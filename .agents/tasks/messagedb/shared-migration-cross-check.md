---
type: task
title: "MessageDB Refactor — Cross-Check Against quorum-shared Architecture"
status: done
created: 2026-05-19
updated: '2026-05-19'
related_docs:
  - .agents/docs/quorum-shared-architecture.md
  - .agents/tasks/quorum-shared-migration/README.md
  - .agents/tasks/quorum-shared-migration/designs/2026-05-18-services-design.md
related_tasks:
  - .agents/tasks/messagedb/README.md
  - .agents/tasks/messagedb/optimizations-low-risk.md
  - .agents/tasks/messagedb/handleNewMessage-reconsidered.md
---

# MessageDB Refactor — Cross-Check Against quorum-shared Architecture

## Purpose

Before executing the [MessageDB refactor master plan](./README.md#master-action-plan-safest-to-riskiest), verify that none of the proposed optimizations conflict with:

1. The principle that wire formats must match across desktop and mobile ([architecture doc](../../docs/quorum-shared-architecture.md#key-principle-data-sync-across-clients))
2. The per-service classifications in the [services-design audit](../quorum-shared-migration/designs/2026-05-18-services-design.md)
3. The planned migration order (typing → receipts → util tests, then mobile-access-blocked work)

## Methodology

For each Tier 0–3 item in the [master plan](./README.md#master-action-plan-safest-to-riskiest), I checked:
- Which services it touches
- Whether those services are classified per-app, Tier 1A (migrate now), Tier 1B (pending mobile), or Tier 2 (deferred)
- Whether the proposed change locks any shared interface (wire format, shared types, StorageAdapter, etc.) before its migration
- Whether the doc wording is honest about the migration impact

## Findings

### Tier 0 — Safe housekeeping

| # | Task | Verdict | Notes |
|---|------|---------|-------|
| 1 | Rename `processDeliveryReceiptData` → `interceptControlMessages` | ✅ Safe | Desktop-internal; method lives in MessageService (per-app); wire formats unchanged. |
| 2 | Remove `React.MutableRefObject` from services | ✅ Safe | All 5 affected services (Config, Space, Invitation, Sync, Message) are explicitly per-app. Doc wording softened (see below). |
| 3 | Normalize control-message intercept shape | ⚠️ Sequencing constraint | **Must land BEFORE or WITH the receipts shared migration.** See §"Sequencing constraint on #3" below. |
| 4 | Type piggybacked ack fields | ✅ Safe | Already correctly sequenced "after receipts migration" in the existing docs. |

### Tier 1 — Larger but still low-risk

| # | Task | Verdict | Notes |
|---|------|---------|-------|
| 5 | Replace `any` types (97 occurrences) | ✅ Safe | All 5 affected services are per-app. Doc wording softened — this is desktop hygiene, not a shared-migration enabler. |
| 6 | NotificationService singleton → DI'd class | ✅ Safe | NotificationService is explicitly per-app forever (Web Notification API). Desktop hygiene only. |
| 7 | `BaseService` extraction | ✅ Safer than originally flagged | Only services matching the `BaseService` 3-dep shape are per-app forever. ActionQueueService (the only migration-eligible service in the cluster) doesn't fit the pattern anyway. |

### Tier 2 — Per-message-type extractions

| # | Task | Verdict | Notes |
|---|------|---------|-------|
| 8 | Extract `MessageCacheService` | ⚠️ Wording correction | Inherits ThreadService's "Tier 2 deferred" status (blocked on hooks migration), not MessageService's "per-app forever". |
| 9 | Extract `ReactionService` | ⚠️ Wording correction | Same as #8. |
| 10 | Extract `ProfileService` | ⚠️ Wording correction | Same as #8. |
| 11 | Extract `EditService` | ⚠️ Wording correction | Same as #8. |

### Tier 3 — High-risk function breakdowns

| # | Task | Verdict | Notes |
|---|------|---------|-------|
| 12 | Break down `kickUser` | ✅ Safe | Inside SpaceService (per-app forever). |
| 13 | Break down `createSpace` | ✅ Safe | Same. |
| 14 | Break down `joinInviteLink` | ✅ Safe | Inside InvitationService (per-app forever). |

## Sequencing constraint on #3 (intercept normalization)

**This is the only finding with a real cross-cutting ordering requirement.**

Tier 0 item #3 ([optimizations-low-risk.md §4.3](./optimizations-low-risk.md#43-normalize-control-message-intercept-shape)) addresses the awkward triple-fallback pattern in `processDeliveryReceiptData`:

```ts
const isDeliveryAck = raw.type === 'delivery-ack' || raw.content?.type === 'delivery-ack';
const ackIds = raw.messageIds ?? raw.content?.messageIds ?? [];
```

The doc proposes two approaches:
- **Preferred (unify senders)**: edit ActionQueueHandlers send paths so all control messages use the same shape; readers then read only one shape.
- **Fallback (normalize at receiver)**: defensive `const ctl = raw.content?.type ? raw.content : raw;` at the top of the intercept.

**The constraint**: the [receipts shared migration](../quorum-shared-migration/2026-05-19-receipts-shared-migration.md) introduces `DeliveryAckMessage` and `ReadAckMessage` types in `quorum-shared/src/types/receipt.ts`. Once those types ship, **the wire format is locked across desktop and mobile.** The defensive triple-fallback in the receiver (`raw.foo` vs `raw.content?.foo`) needs to be reconciled with whatever shape the shared types codify.

**Resolution (2026-05-20 — investigated during the receipts migration)**: option 3 above turned out to be the reality. After grepping every ack-construction site in the codebase and tracing the git history, the verdict is:

- **Only one sender path exists** for both ack types: `ActionQueueHandlers.ts:957` (delivery-ack) and `:1014` (read-ack). Both emit the **flat** shape (`type: 'delivery-ack' as const` at the top level) and have always done so.
- The `raw.content?.type` branches in `MessageService.processDeliveryReceiptData` are **dead defensive code**. They were added because the receiver was originally written incorrectly to check `decryptedContent.content?.type === 'delivery-ack'` (looking inside `.content` for a flat message). The "fix" added the correct flat check via `||` but left the broken nested check in. See [`.agents/bugs/.solved/2026-03-19-standalone-delivery-ack-unreliable.md`](../../bugs/.solved/2026-03-19-standalone-delivery-ack-unreliable.md) line 28 for the historical record.
- **No external peer ever shipped the nested shape.** No older desktop build, no mobile prototype. The fallback was never wire-compatibility code; it was an unreverted artifact of the original receiver bug.

So the wire format is unambiguously flat. The receipts shared migration codifies flat, drops the dead nested-fallback branches in the receiver, and ships in one PR. No sequencing constraint with #3 (#3 becomes a no-op once the dead code is removed).

**Action taken**: the dead `raw.content?.type` fallbacks in `MessageService.ts:325, 328, 339, 342–343` were removed as a small cleanup commit on the receipts-shared-migration branch, in front of the migration itself. After that, the shared types map 1:1 with the only shape desktop emits or receives.

## Doc wording corrections (applied 2026-05-19)

Below are the specific framing issues found and the corrections applied to the affected docs.

### Issue A: Overstating "shared-migration enablement"

Several places in the docs imply that removing `React.MutableRefObject` and replacing `any` types in MessageService/ConfigService is a precondition for reconsidering those services for shared migration. That's not actually true. Each of those services has **multiple independent coupling points**:

- MessageService: React Query, ActionQueue, decrypt pipeline, @lingui, hub envelope handling, DefaultImages — fixing types doesn't address any of the others
- ConfigService: Web Crypto API, React Query keys, React.MutableRefObject, @lingui, folderUtils — same
- SpaceService: React.MutableRefObject, React Query keys, @lingui, NavItem from desktop DB layer
- InvitationService: same as SpaceService

Fixing types is necessary-but-not-sufficient. The framing in the original docs implied it was sufficient. **Applied**: soften the framing to "modest expansion of migration surface (necessary but not sufficient)".

### Issue B: Tier 2 extractions ≠ "per-app forever"

`handleNewMessage-reconsidered.md` originally said the extracted ReactionService/ProfileService/EditService would stay per-app "Same per-app classification as MessageService itself in the services-design audit." That conflated two different statuses:

- **MessageService**: explicitly per-app forever (services-design audit out-of-scope statement)
- **ThreadService** (the precedent): Tier 2 deferred — would migrate to shared if and when the hooks migration unblocks `buildMessagesKeyPrefix` (services-design §6)

The extracted services follow ThreadService's pattern, not MessageService's classification. They are Tier 2 candidates whose future migration is gated on the same hooks migration. **Applied**: corrected the wording in handleNewMessage-reconsidered.md.

### Issue C: Overstated BaseService risk to shared migration

The master README warned that `BaseService` extraction (#7) would make any future per-service migration harder. In practice, the only services whose dependency shape matches the proposed `BaseService` are **all classified per-app forever**:

| Service | `messageDB` | `apiClient` | `enqueueOutbound` | Migration status |
|---------|-------------|-------------|-------------------|------------------|
| ConfigService | ✅ | ✅ | ✅ | Per-app forever |
| SpaceService | ✅ | ✅ | ✅ | Per-app forever |
| InvitationService | ✅ | ✅ | ✅ | Per-app forever |
| MessageService | ✅ | ✅ | ✅ | Per-app forever |
| EncryptionService | ✅ | ✅ | ❌ | Per-app forever |
| ActionQueueService | ✅ | ❌ | ❌ | Tier 1B (different deps anyway) |

No migration-eligible service has the BaseService shape. The shared-migration concern is theoretical, not concrete. **Applied**: softened the warning in the README's Tier 1 ordering rationale.

## What did NOT need changing

These claims in the existing docs are accurate and stay as-is:

- The cross-cutting note in [current-state.md](./current-state.md#cross-cutting-context-relationship-to-quorum-shared-migration) correctly identifies the two narrow exceptions where MessageDB refactor affects shared migration (type-safety pass and BaseService).
- [optimizations-high-risk.md](./optimizations-high-risk.md) correctly notes that `kickUser`, `createSpace`, `joinInviteLink` all live in per-app services.
- [optimizations-low-risk.md §4.4](./optimizations-low-risk.md#44-type-the-piggybacked-ack-fields) correctly schedules itself "after the receipts shared migration lands."
- [handleNewMessage-reconsidered.md](./handleNewMessage-reconsidered.md) "Not a shared-migration enabler" disclaimer is broadly correct (just needed the Tier 2 vs per-app wording fix).

## Net conclusion

The MessageDB refactor plan is **structurally compatible** with the shared-architecture and the planned migration sequence. The four wording corrections are honesty fixes, not plan changes. The one real ordering constraint is on Tier 0 item #3, which should land before or with the receipts shared migration.

No other tier item creates a conflict, locks a shared interface prematurely, or forces a change to the shared migration order.

---

_Created 2026-05-19 — verification triggered by the user asking to confirm safety against quorum-shared architecture before executing the master plan._
