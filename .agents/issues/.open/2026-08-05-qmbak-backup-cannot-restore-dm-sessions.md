---
type: bug
title: "`.qmbak` backup cannot restore DM session continuity — export is incomplete and import discards ratchet states"
status: open
priority: high
ai_generated: true
created: 2026-08-05
updated: 2026-08-05
related_docs:
  - "../../docs/features/user-data-backup.md"
  - "../../docs/cryptographic-architecture.md"
related_issues:
  - "2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md"
---

# `.qmbak` backup cannot restore DM session continuity

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Do not implement the obvious fix.** Restoring ratchet states naively
> introduces a message-key reuse hazard. See "Why the obvious fix is unsafe".

## Status

Analysis only, from reading the code and data model. **Nothing has been
reproduced.** No backup has been taken, no database wiped, no restore attempted.
Every claim below is labelled READ (with a reference) or INFERRED. The crypto
hazard in particular is **INFERRED from the Double Ratchet construction, not
confirmed against the SDK's implementation**, and needs someone who knows the SDK
to confirm or refute before any fix is designed.

Priority is `high` not because the failure is dramatic but because the feature
**invites false confidence**: it is presented as protection against total data
loss, and a user who takes a backup may reasonably stop worrying about a risk
they are still exposed to.

## Symptoms

A user follows the documented protection — Settings → Privacy/Security → Data
Backup → Export — and stores a `.qmbak` file. Later their IndexedDB is destroyed
(Safari ITP eviction, cache clear, device reset, the Safari passkey bug, or a new
device). They import the backup.

**What they get back:** their DM message history, readable, and their conversation
list.

**What they do not get back:** the ability to continue those conversations on
their existing sessions. Any DM sent to them between the wipe and their next
outbound message is retained but never decryptable.

The conversation is not dead — sending re-initiates a fresh session (see
"What already works") — but the restore does not do what "restore" implies.

## Root Cause

Three separate gaps, compounding.

### 1. Import discards ratchet states unconditionally (READ)

