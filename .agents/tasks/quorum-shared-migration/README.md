---
type: index
title: "Quorum Shared Migration — Master Tracker"
status: ongoing
created: 2026-05-19
updated: 2026-05-28
---

# Quorum Shared Migration — Master Tracker

> **🔴 New session? Read these first, in order:**
> 1. **[2026-05-28-status-recap.md](2026-05-28-status-recap.md)** — friendly re-orientation: what's done, what's pending, what's next. Read if you've been away from this for more than a week.
> 2. **[2026-05-28-cross-repo-workflow.md](2026-05-28-cross-repo-workflow.md)** — how to ship work across three repos when Kyn merges shared+desktop but mobile PRs go to a different reviewer. Covers small-PR sizing, additive-vs-breaking changes, drift handling. **Re-read at the start of every migration session** — the cross-repo workflow is unintuitive and easy to get wrong.
> 3. **[../../.temp/2026-05-28-notifications-explainer.md](../../.temp/2026-05-28-notifications-explainer.md)** — only if you're working on the notifications migration specifically. Junior-friendly explainer of what notifications are, what's shared, what's not, what the PR plan is.

> **Sibling workstreams in flight (2026-05-19):** [MessageDB refactor](../messagedb/README.md) and [test suite review](../2026-05-19-test-suite-review.md). The receipts PR here is coupled to MessageDB Tier 0 #3 and ReceiptService test cleanup — both flagged in the [receipts task prerequisite block](./.done/2026-05-19-receipts-shared-migration.md).

> **What this folder is.** Single source of truth for the multi-PR effort to move shareable code from `quorum-desktop` (and eventually `quorum-mobile`) into the `@quilibrium/quorum-shared` package. The migration is open-ended and runs PR by PR — this README is the bird's-eye view.

> **Critical context Kyn established (2026-05-28):** Kyn does NOT merge mobile PRs himself — those go to the lead dev for review. Lead is often busy and mobile PRs can sit for weeks. This shapes the entire workflow. **Default mode: small granular PRs, shared + desktop ship promptly, mobile catches up whenever.** See the cross-repo workflow doc for the full picture and the additive-vs-breaking decision rule.

## Architecture principle

Code that participates in the P2P protocol (wire types, message-level state machines, sync logic) must be **identical** across desktop and mobile, or sync breaks subtly. The shared package is where that code lives. Code that's coupled to a platform's storage, crypto, UI framework, or i18n stays per-app.

## Folder layout

```
quorum-shared-migration/
├── README.md                                  ← this file (master tracker)
│
├── 2026-05-28-status-recap.md                 ← 🟢 START HERE if you've been away
├── 2026-05-28-cross-repo-workflow.md          ← 🟢 READ EVERY SESSION (workflow rules)
│
├── designs/                                   ← audits, inventories, decision rationale
│   ├── 2026-03-18-utils-design.md             (utils audit — migration done)
│   ├── 2026-03-19-hooks-design.md             (hooks audit — needs refresh against live mobile)
│   └── 2026-05-18-services-design.md          (per-service audit — partial migration ongoing)
│
├── 2026-03-15-stacked-prs-workflow.md         ← older stacked-PR doc (secondary; use the 2026-05-28 workflow as primary)
├── 2026-03-15-npm-publish-access-quorum-shared.md  ← one-off setup task
│
└── .done/                                     ← completed per-PR tasks land here
    ├── 2026-05-18-typing-shared-migration.md  (typing service + types + tests)
    ├── 2026-05-19-receipts-shared-migration.md (receipts service + new wire types + tests)
    └── 2026-05-19-tests-migration.md          (relocated util tests to shared)
```

