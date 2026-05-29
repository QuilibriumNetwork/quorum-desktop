---
type: roadmap
title: Quorum-shared migration — phased roadmap (less risky to most risky)
status: living
created: 2026-05-29
updated: 2026-05-29
audience: any agent or contributor planning the next migration move
---

# Quorum-shared migration — roadmap

> **The master plan.** Goal: maximize shared code between `quorum-desktop` and `quorum-mobile` via the `@quilibrium/quorum-shared` package. This doc orders all known work from lowest-risk / quickest-yield to highest-risk / highest-leverage, with explicit dependencies between phases.
>
> **Companion docs**:
> - [README.md](README.md) — row-by-row status of every migration (catalog view).
> - [shipped-log.md](shipped-log.md) — chronological history of what's landed + lessons learned.
> - [cross-repo-workflow.md](cross-repo-workflow.md) — workflow rulebook (cross-repo PR sequencing, i18n, mobile constraints).
>
> **This doc is the leverage-ordered plan view.** The README is the state-ordered catalog. The shipped-log is the time-ordered history. They overlap deliberately at no point.

## Pre-flight (before starting any session)

```bash
cd D:\GitHub\Quilibrium\quorum-shared && git pull
cd D:\GitHub\Quilibrium\quorum-mobile && git fetch && git log -1 --format="%h %ad %s" --date=short origin/master
cd D:\GitHub\Quilibrium\quorum-desktop && git status --short
```

**Mobile working tree is stuck on a Jan 14 commit. ALWAYS read mobile files via `git show origin/master:<path>`, never via the working tree.**

## Work categories (vocabulary)

Every migration task fits one of these four shapes. Categorize the work explicitly when planning a task so a future session can self-classify what they're picking up:

| Category | Shape | Risk | Typical scope |
|---|---|---|---|
| **C1. Duplicate elimination** | Desktop reimplements something shared already exports → replace inline with import | Lowest | 1 desktop hook, no shared changes |
| **C2. Promote desktop → shared** | Desktop has X, mobile has nothing, X is pure and portable → move to shared, mobile inherits later | Low | 1-3 hooks/utilities, additive shared changes |
| **C3. Refactor to converge** | Desktop has fat hook, mobile has split hooks → redesign the shareable layer, refactor desktop to match mobile's pattern | High | 1 hook family, shared API design, desktop rewrite |
| **C4. Extract pure helpers from monoliths** | A big desktop hook contains pure logic inline → pull the logic to shared, keep the orchestration desktop-only | Low-medium | shared util added, desktop hook slimmed |

## Phase ordering principles

1. **Less risky first.** Phase 1 is additive-only, no shared interface changes. Phase 7 is the heavy convergence work that depends on lead-dev decisions.
2. **Dependencies are explicit.** Each phase declares its blockers. Phases without blockers can run in parallel.
3. **Phase boundaries are coordination points, not deadlines.** Multiple Phase-1 tasks can be in flight while Phase-5 sits waiting on a reply.
4. **Each phase references its own per-task files.** The roadmap names the phase + its candidates; dated `2026-XX-XX-migrate-<thing>.md` task files plan and execute each candidate. Per-task workflow is in [cross-repo-workflow.md](cross-repo-workflow.md).

---

## Phase 1 — Pure-Cat-A hook promotion

**Category:** C2 (promote-desktop) + occasional C1 (duplicate-elimination).
**Goal:** ship hooks already pure on desktop and shareable as-is. No shared interface changes; additive only.
**Risk:** lowest. Each task is a self-contained shared PR + desktop redirect.
**Dependencies:** none. Can run today.

**Candidates** (each its own per-task file when picked up):

- **`useKickConfirmation` extraction** — the audit's recommended PR-set 2. Side-by-side comparison flagged desktop's `useUserKicking` and mobile's `useUserKicking` as having a line-for-line identical confirmation state machine. Verify the claim under direct re-read, extract to shared, both platforms adopt. Reference: [designs/2026-05-28-hooks-audit-refresh.md](designs/2026-05-28-hooks-audit-refresh.md) — "Smallest safe first migration PR" section.
- **`useSpaceOrdering`** — Category A pure hook. Verify mobile parallel exists / would plausibly use it.
- **`useFolderStates`** — Category A pure hook. Verify the same.
- **`useEmojiPicker`** — pure UI state + frequent-emojis localStorage. If mobile uses AsyncStorage/MMKV for frequent emojis, the convergence is via a `StorageAdapter` abstraction. Worth a separate scoping decision.

**Exit criteria:** all four candidates have either shipped or been formally classified as not-shareable with a brief verdict logged in the shipped-log.

