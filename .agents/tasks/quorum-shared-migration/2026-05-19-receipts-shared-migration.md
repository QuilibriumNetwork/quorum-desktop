---
type: task
title: "Delivery & Read Receipts — Migration to quorum-shared"
status: ready
created: 2026-05-19
updated: 2026-05-19
related_docs:
  - .agents/docs/features/messages/dm-receipts.md
  - .agents/docs/quorum-shared-architecture.md
related_tasks:
  - .agents/tasks/quorum-shared-migration/2026-05-18-typing-shared-migration.md
  - .agents/tasks/quorum-shared-migration/designs/2026-05-18-services-design.md
  - .agents/tasks/quorum-shared-migration/designs/2026-03-19-hooks-migration-design.md
---

# Delivery & Read Receipts — Migration to quorum-shared

## Context

The DM delivery & read receipts feature ([dm-receipts.md](../../docs/features/messages/dm-receipts.md)) was implemented entirely in `quorum-desktop`. Per the same principle that motivated the typing migration ([2026-05-18-typing-shared-migration.md](2026-05-18-typing-shared-migration.md)), the protocol-level pieces — wire types and the service that buffers/flushes acks — belong in `@quilibrium/quorum-shared` so mobile can consume them identically.

The full per-service audit lives in [designs/2026-05-18-services-design.md §1](designs/2026-05-18-services-design.md). This task is the executable PR plan.

**Sequencing.** Ship this PR **after** the typing PR lands. They are independent functionally, but typing sets the precedent for the `src/<feature>/` folder layout (service.ts + service.test.ts + index.ts) and the receipts PR should mirror it.

