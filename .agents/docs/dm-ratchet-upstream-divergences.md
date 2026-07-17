---
type: doc
title: "DM Double Ratchet fixes — divergences from the original upstream implementation"
status: done
created: 2026-07-17
---

# DM Double Ratchet fixes — divergences from the original implementation

**Purpose of this document:** in July 2026 we changed two behaviors of the DM receive/send
pipeline in `src/services/MessageService.ts` that diverge from how the code was originally
written. Both changes fix the long-standing (~6 months) "DM messages silently never arrive"
bug. This document is the self-contained justification for those changes, written so it can
be handed to the lead dev at any point in the future without requiring them to read the full
bug archive. Every behavioral claim is backed by the Signal Double Ratchet specification
(https://signal.org/docs/specifications/doubleratchet/), not by our own reasoning about crypto.

Full evidence trail (5 instrumented live rounds, dual-log captures, live verification):
`.agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md`.

---

## Divergence 1 — decrypt failure no longer destroys the session

**Shipped:** PR #235 (2026-07-17).

**Original behavior:** in the DM receive section, both decrypt-failure catch blocks
(`DoubleRatchetInboxDecrypt` and `ConfirmDoubleRatchetSenderSession`) deleted the server copy
of the frame AND called `deleteEncryptionState(found)` — destroying the whole session on a
single failed frame.

**New behavior:** on decrypt failure, the frame is skipped (server copy still deleted, loud
error logged) and the session is KEPT.

**Why the original behavior was the root cause of the delivery bug:** the sender still holds
its session and keeps encrypting to the same session inbox. After the receiver destroyed its
state, every subsequent message hit the `!found` branch and was deleted unread with no log.
After the next reconnect the client did not even re-listen on that inbox (the listen set is
built from `encryption_states` rows). Result: the conversation direction died permanently,
with zero errors on either side — exactly the reported symptom shape ("first message lands,
later ones vanish, stays bad once bad"). Proven live with instrumented rounds, and the fix
was confirmed live: the same session now survives decrypt failures and keeps delivering.

**Why keeping the session is not a security regression.** The plausible rationale for the
original code is "AEAD failure could mean tampering, so fail closed and tear the session
down." The Double Ratchet specification explicitly prescribes the opposite for
`RatchetDecrypt`:

> "If an exception is raised (e.g. message authentication failure) then the message is
> discarded and changes to the state object are discarded. Otherwise, the decrypted
> plaintext is accepted and changes to the state object are stored."

Rejecting the frame IS the complete defense against a tampered or injected message — the
attacker gains nothing from the receiver keeping its session, and the protocol is designed to
tolerate bad/duplicate/out-of-order frames precisely this way (later messages use later keys
and decrypt fine). Destroying the session converts a one-frame loss into a permanently dead
conversation while adding no security. The original code additionally *persisted a state
mutation on failure* (the deletion), which is what the spec forbids. Our change brings the
code INTO spec compliance.

---

## Divergence 2 — all ratchet state operations serialized per conversation

**Shipped:** branch `fix/dm-ratchet-serialization` (2026-07-17). Key pieces:
`src/utils/keyedMutex.ts` (per-key FIFO async lock) + lock acquisition at every DM ratchet
critical section in `MessageService.ts`.

**Original behavior:** five independent code paths each performed
read-state → encrypt/decrypt → save-state on the same `encryption_states` row with no
coordination:

1. receive decrypt (`handleNewMessage` — state read at the top, saved ~1,400 lines of awaited
   code later),
2. text send / edit (`submitMessage` DM branch),
3. automatic retry (`retryDirectMessage`),
4. delivery/read receipt sends (`encryptAndSendDm` via the action queue),
5. typing indicator sends (`sendEphemeralDMControl` → `encryptAndSendDm`, fired on keystrokes).

**New behavior:** every one of those sections runs under
`dmRatchetMutex.runExclusive(conversationId, …)`. Additionally, the receive path re-reads the
state row inside the lock (its pre-lock snapshot may be stale after waiting) and persists the
advanced state immediately after a successful decrypt instead of at the tail of the handler.

**Why this was necessary:** Double Ratchet state is strictly linear — the spec models
encrypt/decrypt as sequential mutations of a single state object, and the ratchet's security
(and correctness) depends on each operation starting from the latest stored state. Two
concurrent operations that read the same snapshot fork the state: whichever save lands last
silently erases the other's advance. The peer then cannot derive message keys for the erased
branch, and frames fail with `aead::Error`. A collision that erases a DH step or an inbox
rotation forks the session permanently. This was observed live as the deterministic repro
"reset session → messages 1 and 2 land → from message 3 nothing lands", triggered reliably
once the receipts feature began firing an encrypted send within milliseconds of every
received message (i.e., inside the receive handler's read-to-save window). After
serialization: 10/10 numbered messages per direction with receipts and typing enabled, zero
drops, zero stuck sends.

**On the immediate post-decrypt save** — this is also spec-motivated: "the decrypted
plaintext is accepted and changes to the state object are stored" is one atomic step in
`RatchetDecrypt`. Deferring the save to the end of a long handler created a multi-await
window in which a concurrent send could read the pre-decrypt state and erase the receive
advance.

**Implementation notes relevant to review:**
- `KeyedMutex` is ~40 lines of pure TypeScript with no dependencies, FIFO per key, keys are
  `conversationId`. Deliberately extractable to `quorum-shared` for mobile parity.
- The lock is NEVER held across socket delivery. The outbound queue's callbacks themselves
  take the lock, so holding it until delivery is a circular wait (we hit this in the first
  iteration — both directions froze at "Sending…"; fixed and regression-tested). The trap:
  an async lock callback returning the delivery promise gets auto-flattened, silently
  extending the critical section until delivery.
- Regression tests: concurrent sends must strictly alternate read→save→read→save (fails on
  the unserialized code), and a stalled outbound queue must not prevent a second send from
  reaching its encrypt+save (fails on the lock-across-delivery code).

---

## Divergence 3 — stale init envelopes are refused instead of installed

**Shipped:** branch `chore/dm-reset-signal-logging` (2026-07-17).

**Original behavior:** an incoming initialization envelope (the "here is our new session"
message that establishes or re-establishes a DM session) unconditionally replaced the
receiver's existing session for that device tag, in complete silence.

**New behavior:** an init envelope is installed only if it is strictly newer than the session
rows it would replace. Concretely (`src/utils/initEnvelopeGuard.ts`, pure and unit-tested):
an envelope whose timestamp exactly matches an existing row is a redelivery of an
already-processed envelope and is refused; an envelope older than the newest existing row
beyond a 2-minute clock-skew tolerance is refused. Refused envelopes are deleted from the
server. Malformed envelopes with no resolvable sender address are also dropped. Every
replacement, refusal, and reset signal is now logged at warning level.

**Why this was necessary — this was the dominant cause of the 6-month delivery bug.** The
server retains every inbox frame until the client explicitly deletes it, and those deletions
can fail (`POST /inbox/delete` returning 502 was captured live). An undeleted init envelope
is therefore redelivered on any reconnect — and *successfully re-processing* it replaced the
receiver's CURRENT healthy session with a resurrected old one that the sender no longer
holds. Captured live 2026-07-17: redelivered init envelopes up to 60 days old, replayed on
every hard refresh, each silently killing the fresh session (receiver console completely
silent afterward, because frames to the now-unknown inboxes never reach the app). This is
why conversations kept dying minutes after every manual session reset: each reset planted
the next mine. After the guard: hard refreshes no longer kill sessions, verified live.

Note the security framing: the guard does not weaken session establishment — a genuine
re-init always carries a timestamp newer than the rows it replaces, so legitimate resets are
unaffected. It removes a replay hazard (old envelopes being honored) that the unconditional
install created.

## Minor divergence — the `!found` branch now logs

Frames addressed to an inbox with no encryption state were deleted unread with no log of any
kind. This total silence hid the aftermath of mechanism 1 for six months. The branch still
deletes (leaving the frame would redeliver it forever) but now logs a loud warning with the
truncated inbox address and timestamp.

---

## What we propose upstream / for mobile

**Mobile status, verified in code 2026-07-17** (`quorum-mobile/services/crypto/encryption-service.ts`):
mobile does NOT have Divergence 1's bug — its decrypt-failure handling already returns null
or throws WITHOUT persisting anything (it even carries a comment warning against saving
corrupted state), so mobile was already spec-compliant there and nothing needs porting.
Mobile DOES share the Divergence 2 gap: no lock exists around its ratchet state operations,
its decrypt is an awaited native call between state read and write, and its delivery/read
receipts also ride the DM ratchet. MMKV's synchronous storage narrows the race window but
does not remove it. Concrete proposal:

1. `KeyedMutex` is DONE in shared (#59, 2.1.0-35); mobile serializes its ratchet operations
   per its task: `quorum-mobile/.agents/tasks/2026-07-17-serialize-dm-ratchet-state-keyedmutex.md`.
   The mobile task includes a recon item a JS mutex cannot cover: Android's
   `BackgroundMessageService` runs in a separate JS context; if it can decrypt the same
   inbox as the foreground app, that cross-context race needs a lead-dev-level decision.
2. **Divergence 3 on mobile (verified in mobile code 2026-07-17): partially protected by
   design.** Mobile's init handling checks an ephemeral-key cache and tries the existing
   session before falling through to fresh X3DH, so redelivery of the CURRENT session's
   envelope cannot nuke it. An OLDER distinct envelope (from a previous reset epoch) that
   fails existing-session decrypt and falls through to X3DH may still install a stale
   session over a newer one — recon item in the mobile task. If confirmed,
   `isStaleInitEnvelope` is pure and extractable to quorum-shared so both platforms share
   the identical staleness rule.
3. Optional hardening, desktop and mobile: dedupe-before-decrypt cache (redelivered frames
   currently fail AEAD harmlessly but noisily — deferred, see
   `.agents/tasks/2026-07-17-dm-dedupe-before-decrypt.md`), folding session reset
   (`deleteEncryptionStates`) under the same lock, and automatic resend on missing delivery
   receipts (`.agents/tasks/2026-07-17-dm-dead-session-autoheal.md` — the highest-value
   follow-up; converts residual single-frame wire losses into invisible recoveries).
4. **Server-side:** `POST /inbox/delete` intermittently returns 502 Bad Gateway. Failed
   deletes are the enabler of the whole redelivery class; worth a server-side look.

---
*Created: 2026-07-17 — Last updated: 2026-07-17*
