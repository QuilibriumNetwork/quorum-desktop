---
type: task
title: "Investigate & decide: Double Ratchet state advance on DM typing"
status: resolved
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

## Investigation findings (2026-05-18)

Answers grounded in the current code on `feat/msg-typing-indicator`.

### Q1 — `saveEncryptionState(state, true)` semantics

[`src/db/messages.ts:1329-1353`](src/db/messages.ts#L1329-L1353) → `encryption_states` is keyed by **`['conversationId', 'inboxId']`** (object store created at [`src/db/messages.ts:197-199`](src/db/messages.ts#L197-L199)) and the save is an IndexedDB `put`. The `wasFirstAttempt` flag only controls whether `latest_states` is *also* updated; it does **not** branch the history-store write.

In [`encryptAndSendDm`](src/services/MessageService.ts#L686-L698) the row's `inboxId` is `session.receiving_inbox.inbox_address` — i.e. the *counterparty's* inbox address, which is stable across Double Ratchet advances within the same session (it rotates only on `Inbox Key Rotation` events, [`cryptographic-architecture.md:242+`](.agents/docs/cryptographic-architecture.md#L242)).

**Conclusion:** every ratchet advance on a DM **overwrites the same row in place**. There is no row growth from typing. The cost per typing message is *write churn on a single row* (plus a `latest_states` write), not table bloat.

### Q2 — Actual frequency

Throttle = 5 s per scope. Realistic active typing in a DM ≈ 6–12 starts/min in worst case (continuous typing), much lower in bursts. Compare to the existing standalone delivery-ack path (Q3) which fires on a 10 s idle and uses the exact same `encryptAndSendDm` call. The order of magnitude is comparable to receipts, not orders worse.

### Q3 — How receipts compare (NOT a production-data argument)

[`ActionQueueHandlers.sendDeliveryAck`](src/services/ActionQueueHandlers.ts#L932-L976) calls the same `messageService.encryptAndSendDm(...)`. Structurally identical cost: ratchet advance + single-row overwrite. **But this is a structural comparison only — the app is not yet in production, so we can't claim receipts are "battle-tested at scale".** Both features share the same theoretical per-event cost; if typing turns out to be a problem, receipts' standalone path will likely be one too.

The only existing bug-doc that mentions encryption-state bloat is [`.agents/bugs/encryption-state-evals-bloat.md`](.agents/bugs/encryption-state-evals-bloat.md), which is about Triple Ratchet space-creation evals — a different code path entirely (~10k polynomial evals stored at `createSpace`), not per-message DM ratchet writes. So there is no existing evidence either confirming OR refuting bloat risk for the DM per-message path.

### Q4 — Non-advancing encrypt variant

The two SDK entry points used are `DoubleRatchetInboxEncrypt` and `DoubleRatchetInboxEncryptForceSenderInit` ([`MessageService.ts:656,666`](src/services/MessageService.ts#L656-L674)). Both produce a `ratchet_state` that is then persisted. The Double Ratchet's forward-secrecy guarantee *requires* advancing on each encrypt, so a non-advancing encrypt would be a different cryptographic primitive — not exposed by the SDK and not desirable (would weaken forward secrecy for ephemeral typing, which is fine to drop but adds protocol complexity not worth it).

### Q5 — Measurable bloat

The `analyzeEncryptionStates()` helper ([`src/db/messages.ts:2469-2579`](src/db/messages.ts#L2469-L2579)) **defines bloat as a single row exceeding 100 KB**, and its deep-analysis only looks at intra-row growth (`skipped_keys_map`, `participants`, peer maps). The helper does not flag row-count growth because the row count is structurally bounded by `(conversationId, inboxId)`. **Typing cannot grow the row count.** The only mechanism by which typing could grow the existing row's serialized size is via `skipped_keys_map` accumulation on the receiver side when messages are processed out of order — and the typing path is the **send** path. Receivers intercept typing in `processDeliveryReceiptData` before `saveMessage`, but they still run the decrypt step that advances the receiver's ratchet, which is exactly the same cost as any other DM.

## Concrete cost accounting

The reviewer was wrong about *bloat* (row count is bounded; rows overwrite in place). But "no bloat" is not the same as "no cost". Let's name the real cost precisely.

### What happens per `typing-start` between Alice → Bob

**Network layer (per typing-start):**
1. Alice's client serialises the typing envelope (~100–200 bytes JSON payload before encryption)
2. SDK runs Double Ratchet encrypt → ciphertext + new ratchet state
3. Two WebSocket frames sent: a `listen` subscription + a `direct` ciphertext envelope ([`MessageService.ts:702-709`](src/services/MessageService.ts#L702-L709))
4. Bob's relay/inbox forwards the ciphertext
5. Bob's client decrypts → new receiver-side ratchet state

**IndexedDB writes (per typing-start):**

| Side | Writes |
|------|--------|
| Alice (sender) | 1 `put` to `encryption_states` + 1 `put` to `latest_states` (sender path, [`MessageService.ts:698`](src/services/MessageService.ts#L698)) |
| Bob (receiver) | 1 `put` to `encryption_states` + 1 `put` to `latest_states` (receiver path, [`MessageService.ts:2666`](src/services/MessageService.ts#L2666)) |

Total: **4 IndexedDB writes per typing-start across both clients**, all overwriting the same per-counterparty row pair.

### Row size

The serialised `state` field is the entire Double Ratchet state. Healthy DR rows are well under the 100 KB bloat threshold defined in [`analyzeEncryptionStates`](src/db/messages.ts#L2491) — typically a few KB at steady state (root key + chain keys + a small `skipped_keys_map` if there's any out-of-order delivery, plus inbox key material). Each typing event *overwrites* a row of this size; it does NOT grow it under normal flow.

The one growth vector that does exist on a Double Ratchet row is `skipped_keys_map` — keys retained for out-of-order arrivals. Typing messages are sent on the same encrypted channel as DMs, so they share the same chain-key sequence. **If typing messages arrive out of order with each other or with real DMs, they create skipped-key entries that persist until the matching ciphertext arrives.** In practice, since typing messages are fire-and-forget over WebSocket on a single relay, out-of-order arrival should be rare, but it is not impossible (multi-device race conditions, network reorderings on lossy links).

### Frequency under realistic typing

Worst case (continuous typing, never blurring, never sending):
- `typing-start`: capped at 12/min by the 5 s throttle ([`TypingService.ts:26,75`](src/services/TypingService.ts#L26))
- `typing-stop`: 0 (never triggered)

Typical case (bursty writing, message sent at the end):
- `typing-start`: 1–3 per drafted message
- `typing-stop`: 1 per drafted message (on submit, or blur, or visibility-hidden)
- Plus the actual message itself, which also advances the ratchet

So a "typing-enabled chatty DM" generates **roughly 2–4 ratchet advances per drafted message** instead of 1. That's a 2–4× multiplier on ratchet advances and IndexedDB writes *for opted-in users in active DMs*.

### What's actually consumed

| Resource | Cost per typing event | Notes |
|----------|----------------------|-------|
| IndexedDB row count | 0 growth | composite key overwrite |
| IndexedDB write ops | 2 per side, 4 total | each is a few-KB blob put |
| IndexedDB on-disk size | ~0 (steady-state row size unchanged) | unless `skipped_keys_map` grows from out-of-order arrivals |
| Network egress (Alice) | one DR-encrypted envelope per event | small (~200 B + DR overhead) |
| Network ingress (Bob) | same envelope | same |
| CPU (both sides) | one DR encrypt + one DR decrypt per event | non-trivial but fast |
| Relay/inbox load | one delivery per event | shared infrastructure cost |
| Forward-secrecy compute "spend" | one ratchet step per event | each step consumes one OPK-equivalent and rotates chain keys |

The non-obvious resource here is the **relay/inbox load**: typing in a busy DM increases the number of messages the network has to deliver by ~3×. For Alice and Bob this is trivial; aggregated across N pairs of opted-in chatty users on the same relay, it scales linearly with N.

### What could actually go wrong

Concrete failure modes, ranked by plausibility:

1. **Skipped-keys-map growth on lossy/multi-device DMs.** If typing ciphertexts get lost or arrive out of order, the receiver's `skipped_keys_map` accumulates entries until the matching message arrives (which for typing it never will, since typing is fire-and-forget). The SDK presumably has a cap or TTL on skipped keys (worth verifying with the SDK team), but if not, this is a slow leak that grows a single row's size over time. **This is the most plausible real cost.**
2. **Battery / radio wake on mobile.** Each typing event is a TLS round-trip. On a mobile client (`quorum-mobile`, future) this keeps the radio active during composing. Not relevant to desktop.
3. **IndexedDB write amplification.** Each `put` triggers IndexedDB transaction overhead. At 12/min worst case per active DM this is fine; at 12/min × 50 simultaneous active DMs (extreme power user) it's ~10/sec of small writes. Modern IndexedDB handles this easily.
4. **Relay scaling.** As above — linear in opted-in active DMs. Probably not load-bearing at current network size, but worth flagging if/when the network grows.

## Decision

**Option D — accept the cost, but with eyes open and one follow-up.**

Reasoning:
- The "bloat" framing in the reviewer's note is wrong (rows overwrite, don't append).
- The real costs are: a constant-factor (~2–4×) increase in network + ratchet operations for opted-in active DMs, plus a *potential* slow leak via `skipped_keys_map` if typing ciphertexts get lost.
- The privacy gate (both ends OFF by default) keeps this cost away from non-opted-in users entirely.
- All cheaper alternatives (Options A/B/C/E) either defeat the feature's purpose, require protocol-level engineering not in scope, or kill half the feature.

**What we are NOT relying on:**
- Any claim that "receipts work fine in production" — the app is not in production. Receipts and typing share the same cost profile, and both should be re-evaluated together once we have real-network data.

**What we are doing:**
1. Shipping typing as-is for DMs (with the 5 s throttle + privacy gate).
2. **Follow-up: verify with the SDK team** whether `skipped_keys_map` on the Double Ratchet has a bound (max entries, max age). If it does, the leak vector in failure mode #1 is closed. If it doesn't, we should ask for one — independent of typing, since out-of-order DMs in general can trigger the same growth.
3. **Follow-up: pre-production telemetry.** Before any meaningful rollout, add a dev/staging-only diagnostic that periodically logs `encryption_states` row sizes (the `analyzeEncryptionStates()` helper already does this on demand — wire it to log on a timer behind a debug flag). If steady-state row size grows monotonically over hours of active typing, we have evidence of the skipped-keys leak and need to revisit before opening up to real users.

## Action items

1. ~~Investigate~~ — done, this file.
2. **Update `typing-indicators.md`**: rewrite the "Known limitations → DM ratchet advance per keystroke" bullet from "investigation pending" to "investigated, accepted with caveats" with a one-line summary and link back here.
3. **Follow-up task (separate file):** ask the SDK team whether `skipped_keys_map` is bounded. If not, propose a bound. (NOT typing-specific — applies to any out-of-order DM delivery.)
4. **Follow-up task (separate file):** before pre-prod rollout, instrument a periodic dev-only log of `analyzeEncryptionStates()` totals. Watch for monotonic growth during multi-hour typing sessions.

---

*Created: 2026-05-18 — deferred from the typing-indicators code review (`feat/msg-typing-indicator` branch). The PR reviewer flagged this as the highest-severity finding; this task captures the investigation needed before deciding on a fix.*

*Resolved: 2026-05-18 — investigation complete; decision is Option D (accept). The reviewer's bloat concern conflated row-count growth with intra-row growth; the typing path can only do the latter and only via skipped-keys accumulation on out-of-order receives, which is not a typing-specific cost.*
