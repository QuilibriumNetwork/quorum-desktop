---
type: index
title: "Quorum Shared Migration — Master Tracker"
status: ongoing
created: 2026-05-19
updated: 2026-05-28
---

# Quorum Shared Migration — Master Tracker

> **🔴 New session? Read these first, in order:**
> 1. **[roadmap.md](roadmap.md)** — the master plan. **Read the "🟢 Next session: start here" block at the top first** — it names the next concrete action to take. Then the rest of the doc gives phased context.
> 2. **[cross-repo-workflow.md](cross-repo-workflow.md)** — how to ship work across three repos when shared+desktop are self-merged but mobile PRs go to a different reviewer. Covers small-PR sizing, additive-vs-breaking changes, drift handling, the "follow mobile patterns" rule, and the "don't decide for the lead" rule. **Re-read at the start of every migration session** — the cross-repo workflow is unintuitive and easy to get wrong.
> 3. **[shipped-log.md](shipped-log.md)** — **read the "Top-level lessons" block at the top** (6-trap taxonomy + cross-cutting findings). Then skim the 5 recent entries below it to catch up on what changed.
> 4. **[../../reports/2026-05-28-notification-architecture-divergence.md](../../reports/2026-05-28-notification-architecture-divergence.md)** — only if you're working on the notifications track specifically. Verified deep-dive into how desktop and mobile each handle notification preferences. Anchors the GitHub issue paused on a lead-dev reply.

> **Cross-cutting work that touches this migration:**
> - [`../2026-01-07-channel-ordering-feature.md`](../2026-01-07-channel-ordering-feature.md) — desktop drag-and-drop channel reordering feature. Touches the migration in two ways: (1) reorder hooks intentionally kept desktop-local (Option B decision recorded in task), (2) channel pinning removal is cross-repo (mobile + shared + desktop coordination).

> **Sibling workstreams in flight (2026-05-19):** [MessageDB refactor](../messagedb/README.md) and [test suite review](../2026-05-19-test-suite-review.md). The receipts PR here is coupled to MessageDB Tier 0 #3 and ReceiptService test cleanup — both flagged in the [receipts task prerequisite block](./.done/2026-05-19-receipts-shared-migration.md).

> **What this folder is.** Single source of truth for the multi-PR effort to move shareable code from `quorum-desktop` (and eventually `quorum-mobile`) into the `@quilibrium/quorum-shared` package. The migration is open-ended and runs PR by PR — this README is the bird's-eye view.

> **Critical context (2026-05-28):** Mobile PRs are NOT self-merged — they go to the lead dev for review. The lead is often busy and mobile PRs can sit for weeks. This shapes the entire workflow. **Default mode: small granular PRs, shared + desktop ship promptly, mobile catches up whenever.** Also: where mobile already has a working pattern, the migration follows it (don't disrupt the lead's territory). See the cross-repo workflow doc for the full picture.

## Architecture principle

Code that participates in the P2P protocol (wire types, message-level state machines, sync logic) must be **identical** across desktop and mobile, or sync breaks subtly. The shared package is where that code lives. Code that's coupled to a platform's storage, crypto, UI framework, or i18n stays per-app.

## Folder layout

