---
type: bug
title: "DM decrypt failure destroys the whole session (root cause of 6-month delivery bug) — FIX SPEC"
status: root cause PROVEN live 2026-07-17; fix not yet implemented
created: 2026-07-17
severity: high
repo: quorum-desktop (mobile has the same disease — see cross-platform note)
area: DM delivery / Double Ratchet / MessageService receive pipeline
supersedes-as-actionable: ".agents/bugs/2026-07-02-dm-message-delivery-unreliable-master.md (the full 6-month diagnosis archive; read it for evidence, work from THIS doc for the fix)"
related:
  - ".agents/tasks/2026-07-17-dm-session-reset-and-delivery-fix-plan.md (button shipped PR #234; systemic proposal)"
---

# FIX SPEC: DM decrypt failure destroys the session

This is the **short, actionable** spec for the core fix. The giant master report
(`2026-07-02-...-master.md`) is the diagnosis archive — 5 instrumented live rounds proving the
mechanism. Do not re-read all of it to act; everything needed to implement the fix is here.

## The bug in three sentences

When a single incoming DM frame fails to decrypt (observed live: WASM returns
`Decryption failed: aead::Error` — a one-off ratchet key mismatch from a duplicate/retry/race,
NOT a broken session), the receive pipeline **deletes the entire encryption session and the
server copy of the message**. The sender still holds its session and keeps encrypting into an
inbox the receiver no longer listens to, so every subsequent message is silently dropped
(`!found` branch), with zero error to either user. Result: the conversation direction is dead
permanently until a manual session reset — which itself gets re-killed within minutes of active
use (confirmed twice, 2026-07-17).

## Why this is the real fix (not the reset button)

The Double Ratchet **tolerates a lost/bad frame by design** — later messages use later keys and
decrypt fine. So destroying the session on one failure is pure self-harm: the captured
`aead::Error` frame would have cost exactly one frame (a receipt) and been invisible to the user
if the code had simply skipped it. The reset button (shipped PR #234) is a manual unstick, not a
cure — it re-establishes a session that the same reaction then destroys again.

### Spec confirmation (verified 2026-07-17, not inference)

A security-motivated reading of the current code is "decrypt/AEAD failure could mean tampering,
so tear the session down (fail closed)." The Signal **Double Ratchet specification explicitly
rejects this** for the `RatchetDecrypt` operation:

> "If an exception is raised (e.g. message authentication failure) then the message is discarded
> and changes to the state object are discarded. Otherwise, the decrypted plaintext is accepted
> and changes to the state object are stored."
> — Signal Double Ratchet spec, https://signal.org/docs/specifications/doubleratchet/

So the spec-correct behavior on failure is: **discard the message, leave the saved session state
untouched.** Rejecting the frame IS the complete defense against a tampered/injected message;
destroying the session adds no security (the attacker gains nothing from you keeping the session)
and breaks the protocol's documented tolerance for out-of-order / transient failures. The current
code does the opposite — it persists a mutation (deletes the session) on failure — which is
*non-compliant*. Our fix brings the code INTO spec, it does not weaken it.

## The exact drop sites (current `main`, `src/services/MessageService.ts`)

Two catch blocks in the DM receive section do the damage:

1. **D1 — `DoubleRatchetInboxDecrypt` catch** (~line 3174):
   ```ts
   } catch (decryptError) {
     logger.error('[MessageService] DM decrypt failed (DoubleRatchetInboxDecrypt)', decryptError);
     await this.deleteInboxMessages(keys.receiving_inbox, [message.timestamp], this.apiClient); // deletes server copy
     await this.messageDB.deleteEncryptionState(found);  // ← DESTROYS THE SESSION. This is the bug.
     return;
   }
   ```
2. **D2 — `ConfirmDoubleRatchetSenderSession` catch** (~line 3121): identical shape — deletes
   server message + `deleteEncryptionState(found)`.

Also relevant (silent aftermath, not the trigger):
- **D3b — `if (!found)`** (~line 3073): message for an inbox with no state → deleted unread,
  no log. This is where post-destruction messages vanish. Make it log-and-leave, don't
  delete-and-forget.

## The fix (surgical, minimal — Fix 1)

In both D1 and D2 catch blocks: **do NOT call `deleteEncryptionState(found)`.** Keep the session.
Skip the one bad frame. Decision to make (small):
- Deleting the *server copy* of the poison frame (`deleteInboxMessages`) is arguably fine to keep
  — a frame that can't be decrypted is useless and leaving it invites redelivery→refail loops.
  Recommend: KEEP the server-delete, DROP the session-delete. That's the whole Fix 1.
- Log loudly (keep the `logger.error`) so the skip is visible.

That single change (remove two `deleteEncryptionState` calls) is expected to stop the
every-few-minutes death entirely, because a transient `aead::Error` stops being fatal.

## Follow-on fixes (separate, optional, after Fix 1 proves out)

- **Fix 2 — dedupe before decrypt:** track recently-processed (inbox, timestamp) pairs; skip +
  ack duplicates so retry/redelivery frames never reach the ratchet. Kills the trigger class.
- **Fix 3 — auto-heal:** after N *consecutive* failures on one session (true de-sync, not a
  one-off), do what the reset button does automatically (delete state → next msg re-inits).
- **Fix 4 — un-silence D3b / D3a** (log-and-leave).

Keep Fix 2/3 decision logic PURE (no storage/transport) so it can later be extracted to
quorum-shared if the lead-dev wants mobile parity (see the fix plan doc). Desktop-local for now.

## Test criteria (using the `[DMTRACE]` kit on branch `debug/dm-delivery-trace`)

Two browser profiles, chat numbered messages. Pass = when a `🔴 decrypt failed` fires,
subsequent messages on the SAME session **keep being delivered** (no `NO STATE` cascade, no
dead direction). Before Fix 1 the session dies; after, it survives the bad frame. This is
directly observable without deep log reading — messages simply keep landing.

## Cross-platform note

Mobile has the identical destroy-on-failure behavior (its Reset Session button is the proof the
team has met this). Fixes 1-4 are transport-agnostic receive logic and apply conceptually to
mobile too; propose to lead-dev after Fix 1 is validated on desktop.

---
*Created: 2026-07-17*