---

## Phase 2 — Pure-helper extraction from monoliths

**Category:** C4 (extract pure helpers).
**Goal:** pull pure logic out of big desktop hooks into shared utilities. Desktop hooks become thinner, mobile gets new shareable utils.
**Risk:** low-medium. Additive shared changes, desktop refactors inline. No shared interface design.
**Dependencies:** none (independent of Phase 1).

**Known candidates** (each its own per-task file):

- **AES-GCM config-decryption block** — duplicated verbatim between `useOnboardingFlowLogic.fetchUser` and `useUnifiedOnboardingFlow.syncImportedProfile`. Surfaced 2026-05-29 morning spot-check. Pure logic. Audit whether mobile has the same flow; if yes, promote to a shared `decryptUserConfig` utility.
- **Role-mutation pure functions** — inside `useRoleManagement` (Category A on desktop, but the audit notes mobile has full mutation parallels). Functions like `updateRolePermission(role, permission, value)` are pure and trivially shareable. Extract them; desktop's stage-then-save and mobile's save-per-action UX both call into them.
- **Manifest-construction helpers** — inside `useSpaceCreation`, `useInviteManagement`. Look for pure functions that build space manifests, parse invite link components, validate user-supplied fields before broadcast.

**Exit criteria:** each known candidate has shipped or been verified as non-extractable. New monolith hooks investigated as Phase 7 starts will surface more candidates — those land here.

---

## Phase 3 — Cat A2 query infrastructure decision

**Category:** C2 (promote-desktop) OR formal cleanup decision.
**Goal:** resolve the desktop `build*Key` / `build*Fetcher` / `useInvalidate*` query helpers question — either unify with shared's `queryKeys` and ship to shared, or formally close the door and document why.
**Risk:** low. Pure desktop refactor either way. The judgment call is the decision itself.
**Dependencies:** none.

**Context.** The 2026-05-28 hooks audit originally recommended these 55 files as PR-set 1, then withdrew the recommendation:
- Desktop's `buildSpacesKey() = ['Spaces']` (capital S) conflicts with shared's `queryKeys.spaces.all = ['spaces']` (lowercase). Same logical key, different cache slot.
- `build*Fetcher` files reference desktop-specific `MessageDB` type.
- `useInvalidate*` hooks aren't a pattern mobile uses (mobile inlines `queryClient.invalidateQueries`).

**Two paths:**
- **Path A.** Migrate desktop to use shared's `queryKeys` factory directly (rename desktop's cache keys to lowercase). One desktop-only refactor PR. Mobile already uses shared's keys. Then deprecate desktop's `build*Key` / `build*Fetcher` layer entirely.
- **Path B.** Formally classify all 55 files as "desktop-internal infrastructure, will not migrate." Document why in the hooks audit. Don't revisit.

**Exit criteria:** decision made, documented, executed.

---

## Phase 4 — Desktop `StorageContext` plumbing

**Category:** C2-flavored infrastructure (no business hooks change yet).
**Goal:** mirror mobile's `StorageContext` + `useStorageAdapter()` pattern on desktop, wrapping the existing `IndexedDBAdapter`. Pure plumbing — unlocks Phase 6.
**Risk:** medium. No shared changes, no business-hook changes yet, but it introduces a new DI layer desktop will adopt incrementally.
**Dependencies:** none. Can run in parallel with Phases 1-3.

**What ships:**
- `quorum-desktop/src/context/StorageContext.tsx` — provider wrapping `IndexedDBAdapter`.
- `useStorageAdapter()` hook with the same shape as mobile's.
- Provider wired into the app root.
- No existing business hook touched.

**Why this comes before Phase 6:** every Cat B "useMessageDB only" hook migration in Phase 6 will swap `useMessageDB()` for `useStorageAdapter()`. That swap can't happen until `useStorageAdapter()` exists on desktop.

**Exit criteria:** `useStorageAdapter()` exists on desktop, returns a working `StorageAdapter` instance, type-checks against shared's interface.

---

## Phase 5 — Lead-dev coordination point