```
quorum-shared-migration/
├── README.md                          ← this file (catalog: status table + pointers)
├── roadmap.md                         ← phased plan, less risky → most risky
├── shipped-log.md                     ← chronological history + lessons learned (top-level lessons block + 5 recent entries)
├── shipped-log-archive.md             ← older entries (only read if you need historical context)
├── cross-repo-workflow.md             ← workflow rulebook (read every session)
├── mobile-tasks-pending.md            ← mobile-side queue (gitignored on mobile)
├── 2026-XX-XX-<slug>.md               ← active per-task files (date-prefixed)
│
├── designs/                           ← audits, inventories, decision rationale
│   ├── 2026-03-18-utils-design.md
│   ├── 2026-05-18-services-design.md
│   ├── 2026-05-28-actionqueue-reaudit.md
│   ├── 2026-05-28-hooks-audit-refresh.md   ← current authoritative hooks audit
│   └── 2026-05-29-searchservice-reaudit.md
│
├── reference/                         ← older / one-off docs kept for context
│   ├── stacked-prs-workflow.md        (older PR-stacking pattern, secondary)
│   └── npm-publish-access.md          (one-off setup task)
│
└── .done/                             ← completed per-task files land here
    ├── 2026-05-18-typing-shared-migration.md
    ├── 2026-05-19-receipts-shared-migration.md
    ├── 2026-05-19-tests-migration.md
    ├── 2026-05-27-shared-vs-local-type-divergence.md
    ├── 2026-05-28-migrate-use-two-step-confirm.md
    └── 2026-05-28-migrate-validation-hooks.md
```

**Three-doc separation of concerns** (no overlap):
- **README.md** = catalog. Status table per migration row + pointers. What exists.
- **roadmap.md** = plan. Phases ordered by risk/leverage + dependencies + queued work. What's next.
- **shipped-log.md** = history. Chronological entries per migration + lessons learned. What changed and why.

**Related cross-folder docs:**
- [`../../reports/2026-05-28-notification-architecture-divergence.md`](../../reports/2026-05-28-notification-architecture-divergence.md) — authoritative deep-dive on the notifications architecture question. Anchors the GitHub issue paused on a lead-dev reply.
- [`../../.temp/2026-05-28-notifications-explainer.md`](../../.temp/2026-05-28-notifications-explainer.md) and [`../../.temp/2026-05-28-notifications-investigation-correction.md`](../../.temp/2026-05-28-notifications-investigation-correction.md) — earlier-session conversation artifacts. NOT authoritative; kept for context.

