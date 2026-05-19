---
type: index
title: "Quorum Shared Migration — Master Tracker"
status: ongoing
created: 2026-05-19
updated: 2026-05-19
---

# Quorum Shared Migration — Master Tracker

> **Sibling workstreams in flight (2026-05-19):** [MessageDB refactor](../messagedb/README.md) and [test suite review](../2026-05-19-test-suite-review.md). The receipts PR here is coupled to MessageDB Tier 0 #3 and ReceiptService test cleanup — both flagged in the [receipts task prerequisite block](./2026-05-19-receipts-shared-migration.md).

> **What this folder is.** Single source of truth for the multi-PR effort to move shareable code from `quorum-desktop` (and eventually `quorum-mobile`) into the `@quilibrium/quorum-shared` package. The migration is open-ended and runs PR by PR — this README is the bird's-eye view.

## Architecture principle

Code that participates in the P2P protocol (wire types, message-level state machines, sync logic) must be **identical** across desktop and mobile, or sync breaks subtly. The shared package is where that code lives. Code that's coupled to a platform's storage, crypto, UI framework, or i18n stays per-app.

## Folder layout

```
quorum-shared-migration/
├── README.md                                  ← this file (master tracker)
│
├── designs/                                   ← audits, inventories, decision rationale
│   ├── 2026-03-18-utils-design.md             (utils audit — migration done)
│   ├── 2026-03-19-hooks-design.md             (hooks audit — blocked on mobile access)
│   └── 2026-05-18-services-design.md          (per-service audit — partial migration ongoing)
│
├── 2026-03-15-stacked-prs-workflow.md         ← workflow reference for stacked PRs
├── 2026-03-15-npm-publish-access-quorum-shared.md  ← one-off setup task
│
├── 2026-05-18-typing-shared-migration.md      ← per-PR task: typing service + types + tests
├── 2026-05-19-receipts-shared-migration.md    ← per-PR task: receipts service + new wire types + tests
├── 2026-05-19-tests-migration.md              ← per-PR task: relocate util tests to shared
│
└── .done/                                     ← completed per-PR tasks land here
```

**Convention.** Audits live in `designs/` and act as reference material that evolves slowly. Per-PR executable tasks live at the root, dated `YYYY-MM-DD-<slug>.md`, and move into `.done/` once merged.

## Status table

Legend: ✅ done · 🟢 ready to ship · ⏸️ blocked · ❌ stays per-app · 📋 audit only