> **Prerequisite from the MessageDB refactor**: before (or as part of) this PR, **resolve the wire-format ambiguity in `processDeliveryReceiptData`** — see [messagedb/optimizations-low-risk.md §4.3](../messagedb/optimizations-low-risk.md#43-normalize-control-message-intercept-shape) and [messagedb/shared-migration-cross-check.md §Sequencing constraint on #3](../messagedb/shared-migration-cross-check.md#sequencing-constraint-on-3-intercept-normalization). Today desktop senders emit acks in two shapes (`raw.type === 'delivery-ack'` and `raw.content?.type === 'delivery-ack'`); the receivers handle both via triple-fallback reads. The shared `DeliveryAckMessage` / `ReadAckMessage` types defined in this PR will codify one shape — pick the flat shape (per the type definitions in this task) and unify the desktop senders to match BEFORE merging, otherwise mobile inherits a wire format that doesn't actually match what some desktop paths emit.
>
> **Scope cost**: small. The fix is in `ActionQueueHandlers.ts` (the two `as const` ack-construction sites at lines 957, 1014) and possibly in `MessageService.ts` ack handling. Receivers can stop the triple-fallback after senders are unified. Worth doing in this PR to avoid a follow-up.

## What makes this slightly larger than typing

The typing migration moved an existing `src/types/typing.ts` file verbatim. **Receipts has no equivalent file** — the wire types are inline string literals scattered across two desktop files:

- `ActionQueueHandlers.ts` line 957: `type: 'delivery-ack' as const, ...`
- `ActionQueueHandlers.ts` line 1014: `type: 'read-ack' as const, ...`
- `MessageService.ts` lines 326, 340: `raw.type === 'delivery-ack'` / `raw.type === 'read-ack'` comparisons
- `actionQueue.ts` lines 33, 36: `ActionType` union includes `'send-delivery-ack'` and `'send-read-ack'` (these are the internal action queue types, NOT the wire types)

The receipts PR has to **design the wire types as new shared types**, not move existing ones. This is a small extra step but worth doing once instead of twice: do it now so the shared types become the canonical source for both sides.

## Per-file audit

### `src/services/ReceiptService.ts` — MIGRATES

**204 lines.** Zero `import` statements. Dependencies are universal JS (`Map`, `Set`, `setTimeout`, `clearTimeout`) plus DOM access (`document.visibilitychange`, `window.beforeunload`) that's already guarded with `typeof document !== 'undefined'` and `typeof window !== 'undefined'` checks.

Constructor surface is the SyncService/TypingService pattern — all callbacks:
- `onFlush(address, messageIds)` — caller does the encrypted send
- `onAckProcessed(messageIds)` — caller updates React Query cache
- `onReadFlush(address, hwm)` — caller enqueues read ack
- `onReadAckProcessed(upToMessageId, upToTimestamp, conversationAddress)` — caller updates cache

Moves verbatim.

### `src/dev/tests/services/ReceiptService.unit.test.ts` — MIGRATES

**273 lines** of vitest tests. Fake timers, mocked callbacks, no platform dependencies. Travels with the service.

### Receipt wire types — CREATED NEW IN SHARED

No source file exists in desktop. The receipts PR introduces a new file in shared:

```ts
// quorum-shared/src/types/receipt.ts (new)

/** Wire format for delivery acks. Sent as flat object (NOT nested under .content). */
export interface DeliveryAckMessage {
  senderId: string;
  type: 'delivery-ack';
  messageIds: string[];
}

/** Wire format for read acks. */
export interface ReadAckMessage {
  senderId: string;
  type: 'read-ack';
  upToMessageId: string;
  upToTimestamp: number;
}

export type ReceiptControlMessage = DeliveryAckMessage | ReadAckMessage;

export type ReceiptControlMessageType = ReceiptControlMessage['type'];
```

This mirrors the structure of `quorum-shared/src/types/typing.ts` (which defines `TypingMessage`, `TypingMessageType`, etc.).

### `MessageService.ts` receive intercept — STAYS PER-APP, narrows against shared types

Lines 326 and 340 do the runtime type detection. They keep doing it, but the literal strings become narrowed against the shared union:

```ts
import type { DeliveryAckMessage, ReadAckMessage } from '@quilibrium/quorum-shared';

const isDeliveryAck = raw.type === 'delivery-ack' || raw.content?.type === 'delivery-ack';
// raw can now be typed as DeliveryAckMessage inside the branch
```

The intercept logic is inseparable from desktop's decrypt pipeline, so it stays in `MessageService`. Optionally add a `isReceiptControlMessage(raw)` type guard in shared for cleanliness; the existing string comparisons already work.

### `ActionQueueHandlers.ts` send paths — STAYS PER-APP, narrows against shared types

The `sendDeliveryAck` and `sendReadAck` handlers construct the ack message objects inline. The `as const` literals become the shared interface types:

```ts
import type { DeliveryAckMessage, ReadAckMessage } from '@quilibrium/quorum-shared';

const ackMessage: DeliveryAckMessage = {
  senderId: selfUserAddress,
  type: 'delivery-ack',
  messageIds,
};
```

The handlers stay per-app (action queue is desktop-specific). The wire object shape is what gets typed against shared.

### `MessageDB.tsx` — STAYS PER-APP

Wires `ReceiptService` into the context tree (creates the instance, supplies callbacks, exposes via `receiptService` on the context value). Desktop-specific React context. Imports `ReceiptService` from shared instead of local.

### UserConfig privacy fields (`deliveryReceipts`, `readReceipts`) — INTENTIONALLY DEFER OR BUNDLE

Same divergence as the typing fields: desktop's local `UserConfig` (in `src/db/messages.ts`) has `deliveryReceipts` and `readReceipts`; shared's `UserConfig` (in `src/types/conversation.ts`) already has `deliveryReceipts` but NOT `readReceipts`. The typing fields (`typingIndicatorsDM`, `typingIndicatorsSpaces`) also aren't in shared.

**Two options for this PR:**

1. **Keep this PR small** — leave the UserConfig divergence as a follow-up task that consolidates all privacy fields at once (`deliveryReceipts`, `readReceipts`, `typingIndicatorsDM`, `typingIndicatorsSpaces`).
2. **Bundle the consolidation** — fold the UserConfig sync into this PR since receipts is the larger contributor to the divergence.

Default to option 1 unless the PR is small enough that bundling doesn't bloat the diff. The receipt service migration is self-sufficient.

## Files to add to quorum-shared

```
src/types/receipt.ts                 (NEW — ~30 lines: DeliveryAckMessage, ReadAckMessage,
                                       ReceiptControlMessage union, ReceiptControlMessageType)
src/receipts/service.ts              (NEW — 204 lines: copy from
                                       quorum-desktop/src/services/ReceiptService.ts)
src/receipts/service.test.ts         (NEW — 273 lines: copy from
                                       quorum-desktop/src/dev/tests/services/ReceiptService.unit.test.ts;
                                       change import from '@/services/ReceiptService' to relative './service')
src/receipts/index.ts                (NEW — barrel re-export of ReceiptService + types)
```

Folder layout mirrors `src/sync/` and the planned `src/typing/`.

## Updates to quorum-shared barrel

- `src/types/index.ts` — re-export the new receipt types
- `src/index.ts` — re-export `ReceiptService` and the receipt types

## Updates to quorum-desktop (after the shared version publishes)

- **Delete** `src/services/ReceiptService.ts`
- **Delete** `src/dev/tests/services/ReceiptService.unit.test.ts` (tests now live in shared)
- **Update** importers to consume from shared:
  - `src/services/index.ts` — remove the ReceiptService re-export (or change to re-export from shared if other code still expects it under `@/services`)
  - `src/components/context/MessageDB.tsx` — change `import { ReceiptService } from '@/services/ReceiptService'` to `from '@quilibrium/quorum-shared'`
  - `src/services/MessageService.ts` — type the intercepted `raw` against the new shared union (optional cleanup, not required for behaviour)
  - `src/services/ActionQueueHandlers.ts` — type the constructed ack message objects against the new shared interfaces (optional cleanup)

## Verification

- `cd d:/GitHub/Quilibrium/quorum-shared && yarn test:run` — new receipts test file passes alongside existing sync + typing tests
- `cd d:/GitHub/Quilibrium/quorum-desktop && yarn test:run` — all remaining desktop tests pass (the 273-line receipts test now lives in shared and runs there)
- `cd d:/GitHub/Quilibrium/quorum-desktop && npx tsc --noEmit --skipLibCheck` — clean
- **Manual two-account QA** — DM delivery receipts still display (single check / double check), read receipts still display when reading new messages, no regression in piggybacked ack handling, no regression in standalone flush timing

## Estimated effort

Half a day to one day. The service code and tests move verbatim (no rewrites). The new work is:

1. Designing the receipt wire types in shared (~30 lines)
2. Updating ~3 importers in desktop
3. Optionally tightening type narrowing in `MessageService` and `ActionQueueHandlers` to use the new shared union

If bundling the UserConfig consolidation: add another half-day for the UserConfig type changes and any downstream type errors.

## What this task explicitly does NOT migrate

- **MessageService intercept** — stays per-app (coupled to decrypt pipeline)
- **ActionQueueHandlers send paths** — stays per-app (action queue is desktop-specific)
- **MessageDB wiring** — stays per-app (React context)
- **UI components** (single-check/double-check indicators, read receipt display) — per-app
- **Privacy modal UI** — per-app
- **UserConfig privacy fields** — defer unless bundled (see above)

## Sequencing with other open migrations

- **Typing PR ([2026-05-18-typing-shared-migration.md](2026-05-18-typing-shared-migration.md)):** ship typing first. It sets the precedent for the `src/<feature>/` folder layout and proves the pattern end-to-end with simpler scope.
- **Hooks migration (blocked):** independent. No receipt-related hooks are in scope for the hooks migration since the receipt service doesn't use React directly.
- **UserConfig consolidation:** can ride with this PR or be deferred (see above).

## Done criteria

- [ ] New shared types in `src/types/receipt.ts` reviewed and accepted
- [ ] PR opened against `quorum-shared` adding types + service + tests
- [ ] Tests pass in quorum-shared (`yarn test` includes the new receipt tests)
- [ ] New quorum-shared version published
- [ ] PR opened against `quorum-desktop` updating import paths and deleting the local service + test
- [ ] Desktop type-check clean
- [ ] All remaining desktop tests still pass
- [ ] Manual two-account QA: delivery + read receipts still work end-to-end

---

*Created: 2026-05-19 — companion task to the typing migration; introduces new receipt wire types in shared since desktop never had a dedicated types file for them.*

*Updated 2026-05-19 (same day) — added prerequisite block at the top: must resolve the desktop wire-format ambiguity (Tier 0 #3 of the MessageDB refactor) before or as part of this PR, otherwise the shared types lock in only one of the two shapes desktop emits. Cross-referenced from [messagedb/shared-migration-cross-check.md](../messagedb/shared-migration-cross-check.md).*