**Related cross-folder docs** (not in this folder but relevant):
- [`../2026-05-27-shared-vs-local-type-divergence.md`](../2026-05-27-shared-vs-local-type-divergence.md) — the `NotificationSettings` / `NavItem` divergence investigation. Lives in `.agents/tasks/` because it started as a generic divergence task; the migration-specific execution plan is in the explainer below.
- [`../../.temp/2026-05-28-notifications-explainer.md`](../../.temp/2026-05-28-notifications-explainer.md) — junior-friendly walk-through of notifications: what's shared, what's not, the 3-PR plan. (In `.temp/` because it's a personal-onboarding doc not part of the formal task tracking.)

**Convention.** Audits live in `designs/` and act as reference material that evolves slowly. Per-PR executable tasks live at the root, dated `YYYY-MM-DD-<slug>.md`, and move into `.done/` once merged. Workflow/reference docs (like the cross-repo workflow and status recap) live at the root and don't move.

## Status table

Legend: ✅ done · 🟢 ready to ship · ⏸️ blocked · ❌ stays per-app · 📋 audit only

| Migration | Type | Status | Reference |
|---|---|---|---|
| Shared types (Space, Message, Channel, User, Conversation, Bookmark) | Foundation | ✅ Done (PR #1) | — |
| Primitives (22 cross-platform UI components) | UI kit | ✅ Done (PR #2) | — |
| Utils (22 modules: validation, mentions, formatting, etc.) | Logic | ✅ Done (PR #3) | [designs/2026-03-18-utils-design.md](designs/2026-03-18-utils-design.md) |
| Util tests (3 test files testing already-shared utils) | Tests | ✅ Done (2026-05-20) | [.done/2026-05-19-tests-migration.md](.done/2026-05-19-tests-migration.md) |
| Typing service + types + tests | Feature service | ✅ Done (2026-05-20) | [.done/2026-05-18-typing-shared-migration.md](.done/2026-05-18-typing-shared-migration.md) |
| Receipts service + NEW wire types + tests | Feature service | ✅ Done (2026-05-20) | [.done/2026-05-19-receipts-shared-migration.md](.done/2026-05-19-receipts-shared-migration.md) |
| Hooks (~265 hook files) | Logic | ⏸️ Blocked on mobile codebase access | [designs/2026-03-19-hooks-design.md](designs/2026-03-19-hooks-design.md) |
| ActionQueueService | Service | ⏸️ Blocked on mobile access (direction unclear) | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §4 |
| SearchService + SearchAdapter | Service | ⏸️ Blocked on mobile access | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §3 |
| channelThreadHelpers | Helpers | ⏸️ Blocked on mobile access | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §5 |
| ThreadService | Service | ⏸️ Blocked on hooks migration | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §6 |
| BackupService | Service | ⏸️ Blocked on shared symmetric crypto module | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §7 |
| UserConfig privacy field consolidation (deliveryReceipts, readReceipts, typingIndicatorsDM/Spaces) | Types | ✅ Done (2026-05-27) | [.done/2026-05-27-userconfig-type-drift.md](../.done/2026-05-27-userconfig-type-drift.md) |
| UserNote inline → named shared type | Types | ✅ Done (2026-05-27) | quorum-shared PR #17, version 2.1.0-16 |
| NotificationSettings / NavItem structural alignment between local and shared | Types | 🟢 Ready (mobile access verified 2026-05-28) | [2026-05-27-shared-vs-local-type-divergence.md](../2026-05-27-shared-vs-local-type-divergence.md), [explainer](../../.temp/2026-05-28-notifications-explainer.md) |
| Farcaster module landed upstream (hypersnap client + legacy fallback + 11 hooks) | Feature | 📋 Upstream-only (not driven by this migration) | See "Upstream changes 2026-05-28" below |
| `UserConfig.farcasterLink` + `isProfilePublic` upstream — desktop's local `UserConfig` mirror needs the same fields | Types | 🟢 Ready (small housekeeping) | See "Upstream changes 2026-05-28" below |
| MessageService | Service | ❌ Per-app | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) Context |
| ConfigService, EncryptionService, SpaceService, InvitationService, SyncService (desktop wrapper), NotificationService, ActionQueueHandlers | Services | ❌ Per-app | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §8–14 |

## Next up

As of 2026-05-28, Kyn has the latest `quorum-mobile` cloned locally at `D:\GitHub\Quilibrium\quorum-mobile`. The "blocked on mobile access" rows are now unblockable in principle; see [2026-05-28-status-recap.md](2026-05-28-status-recap.md) for the friendly re-orientation and recommended sequencing.

**Two rows are now ready to ship:**

1. **`NotificationSettings` / `NavItem` structural alignment** — verified against live mobile code. Mobile has zero UI consumers of these types; promotion to shared is wire-compatible (desktop has been writing the desired shape all along). Plan: small shared PR → mobile catch-up PR → desktop dedup PR. Full explainer: [2026-05-28-notifications-explainer.md](../../.temp/2026-05-28-notifications-explainer.md).
2. **Desktop `UserConfig` mirror catch-up for `isProfilePublic` + `farcasterLink`** — upstream pull on 2026-05-28 added these fields to shared. Desktop's `src/db/messages.ts` local `UserConfig` doesn't have them yet. Same drift pattern as the receipts/typing fields fixed in PR #16. Trivial.

**Still mobile-coupled (need design refresh, not just access):** hooks migration, ActionQueueService, SearchService, channelThreadHelpers, ThreadService, BackupService. The hooks audit needs re-running against live mobile before a new abstraction-layer design.

## What unblocks the rest

**Mobile codebase access (achieved 2026-05-28)** was the single highest-leverage unblock. With it we can now:

- Move ActionQueueService, SearchService, channelThreadHelpers from "pending direction" to a real decision. (Initial scan: mobile has no `actionQueue` or `search` folder yet, suggesting "promote desktop's → shared, mobile inherits" is the likely path for these.)
- Re-audit the hooks tree against live mobile (the 2026-03-19 inventory predates the current state).
- Verify that mobile's local utility implementations match shared's versions.

**Sequencing now:** start with the small wins (`NotificationSettings` + `UserConfig` field catch-up) to build momentum, then refresh the hooks audit before tackling the big migration.

## Relationship to the MessageDB refactor

The pending [MessageDB refactor work](../messagedb/messagedb-current-state.md) (extracting `MessageCacheService`, `DirectMessageService`, `ChannelMessageService`; breaking down `kickUser` / `createSpace` / `joinInviteLink`) is **largely orthogonal** to this migration. Every service in that refactor is explicitly classified as "stays per-app" in [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) — they're coupled to React Query, ActionQueue, or the desktop decrypt pipeline.

**One real interaction** plus a couple of doc-framing notes:

1. **Sequencing constraint (RESOLVED 2026-05-20)** — Tier 0 #3 of the MessageDB plan (control-message intercept normalization, [optimizations-low-risk.md §4.3](../messagedb/optimizations-low-risk.md#43-normalize-control-message-intercept-shape)) was framed as a hard prerequisite for the receipts migration on the assumption that desktop emitted acks in two shapes (flat and nested-under-`.content`). Investigation during the receipts migration ([cross-check](../messagedb/shared-migration-cross-check.md#sequencing-constraint-on-3-intercept-normalization)) proved only the flat shape ever existed on the wire; the `raw.content?.type` branches in the receiver were dead defensive code from the original receiver bug. A 5-line cleanup commit in front of the receipts migration dropped the dead branches; the shared `DeliveryAckMessage` / `ReadAckMessage` types codify the flat shape, which matches every desktop emission. Tier 0 #3 is therefore done.
2. **Type-safety pass** ([optimizations-low-risk.md §2.1–2.2](../messagedb/optimizations-low-risk.md)) is desktop hygiene, not a "precondition for shared migration." MessageService and ConfigService each have multiple independent coupling points (Web Crypto, React Query keys, `@lingui`, `React.MutableRefObject`); fixing types alone doesn't unblock migration. Earlier docs implied otherwise — corrected by the cross-check.
3. **BaseService extraction** ([optimizations-low-risk.md §3.1](../messagedb/optimizations-low-risk.md)) was earlier flagged as making future shared migration harder. On cross-check, no migration-eligible service actually fits the BaseService dependency shape, so the concern is theoretical, not concrete.

Net: doing the MessageDB refactor first does not expand or shrink the shared migration backlog. The one place it interacts is Tier 0 #3, which is small enough to bundle into the receipts migration PR if needed. Full verification in [messagedb/shared-migration-cross-check.md](../messagedb/shared-migration-cross-check.md).

## Branch / PR workflow

- **[2026-05-28-cross-repo-workflow.md](2026-05-28-cross-repo-workflow.md)** — **read this first.** How Kyn ships work when mobile PRs go to a different reviewer. Covers small-PR sizing, drift handling, when to stack vs. branch fresh, and the standard shared → desktop → mobile sequence.
- [2026-03-15-stacked-prs-workflow.md](2026-03-15-stacked-prs-workflow.md) — older doc for the stacked-branch convention used during the original types → primitives → utils → hooks PR chain. Still useful when stacking is genuinely needed (Case 2 in the newer doc).

Earlier migrations used stacked branches; ongoing per-feature migrations (typing, receipts, tests, notifications) are independent and branch fresh from `main` on each repo.

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

- **MessageService audit** — explicitly out of scope today (~2000 lines, ~60 imports, deeply coupled). Worth a separate dedicated audit once the more tractable services have landed.
- **`isTypingControlMessage` / `isReceiptControlMessage` type guards** — optional small helpers that would let `MessageService` narrow incoming envelopes against the shared union types without inline string literals. Cosmetic improvement, not a blocker.
- **NotificationSettings / NavItem structural alignment** — desktop has richer shapes (per-space muting, enum-array notification triggers, literal `IconName`/`IconColor`) than shared, which has placeholders/looser types. Investigation done; see [2026-05-27-shared-vs-local-type-divergence.md](../2026-05-27-shared-vs-local-type-divergence.md). Blocked on mobile codebase access (need to verify mobile hasn't independently shipped a contradicting notifications UI before promoting desktop's design to shared).

## Upstream changes 2026-05-28

Kyn cloned latest `quorum-mobile` and noted that `quorum-shared` had also seen upstream activity. Fetched `origin/master` on the local `quorum-shared` clone. Findings:

**Local clone (`D:\GitHub\Quilibrium\quorum-shared`) was 3 commits behind `origin/master`:**

| Commit | Summary | Impact on migration |
|---|---|---|
| `8c57a50` — `2.1.0-2` chore | Version bump + small changes to `src/sync/service.ts`, `src/sync/utils.ts` | Bookkeeping. |
| `0bd2fa8` — `rollup public changes for quorum` | **Big one.** Adds full `src/farcaster/` module (16 files: hypersnap-first client, legacy fallback, signer lifecycle/storage, normalize/protoWire/messageBuilder, 11 React Query hooks for casts/feeds/profiles). Updates `src/types/user.ts` (`UserConfig` gains `isProfilePublic?` and `farcasterLink?`; new `FarcasterLink` type), `src/types/message.ts`, transports, and pins dep versions. | Two new `UserConfig` fields desktop's local mirror needs to catch up to. Farcaster module is a separate effort, not part of this migration. |
| `3a8f10e` | Merge commit | None. |

**`NotificationSettings` shape on `origin/master` is unchanged** (still the `{ enabled?, mentions?, replies?, all? }` placeholder), so the in-flight notifications type-alignment migration plan applies cleanly without any upstream conflict.

**Action required before any migration PR:** `git pull` in `D:\GitHub\Quilibrium\quorum-shared` (and `yarn install` in desktop and mobile consumers), so the migration branches don't build on a stale base.

**Mobile sync impact:** mobile already has its own `useFarcaster*` hooks under `quorum-mobile/hooks/`. With the shared `farcaster/` module landed, those should eventually point at shared instead — but that's a separate workstream, not part of the type-divergence cleanup.

---

*Last updated: 2026-05-28 — mobile codebase access verified by reading `quorum-mobile` directly; two previously-blocked rows are now ready (`NotificationSettings`/`NavItem` alignment, plus `UserConfig.farcasterLink`/`isProfilePublic` mirror catch-up). Also pulled `origin/master` on `quorum-shared`: 3 new commits including the major `src/farcaster/` module addition. Status table updated, "Upstream changes 2026-05-28" section added, recap doc at [2026-05-28-status-recap.md](2026-05-28-status-recap.md) and explainer at [../../.temp/2026-05-28-notifications-explainer.md](../../.temp/2026-05-28-notifications-explainer.md).*

*Previously: 2026-05-27 — two type-only PRs against `quorum-shared` (2.1.0-15 and 2.1.0-16): added 7 missing privacy/device fields to `UserConfig` (the receipts/typing-indicators consolidation flagged here as an open follow-up, plus a new `generateYouTubePreviews` field for the YouTube facade gate), and promoted `UserConfig.userNotes`'s inline object type to a named `UserNote` export so desktop could drop its local duplicate. Investigation also surfaced a deeper structural divergence in `NotificationSettings` and `NavItem` shapes between desktop and shared; tracked as a new mobile-blocked follow-up in [2026-05-27-shared-vs-local-type-divergence.md](../2026-05-27-shared-vs-local-type-divergence.md).*

*Previously: 2026-05-20 (third update) — util tests migration done (2026-05-19 task moved to `.done/`). Three test files moved to `quorum-shared/src/utils/` (renamed to match shared's source filenames: `validation.test.ts`, `mentions.test.ts`, `messageGrouping.test.ts`). Found and fixed a real type-shape drift in the process: desktop's mocked `Message.mentions` used the wrong field names (`mentions/channels/roles` instead of shared's `memberIds/roleIds/channelIds`); the desktop test only passed because of `as any` casts. Shared's strict build caught it. No new shared dependencies. Status table updated, "Next up" now empty — everything remaining is mobile-blocked.*

*Previously: 2026-05-20 (second update) — receipts migration done (2026-05-19 task moved to `.done/`). Status table updated. Shared package now has `src/receipts/` + the new `ReceiptControlMessage` / `ReceiptControlMessageType` types in `src/types/receipt.ts` (`DeliveryAckMessage` / `ReadAckMessage` / `ReceiptEnvelopeFields` were already there). Desktop deletes the local copies and imports from `@quilibrium/quorum-shared`. Tier 0 #3 (MessageDB intercept normalization) resolved in front of the migration: a 5-line cleanup commit dropped the dead `raw.content?.type` branches in `MessageService.processDeliveryReceiptData`. Two-account QA is an open follow-up — current dev environment has DM sync issues unrelated to this migration that prevent immediate verification.*

*Previously: 2026-05-20 — typing migration done (2026-05-18 task moved to `.done/`). Status table updated, "Next up" reduced to receipts + util tests. Shared package now has `src/typing/` + `src/types/typing.ts`; desktop deletes the local copies and imports from `@quilibrium/quorum-shared`. Manual two-account QA passed (DM and space typing both work end-to-end).*

*Previously: 2026-05-19 — folder restructure: introduced designs/ subfolder for audits, root holds executable per-PR tasks, this README is the master tracker. Added "Relationship to the MessageDB refactor" section documenting the orthogonality of the two efforts. Cross-check pass later same day refined that section: surfaced the Tier 0 #3 sequencing constraint and corrected the framing on the type-safety pass and BaseService extraction.*