**Category:** external dependency (not code work).
**Goal:** file a GitHub issue against `quorum-mobile` asking the two architectural questions the audit identified, then wait for direction.
**Risk:** external — we don't control timing. Lead has limited bandwidth.
**Dependencies:** wait until the existing notifications issue (mobile #65) gets a reply, OR until enough Phase 1-4 work has shipped to justify a second coordination ask. Don't double-load the lead's queue.

**Two questions to file** (verbatim from [designs/2026-05-28-hooks-audit-refresh.md](designs/2026-05-28-hooks-audit-refresh.md), "Crypto" and "Broadcast" sections):

1. **CryptoProvider DI.** Mobile instantiates `NativeCryptoProvider` ad-hoc at every space-crypto call site, plus a module-level singleton for DM crypto. Do we converge on a `CryptoContext` + `useCryptoProvider()` pattern (matching `StorageContext`), or stay ad-hoc?
2. **Broadcast pattern for shared mutation hooks.** Should shared hooks return constructed WS envelopes (caller dispatches), or accept an `onBroadcast(envelope)` callback?

**Why this gates Phases 6-7:** Phase 6 (useMessageDB-only hooks) doesn't need crypto or broadcast — it can ship without these answers. Phase 7 (monolith convergence) absolutely needs them, because the shareable mutation layer's shape depends on what the lead picks.

**Exit criteria:** lead replies, decision documented, Phases 6-7 unblocked.

---

## Phase 6 — Cat B "useMessageDB only" migration

**Category:** C3 (refactor to converge).
**Goal:** migrate the ~14 hooks that use `useMessageDB()` ONLY for storage operations (read/write spaces/messages/users, no broadcast, no crypto). They swap to `useStorageAdapter()`-routed shared hooks.
**Risk:** medium-high per hook, but each is independent and bisect-able.
**Dependencies:** Phase 4 (`useStorageAdapter()` exists on desktop). Independent of Phase 5.

**Hooks in scope** (from [designs/2026-05-28-hooks-audit-refresh.md](designs/2026-05-28-hooks-audit-refresh.md), "useMessageDB only" sub-bucket): `useBookmarks`, `useChannelManagement` (storage portions), `useGroupManagement` (storage portions), `useConversationPreviews`, `useUpdateReadTime`, `useUpdateThreadReadTime`, `useFolderDragAndDrop`, `useInviteProcessing`, `useTypingIndicator`, `useTypingNotifier`, `useSpaceDragAndDrop`, `useChannelThreads`, `useThreadMessages`, `useUserRoleManagement`.

**Per-hook shape**: identify which `useMessageDB()` calls are pure storage operations; swap to `useStorageAdapter()` routed through a shared hook. The non-storage portions (broadcast, crypto) stay desktop-only behind callbacks until Phase 7.

**Exit criteria:** all in-scope hooks either migrated or formally re-classified.

---

## Phase 7 — Cat B monolith convergence

**Category:** C3 (refactor to converge) — the heavyweight phase.
**Goal:** the four big business hooks where desktop has fat form-state controllers and mobile has split mutations. Following mobile's split-mutation pattern (per the workflow's "follow mobile patterns" rule), promote the mutation function bodies to shared. Desktop refactors its monoliths into thin form-state shells calling shared mutations.
**Risk:** highest. Lead-dev coordination required; desktop UX is touched; mobile may also need lockstep PRs.
**Dependencies:** Phase 5 answers (crypto DI + broadcast pattern). Phase 4 helpful but not strictly required.

**Order by ascending difficulty:**

- **7a. `useUserKicking`.** Easiest. Audit says state machine is line-for-line identical between platforms; only divergence is the param shape (mobile is `{ spaceId }`, desktop reads `useParams()`). Adopt mobile's param shape; kick implementation stays behind a callback. Desktop refactor: small.
- **7b. `useRoleManagement`.** Medium. Pure role-mutation logic is trivially shareable (`updateRolePermission`, etc.). But desktop's "stage then save" UX vs mobile's "save per action" UX is a real choice — likely surface in Phase 5 as a third question to the lead, or pick one approach and document the rationale. Desktop refactor: medium.
- **7c. `useChannelManagement` + `useInviteManagement`.** Hardest. Desktop monoliths are 396 and 520 LOC respectively; mobile has 10 and 6 split mutations. CRUD mutations promote to shared (matching mobile); desktop's form-state stays desktop-only; user-search / address-resolution in `useInviteManagement` stays desktop-only until mobile builds the same UX. Desktop refactor: medium-large.

**Exit criteria:** all four refactored or formally re-classified. Mobile PRs opened (where applicable) and tracked in [mobile-tasks-pending.md](mobile-tasks-pending.md).

---

## Phase 8 — Services revisits

**Category:** C2 / C3 mix (depends on the service).
**Goal:** re-evaluate the services currently blocked or deferred.
**Risk:** varies per service. Mostly defer-by-design.
**Dependencies:** Phases 4-7 mature.

**Services to revisit:**

