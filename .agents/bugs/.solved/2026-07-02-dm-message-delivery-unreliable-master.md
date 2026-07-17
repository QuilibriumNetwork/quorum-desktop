---
type: bug
title: "DM messages between users intermittently never arrive (master report)"
status: RESOLVED 2026-07-17 — both mechanisms fixed and live-verified. (1) Session destruction on decrypt failure: fixed, PR #235. (2) aead::Error frame drops from unserialized ratchet state: fixed on branch fix/dm-ratchet-serialization, live-verified 10/10 messages per direction with receipts + typing on. This report is the consolidated summary + diagnosis archive.
created: 2026-07-02
severity: high
repo: quorum-desktop (primary; mobile has the same patterns — see "Remaining gaps")
area: DM delivery / Double Ratchet sessions / WebSocket transport
user-confirmed: "reproduced desktop↔desktop AND desktop↔mobile; ~6 months standing; first message lands, subsequent ones often don't; dead direction stays dead"
related:
  - ".agents/bugs/.solved/2026-07-17-dm-decrypt-failure-destroys-session-FIX-SPEC.md (Fix 1: stop destroying the session on decrypt failure — PR #235)"
  - ".agents/bugs/.solved/2026-07-17-dm-aead-error-frame-drops.md (Fix 2: serialize ratchet state operations — branch fix/dm-ratchet-serialization)"
  - ".agents/tasks/2026-07-17-dm-session-reset-and-delivery-fix-plan.md (Reset Session button — PR #234)"
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md (DM internals + identity debug ladder)"
  - ".agents/tools/dm-debug/ (console snippets 01-06 + log-points.md — historical debug kit)"
---

# DM message delivery is unreliable (master report)

**One-line:** for ~6 months, DMs intermittently never arrived, with no error, no retry, and no
signal to either user; once a conversation direction "went bad" it stayed dead until a manual
session reset. Root-caused and fixed 2026-07-17 as two cooperating defects, both in
`src/services/MessageService.ts`.

---

## 1. Resolution summary

| # | Mechanism | Effect | Fix | Status |
|---|---|---|---|---|
| 1 | **Session destruction on decrypt failure.** One bad frame → the receive pipeline deleted the entire Double Ratchet session (and the server copy of the frame). The sender kept encrypting into an inbox the receiver no longer had state for → every later message silently deleted (`!found` branch). | Conversation direction permanently dead | Both decrypt-failure catch blocks skip the frame and KEEP the session (Signal spec compliance) | SHIPPED, PR #235, live-verified |
| 2 | **Unserialized ratchet state read-modify-write.** Five paths (receive decrypt, text send/edit, retry, receipt sends, typing sends) each did read-state → ratchet-op → save-state with no coordination. Concurrent ops read the same snapshot; the losing save erased the winner's advance → the peer could no longer derive keys → `aead::Error` on subsequent frames; one bad collision forked the session permanently ("msg 1 & 2 land, from msg 3 nothing lands"). | Individual frames dropped; under receipts, full one-direction death within ~3 messages | Per-conversation FIFO mutex (`src/utils/keyedMutex.ts`) around every ratchet critical section + receive path re-reads state inside the lock and saves immediately after decrypt | SHIPPED, branch `fix/dm-ratchet-serialization`, live-verified |

**Why receipts "caused" it:** they didn't — they amplified mechanism 2. The delivery/read
receipt feature fires an encrypted send within milliseconds of every received message, exactly
inside the receive handler's read-to-save window (which spanned ~1,400 lines of awaited code).
A race that previously needed coincidence (typing + send + receive overlapping, two tabs)
became near-deterministic. One 6-month-old bug, not two; receipts made it reproducible.

**Live verification (2026-07-17):** fresh session reset, receipts + typing ON, 10 numbered
messages per direction: all 20 landed, nothing stuck at "Sending…", no dead direction. The old
code reliably died at message 3 under the same protocol. Frames encrypted against a pre-reset
session fail once with `skipping frame, keeping session` and drain harmlessly — expected noise,
not loss.

