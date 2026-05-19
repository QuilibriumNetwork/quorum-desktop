---
type: index
title: "Quorum Shared Migration — Master Tracker"
status: ongoing
created: 2026-05-19
updated: 2026-05-19
---

# Quorum Shared Migration — Master Tracker

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

*Last updated: 2026-05-19 — folder restructure: introduced designs/ subfolder for audits, root holds executable per-PR tasks, this README is the master tracker.*