- **ThreadService** — was blocked on hooks abstraction state. Clears after Phases 4-6. Reference: [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) §6.
- **BackupService** — still blocked on a shared symmetric crypto module. Separate dependency. Reference: §7.
- **channelThreadHelpers** — re-audit against mobile state once hook migration is mature. Reference: §5.

**Exit criteria:** each service either has a per-task plan + executed PR set, or is formally re-classified as "stays per-app" with rationale.

---

## Paused tracks (not in the linear sequence)

These run on their own clocks, independent of the phase sequence.

- **Notifications convergence** — mobile GitHub issue #65, no replies as of 2026-05-29. Architecturally complex (mobile MMKV + iOS NSE vs desktop `UserConfig`-synced settings). Full investigation in [../../reports/2026-05-28-notification-architecture-divergence.md](../../reports/2026-05-28-notification-architecture-divergence.md). Includes the deferred `getMutedChannelsForSpace` + `isChannelMuted` migration (pure functions blocked because they're notification-shaped).
- **Folder name length consistency** — 5-LOC opportunistic refactor, partly done (folder modal aligned to 50 chars; `useFolderNameValidation` still references the old 40-char constant). Pick up alongside any folder-touching task.
- **`useInviteManagement` 1-line nudge** — `manualAddress?.length === 46` heuristic could tighten to `isValidIPFSCID`. Folds naturally into Phase 7c.

## Explicit non-goals (don't re-debate)

These have been audited and classified as stays-per-app or out-of-scope. Surface a NEW reason if you want to revisit; don't restart the original debate.

- **MessageService** (~2000 lines, deeply coupled to desktop's decrypt pipeline + React Query + ActionQueue). [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) Context.
- **ConfigService, EncryptionService, SpaceService, InvitationService, SyncService, NotificationService, ActionQueueHandlers** — all stays-per-app. Same doc §8-14.
- **ActionQueueService** — re-audited 2026-05-28. Desktop is messaging reliability spine; mobile's `mutationQueue.ts` is a Farcaster-only stub with zero callers. [designs/2026-05-28-actionqueue-reaudit.md](designs/2026-05-28-actionqueue-reaudit.md).
- **SearchService** — re-audited 2026-05-29. Same MiniSearch config across platforms but desktop persists in IndexedDB, mobile rebuilds in-memory. Different storage models. [designs/2026-05-29-searchservice-reaudit.md](designs/2026-05-29-searchservice-reaudit.md).
- **Desktop's `build*Key` / `build*Fetcher` / `useInvalidate*` query helpers** (55 files) — currently unresolved. See Phase 3. Until Phase 3 closes, treat as "not a migration target by default" per the audit's withdrawn recommendation.

## Current state snapshot

**What's shipped** (see [shipped-log.md](shipped-log.md) for full chronology + lessons):
- Foundation: shared types, primitives, utils + tests, TypingService, ReceiptService, UserConfig field consolidation, notification types `Space*` rename + dedup.
- Hooks/validators: `useTwoStepConfirm`, 9 field validators with `errorKey` i18n pattern, `useAddressValidation` dedupe, `useInviteValidation` dedupe, key-backup dead-code cleanup.
- Length alignment: space `MAX_NAME_LENGTH` 40 → 50, `MIN_NAME_LENGTH` 2.

**Architectural snapshot:**
- `StorageAdapter` + `CryptoProvider` interfaces are already in shared. Mobile implements both. Desktop implements `IndexedDBAdapter` but doesn't expose `useStorageAdapter()` yet (Phase 4).
- Mobile structures business hooks as thin TanStack mutation wrappers over stateless services — NOT desktop's monolithic form-state pattern.
- Mobile has 67 hooks (not 17 as an earlier scan claimed). Most desktop business hooks have a mobile equivalent.

**Where we are on the phase sequence:**
- Phases 1-3 are all unblocked and can run today.
- Phase 4 unblocked.
- Phase 5 depends on the notifications issue #65 reply or accumulated Phase 1-4 work.
- Phases 6-7 gated on Phase 4 and (partially) Phase 5.
- Phase 8 gated on 4-7 maturing.

**Recommended next action:** start Phase 1 with `useKickConfirmation` extraction. The audit explicitly recommended it as PR-set 2 in May 2026 and it hasn't been done yet.

---

*Created 2026-05-29 — synthesizes the original migration goal (maximize shared code) with the hooks audit's per-phase recommendations and the cross-repo workflow's coordination constraints. Replaces the prior `status-recap.md` (status snapshot + queued work merged into this doc). Living doc — update phase exit criteria as work ships; surface new candidates by appending to the relevant phase's list.*