**Also shipped along the way:**
- **Reset Session button** (PR #234) — manual recovery valve, still useful.
- **Un-silenced `!found` drop** — the silent delete-unread branch now logs loudly.
- **Deadlock lesson (first fix iteration):** holding the conversation lock until socket delivery
  deadlocks against the outbound queue (whose callbacks take the same lock). Subtle trap: an
  async lock callback that returns the delivery promise gets auto-flattened, silently extending
  the critical section until delivery. Fixed by wrapping the returned promise in an object;
  regression-tested. If you ever see both directions stuck at "Sending…" again, start here.

## 2. What a future reader needs to know (the invariants)

1. **Double Ratchet state is strictly linear.** Every encrypt/decrypt must read the LATEST
   saved state, advance it, and save. Two operations from the same snapshot fork the ratchet.
   All DM ratchet operations must go through `dmRatchetMutex.runExclusive(conversationId, …)`
   — see `src/utils/keyedMutex.ts` and the five call sites in `MessageService.ts`.
2. **Decrypt failure = skip the frame, keep the session.** Signal Double Ratchet spec: "If an
   exception is raised then the message is discarded and changes to the state object are
   discarded." Destroying the session on failure is non-compliant self-harm.
   (https://signal.org/docs/specifications/doubleratchet/)
3. **Accept plaintext + store state is ONE atomic step.** The receive path saves the advanced
   state immediately after successful decrypt, inside the lock — never at the end of the
   handler.
4. **Never hold the ratchet lock across delivery.** The outbound queue only drains on an open
   socket and its callbacks take the same lock; awaiting delivery inside the lock is a
   circular wait.

## 3. Remaining known gaps (for lead dev)

- **Two tabs / same account:** two JS contexts race each other; the in-process mutex cannot
  arbitrate. Needs Web Locks API or single-instance enforcement. Pre-existing, low priority.
- **Session reset not under the lock:** `deleteEncryptionStates` racing an in-flight decrypt
  could resurrect a deleted row. Rare; worth folding under the mutex eventually.
- **Mobile parity (verified in mobile code 2026-07-17):** mobile does NOT have the
  destroy-on-failure bug (its decrypt failure already returns null without persisting), but
  it DOES have the unserialized read-modify-write gap (no lock, awaited native decrypt
  between read and write, receipts ride the ratchet). Tasks created:
  `.agents/tasks/2026-07-17-quorum-shared-add-keyedmutex.md` (shared util) and
  `quorum-mobile/.agents/tasks/2026-07-17-serialize-dm-ratchet-state-keyedmutex.md`.
- **Redelivery duplicates:** the server re-pushes undeleted frames on re-listen; duplicates
  always fail AEAD (key already consumed), get skipped and deleted. Harmless but noisy; a
  dedupe-before-decrypt cache would silence it.

---

## 4. Diagnosis archive (historical — how it was found)

Five instrumented live rounds (2026-07-02 → 2026-07-17), two desktop accounts, `[DMTRACE]`
probe kit on branch `debug/dm-delivery-trace`, console snippets in `.agents/tools/dm-debug/`.

### The receive pipeline (as it was; line anchors from 2026-07-02 master)

```
SENDER                                          RECEIVER
DirectMessage submit
  → MessageService.submitMessage (DM branch)      WS onmessage (WebsocketProvider)
    enumerate inboxes: self devices +               → inbound queue → handleNewMessage
      counterparty devices                            → DM: found = states[message.inboxAddress]
    prune stale sessions                              ├─ msg to own DEVICE inbox → init-envelope
    per inbox: DoubleRatchetInboxEncrypt /            │    + NewDoubleRatchetRecipientSession
      ForceSenderInit / NewSenderSession              ├─ msg to SESSION inbox with state →
    save new ratchet state per session                │    DoubleRatchetInboxDecrypt
    emit frames: {listen} + {direct}                  └─ no state → !found (was: silent delete)
  → enqueueOutbound → ws.send loop                  on success: save state, saveMessage,
    ── NO ack, NO retry ──                            deleteInboxMessages (ack-by-delete)
                                                    SERVER retains inbox messages until the
RECONNECT: resubscribe re-listens ONLY inboxes      client deletes them → redelivery on
present in encryption_states + own device inbox     re-listen is possible
```

Key structural facts that made the bug possible:
- Outbound had no delivery guarantee (frames dequeued before send; errors logged only).
- The server IS a durable inbox — but only if the client still listens on the inbox and never
  deletes what it couldn't read. Both provisos were violated by the drop sites below.
- Sessions are per device-pair: one receiver device can be fine while another is black-holed.

### The drop sites (all in the DM receive section, as found)

| # | Site | On failure it did | Logged? |
|---|---|---|---|
| D1 | `DoubleRatchetInboxDecrypt` catch | deleted server message + WHOLE SESSION | error |
| D2 | `ConfirmDoubleRatchetSenderSession` catch | same | error |
| D3a | init-envelope bare catch | deleted server message | nothing |
| D3b | `!found` (no state for inbox) | deleted server message, unread | nothing |

The black-hole loop (H1, proven live): one decrypt failure → D1 destroys session + message →
sender keeps encrypting to the dead session inbox → receiver hits D3b silently forever → after
reconnect the inbox isn't even listened to. Explained every observed shape: "first message
lands", "stays bad once bad", "no errors anywhere", "asymmetric conversation rows".

### Hypotheses and final verdicts

| # | Hypothesis | Verdict |
|---|---|---|
| H1 | decrypt-fail → session+message destroyed → silent black hole | **CONFIRMED live** (dual-log capture); fixed by PR #235 |
| H1b | individual frames fail `aead::Error` (the trigger feeding H1) | **CONFIRMED**; root cause = unserialized ratchet state RMW, fixed by serialization branch. NOT head-of-line blocking (disproved in code: failed frames are deleted server-side and the inbound loop continues past failures); NOT ack-vs-ack collision (ActionQueue is sequential) — the collision is send-vs-receive and send-vs-send across queues |
| H2 | outbound frames lost at a dying socket | not the primary cause; hardening still worthwhile |
| H3 | stale device registrations → encrypting to dead inboxes | not observed |
| H4 | listen/subscription gap on reconnect | not the primary cause; redelivery duplicates observed as harmless AEAD-fail noise |

### Debug kit (kept for future sessions)

- `.agents/tools/dm-debug/` — console snippets: 01 snapshot, 03 encryption-states diff.
- Branch `debug/dm-delivery-trace` — `[DMTRACE]` probes P1-P6 (send fan-out, encrypt branch,
  ws send/recv, the loud `!found`, decrypt OK) + redelivery detector.
- Repro protocol: two profiles, numbered messages, receipts + typing ON; amplifiers: reconnect
  churn, two tabs, burst sends, sleep/wake.

---
*Created: 2026-07-02 — Last updated: 2026-07-17*