| Migration | Type | Status | Reference |
|---|---|---|---|
| Shared types (Space, Message, Channel, User, Conversation, Bookmark) | Foundation | ✅ Done (PR #1) | — |
| Primitives (22 cross-platform UI components) | UI kit | ✅ Done (PR #2) | — |
| Utils (22 modules: validation, mentions, formatting, etc.) | Logic | ✅ Done (PR #3) | [designs/2026-03-18-utils-design.md](designs/2026-03-18-utils-design.md) |
| Util tests (4 test files testing already-shared utils) | Tests | 🟢 Ready | [2026-05-19-tests-migration.md](2026-05-19-tests-migration.md) |
| Typing service + types + tests | Feature service | 🟢 Ready | [2026-05-18-typing-shared-migration.md](2026-05-18-typing-shared-migration.md) |
| Receipts service + NEW wire types + tests | Feature service | 🟢 Ready (after typing lands) | [2026-05-19-receipts-shared-migration.md](2026-05-19-receipts-shared-migration.md) |
| Hooks (~265 hook files) | Logic | ⏸️ Blocked on mobile codebase access | [designs/2026-03-19-hooks-design.md](designs/2026-03-19-hooks-design.md) |
| ActionQueueService | Service | ⏸️ Blocked on mobile access (direction unclear) | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §4 |
| SearchService + SearchAdapter | Service | ⏸️ Blocked on mobile access | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §3 |
| channelThreadHelpers | Helpers | ⏸️ Blocked on mobile access | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §5 |
| ThreadService | Service | ⏸️ Blocked on hooks migration | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §6 |
| BackupService | Service | ⏸️ Blocked on shared symmetric crypto module | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §7 |
| UserConfig privacy field consolidation (deliveryReceipts, readReceipts, typingIndicatorsDM/Spaces) | Types | ⏸️ Open follow-up | mentioned in typing + receipts tasks |
| MessageService | Service | ❌ Per-app | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) Context |
| ConfigService, EncryptionService, SpaceService, InvitationService, SyncService (desktop wrapper), NotificationService, ActionQueueHandlers | Services | ❌ Per-app | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §8–14 |

## Next up

1. **Typing migration** ([2026-05-18-typing-shared-migration.md](2026-05-18-typing-shared-migration.md)) — fully audited, no blockers, smallest scope.
2. **Receipts migration** ([2026-05-19-receipts-shared-migration.md](2026-05-19-receipts-shared-migration.md)) — same pattern as typing, plus a small new step (designing the receipt wire types in shared since they don't exist as a dedicated file in desktop). Best to ship after typing so the typing module's folder layout sets the precedent.
3. **Util tests** ([2026-05-19-tests-migration.md](2026-05-19-tests-migration.md)) — trivial housekeeping. Independent of the other two.

These three can ship in any order and are not blocked on mobile codebase access.

## What unblocks the rest

**Mobile codebase access** is the single highest-leverage unblock. It would:

- Move ActionQueueService, SearchService, channelThreadHelpers from "pending direction" to a real decision (port desktop's → shared, or use mobile's as baseline, or design a new shared interface based on both).
- Unblock the hooks migration (which in turn unblocks ThreadService and the cache-coupled parts of other services).
- Let the team verify that mobile's local utility implementations match shared's versions (validation, formatting, mentions).

Until then, only the three "ready" rows ship.

## Relationship to the MessageDB refactor

The pending [MessageDB refactor work](../messagedb/messagedb-current-state.md) (extracting `MessageCacheService`, `DirectMessageService`, `ChannelMessageService`; breaking down `kickUser` / `createSpace` / `joinInviteLink`) is **largely orthogonal** to this migration. Every service in that refactor is explicitly classified as "stays per-app" in [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) — they're coupled to React Query, ActionQueue, or the desktop decrypt pipeline.

**One real interaction** plus a couple of doc-framing notes:

1. **Sequencing constraint** — Tier 0 #3 of the MessageDB plan (control-message intercept normalization, [optimizations-low-risk.md §4.3](../messagedb/optimizations-low-risk.md#43-normalize-control-message-intercept-shape)) **must land BEFORE or WITH the receipts shared migration** ([2026-05-19-receipts-shared-migration.md](./2026-05-19-receipts-shared-migration.md)). Otherwise the wire-format ambiguity (`raw.type` vs `raw.content?.type`) gets codified into the shared `DeliveryAckMessage` / `ReadAckMessage` types and mobile inherits only one of the two shapes desktop emits. Full reasoning in [messagedb/shared-migration-cross-check.md §Sequencing constraint on #3](../messagedb/shared-migration-cross-check.md#sequencing-constraint-on-3-intercept-normalization).
2. **Type-safety pass** ([optimizations-low-risk.md §2.1–2.2](../messagedb/optimizations-low-risk.md)) is desktop hygiene, not a "precondition for shared migration." MessageService and ConfigService each have multiple independent coupling points (Web Crypto, React Query keys, `@lingui`, `React.MutableRefObject`); fixing types alone doesn't unblock migration. Earlier docs implied otherwise — corrected by the cross-check.
3. **BaseService extraction** ([optimizations-low-risk.md §3.1](../messagedb/optimizations-low-risk.md)) was earlier flagged as making future shared migration harder. On cross-check, no migration-eligible service actually fits the BaseService dependency shape, so the concern is theoretical, not concrete.

Net: doing the MessageDB refactor first does not expand or shrink the shared migration backlog. The one place it interacts is Tier 0 #3, which is small enough to bundle into the receipts migration PR if needed. Full verification in [messagedb/shared-migration-cross-check.md](../messagedb/shared-migration-cross-check.md).

## Branch / PR workflow

See [2026-03-15-stacked-prs-workflow.md](2026-03-15-stacked-prs-workflow.md) for the stacked-branch convention and the `link:` / published-npm dependency dance. Earlier migrations used stacked branches (types → primitives → utils → hooks); ongoing per-feature migrations (typing, receipts, tests) are independent and branch from `main` on both repos.

## Per-PR task template

Each executable migration follows this rough shape, lifted from how the typing task was structured:

1. **Per-file audit** — what's portable, what isn't, why
2. **Files to add to quorum-shared** — exact paths
3. **Updates to quorum-shared barrel** — `src/types/index.ts`, `src/index.ts`
4. **Updates to quorum-desktop** — delete moved files, redirect imports
5. **Verification** — `yarn test` in shared, `yarn test:run` + `npx tsc --noEmit` in desktop, manual QA
6. **Done criteria** — checklist
7. **What this migration explicitly does NOT cover** — boundary fence

The typing task is the reference example. Receipts and future migrations should mirror its structure.

## Open follow-ups not yet scoped as tasks

- **UserConfig privacy field consolidation** — desktop's local `UserConfig` has `deliveryReceipts`, `readReceipts`, `typingIndicatorsDM`, `typingIndicatorsSpaces` fields that don't exist on shared's `UserConfig` (`src/types/conversation.ts`). The fields cluster naturally and should migrate together. Best done as part of the receipts PR or immediately after, since receipts is the larger contributor.
- **MessageService audit** — explicitly out of scope today (~2000 lines, ~60 imports, deeply coupled). Worth a separate dedicated audit once the more tractable services have landed.
- **`isTypingControlMessage` / `isReceiptControlMessage` type guards** — optional small helpers that would let `MessageService` narrow incoming envelopes against the shared union types without inline string literals. Cosmetic improvement, not a blocker.

---

*Last updated: 2026-05-19 — folder restructure: introduced designs/ subfolder for audits, root holds executable per-PR tasks, this README is the master tracker. Added "Relationship to the MessageDB refactor" section documenting the orthogonality of the two efforts. Cross-check pass later same day refined that section: surfaced the Tier 0 #3 sequencing constraint and corrected the framing on the type-safety pass and BaseService extraction.*
