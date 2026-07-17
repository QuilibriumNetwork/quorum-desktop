---
type: bug
title: "DM messages between users intermittently never arrive (master report + guided debug-session kit)"
status: PARTIALLY RESOLVED 2026-07-17 — session destruction FIXED & shipped (PR #235); aead::Error frame drops root-caused (unserialized ratchet state read-modify-write across five writer paths) with fix implemented on branch fix/dm-ratchet-serialization, awaiting live verification. This report is the DIAGNOSIS ARCHIVE; work items live in the focused docs below.
created: 2026-07-02
severity: high
repo: quorum-desktop (primary; mobile affected too)
area: DM delivery / Double Ratchet sessions / WebSocket transport
user-confirmed: "reproduces desktop↔desktop AND desktop↔mobile (2026-07-02); DMs mostly, channels rarely. Long-standing (~6 months). Pattern: first message lands, subsequent ones often don't."
related:
  - ".agents/bugs/.solved/2026-07-17-dm-decrypt-failure-destroys-session-FIX-SPEC.md (Fix 1 — SHIPPED PR #235: session no longer destroyed on decrypt failure)"
  - ".agents/bugs/2026-07-17-dm-aead-error-frame-drops.md (OPEN — remaining half: individual frames still fail to decrypt)"
  - ".agents/tasks/2026-07-17-dm-session-reset-and-delivery-fix-plan.md (Reset Session button shipped PR #234; systemic proposal)"
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md (DM internals + identity debug ladder)"
  - ".agents/tools/dm-debug/ (console snippets 01-06 + log-points.md)"
  - "quorum-mobile/.agents/bugs/2026-06-13-desktop-to-mobile-messages-fail-decryption-invalid-signature.md (SPACE-path sibling; different transport)"
---

# DM message delivery is unreliable (master report)

> **RESOLUTION STATUS (2026-07-17):** H1 is confirmed the root cause. The bug had TWO mechanisms:
> (1) **session destruction on decrypt failure** — one bad frame tore down the whole session,
> permanently killing a DM direction. FIXED & shipped (PR #235, `MessageService.ts` — the two
> decrypt-failure catch blocks no longer call `deleteEncryptionState`; Double Ratchet spec
> compliance). (2) **frame generation** — individual frames failed to decrypt with
> `aead::Error`. ROOT-CAUSED 2026-07-17 (unserialized ratchet state read-modify-write across
> five send/receive paths; receipts amplified a preexisting race) and FIX IMPLEMENTED on
> branch `fix/dm-ratchet-serialization` (per-conversation mutex) — see the verdict in
> `2026-07-17-dm-aead-error-frame-drops.md`. Also shipped: a manual **Reset Session** button
> (PR #234) as a user-facing recovery valve. This document below is the full diagnosis archive
> (5 instrumented live rounds); the focused docs in the `related:` list are the actionable items.

**One-line:** DMs between two users intermittently never arrive and nothing ever surfaces the
loss — no error, no retry, no signal to the sender. Reproduces **desktop↔desktop** (user-confirmed
2026-07-02), so the root cause is in desktop/shared logic or the server layer, NOT mobile-specific
code. The receive pipeline contains **three code paths that destroy evidence on failure** (delete
the message from the server, and in two of them also delete the encryption session), which both
hides the root cause and plausibly *is* the mechanism that turns one transient failure into a
permanently dead conversation.

This is the missing master report for raw DM delivery. The playbook's "Known sync issues"
section has flagged this cluster since 2026-06-09 ("Regular text DMs occasionally don't arrive…
Root cause not yet identified"); nothing had consolidated it or planned the diagnosis until now.

---

## What we know (evidence, not theory)

- **Reproduces desktop↔desktop** — two accounts, same build, same code. (User-confirmed 2026-07-02.)
- **Also desktop↔mobile**; mobile↔mobile untested. Channels fail too but *rarely* (that path had
  five fixes ship mid-June — see the mobile sibling report); DMs are the big residual.
- **Pattern:** first message of a fresh conversation typically lands; later ones intermittently
  vanish. Once a conversation "goes bad" for one direction it tends to stay bad. This shape fits a
  per-session state problem, not random packet loss.
- **Asymmetric conversation rows** confirmed live 2026-06-09 (A has B in the conversation list,
  B doesn't have A) — same family.
- The send side, when probed in past sessions, logs success — the failure is receive-side or
  transport, per multiple prior instrumented runs (memory: prove send-side with logs, then the
  receive side is where it dies).

## The pipeline (walked in code 2026-07-02 — all anchors current master)

```
SENDER                                          RECEIVER
DirectMessage submit
  → MessageService.submitMessage (DM branch)      WS onmessage (WebsocketProvider.tsx:187)
    enumerate inboxes: self devices +               → inbound queue → handleNewMessage
      counterparty devices (:2658-2665)               → DM section: found = states[message.inboxAddress] (:2830)
    prune stale sessions (:2666-2671)                 ├─ msg to own DEVICE inbox → init-envelope path
    per inbox:                                        │    UnsealInitializationEnvelope +
      existing session → DoubleRatchetInboxEncrypt    │    NewDoubleRatchetRecipientSession (:2843)
        (:2717) or ForceSenderInit (:2705)            ├─ msg to a SESSION inbox with state →
      no session → NewDoubleRatchetSenderSession      │    DoubleRatchetInboxDecrypt (:3074)
        (:2730)                                       └─ no state for that inbox → `!found` (:3012)
    save new ratchet state per session (:2747+)
    emit frames: {type:'listen'} + {type:'direct'}  on success: save state, saveMessage, addMessage,
      (:2763, :2768)                                  deleteInboxMessages (ack-by-delete)
  → enqueueOutbound → processOutbound
    ws.send loop (WebsocketProvider.tsx:140-147)   SERVER retains each inbox message until the
    ── NO ack, NO retry ──                          client explicitly deletes it → redelivery on
                                                    re-listen is possible IF the client still listens
RECONNECT: resubscribe re-listens ONLY inboxes      on that inbox (MessageDB.tsx:495-526: listen set =
present in encryption_states + own device inbox     all encryption_states inboxIds + device inbox)
```

Key structural facts:

1. **Outbound has no delivery guarantee.** `processOutbound` dequeues, then `ws.send(m)` in a loop
   (`WebsocketProvider.tsx:128-155`). If the socket dies mid-batch or `send` fails, the frames are
   already dequeued — gone. Errors go to `console.error` only. (An old solved bug,
   `2025-12-19-websocket-processqueue-stuck-blocking-outbound.md`, was in this same layer.)
2. **The server IS a durable inbox.** Clients explicitly `deleteInboxMessages` after processing.
   So receive-side transport gaps *should* self-heal on reconnect — **provided the client still
   listens on that inbox and never deletes what it couldn't read.** Both provisos are violated
   below.
3. **Sessions are per device-pair.** A message is separately encrypted for EVERY device of both
   users (`:2658-2665`). One receiver device can be fine while another is black-holed.

## The three silent-drop sites (confirmed in code — the H1 mechanism)

All in `MessageService.ts`, DM receive section:

| # | Site | On failure it does | Logs? |
|---|---|---|---|
| D1 | established-session decrypt fails (`DoubleRatchetInboxDecrypt` catch, ~`:3115`) | deletes the message **from the server** + **deletes the whole encryption state** | `logger.error('[MessageService] DM decrypt failed (DoubleRatchetInboxDecrypt)')` |
| D2 | sender-session confirm fails (`ConfirmDoubleRatchetSenderSession` catch, ~`:3059`) | same: deletes message + encryption state | `logger.error('… (ConfirmDoubleRatchetSenderSession)')` |
| D3a | init-envelope path fails (bare `catch` ~`:3002`) | deletes the message from the server | **NOTHING** (also `Failed to decrypt message with any known state` console.error just above, for the no-state fallthrough) |
| D3b | message arrives for an inbox with **no** state (`if (!found)` ~`:3012`) | deletes the message from the server | **NOTHING** |

**The black-hole loop these compose (leading hypothesis H1):**

1. ONE decrypt failure on an established session — any transient cause: an out-of-order frame, a
   state-save race (two tabs / two own devices), a crash between decrypt and state persist →
2. D1 fires: the message is destroyed server-side AND the local session state is destroyed →
3. the SENDER still has its session and keeps encrypting to the same session inbox →
4. receiver now has no state for that inbox → every subsequent message hits **D3b: silently
   deleted, zero trace** →
5. after the next reconnect it's even quieter: resubscribe only re-listens inboxes present in
   `encryption_states` (`MessageDB.tsx:495-526`) — the deleted session's inbox **isn't listened to
   at all**, messages just accumulate server-side (or age out) →
6. no signal ever reaches the sender; the direction stays dead until something re-inits the
   session (e.g. conversation delete, which since desktop PR #222 / mobile PR #144 signals a
   session reset).

This mechanism explains every observed shape: "first message lands" (fresh init), "later ones
don't" (post-desync), "stays bad once bad" (state deleted + not listening), "no errors anywhere"
(D3b is fully silent), and "asymmetric conversation rows" (one direction's session dead, the
other's alive).

## Ranked hypotheses (what the session must discriminate)

| # | Hypothesis | Where it dies | Predicted session signature |
|---|---|---|---|
| **H1** | decrypt-fail → session+message destroyed → silent black hole (mechanism above) | receiver | ONE `DM decrypt failed` error at the moment the conversation "goes bad", then nothing for later messages; an `encryption_states` row disappears (03-snippet diff); sender logs keep claiming success |
| **H2** | outbound frames lost at a dying socket (no ack/retry) | sender WS | sender's send-loop probe shows fewer frames sent than produced, or send during `readyState !== OPEN`; receiver sees nothing; NOT correlated with one conversation — random |
| **H3** | fan-out wrong: stale counterparty `device_registrations` → encrypts to dead/old inboxes | sender enumeration | sender probe shows an inbox list that doesn't match the receiver's actual device inbox; receiver sees nothing; consistent per device-pair |
| **H4** | listen/subscription gap: receiver not subscribed to a live session inbox (reconnect ordering, listen frame lost) | receiver WS | receiver console silent; message NOT deleted server-side; message suddenly arrives after a hard reload (re-listen + server redelivery) — the "healed by restart" tell |

---

## Phase 1 — guided debug session (desktop↔desktop)

**Goal:** catch ONE vanished message in the act and read which hypothesis it is. Two desktop
accounts (call them A and B), each in its own browser profile/window, DevTools open on BOTH.

### Part 0 — setup (5 min)

1. Run both clients from the dev build (`yarn dev`) so probes hot-reload. Two browser profiles.
2. Both DevTools consoles: log level **All levels** (the #1 wasted-time gotcha, see playbook).
3. On BOTH sides paste `.agents/tools/dm-debug/03-encryption-states.js` → screenshot/save the
   output. This is the "before" state baseline.
4. Optional but valuable: `.agents/tools/dm-debug/01-snapshot.js` on both, save the JSON.

### Part 1 — zero-edit pass (no code changes; 10 min)

The D1/D2 sites already log. Just chat:

1. A→B and B→A alternately, one short numbered message every few seconds ("a1", "b1", "a2"…).
   Numbering makes gaps visible instantly.
2. The moment a message doesn't appear on the other side, STOP and check, on the RECEIVER:
   - Console has `DM decrypt failed (DoubleRatchetInboxDecrypt)` or `(ConfirmDoubleRatchetSenderSession)`?
     → **H1 confirmed at the trigger moment.** Re-run snippet 03: an `encryption_states` row for
     that conversation is now missing/changed vs the baseline → the black-hole loop has started.
     Keep sending 2-3 more from the same sender: they should now vanish with NO log at all (D3b) —
     that silence + the earlier single error is the full H1 signature.
   - Console has `Failed to decrypt message with any known state`? → H1 via the init path (D3a).
   - Console completely silent? → H2/H3/H4; go to Part 2.
3. Also worth trying immediately: **hard-reload the receiver** (Ctrl+Shift+R). If the missing
   message then appears → the server still had it and redelivered on re-listen → **H4**
   (subscription gap), and the session is healthy.

### Part 2 — instrumented pass (six `[DMTRACE]` probes; ~15 min)

Add these `console.log` lines (tag everything `[DMTRACE]` so stripping is one search). Locations
are anchored by searchable strings, not line numbers.

**Sender side, `src/services/MessageService.ts`, DM branch of `submitMessage`:**

P1 — after the `inboxes` array is built (search `counterparty.device_registrations.map`):
```ts
console.log('[DMTRACE] send fan-out', {
  msg: (message.content as any)?.text?.slice?.(0, 12),
  inboxes: inboxes.map(i => i.slice(0, 10)),
  myDeviceInbox: keyset.deviceKeyset.inbox_keyset.inbox_address.slice(0, 10),
});
```

P2 — inside the per-inbox loop, one line per branch (search `DoubleRatchetInboxEncryptForceSenderInit`
in the DM branch):
```ts
console.log('[DMTRACE] encrypt', { inbox: inbox.slice(0,10), path: 'existing' /* or 'forceInit' / 'newSession' per branch */ });
```

P3 — `src/components/context/WebsocketProvider.tsx`, in `processOutbound`'s send loop (search
`wsRef.current.send(m)`):
```ts
const t = JSON.parse(m)?.type;
console.log('[DMTRACE] ws send', { type: t, readyState: wsRef.current.readyState });
```
and in its `catch`: `console.warn('[DMTRACE] ws send FAILED', error);`

**Receiver side:**

P4 — `WebsocketProvider.tsx` `ws.onmessage` (search `messageQueue.current = [`):
```ts
console.log('[DMTRACE] ws recv', { inbox: (JSON.parse(event.data)?.inboxAddress ?? '').slice(0, 10) });
```

P5 — `MessageService.ts`, the `if (!found)` branch (search `if (!found) {` in the DM section) —
**this is the silent black-hole branch, make it loud:**
```ts
console.warn('[DMTRACE] NO STATE for inbox — deleting msg unread (D3b)', message.inboxAddress.slice(0, 10));
```

P6 — just after a successful decrypt (search `decryptedContent = JSON.parse(result.message)`):
```ts
console.log('[DMTRACE] decrypt OK', { text: (decryptedContent as any)?.content?.text?.slice?.(0, 12) });
```

Repeat the numbered-message chat. **For the first message that vanishes, write down the last
`[DMTRACE]` line seen on each side** and read the verdict:

| Sender shows | Receiver shows | Verdict |
|---|---|---|
| fan-out + encrypt + `ws send` OK | `ws recv` + `decrypt failed` error | **H1 trigger** — capture the exception text; then later messages show `ws recv` + P5 (`NO STATE`) = black hole running |
| fan-out + encrypt + `ws send` OK | `ws recv`, then P5 immediately (no prior decrypt-fail this session) | **H1 aftermath** — the session died in a previous session/reload; snapshot 03 to confirm the missing state row |
| fan-out + encrypt, but `ws send` missing / FAILED / `readyState != 1` | nothing | **H2** — outbound loss |
| fan-out shows an inbox set that doesn't include the receiver's device inbox (compare with receiver's 03 output) | nothing | **H3** — stale registrations |
| everything OK on sender | nothing at all, but hard-reload makes the message appear | **H4** — listen gap |

### Part 3 — amplifiers (if it won't reproduce on demand)

The bug is intermittent; these recreate its suspected triggers deliberately:

- **Reconnect churn:** toggle the receiver's network off/on (DevTools → Network → Offline) between
  messages — exercises the resubscribe path (H4) and out-of-order delivery (H1 trigger).
- **Two tabs, same account:** open the receiver account in a second tab — two clients racing on
  the same inboxes/states is a classic ratchet-desync trigger (H1).
- **Burst sends:** send 5 messages as fast as possible — exercises ordering.
- **Sleep/wake:** leave the receiver idle 10+ min (or sleep the laptop), then send.

### Deliverable of the session

For each vanished message: the last-probe-seen row, the receiver's exception text if H1, and the
before/after 03-snapshot diff. Paste into this report under a "Session results" heading.

---

## Fix directions (conditional on the session, but H1's are already justifiable)

The three drop sites are defects **regardless** of which hypothesis wins — destroying an
unreadable message AND the session, silently, is wrong in an E2E system with a durable server
inbox. Direction, in order of value:

1. **Stop destroying evidence.** On decrypt failure: do NOT delete the message from the server,
   do NOT delete the encryption state, DO log loudly. Quarantine (skip + leave on server) so a
   later fix / session reset can recover it. Make D3b (`!found`) log-and-leave instead of
   delete-and-forget.
2. **Self-heal: session-reset request.** The reset machinery already exists (conversation delete
   signals the counterparty to reset the session — desktop PR #222 / mobile PR #144). On repeated
   decrypt failure for a session, send the counterparty a "re-init this session" control message
   instead of dying silently; on re-init, sender resends what the receiver never acked (the server
   inbox still holds it if #1 is done).
3. **Outbound reliability (H2):** don't dequeue until `ws.send` succeeded on an OPEN socket;
   re-queue on failure. Small change in `processOutbound`.
4. **Listen-set hardening (H4):** re-listen should not depend solely on `encryption_states`
   rows surviving; consider listening on all conversation inboxes + device inbox, and re-sending
   the listen frame after any state mutation.

**Do not** jump straight to a rewrite of session handling — run the session first; the fix that
matters is the one matching the observed drop site.

---

## Cross-references

- SPACE-path sibling (channels; different transport, already heavily fixed in June):
  `quorum-mobile/.agents/bugs/2026-06-13-desktop-to-mobile-messages-fail-decryption-invalid-signature.md`
- DM internals + identity ladder: `.agents/docs/debugging/dm-architecture-and-debug-playbook.md`
- Console snippets: `.agents/tools/dm-debug/` (01 snapshot, 03 encryption states are the two this
  session uses)
- Mobile memory anchors: `dm-cross-device-sync-unreliable-blocks-testing`,
  `dm-control-msg-single-session-vs-alldevices-transport`

---
*Created: 2026-07-02*