Export **does** capture them. `getAllDMData` returns `encryption_states`
([messages.ts:2251](../../../src/db/messages.ts#L2251)) and `BackupService`
writes them into the encrypted payload.

Import **drops them**. `importDMData` accepts only `{ messages, conversations }`
and its transaction opens only those two object stores
([messages.ts:2270-2278](../../../src/db/messages.ts#L2270-L2278)).
`BackupService.importBackup` states the intent explicitly: *"Import messages and
conversations only (skip encryption_states and user_config)"*
([BackupService.ts:202](../../../src/services/BackupService.ts#L202)).

**The reasoning is correct for the case it was built for.** The doc calls this
"Phase 2: user has active sessions" — merging a backup into a live account, where
overwriting ratchet state would break decryption with counterparties. That is
right. The problem is that the *other* case — restoring onto an empty database
— has the opposite correct behaviour, and both go through the same code path.

### 2. The export is missing stores the restore would need (READ)

Even if import wrote `encryption_states`, they would not be usable. Two
DM-session-critical stores are never exported at all:

| Store | Purpose | Exported? |
|---|---|---|
| `encryption_states` | Double Ratchet state per conversation+inbox | ✅ (then discarded on import) |
| `inbox_mapping` | maps `inboxId` → `conversationId`; routes an inbound frame to its conversation | ❌ **not exported** |
| `latest_states` | tracks the most recent state per conversation | ❌ **not exported** |
| `conversation_users` | DM participant records | ❌ not exported |

Store list READ from [messages.ts:275-289](../../../src/db/messages.ts#L275-L289);
export scope READ from [messages.ts:2218-2262](../../../src/db/messages.ts#L2218-L2262).

**INFERRED:** without `inbox_mapping`, a restored ratchet state has no route from
an arriving inbox frame to the conversation it belongs to — which is consistent
with the observed *"DM frame for unknown inbox — no encryption state, retained
unread"* path ([MessageService.ts:4376](../../../src/services/MessageService.ts#L4376)).
Needs confirmation.

Also unverified: where `ConversationInboxKeypair` (the per-conversation X448/Ed448
inbox keypair, [encryption-state.ts:183-194](../../../../quorum-shared/src/crypto/encryption-state.ts#L183-L194))
actually lives, and whether it is captured anywhere. If it is not, receiving on a
restored session is impossible regardless of the other two.

### 3. Why the obvious fix is unsafe (INFERRED — needs SDK confirmation)

"Just import the encryption states when the DB is empty" is the natural fix and
**it should not be implemented as stated.**

`EncryptionState.state` is a single opaque JSON-serialized ratchet blob
([encryption-state.ts:130-156](../../../../quorum-shared/src/crypto/encryption-state.ts#L130-L156)).
Sending and receiving chains are not separable at the app layer.

Consider the timeline: backup taken at T1 → user sends messages T1→T2 (sending
chain advances) → wipe at T2 → restore the T1 state → user sends again.

The restored sending chain is **rewound**. In Double Ratchet, a message key is
derived from the chain key and the message number, so the same chain key at the
same message number produces the **same message key**. Encrypting different
plaintext under a key+nonce pair already used breaks confidentiality for both
messages.

Restoring the state for **receiving** carries no such hazard — receiving chains
derive decryption keys and reuse is harmless. But because the blob is opaque, the
app cannot restore one without the other.

**This is the crux of the issue and the reason it needs SDK input rather than an
app-layer patch.**

## What already works (do not break it)

Not everything is lost, and the existing behaviour is a reasonable floor:

- **Sending re-initiates.** `DoubleRatchetInboxEncryptForceSenderInit` ([MessageService.ts:1537](../../../src/services/MessageService.ts#L1537)) opens a fresh session when no state is present, so a user can resume talking to the same person.
- **Inbound frames are retained, not destroyed.** Frames for an unknown inbox are kept unread ([MessageService.ts:4376](../../../src/services/MessageService.ts#L4376)) rather than dropped, so they are at least theoretically recoverable if state ever returns.
- **History restore works today.** Messages and conversations do come back.

Any fix must preserve all three.

## Candidate directions (none costed, none endorsed yet)

Listed so the SDK conversation has something concrete to react to. **Direction D1
is the one to evaluate first.**

**D1 — Restore for receive, force-init for send.** Import the ratchet state so
retained-unread frames become decryptable, but never send from a restored state:
force a new outbound session on the first send. Requires the SDK to expose either
a receive-only restore mode or a "discard the sending chain" operation.
Sidesteps the key-reuse hazard entirely rather than reasoning about whether a
given restore is safe.

**D2 — Complete the export first, independently.** Add `inbox_mapping`,
`latest_states` and `conversation_users` to `getAllDMData`, and confirm where the
per-conversation inbox keypairs live. This is worth doing **regardless of which
restore direction wins**, because no restore design can work without them, and it
is the one part with no crypto risk. Bump the `BackupFile` version.

**D3 — Restore only into a provably empty database.** Gate ratchet restore on the
target having zero encryption states. Narrower than D1 and it does *not* remove
the rewind hazard — a wiped device restoring a stale backup still has a rewound
sending chain. **Insufficient on its own.**

**D4 — Accept the current behaviour and fix the framing instead.** If D1 proves
impractical, state plainly in the UI and the doc that `.qmbak` restores *history*,
not *sessions*, and that conversations resume on a new session. Cheapest option
and strictly better than silently implying more than it delivers.

## Verification

**No fix ships without a two-party harness.** This is message-delivery and key
handling: wrong is silent, and neither the user nor a code reader can detect it.

- [ ] **Establish the baseline.** Two accounts, a DM with history. Export a backup on A. Wipe A's IndexedDB. Import. Record precisely: what history is readable, whether a message from B (sent while A was wiped) ever decrypts, whether A can send, whether B sees it.
- [ ] **Confirm gap 2 empirically** — that a restored `encryption_state` is unusable without `inbox_mapping`. If it turns out usable, this issue is smaller than written and should be rescoped.
- [ ] **Put the key-reuse hazard to whoever owns the SDK.** Confirm or refute that a rewound sending chain re-derives identical message keys. If refuted, D3 becomes viable and this issue simplifies considerably.
- [ ] **Control arm.** Run the same harness with no wipe at all. If both arms show the same failure, the harness is measuring something other than the restore.
- [ ] After any fix: confirm restoring into a **live** account still leaves live sessions untouched (the original Phase 2 guarantee).
- [ ] Revert the fix and confirm the new tests go red. An assertion that passes either way is worse than none.
- [ ] Adversarial check: take a backup, send 50 more messages, wipe, restore, send. Inspect whether any two ciphertexts share a key/nonce pair.

## Prevention

- **Backup restore paths need two explicit modes.** "Merge into a live account" and "restore onto an empty device" have opposite correct behaviour for session state. One code path serving both is what produced this. Name the modes in the API rather than inferring them.
- **Export and import must be tested as a round trip against an empty target.** Testing import into a populated DB hides exactly this class of defect, because the missing pieces are already present.
- **A partial backup is a liability, not a partial win.** It changes user behaviour — someone who has taken a backup stops taking other precautions. If it cannot fully restore, the UI must say so.
- **Opaque crypto blobs constrain what the app layer can safely do.** Any feature that rewinds, replays or partially restores cryptographic state needs SDK-level support and review, not app-level cleverness.

## Related

- [Safari ITP wipes IndexedDB after 7 idle days](2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md) — the trigger that surfaced this. The defect itself is independent (it applies equally to cache clears, device resets, the Safari passkey bug, and moving to a new device), **but the two are coupled on the fix path**: see below.
- [Guided install flow for Safari web users](2026-08-05-guided-install-flow-for-safari-web-users.md) — **this issue is on its critical path.** An iOS Home Screen web app gets a storage partition separate from Safari, so a user who installs starts with an empty database. The only handoff for their existing history is export `.qmbak` from the tab → import in the installed app. That makes this issue the migration mechanism for the ITP mitigation, not just a disaster-recovery nicety. The install flow can ship before this is fixed, but only with copy that states plainly that history transfers and sessions do not.
- [User Data Backup & Restore](../../docs/features/user-data-backup.md) — the feature as currently documented; its "Import Behavior" section describes the skip as intended, which is correct for the merge case and is the framing this issue disputes for the restore case
- [Cryptographic Architecture](../../docs/cryptographic-architecture.md) — Double Ratchet model and key storage
- [PWA feasibility report](../../reports/2026-08-05-pwa-mobile-fallback-feasibility.md) §3.2
