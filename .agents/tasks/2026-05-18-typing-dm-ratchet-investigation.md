---
type: task
title: "Investigate & decide: Double Ratchet state advance on DM typing"
status: open
created: 2026-05-18
updated: 2026-05-18
related_docs:
  - .agents/docs/features/messages/typing-indicators.md
  - .agents/docs/cryptographic-architecture.md
related_tasks:
  - .agents/tasks/2026-05-18-typing-indicators-design.md
---

# Investigate: Double Ratchet state advance on DM typing

## Problem statement

The PR-level code review of the typing-indicators feature flagged that every DM typing-start / typing-stop signal advances the Double Ratchet state and writes a new encryption-state row to IndexedDB.

Source: `src/services/MessageService.ts` `encryptAndSendDm` (called by `sendEphemeralDMControl`) calls `DoubleRatchetInboxEncrypt` and then `messageDB.saveEncryptionState(newEncryptionState, true)` for each target inbox session.

The reviewer's concern: with active typing in a DM, a user generates roughly one ratchet advance every 5 seconds (the throttle window). Over time this could bloat the encryption-states table. The reviewer cited the existing known bloat issue (see the `window.__messageDB.analyzeEncryptionStates()` debug helper in `MessageDB.tsx`) and recommended switching to a piggyback-only model like delivery-acks use.

## Open questions before any code changes

1. **What does `saveEncryptionState(state, true)` actually do?** The second parameter `true` suggests overwrite semantics. If the row is keyed by `(inboxId, conversationId)` and rewritten in place, there is no row growth, only repeated writes to the same row. That changes the impact assessment from "bloat" to "write churn".

2. **What's the actual frequency in a typing session?** The throttle is 5 seconds for typing-start. A typing-stop fires on send/blur/visibility-hidden. A user typing continuously for one minute generates ~12 typing-starts. A user typing in bursts (the realistic pattern) generates fewer. Compare to message frequency in an active DM (a few per minute when chatty).

3. **What does the existing receipts feature do?** Delivery acks have two paths: piggyback (no extra ratchet advance, rides on outgoing DM) and standalone (advances ratchet, sent after a 10-second idle). Standalone acks for a chatty conversation are bounded but for sparse conversations could fire repeatedly. How has receipts handled this in practice? Is there documented evidence of bloat from standalone acks?

4. **Is there a way to encrypt without advancing the ratchet?** If the SDK exposes a non-stateful "encrypt this with the current ratchet root key" variant, typing could ride on the same envelope without advancing. (Probably not — the whole point of the Double Ratchet is forward secrecy through ratchet advance — but worth confirming.)

5. **What measurable bloat is actually occurring?** Has anyone observed the `encryption_states` row count grow unboundedly during heavy typing? Or is it stable per-session?

## Design options if a fix is needed

### Option A: Piggyback-only DM typing
- Typing fields ride on the next outbound real DM as extra envelope fields (same as `ackMessageIds` does for delivery receipts)
- Trade-off: typing indicator only shows when the typer is ALSO sending other messages, which is the case the indicator exists for the absence of. Probably defeats the purpose for DMs.
- Verdict: would not work as primary mechanism for typing.

### Option B: Piggyback + bounded standalone
- Default to piggyback. Send a standalone typing-start only when there has been no outbound DM in the last N seconds.
- More complex coordination logic. Need to define when piggyback expires and standalone fires.
- Trade-off: still uses ratchet for standalone path, just less often.

### Option C: Separate cheap channel
- Investigate whether the SDK has a non-ratcheting send option for ephemeral DMs
- Or use a different transport (hub-like broadcast scoped to the pair) — would require new key material and protocol work
- Probably the cleanest solution but a large engineering investment

### Option D: Accept the cost
- If the impact assessment (questions 1-5 above) shows the ratchet writes are within normal operating envelope, document the trade-off and ship as-is
- Add monitoring: log encryption-state row count periodically in a dev-only diagnostic

### Option E: Disable DM typing entirely
- Keep typing indicators only for spaces (where the path is hub-envelope-only, no ratchet advance)
- Loses half the feature but eliminates the risk entirely

## Recommended next steps

1. **Measure first.** Before any code change, instrument a session: log encryption-state row count before and after a 10-minute active typing session in a DM. Confirm or refute the bloat hypothesis.
2. **Read the SDK** to understand whether `saveEncryptionState(state, true)` is overwrite or append, and whether the SDK exposes a non-advancing encrypt.
3. **Compare to receipts standalone path.** Read `ActionQueueHandlers.sendDeliveryAck` and trace what happens in practice when a user receives many DMs without sending any (forcing standalone delivery-acks). If receipts has a documented bloat issue, that's evidence; if not, that's evidence too.
4. **Decide between options A-E** based on measurements + SDK behavior.
5. **If a fix is chosen, design the wire-format change** (piggyback fields on outgoing DMs) in a separate spec.

## Out of scope for this investigation

- Anything affecting space-channel typing. That path is hub-envelope-only and does not advance any ratchet.
- The receive-side flow. The interception in `processDeliveryReceiptData` is unchanged regardless of how the send path works.

## When this becomes a real issue (red flags to watch for)

- User reports of slow DM open times in conversations with heavy historical typing
- IndexedDB size growing unexpectedly between sessions
- Encryption-state row count exceeding ~100 per active conversation
- The existing `analyzeEncryptionStates()` helper reporting anomalies

---

*Created: 2026-05-18 — deferred from the typing-indicators code review (`feat/msg-typing-indicator` branch). The PR reviewer flagged this as the highest-severity finding; this task captures the investigation needed before deciding on a fix.*