**Convention.** Audits live in `designs/` and act as reference material that evolves slowly. Per-PR executable tasks live at the root, dated `YYYY-MM-DD-<slug>.md`, and move into `.done/` once merged. Evergreen workflow/reference docs (like the cross-repo workflow, roadmap, shipped-log, README) live at the root WITHOUT date prefixes — dates are for time-bound work only. One-off setup docs go in `reference/`.

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
| UserConfig privacy field consolidation (deliveryReceipts, readReceipts, typingIndicatorsDM/Spaces) | Types | ✅ Done (2026-05-27) | [.done/2026-05-27-userconfig-type-drift.md](../.done/2026-05-27-userconfig-type-drift.md) |
| UserNote inline → named shared type | Types | ✅ Done (2026-05-27) | quorum-shared PR #17, version 2.1.0-16 |
| Desktop `UserConfig` mirror catch-up (`isProfilePublic`, `farcasterLink`) | Types | ✅ Done (2026-05-28) | quorum-desktop PR #159 |
| Notification types rename to `Space*` prefix + desktop dedup against shared | Types | ✅ Done (2026-05-28) | quorum-shared PR #18, quorum-desktop PR #160. Report: [reports/2026-05-28-notification-architecture-divergence.md](../../reports/2026-05-28-notification-architecture-divergence.md) |
| Per-space notification sync (desktop ↔ mobile) | Feature | ⏸️ Awaiting lead-dev confirmation on architecture | GitHub issue draft: [../../.temp/2026-05-28-notification-prefs-github-issue.md](../../.temp/2026-05-28-notification-prefs-github-issue.md). Report: [reports/2026-05-28-notification-architecture-divergence.md](../../reports/2026-05-28-notification-architecture-divergence.md) |
| `NavItem.icon`/`.color` structural alignment | Types | ⏸️ Mobile uses only space-variant items (no folder UI yet); deferred until mobile builds folders | [.done/2026-05-27-shared-vs-local-type-divergence.md](.done/2026-05-27-shared-vs-local-type-divergence.md) |
| Field validators (`validateSpaceName`, `validateDisplayName`, `validateChannelName`, …) with errorKey i18n pattern | Hooks/Logic | ✅ Done (2026-05-28) | shared `2.1.0-19`. Mobile adoption queued — see [mobile-tasks-pending.md](mobile-tasks-pending.md). [shipped-log entry](shipped-log.md#2026-05-28--field-validators-validatespacename-validatedisplayname-) |
| `useTwoStepConfirm` primitive (extracted from `useUserKicking` + `useSpaceLeaving`) | Hook | ✅ Done (2026-05-28) | shared `2.1.0-18`. See [shipped-log.md](shipped-log.md#2026-05-28--usetwostepconfirm) |
| Hooks (276 hook files) | Logic | 🟢 6+ hooks/validators shipped. Audit refreshed 2026-05-28. Future per-candidate tasks at `2026-XX-XX-migrate-<hook>.md` as scoped. | [designs/2026-05-28-hooks-audit-refresh.md](designs/2026-05-28-hooks-audit-refresh.md) |
| ActionQueueService | Service | ❌ Stays per-app. Re-audited 2026-05-28: mobile's `mutationQueue.ts` is a Farcaster-only stub with zero active callers; the two systems solve different problems. | [designs/2026-05-28-actionqueue-reaudit.md](designs/2026-05-28-actionqueue-reaudit.md) |
| SearchService + SearchAdapter | Service | ❌ Stays per-app. Re-audited 2026-05-29: same MiniSearch config across platforms but desktop persists in IndexedDB while mobile rebuilds in-memory per session. One micro-shareable (MiniSearch options constant) for opportunistic future bundling. | [designs/2026-05-29-searchservice-reaudit.md](designs/2026-05-29-searchservice-reaudit.md) |
| channelThreadHelpers | Helpers | ⏸️ Re-evaluate after mobile public-repo dump (2026-05-28) | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §5 |
| ThreadService | Service | ⏸️ Blocked on hooks migration | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §6 |
| BackupService | Service | ⏸️ Blocked on shared symmetric crypto module | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §7 |
| Farcaster module (hypersnap client, legacy fallback, signer lifecycle, 11 React Query hooks) | Feature | 📋 Already in shared (2026-05-28 upstream pull). Mobile already uses some of its own Farcaster hooks; eventual convergence on shared possible but not driven by this migration. | — |
| MessageService | Service | ❌ Stays per-app | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) Context |
| ConfigService, EncryptionService, SpaceService, InvitationService, SyncService (desktop wrapper), NotificationService, ActionQueueHandlers | Services | ❌ Stays per-app | [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §8–14 |

## Next up

See [roadmap.md](roadmap.md) for the leverage-ordered plan. The roadmap names the next-to-pick task, the phase it belongs to, and what unblocks the higher-leverage phases. This README's job is to track per-row state, not to plan.

**Per-task workflow** (established 2026-05-28): for each hook or thematic bundle, create a granular `2026-XX-XX-migrate-<slug>.md` task file at this folder's root. Verify, migrate, ship, log in [shipped-log.md](shipped-log.md), move the task file to `.done/`. Full workflow in [cross-repo-workflow.md](cross-repo-workflow.md).

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

- **[cross-repo-workflow.md](cross-repo-workflow.md)** — **read this first.** How to ship work when mobile PRs go to a different reviewer. Covers small-PR sizing, drift handling, when to stack vs. branch fresh, the "follow mobile patterns" rule, the "don't decide for the lead" rule, and the standard shared → desktop → mobile sequence.
- [reference/stacked-prs-workflow.md](reference/stacked-prs-workflow.md) — older doc for the stacked-branch convention used during the original types → primitives → utils → hooks PR chain. Still useful when stacking is genuinely needed (Case 2 in the newer doc).

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
- **Notification preference sync (desktop ↔ mobile)** — investigation complete: see [reports/2026-05-28-notification-architecture-divergence.md](../../reports/2026-05-28-notification-architecture-divergence.md). The shared `UserConfig` fields already exist; the gap is mobile-side code that bridges `UserConfig.notificationSettings[spaceId].isMuted` and `UserConfig.mutedChannels[spaceId]` to mobile's local MMKV at config-load + writes back on toggle. ⏸️ Awaiting lead-dev direction via the GitHub issue drafted at [`../../.temp/2026-05-28-notification-prefs-github-issue.md`](../../.temp/2026-05-28-notification-prefs-github-issue.md).
- **Mobile public-repo dump re-audit** — the 2026-05-28 "catching up public repo" commit on `quorum-mobile` (`98d59a4`) added massive new functionality (full notification stack, iOS NSE, Farcaster hooks, calling, wallet, etc.). The older design docs in `designs/` predate this and need refreshing against the current mobile state before driving new migration work. Suggested first pass: hooks audit (was the original "biggest unblocked" item).

## Upstream changes 2026-05-28

Two separate upstream events landed on the same day:

### A. `quorum-shared` — `0bd2fa8` "rollup public changes for quorum"

The shared repo got 3 commits including a major addition: a full `src/farcaster/` module (16 files: hypersnap client, legacy fallback, signer lifecycle/storage, normalize/protoWire/messageBuilder, 11 React Query hooks for casts/feeds/profiles). `UserConfig` gained two new fields (`isProfilePublic?`, `farcasterLink?`) and a new `FarcasterLink` type. `@noble/curves` added as a peer dependency.

**Impact on migration:** desktop's local `UserConfig` mirror caught up via PR #159. The Farcaster module is a separate effort, not part of the type-divergence migration.

### B. `quorum-mobile` — `98d59a4` "catching up public repo"

Mobile's `origin/master` got a massive public-repo sync the same day. Before this commit, the public mirror was 4 months stale. After: full notification stack (`useUnifiedNotifications`, `useFarcasterNotifications`, `services/notifications/` with 9 files), iOS Notification Service Extension (`ios/QuorumNotificationService/`), call screens, wallet, governance, QNS marketplace, and much more.

**Impact on migration:** the design docs in `designs/` were written against the prior stale mobile snapshot. Every "blocked on mobile direction" row in the status table needs re-evaluation against the new state. The notifications work in this session was the first to discover this — mobile's architectural choices (e.g. MMKV-based notification prefs, NOT synced via `UserConfig`) are now visible and influence convergence decisions.

### Lesson learned and codified

The mobile repo is a partially-public mirror, not the live internal dev tree. **Before grepping mobile for cross-repo work, always verify freshness** with `git fetch && git log -1 origin/master`. Earlier session reasoning was based on a January snapshot; only late-session diligence caught the May 28 dump. Memory note saved in `~/.agents/memory/projects/quilibrium/quorum-desktop/quorum-shared-migration.md`.

---

*Last updated: 2026-05-28 (late) — first hook migration shipped: `useTwoStepConfirm` extracted to `quorum-shared@2.1.0-18`, desktop's `useUserKicking` + `useSpaceLeaving` refactored to consume it. Established per-task workflow: one candidate (or thematic bundle), one dated task file, ship, log, move to `.done/`. The intermediate "candidates" doc was retired in favor of this approach. See [shipped-log.md](shipped-log.md) for the chronological log.*

*Previously: 2026-05-28 (late) — hooks audit refreshed against mobile `origin/master` (`98d59a4`) and shared `origin/master` (`fbbd48c`). Headline: the `StorageAdapter`/`CryptoProvider` abstractions the March audit said were blockers already exist; mobile has 67 hooks (not 17); shared API design should follow mobile's split-mutation pattern. The audit's first-PR recommendation (A2 query helpers) was withdrawn after spot-checking revealed type-coupling and casing conflicts with shared's existing `queryKeys`.*

*Previously: 2026-05-28 (evening) — three PRs shipped this session: quorum-desktop #159 (UserConfig mirror catch-up for `isProfilePublic`/`farcasterLink`), quorum-shared #18 + quorum-desktop #160 (notification types `Space*` prefix rename + desktop dedup against shared). Notifications track now PAUSED on lead-dev direction — full architecture investigation at [reports/2026-05-28-notification-architecture-divergence.md](../../reports/2026-05-28-notification-architecture-divergence.md), GitHub issue draft at [../../.temp/2026-05-28-notification-prefs-github-issue.md](../../.temp/2026-05-28-notification-prefs-github-issue.md). Also discovered the mobile public-repo had a massive 2026-05-28 catch-up dump (`98d59a4`) — the older design docs need refreshing against the new mobile state before driving more migration work. Status table refreshed to reflect this; "Next up" rewritten.*

*Previously: 2026-05-28 (morning) — mobile codebase access verified, upstream `quorum-shared` pulled (Farcaster module + new UserConfig fields landed). Status table updated, "Upstream changes 2026-05-28" section added.*

*Previously: 2026-05-27 — two type-only PRs against `quorum-shared` (2.1.0-15 and 2.1.0-16): added 7 missing privacy/device fields to `UserConfig` (the receipts/typing-indicators consolidation flagged here as an open follow-up, plus a new `generateYouTubePreviews` field for the YouTube facade gate), and promoted `UserConfig.userNotes`'s inline object type to a named `UserNote` export so desktop could drop its local duplicate. Investigation also surfaced a deeper structural divergence in `NotificationSettings` and `NavItem` shapes between desktop and shared; tracked at [.done/2026-05-27-shared-vs-local-type-divergence.md](.done/2026-05-27-shared-vs-local-type-divergence.md).*

*Previously: 2026-05-20 (third update) — util tests migration done (2026-05-19 task moved to `.done/`). Three test files moved to `quorum-shared/src/utils/` (renamed to match shared's source filenames: `validation.test.ts`, `mentions.test.ts`, `messageGrouping.test.ts`). Found and fixed a real type-shape drift in the process: desktop's mocked `Message.mentions` used the wrong field names (`mentions/channels/roles` instead of shared's `memberIds/roleIds/channelIds`); the desktop test only passed because of `as any` casts. Shared's strict build caught it. No new shared dependencies. Status table updated, "Next up" now empty — everything remaining is mobile-blocked.*

*Previously: 2026-05-20 (second update) — receipts migration done (2026-05-19 task moved to `.done/`). Status table updated. Shared package now has `src/receipts/` + the new `ReceiptControlMessage` / `ReceiptControlMessageType` types in `src/types/receipt.ts` (`DeliveryAckMessage` / `ReadAckMessage` / `ReceiptEnvelopeFields` were already there). Desktop deletes the local copies and imports from `@quilibrium/quorum-shared`. Tier 0 #3 (MessageDB intercept normalization) resolved in front of the migration: a 5-line cleanup commit dropped the dead `raw.content?.type` branches in `MessageService.processDeliveryReceiptData`. Two-account QA is an open follow-up — current dev environment has DM sync issues unrelated to this migration that prevent immediate verification.*

*Previously: 2026-05-20 — typing migration done (2026-05-18 task moved to `.done/`). Status table updated, "Next up" reduced to receipts + util tests. Shared package now has `src/typing/` + `src/types/typing.ts`; desktop deletes the local copies and imports from `@quilibrium/quorum-shared`. Manual two-account QA passed (DM and space typing both work end-to-end).*

*Previously: 2026-05-19 — folder restructure: introduced designs/ subfolder for audits, root holds executable per-PR tasks, this README is the master tracker. Added "Relationship to the MessageDB refactor" section documenting the orthogonality of the two efforts. Cross-check pass later same day refined that section: surfaced the Tier 0 #3 sequencing constraint and corrected the framing on the type-safety pass and BaseService extraction.*
