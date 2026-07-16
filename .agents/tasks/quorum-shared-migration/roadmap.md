---
type: roadmap
title: Quorum-shared migration — roadmap
status: living
created: 2026-05-29
updated: 2026-05-30
audience: any agent or contributor planning the next migration move
---

# Quorum-shared migration — roadmap

> **The master plan.** Goal: maximize shared code between `quorum-desktop` and `quorum-mobile` via the `@quilibrium/quorum-shared` package.
>
> **Companion docs**:
> - [README.md](README.md) — row-by-row status of every migration (catalog view).
> - [shipped-log.md](shipped-log.md) — chronological history of what's landed + lessons. Detailed closed-phase rationales live in [shipped-log-archive.md](shipped-log-archive.md).
> - [cross-repo-workflow.md](cross-repo-workflow.md) — workflow rulebook (cross-repo PR sequencing, i18n, mobile constraints).
> - [mobile-tasks-pending.md](mobile-tasks-pending.md) — queued mobile-side work dropped during desktop sessions.

## 🟢 Next session: start here

**Freshness check 2026-07-16:** issues [#65](https://github.com/QuilibriumNetwork/quorum-mobile/issues/65), [#66](https://github.com/QuilibriumNetwork/quorum-mobile/issues/66), [#67](https://github.com/QuilibriumNetwork/quorum-mobile/issues/67) are **all still OPEN, zero replies.** Phases 5/7/8 remain gated — nothing there has unblocked. Meanwhile ~10 additive shared PRs shipped independently (shared now `2.1.0-34`); the README status table captures them.

Concrete next moves (in priority order):

1. **Finish the message-preprocessing migration (desktop consumer leg).** The shared leg shipped as [quorum-shared#52](https://github.com/QuilibriumNetwork/quorum-shared/pull/52) on 2026-06-25 — `src/utils/messagePreprocessing.ts` exists and is barrel-exported. Desktop STILL inlines the same transforms in `MessageMarkdownRenderer.tsx`. Remaining work: delete the inlined copies, import from shared, visual-smoke the renderer. Task: [`2026-06-18-promote-message-preprocessing-to-shared.md`](2026-06-18-promote-message-preprocessing-to-shared.md) (`in-progress`). This is the clearest unblocked win.

2. **Run a fresh small-bucket sweep.** Past sweeps surfaced bonus C1 findings (one side reimplements what shared exports). Direction varies by session. Worth re-running since a lot of new shared surface landed since the last sweep (role helpers, `formatAddress`, date formatters, image config).

3. **Channel pinning removal** — only START if [`../2026-01-07-channel-ordering-feature.md`](../2026-01-07-channel-ordering-feature.md) is the next desktop feature being implemented. Otherwise leave paused.

4. **Wait on Phase 5 reply.** Issue [quorum-mobile#67](https://github.com/QuilibriumNetwork/quorum-mobile/issues/67) filed 2026-05-30, still no reply as of 2026-07-16. Lead reply unblocks Phase 7. If it's been sitting this long, a specific ping (per the "make the cost visible" rule in cross-repo-workflow.md) may be warranted.

**Do NOT** pick up Phase 7 (gated on #67) or Phase 8 (gated on 7). **Do NOT** execute mobile task drops directly — runtime tests required, the lead reviews on their schedule. **Do NOT** re-investigate closed phases — full rationale in `shipped-log-archive.md`.

## Pre-flight (before starting any session)

```bash
git -C "D:/GitHub/Quilibrium/quorum-shared" pull
git -C "D:/GitHub/Quilibrium/quorum-mobile" fetch && git -C "D:/GitHub/Quilibrium/quorum-mobile" log -1 --format="%h %ad %s" --date=short origin/master
git -C "D:/GitHub/Quilibrium/quorum-desktop" status --short
```

**Mobile working tree is stuck on a Jan 14 commit. ALWAYS read mobile files via `git show origin/master:<path>`, never via the working tree.**

## Work categories (vocabulary)

| Category | Shape | Risk |
|---|---|---|
| **C1. Duplicate elimination** | One side reimplements something shared already exports → replace inline with import | Lowest |
| **C2. Promote → shared** | Pure portable logic moves to shared, other platform inherits later | Low |
| **C3. Refactor to converge** | Desktop monolith + mobile split hooks → redesign shareable layer | High |
| **C4. Extract pure helpers** | Pull pure logic out of fat hook into shared util | Low-medium |

## Failure-mode taxonomy (the 6 traps)

Apply as a checklist when verifying any candidate. A candidate failing ANY of these is C (stays per-app) or D (defer).

- **Trap A — Already done same-day.** Audit framing went stale before publish.
- **Trap B — Mobile (or desktop) doesn't have the feature.** No UI / no parallel data path.
- **Trap C — Same data, different model.** Same data shape, different purpose. Example: `useSpaceOrdering` (both have `spaceIds` but desktop uses for drag-reorder, mobile sorts by activity).
- **Trap D — Same feature, different algorithm.** Independent implementations with different semantics. Example: `useEmojiPicker` frecency (desktop raw counts vs mobile exponential decay).
- **Trap E — Platform-correct primitive divergence.** Both platforms use platform-appropriate primitives; convergence would regress one. Examples: AES-GCM decrypt (Web Crypto vs `@noble/ciphers`); UUID gen (`crypto.randomUUID()` vs polyfill); Ed448 signing (WASM vs `NativeCryptoProvider`).
- **Trap F — Singleton bypass.** Platform has a context system but candidate hooks bypass it via a module-level singleton. Example: mobile's `useChannelManagement` uses `getMMKVAdapter()`, not `useStorageAdapter()`.

---

## Active phases

### Phase 5 — Lead-dev coordination point

**Category:** external dependency. **Risk:** external timing.

Filed as [quorum-mobile#67](https://github.com/QuilibriumNetwork/quorum-mobile/issues/67) on 2026-05-30. Two architectural questions: `CryptoProvider` DI pattern + broadcast pattern for shared mutation hooks. Original draft kept at `.temp/2026-05-29-phase5-coordination-issue.md` (gitignored).

**Exit:** lead replies, decision documented, Phase 7 unblocked.

### Phase 7 — Cat B monolith convergence

**Category:** C3 (the heavyweight). **Dependencies:** Phase 5 answers.

Four big business hooks where desktop has fat form-state controllers and mobile has split mutations. Following mobile's split pattern (per "follow mobile patterns" workflow rule), promote mutation function bodies to shared; desktop refactors monoliths into thin form-state shells calling shared mutations.

**Order by ascending difficulty:**
- **7a. `useUserKicking`** — easiest. State machine line-for-line identical between platforms; only divergence is param shape.
- **7b. `useRoleManagement`** — medium. Pure role-mutation logic is shareable (and already partially extracted in PR #21). Desktop's "stage then save" UX vs mobile's "save per action" is the real choice.
- **7c. `useChannelManagement` + `useInviteManagement`** — hardest. Desktop monoliths are 396/520 LOC; mobile has split mutations. CRUD mutations promote to shared; desktop's form-state stays desktop-only; user-search / address-resolution in `useInviteManagement` stays desktop-only until mobile builds the same UX.

**Exit:** all four refactored or formally re-classified.

### Phase 8 — Services revisits

**Category:** C2 / C3 mix. **Dependencies:** Phase 7 mature.

Re-evaluate the services currently blocked or deferred. **Mostly defer-by-design.**

- **ThreadService** — blocked on hooks abstraction state. [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §6.
- **BackupService** — blocked on a shared symmetric crypto module. §7.
- **channelThreadHelpers** — re-audit against mobile state once hook migration is mature. §5.
- **Desktop `saveMessage` write-path conversation-preview enrichment** — surfaced by Phase 6 verification. Desktop's `useConversationPreviews` exists because desktop's write path doesn't populate `Conversation.lastMessagePreview` at save time (mobile already does). Aligning the write path would eliminate `useConversationPreviews` entirely.

**Exit:** each item either has a per-task plan + executed PR set, or is formally re-classified as "stays per-app" with rationale.

---

## Closed phases (summary — full rationale in shipped-log-archive)

- **Phase 1 — Pure-Cat-A hook promotion.** Closed empty 2026-05-29. All 4 audit-named candidates (`useKickConfirmation`, `useSpaceOrdering`, `useFolderStates`, `useEmojiPicker`) failed a trap. Net yield: 1 mobile task drop, 0 shared promotions. Lesson: "Cat A pure on desktop" did not translate to shareable.
- **Phase 2 — Pure-helper extraction from monoliths.** Closed 2026-05-29/30. AES-GCM config decrypt → stays-per-app (Trap E), shipped as desktop-internal helper. Role-mutation helpers → extracted (`toggleRolePermission` / `setRolePermissions` in 2.1.0-21, PR #21). Manifest helpers → audit overestimated; only bonus C1 mobile task drops surfaced. Net: 1 shared promotion + 3 mobile task drops + 1 desktop-internal cleanup.
- **Phase 3 — Cat A2 query infrastructure.** Closed 2026-05-29 as **stays per-app**. Desktop's `build*Key` / `build*Fetcher` / `useInvalidate*` (55+ files) do not migrate. Four grounds: structural divergence of cache keys, fetchers hard-typed to `MessageDB` + DOM APIs, mobile doesn't use `useInvalidate*` wrappers, real coupling surface includes the stays-per-app services layer (~80-100+ touch points).
- **Phase 4 — Desktop StorageContext plumbing.** Closed 2026-05-29 as **wrong-shaped, not a prerequisite**. `StorageAdapter` is too narrow for the audit's Phase 6 candidates (13 of 14 hooks call `MessageDB`-specific methods not in `StorageAdapter`).
- **Phase 4b — KeyValueAdapter.** Closed 2026-05-29 as **ghost prerequisite**. All 4 candidate hooks fail an earlier trap before `KeyValueAdapter` would matter. Re-evaluate if mobile ships folder UI or accent-color settings.
- **Phase 6 — Cat B "useMessageDB only" migration.** Closed 2026-05-29 with **zero candidates**. The audit's 14-hook list was based on a false premise. The right test is "shared hook exists AND mobile uses it" — neither condition met for any of the 14.

---

## Paused tracks (not in the linear sequence)

- **Notifications convergence** — mobile issue #65, no replies as of 2026-05-29. Architecturally complex (mobile MMKV + iOS NSE vs desktop `UserConfig`-synced). Full investigation in [../../reports/2026-05-28-notification-architecture-divergence.md](../../reports/2026-05-28-notification-architecture-divergence.md). Includes the deferred `getMutedChannelsForSpace` + `isChannelMuted` migration.
- **Channel reorder pure helpers (future C4)** — desktop's channel-ordering feature ([`../2026-01-07-channel-ordering-feature.md`](../2026-01-07-channel-ordering-feature.md)) ships reorder hooks as desktop-local for now. Pure `Space → Space` transforms (`moveChannelInSpace`, `reorderGroupsInSpace`, `reorderChannelsInGroup`) are identical between platforms — clean C4 candidate once the feature ships AND mobile addresses the broadcast gap ([mobile #66](https://github.com/QuilibriumNetwork/quorum-mobile/issues/66)).
- **Channel pinning removal (cross-repo)** — separate from the migration; tracked in [`../2026-01-07-channel-ordering-feature.md`](../2026-01-07-channel-ordering-feature.md) §6. Drops `Channel.isPinned`/`pinnedAt` from shared types + mobile's unused `usePinChannel` + desktop's pin UI. Pattern A sequencing (mobile first).

## Explicit non-goals (don't re-debate)

Audited and classified as stays-per-app. Surface a NEW reason if you want to revisit.

- **MessageService** (~2000 LOC, deeply coupled to desktop's decrypt pipeline + React Query + ActionQueue). [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md).
- **ConfigService, EncryptionService, SpaceService, InvitationService, SyncService, NotificationService, ActionQueueHandlers** — same doc §8-14.
- **ActionQueueService** — re-audited 2026-05-28. Desktop is messaging reliability spine; mobile's `mutationQueue.ts` is a Farcaster-only stub with zero callers. [designs/2026-05-28-actionqueue-reaudit.md](designs/2026-05-28-actionqueue-reaudit.md).
- **SearchService** — re-audited 2026-05-29. Same MiniSearch config but different storage models (desktop IndexedDB-persisted, mobile in-memory rebuild). [designs/2026-05-29-searchservice-reaudit.md](designs/2026-05-29-searchservice-reaudit.md).
- **Desktop's `build*Key` / `build*Fetcher` / `useInvalidate*` query helpers** — Phase 3 closure. Full rationale in [designs/2026-05-28-hooks-audit-refresh.md](designs/2026-05-28-hooks-audit-refresh.md) "Phase 3 follow-up — formal closure".

---

*Last updated: 2026-07-16 — freshness pass: confirmed gating issues #65/#66/#67 all still open (zero replies), so Phases 5/7/8 remain blocked. Refreshed "start here" to surface the one clearly-unblocked task (message-preprocessing desktop consumer leg, shared leg shipped as #52) and to note the ~10 additive shared PRs that landed since. No phase re-classifications.*

*Previously: 2026-05-30.*
