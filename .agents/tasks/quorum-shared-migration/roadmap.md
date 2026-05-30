---
type: roadmap
title: Quorum-shared migration — phased roadmap (less risky to most risky)
status: living
created: 2026-05-29
updated: 2026-05-30
audience: any agent or contributor planning the next migration move
---

# Quorum-shared migration — roadmap

> **The master plan.** Goal: maximize shared code between `quorum-desktop` and `quorum-mobile` via the `@quilibrium/quorum-shared` package. This doc orders all known work from lowest-risk / quickest-yield to highest-risk / highest-leverage, with explicit dependencies between phases.
>
> **Companion docs**:
> - [README.md](README.md) — row-by-row status of every migration (catalog view).
> - [shipped-log.md](shipped-log.md) — chronological history of what's landed + lessons learned (read the "Top-level lessons" block at top).
> - [cross-repo-workflow.md](cross-repo-workflow.md) — workflow rulebook (cross-repo PR sequencing, i18n, mobile constraints).
>
> **This doc is the leverage-ordered plan view.** The README is the state-ordered catalog. The shipped-log is the time-ordered history. They overlap deliberately at no point.

## 🟢 Next session: start here

State at end of 2026-05-30 session: **role-mutation extraction shipped** (shared #21 + desktop #163 merged; mobile task queued). Phase 2 candidates exhausted. Concrete next moves, in order of leverage:

**1. Channel pinning removal** — only START if `2026-01-07-channel-ordering-feature.md` is the next desktop feature being implemented; otherwise leave as paused.

**2. Run a fresh small-bucket sweep**. The Phase 2 verifications surfaced bonus C1 findings (mobile reimplements shared utils). A targeted sweep across mobile's `hooks/chat/*` and `services/*` for "what does mobile inline that shared exports" could surface more.

**3. Wait on Phase 5 reply.** Issue [quorum-mobile#67](https://github.com/QuilibriumNetwork/quorum-mobile/issues/67) filed 2026-05-30. Lead reply unblocks Phase 7 (monolith convergence).

**Do NOT pick up Phases 5, 7, or 8.** Phase 5 is filing-only (no investigation). Phase 7 is gated on Phase 5 answers. Phase 8 has no unblocked candidates.

**Do NOT execute mobile task drops directly** — they're queued for runtime-test sessions (which we don't run). See [mobile-tasks-pending.md](mobile-tasks-pending.md) for what's queued; the lead reviews/merges on their schedule.

**Do NOT re-investigate closed phases.** All 6 are closed with full rationale. Trap taxonomy in shipped-log "Top-level lessons" block consolidates the failure modes.

**Cross-cutting work to be aware of**:
- [`../2026-01-07-channel-ordering-feature.md`](../2026-01-07-channel-ordering-feature.md) — desktop drag-and-drop channel reordering feature. Touches the migration in two ways: (1) reorder hooks intentionally kept desktop-local (decision recorded in task + migration roadmap Paused tracks), (2) channel pinning removal is cross-repo (mobile + shared + desktop coordination).

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

- ~~**`useKickConfirmation` extraction**~~ — **RESOLVED 2026-05-29.** Verified the audit's "line-for-line identical" claim. Finding: desktop's `useUserKicking` was already refactored to consume `useTwoStepConfirm` in the 2026-05-28 PR-set (so the audit's "extract `useKickConfirmation`" framing was obsolete the day it was written). Mobile is the only remaining inline holdout. No new shared hook needed — `useTwoStepConfirm` already IS the right abstraction. Mobile task dropped: [mobile #2026-05-29](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-adopt-useTwoStepConfirm-in-useUserKicking.md). Tracked in [mobile-tasks-pending.md](mobile-tasks-pending.md).
- ~~**`useSpaceOrdering`**~~ — **RESOLVED 2026-05-29 — classification C (stays per-app).** Three independent reasons: (1) it's a legacy shim on desktop, only called when `config.items` is absent (the folder-aware path uses `useNavItems` instead); (2) mobile sorts spaces by most-recent activity timestamp, ignoring `config.spaceIds` for display order — fundamentally different model; (3) the entire logic is ~15 lines of dedup + ordered-join, too thin to warrant a shared hook even if it converged. Verified against mobile `app/(tabs)/spaces/index.tsx:~131`. Future-action note: candidate for desktop deletion once the legacy-config path is confirmed unreachable.
- ~~**`useFolderStates`**~~ — **RESOLVED 2026-05-29 — classification D (defer).** Mobile has no folder UI: `configService.ts` validates `NavItem[]` for data integrity but no screen renders `type: 'folder'` items, no expand/collapse affordance, no folder-grouped nav tree. Mobile's spaces list is a flat `FlashList` over `Space[]`. Same blocker as the `NavItem.icon`/`.color` deferral already in the README status table: "deferred until mobile builds folders." Secondary blocker: `useFolderStates` uses `localStorage` directly; sharing it would require a `KeyValueAdapter` abstraction not yet designed (the existing `StorageAdapter` covers DB entities, not key-value UI prefs). Re-evaluate when mobile ships folder navigation.
- ~~**`useEmojiPicker`**~~ — **RESOLVED 2026-05-29 — classification C (stays per-app).** Three independent divergences: (1) `useEmojiPicker` itself is DOM-coupled (`DOMRect`, `window.innerHeight`/`Width`) for floating-overlay positioning; mobile uses a bottom-sheet Modal — different UX paradigm. (2) Frecency algorithms differ: desktop tracks raw hit counts (`useFrequentlyUsed.ts`); mobile uses exponential decay (`services/emojiFrecency.ts`: `score * 0.95` per use + `0.5^(hoursSinceUse/24)` time decay). (3) Data units differ: desktop stores unified codepoints (`"1f60d"`) and converts via `unifiedToNative()`; mobile stores native characters (`"😀"`). A `KeyValueAdapter` would NOT unblock this — the divergence is algorithmic, not just storage. Note: if either platform ever wants to align frecency behavior, that's an algorithm-first decision, not a shared-util task. The only shared surface is the `Emoji` custom-emoji type, already exported.

**Exit criteria:** ✅ **Phase 1 fully verified 2026-05-29.** All four named candidates resolved:
- `useKickConfirmation` → mobile task drop (desktop already done same-day).
- `useSpaceOrdering` → C (stays per-app: legacy on desktop + different mobile model).
- `useFolderStates` → D (defer: mobile no folder UI + no `KeyValueAdapter`).
- `useEmojiPicker` → C (stays per-app: algorithmic divergence, not just storage).

Net Phase 1 yield: **1 mobile task drop, 0 shared promotions**.

**Phase 1 wrap-up lessons:** four for four, "Category A pure on desktop" did not translate to shareable. The failure-mode taxonomy that emerged across this session (Phases 1-4) is below. This is the authoritative reference — apply as a checklist when verifying any candidate.

### Failure-mode taxonomy (the 6 traps)

- **Trap A — Already done same-day.** Audit framing went stale before publish. Example: `useKickConfirmation` extraction (desktop refactored to consume `useTwoStepConfirm` the same day the audit recommending the extraction was published).
- **Trap B — Mobile doesn't have the feature.** Even if desktop's logic is pure, mobile has no UI / no parallel data path. Example: `useFolderStates` (mobile has the type but no folder UI).
- **Trap C — Same data, different model.** Mobile's data layer uses the same shape but for a different purpose. Example: `useSpaceOrdering` (both platforms have `spaceIds` but desktop uses it for user-controlled drag-reorder; mobile uses it as a membership list and sorts spaces by activity).
- **Trap D — Same feature, different algorithm.** Both platforms have the feature but evolved independent implementations with different semantics. Example: `useEmojiPicker` frecency (desktop raw counts, mobile exponential decay; even data units differ).
- **Trap E — Platform-correct primitive divergence.** Both platforms use platform-appropriate primitives for the same algorithm; forcing convergence would regress one platform. Examples: AES-GCM config decrypt (Web Crypto vs `@noble/ciphers`, desktop would lose hardware acceleration + non-extractable keys); UUID generation (`crypto.randomUUID()` vs polyfill); Ed448 signing (`ch.js_sign_ed448` WASM vs `NativeCryptoProvider`).
- **Trap F — Singleton bypass.** A platform has a context system (e.g. `StorageContext`), but the candidate hooks bypass it via a module-level singleton. The context's existence doesn't imply hooks consume it. Example: mobile's `useChannelManagement` uses `getMMKVAdapter()` directly, not `useStorageAdapter()`. Verify hooks actually use the context before assuming a "mirror the pattern" migration is supported by precedent.

A candidate failing ANY of these traps is C (stays per-app) or D (defer). Use the taxonomy as a checklist during verification, not as a post-hoc rationalization.

**Key architectural finding surfaced**: the `KeyValueAdapter` gap. Two candidates (`useFolderStates`, likely `useAccentColor`) hit the same blocker — localStorage-coupled UI prefs that mobile would persist via MMKV. Tracking as a sub-task of Phase 4 (see Phase 4 update below).

**Recommended next move**: skip ahead to Phase 2 (pure-helper extraction from monoliths). Phase 1's bucket is exhausted; Phase 2 has known candidates that haven't been verified yet (the AES-GCM config-decryption block was the most-flagged in prior spot-checks).

---

## Phase 2 — Pure-helper extraction from monoliths

**Category:** C4 (extract pure helpers).
**Goal:** pull pure logic out of big desktop hooks into shared utilities. Desktop hooks become thinner, mobile gets new shareable utils.
**Risk:** low-medium. Additive shared changes, desktop refactors inline. No shared interface design.
**Dependencies:** none (independent of Phase 1).

**Known candidates** (each its own per-task file):

- ~~**AES-GCM config-decryption block**~~ — **RESOLVED 2026-05-29 — classification C (stays per-app).** Investigation surfaced **4 desktop copies** (not 2 as morning spot-check thought): `useOnboardingFlowLogic.ts:194-224` + `useUnifiedOnboardingFlow.ts:219-242` + `useUnifiedOnboardingFlow.ts:342-371` + `ConfigService.ts:75-128`. Mobile has the equivalent at `services/config/configService.ts:192-232` — semantically identical algorithm (SHA-512 → first 32 bytes → AES-256-GCM, IV = last 24 hex chars), same wire format, same output type. **But the implementations are platform-correct in different ways:** desktop uses `window.crypto.subtle` (Web Crypto, non-extractable keys, hardware accel); mobile uses `@noble/ciphers` (pure JS, natural for RN). Forcing convergence would be a security regression for desktop (Web Crypto → noble means keys move from non-extractable to raw `Uint8Array`). Shape A (`CryptoProvider` DI) is also wrong — `CryptoProvider` is the message-layer Ratchet/Ed448 interface, semantically mismatched with symmetric config crypto. **The desktop-internal duplication (4 copies → 1 helper) is still worth fixing** as a desktop-only task; tracked in "Paused tracks" below.
- ~~**Role-mutation pure functions**~~ — **✅ SHIPPED 2026-05-30.** Per-task file moved to `.done/`. Shared 2.1.0-21 ([quorum-shared#21](https://github.com/QuilibriumNetwork/quorum-shared/pull/21)) added `toggleRolePermission` + `setRolePermissions`. Desktop ([quorum-desktop#163](https://github.com/QuilibriumNetwork/quorum-desktop/pull/163)) consumes them in `useRoleManagement.ts`. Mobile task dropped at [`2026-05-30-mobile-adopt-shared-role-mutation-helpers.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-30-mobile-adopt-shared-role-mutation-helpers.md) — static-only verification, runtime test not required. The original bonus C1 finding (`useHasPermission`/`useUserPermissions`/`useUserRoles` mobile rewire) remains its own queued mobile task at [`2026-05-29-mobile-adopt-shared-permission-helpers.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-adopt-shared-permission-helpers.md).
- ~~**Manifest-construction helpers**~~ — **RESOLVED 2026-05-29 — classification D (bonus C1 findings, no Phase 2 extraction).** Audit overestimated both hooks: `useSpaceCreation` is 101 LOC of orchestration (not ~500); `useInviteManagement` is 197 LOC (not ~520). Real logic lives in `SpaceService.ts` (explicitly stays-per-app per services design). The only pure-liftable candidate inside `SpaceService` (Space object factory, SC-1) is too thin to warrant extraction (~20 LOC inlined once per platform; the call sites are interleaved with crypto so the extraction yields zero net LOC savings at call site). Manifest-encryption + key-derivation are Trap E (platform-correct primitive divergence: `ch.js_sign_ed448` WASM vs `NativeCryptoProvider`). **Two strong bonus C1 findings surfaced**: (1) mobile reimplements `getInviteUrlBase`/`VALID_INVITE_PREFIXES`/`parseInviteLink` locally in 2 files (~80 LOC) — mobile task dropped at [`2026-05-29-mobile-rewire-invite-helpers-to-shared.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-rewire-invite-helpers-to-shared.md); includes a real correctness fix (mobile's `getInviteUrlBase` hardcodes prod domain, breaks staging/localhost builds). (2) Confirms the deferred desktop `useInviteManagement` 1-line nudge in Paused tracks (`length === 46` → `isValidIPFSCID`).

**Exit criteria:** ✅ **Phase 2 fully verified 2026-05-29.** All three named candidates resolved:
- AES-GCM config decrypt → C (Trap E platform-correct crypto). Desktop-internal cleanup queued in Paused tracks.
- Role-mutation helpers → B (partial extraction scoped + bonus mobile C1 dropped).
- Manifest helpers → D (bonus mobile C1 dropped + reinforces existing Paused-tracks 1-liner).

Net Phase 2 yield: **1 scoped per-task file (role-mutation extraction, ready for execution), 2 mobile C1 tasks dropped, 1 desktop-internal cleanup queued, 1 Paused-tracks 1-liner reinforced**.

New monolith hooks investigated as Phase 7 starts will surface more candidates — those land here.

**Phase 2 lessons (2026-05-29):**
1. **"Duplicated across platforms" ≠ "shareable"** when both platforms made platform-correct independent implementation choices (e.g. Web Crypto vs noble). Symmetric crypto is the canonical example — browser-vs-native primitives diverge for good reasons.
2. **The audit overestimated hook LOC counts.** `useSpaceCreation` is 101 LOC (audit said ~500). `useInviteManagement` is 197 LOC (audit said ~520). The "fat monolith" framing was wrong for these two — they're orchestration shells. The real logic lives in `SpaceService.ts` which is explicitly stays-per-app.
3. **Bonus C1 findings dominate the value capture.** Both Phase 2 candidates surfaced higher-yield mobile-side C1 (mobile reimplements shared utils) findings than the original C4 target was worth. Two mobile task drops this round (permission helpers + invite helpers) ~140 LOC of mobile cleanup + 2 real correctness fixes (isSpaceOwner + getInviteUrlBase hardcoded prod).
4. **Recommended next move**: continue with Phase 3 (Cat A2 query infrastructure decision) OR start executing the scoped Phase 2 role-mutation extraction. Phase 3 is a judgment call (the Path A vs Path B decision); Phase 2 execution is straightforward but cross-repo coordination.

---

## Phase 3 — Cat A2 query infrastructure decision

**Category:** C2 (promote-desktop) OR formal cleanup decision.
**Goal:** resolve the desktop `build*Key` / `build*Fetcher` / `useInvalidate*` query helpers question — either unify with shared's `queryKeys` and ship to shared, or formally close the door and document why.
**Risk:** low. Pure desktop refactor either way. The judgment call is the decision itself.
**Dependencies:** none.

**Exit criteria:** ✅ **Phase 3 resolved 2026-05-29 — Path B (formal closure).**

The decision and full rationale are captured in [`designs/2026-05-28-hooks-audit-refresh.md`](designs/2026-05-28-hooks-audit-refresh.md) under "Phase 3 follow-up (2026-05-29) — formal closure" and reflected in the "Explicit non-goals" section of this roadmap.

**TL;DR of the decision**: four compounding grounds for closure:
1. Cache key shapes are structurally divergent (messages key has different segment count + semantics, not just casing).
2. `build*Fetcher` files are hard-typed to `MessageDB` and several reference DOM APIs.
3. Mobile does NOT use `useInvalidate*` wrappers — inlines `queryClient.invalidateQueries` with shared's `queryKeys` directly.
4. The real coupling surface is far larger than 55 files — it includes `MessageService.ts` (~5000 LOC, 15+ direct call sites), `SpaceService.ts`, `ConfigService.ts`, `EncryptionService.ts`, `InvitationService.ts`, `ActionQueueHandlers.ts`, `ThreadService.ts`, and several component files. All in the stays-per-app services layer.

**Lessons codified**:
- **"Pure on desktop = shareable" is wrong as a default**. The actual tests are: (a) does mobile use the pattern, and (b) is the data schema compatible with shared's existing exports. Both fail for A2.
- **Audit estimates that count only the "obvious" files can dramatically undercount the real refactor surface.** The 55-file figure missed the services layer that consumes these factories directly. Future audits of cross-cutting infra should grep for ALL consumers, not just the obvious wrappers.
- **Formal closure is a valid Phase outcome.** Path B is not failure — it's preventing future sessions from re-investigating the same files and hitting the same false-positive signal.

---

## Phase 4 — Desktop `StorageContext` plumbing

**Category:** C2-flavored infrastructure (no business hooks change yet).
**Goal:** mirror mobile's `StorageContext` + `useStorageAdapter()` pattern on desktop, wrapping the existing `IndexedDBAdapter`. Pure plumbing — unlocks Phase 6.
**Risk:** medium. No shared changes, no business-hook changes yet, but it introduces a new DI layer desktop will adopt incrementally.
**Dependencies:** none. Can run in parallel with Phases 1-3.

**Exit criteria:** ✅ **Phase 4 reclassified 2026-05-29 — recommendation C (wrong-shaped, not a Phase 6 prerequisite).**

Verification this session demonstrated the audit's Phase 4 framing was wrong on three independent grounds:

1. **`StorageAdapter` doesn't cover what most "useMessageDB only" hooks actually call.** Of the 14 hooks the audit named as Phase 6 candidates, only `useConversationPreviews` calls exclusively `StorageAdapter`-compatible methods (`messageDB.getMessage()`). The other 13 call `MessageDB`-specific richer methods (`addBookmark`, `removeBookmark`, `saveReadTime`, `getChannelThreads`, `getThreadStats`, `updateMessagePinStatus`, `muteUser`, `getAllEncryptionStates`, etc.) that are NOT in `StorageAdapter`. Routing them through `useStorageAdapter()` would leave them without the methods they need.
2. **13 of 14 "useMessageDB only" hooks have no mobile parallel at all.** Only `useChannelManagement` has a mobile counterpart. The other 13 — `useBookmarks`, `useConversationPreviews`, `useUpdateReadTime`, `useUpdateThreadReadTime`, `useFolderDragAndDrop`, `useInviteProcessing`, `useTypingIndicator`, `useTypingNotifier`, `useSpaceDragAndDrop`, `useChannelThreads`, `useThreadMessages`, `useGroupManagement`, `useUserRoleManagement` — don't exist on mobile. Phase 6's premise ("swap to a `useStorageAdapter()`-routed shared hook") requires the shared hook to exist first. For 13/14 candidates, no such shared hook exists. Those are Phase 7 (design-new-shared-hook) candidates, not Phase 6 swap candidates.
3. **The one hook with a mobile parallel bypasses mobile's own `StorageContext`.** Mobile's `useChannelManagement` uses `getMMKVAdapter()` (the module-level singleton) — not `useStorageAdapter()`. So even on the platform that HAS `StorageContext`, hooks that look like Phase 6 targets bypass the context entirely. Desktop adopting `StorageContext` wouldn't align with how mobile's actual hook works.

**New trap (Trap F — singleton bypass)**: both platforms have module-level adapter singletons (`getIndexedDBAdapter`, `getMMKVAdapter`) that are used independently of the context system. The context isn't universally adopted even on the platform that has it.

**Plus**: the original Phase 4 justification was half "unblock A2 query helpers" — and Phase 3 just formally closed A2 to stays-per-app. That half was already gone before this verification ran.

**Net**: Phase 4 as originally framed is NOT a prerequisite for Phase 6. Phase 4 is at most a narrow infrastructure nice-to-have for the 3 thin-wrapper shared hooks (`useSpaces`/`useChannels`/`useSendMessage`) that already use `useStorageAdapter()` on mobile. Even there, a one-line `useMemo(() => getIndexedDBAdapter(messageDB), [messageDB])` inside the specific hook does the job without a full `StorageContext` provider.

**Reshaping recommendation**:
- **Phase 4 reclassified** from "prerequisite for Phase 6" to "narrow infrastructure nice-to-have, NOT a gate." If/when the 3 thin-wrapper hooks become Phase 6 targets, the singleton-via-useMemo approach works without a `StorageContext` PR.
- **Phase 6 re-scope required**. The audit's 14-hook list was based on a false premise (that `StorageAdapter` covered their method needs). The actual Phase 6 surface is 1 hook (`useConversationPreviews`) plus possibly `useChannelManagement` if its mobile parallel's shape is adaptable. The other 12 are Phase 7 territory.
- **Phase 4b (`KeyValueAdapter`) unaffected**. Stands on its own merits (independent of `StorageAdapter`).

**Lessons codified**:
- **Trap F — singleton bypass**: when a platform has a context system, verify whether the candidate hooks actually use the context or bypass it via a singleton. Mobile's `useChannelManagement` was the example.
- **Audit Phase 6 list invalidated**: the "14 useMessageDB-only hooks" framing missed that 13/14 have no mobile parallel. Future Phase 6 planning needs hook-by-hook mobile parallel verification BEFORE classifying as Phase 6 candidates.
- **Phase prerequisite chains can be ghosts**: the audit declared Phase 4 a Phase 6 prerequisite based on assumptions (StorageAdapter covers the hooks' needs, hooks have mobile parallels). Test prerequisite claims directly before treating them as dependencies.

### Phase 4b — `KeyValueAdapter` (RECLASSIFIED 2026-05-29 — ghost prerequisite, close)

**Exit criteria:** ✅ **Phase 4b closed 2026-05-29 — recommendation C.** Verification showed all candidates are blocked by larger traps than the storage-layer gap. Full hook-by-hook grep of `localStorage` usage surfaced 4 candidates; ALL fail an earlier trap before `KeyValueAdapter` would matter:

- **`useFolderStates`**: Trap B (mobile has no folder UI; `git grep "folder" origin/master -- "*.tsx"` returned zero). `KeyValueAdapter` is the *second* gate; mobile building folders is the first gate. Designing gate 2 while gate 1 is shut produces zero value.
- **`useAccentColor`**: Trap B + Trap D combined. Trap B: mobile's `ThemeProvider` has `setAccentColor` wired up but **zero callsites** anywhere in `app/**` — the feature exists in code but not in the UX (mobile is hardcoded to `defaultAccentColor="blue"`). Trap D: even if mobile shipped an accent picker, desktop's `useAccentColor` mutates `document.documentElement.classList` to apply CSS classes — DOM-only application logic. The persistence is half the divergence; the application is the other half.
- **`useShowHomeScreen`**: Trap B. No mobile equivalent of the "empty DM home screen" UX feature.
- **`useFrequentEmojis`**: already classified stays-per-app (Phase 1, Trap D — algorithmic divergence between raw count vs exponential decay). Explicitly NOT unblocked by `KeyValueAdapter`.

Plus: mobile has NO shared "UI prefs" key-value abstraction. `MMKVAdapter` is for domain entities (implements `StorageAdapter`). `mirroredMMKV` is iOS-NSE-specific. Ad-hoc `createMMKV()` calls are per-feature singletons. The "mobile would implement `KeyValueAdapter` over MMKV" premise has no precedent on mobile to reference.

Plus: extending `StorageAdapter` with `getPreference/setPreference` would be a semantic mismatch — `StorageAdapter` is sync-layer data store, not device-local prefs store. Different architectural concerns.

**Re-evaluate trigger:** mobile ships folder navigation OR a user-facing accent color settings screen. At that point, check whether mobile uses MMKV for the preference, confirm the feature model matches desktop, then decide if `KeyValueAdapter` is still the right shape.

**Lessons codified (echoing Phase 4)**: prerequisite chains can be ghosts when the candidate hooks have bigger blockers than the "missing abstraction." The audit's note "`KeyValueAdapter` would unblock `useFolderStates`" was true as a second-order observation but wrong as a first-order action item because the first-order blocker (mobile no folder UI) was still in effect.

---

## Phase 5 — Lead-dev coordination point

**Category:** external dependency (not code work).
**Goal:** file a GitHub issue against `quorum-mobile` asking two architectural questions — `CryptoProvider` DI pattern + broadcast pattern for shared mutation hooks. Then wait for direction.
**Risk:** external — we don't control timing. Lead has limited bandwidth.
**Status as of 2026-05-30:** filed as [quorum-mobile#67](https://github.com/QuilibriumNetwork/quorum-mobile/issues/67). Awaiting lead reply. Original draft kept at `.temp/2026-05-29-phase5-coordination-issue.md` (gitignored) for reference.

**Why this gates Phase 7:** Phase 7 (monolith convergence) needs them because the shareable mutation layer's shape depends on what the lead picks. Phase 6 was closed empty 2026-05-29 — no longer waits on Phase 5.

**Exit criteria:** lead replies, decision documented, Phase 7 unblocked.

**Phase 5 lesson** (refined this session): Phase 5's value scales with how many concretely-blocked candidates exist. Today's verifications closed many Phase 6/7 candidates (stays-per-app, mobile-feature-absent, etc.), so the queue of work actually blocked on Phase 5 is smaller than the audit assumed. The questions matter for FUTURE Phase 7 work but aren't urgent today.

---

## Phase 6 — Cat B "useMessageDB only" migration

**Category:** C3 (refactor to converge).
**Goal (REVISED 2026-05-29)**: migrate ONLY the desktop hooks that use `useMessageDB()` ONLY for storage operations AND have an existing matching shared hook to migrate INTO.
**Risk:** low-medium per candidate (after rescoping). Each is independent and bisect-able.
**Dependencies:** none (Phase 4 reclassified as nice-to-have, not a prerequisite — see Phase 4 verification 2026-05-29). Independent of Phase 5.

### Audit's original 14-hook list — INVALIDATED 2026-05-29

The Phase 4 verification this session also invalidated Phase 6's hook list. The audit named 14 hooks: `useBookmarks`, `useChannelManagement`, `useGroupManagement`, `useConversationPreviews`, `useUpdateReadTime`, `useUpdateThreadReadTime`, `useFolderDragAndDrop`, `useInviteProcessing`, `useTypingIndicator`, `useTypingNotifier`, `useSpaceDragAndDrop`, `useChannelThreads`, `useThreadMessages`, `useUserRoleManagement`. The audit's classification assumed they could "swap `useMessageDB()` for `useStorageAdapter()` routed through a shared hook." That assumption was wrong on three independent grounds (see Phase 4 above for full detail):

1. **`StorageAdapter` doesn't cover most of their method needs.** 13 of 14 hooks call `MessageDB`-specific richer methods (`addBookmark`, `saveReadTime`, `getChannelThreads`, etc.) NOT in `StorageAdapter`.
2. **13 of 14 hooks have NO mobile parallel.** There's no shared hook to migrate them into. They are Phase 7 (design-new-shared-hook) candidates, not Phase 6 (swap-to-existing) candidates.
3. **The one with a mobile parallel (`useChannelManagement`) bypasses mobile's own `StorageContext`** — uses `getMMKVAdapter()` singleton directly.

### Phase 6 verification — empty (RESOLVED 2026-05-29)

**Exit criteria: ✅ Phase 6 has zero candidates. Formal closure.**

The Phase 4 invalidation identified `useConversationPreviews` as the single hook whose DB call (`getMessage`) fits in `StorageAdapter`. Phase 6 verification today confirmed that single fitness check was using the wrong test. The actual Phase 6 question is: **does a shared hook exist to migrate INTO?** Verification answered no on multiple grounds:

1. **No shared hook for conversation previews exists.** `quorum-shared/src/hooks/` exports `useTwoStepConfirm`, `useSpaces`, `useChannels`, `useMessages`, and several mutation hooks — but no `useConversations`/`useConversationPreviews`/equivalent. The pure utility `generateMessagePreview` IS shared at `src/utils/messagePreview.ts`, but desktop's hook already imports and uses it. That's the only shared piece.
2. **Mobile uses a different architectural model — Trap C.** Mobile stores `lastMessagePreview` directly on the `Conversation` record at write time (the `Conversation` extended type at `hooks/chat/useConversations.ts:14` includes `lastMessagePreview?: string`; `StorageAdapter.saveMessage`'s signature already accepts `conversationType`/`icon`/`displayName`, supporting write-time enrichment as the intended pattern). Desktop fetches messages at render time to compute previews. These are different write-path models, not different storage layers.
3. **Spot-check confirms Phase 4 was correct on the other 13.** `useBookmarks` calls `addBookmark`/`removeBookmark`; `useUpdateReadTime` calls `saveReadTime`; `useChannelThreads` calls `getChannelThreads`. None of these are in `StorageAdapter`. Phase 4's sampling was accurate; the audit's 14-hook list does not contain Phase 6 candidates.

**Net**: Phase 6 closes with 0 migrations executed. The audit's 14-hook list was based on a false premise that pure-import + `useMessageDB`-only equaled "ready to swap to shared." Future Phase 6-shaped work would need pre-existing shared hooks AND mobile actually using them — neither condition was met for any of the 14.

**Architectural pointer surfaced (worth tracking for Phase 8)**: desktop's `useConversationPreviews` would become unnecessary if desktop's `saveMessage` path populated `Conversation.lastMessagePreview` at write time like mobile does. That's a write-path alignment task, not a hook migration. Listed under "Paused tracks" with the existing AES-GCM/channel-ordering helpers.

**Phase 6 lessons codified**:
- **The right Phase 6 test isn't "fits StorageAdapter" — it's "shared hook exists AND mobile uses it."** Both conditions must hold; either alone is misleading.
- **Architectural divergence at the write path can masquerade as a read-path migration opportunity.** When desktop has a hook that exists to compensate for missing data, the migration target is the write-path that creates the data, not the read-path hook itself.
- **Phase 7 absorbs what Phase 6 rejected.** The 13 hooks the audit named are not "stays per-app" — they're Phase 7 candidates (design new shared hooks) IF a future session decides convergence is worth the work. Most are gated on Phase 5 (broadcast/crypto DI answers).
- **Trap F (singleton bypass) is real**: a hook using `getMMKVAdapter()` on mobile is NOT validating the `useStorageAdapter()` pattern, even though the context exists.

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
- ~~**Folder name length consistency**~~ — ✅ ALREADY RESOLVED (verified 2026-05-30 session 3). `useFolderManagement.ts` imports `MAX_NAME_LENGTH` from `@quilibrium/quorum-shared` (currently 50). The old `useFolderNameValidation` hook the Paused-tracks entry referenced no longer exists. Entry was stale.
- ~~**`useInviteManagement` 1-line nudge**~~ — ✅ SHIPPED 2026-05-30 (`isValidIPFSCID` from shared replaces the length === 46 heuristic).
- ~~**Desktop-internal AES-GCM config-decrypt dedup**~~ — ✅ SHIPPED 2026-05-30 on `session/2026-05-30` branch. `decryptUserConfig(encryptedHex, privateKeyBytes)` helper added to `src/utils/crypto.ts` + `src/utils/crypto.web.ts`. Replaces 4 inline copies (`useOnboardingFlowLogic`, two in `useUnifiedOnboardingFlow`, `ConfigService`). Net -47 LOC. Smoke tested: fresh-login decrypt + after-refresh sync both work.
- **Channel reorder pure helpers (future C4 candidate)** — desktop's upcoming channel-ordering feature ([`../2026-01-07-channel-ordering-feature.md`](../2026-01-07-channel-ordering-feature.md)) ships reorder hooks as **desktop-local** for now (avoids committing to a broadcast-DI pattern before lead-dev review). The pure `Space → Space` transforms underneath (`moveChannelInSpace`, `reorderGroupsInSpace`, `reorderChannelsInGroup`) are identical between desktop and mobile — clean C4 extraction candidate for a future session once the feature ships. Same shape as today's role-mutation extraction. Re-evaluate after the feature ships AND mobile addresses the broadcast gap ([mobile issue #66](https://github.com/QuilibriumNetwork/quorum-mobile/issues/66)).
- **Channel pinning removal (cross-repo)** — separate from the migration; tracked in [`../2026-01-07-channel-ordering-feature.md`](../2026-01-07-channel-ordering-feature.md) section 6. Drops `Channel.isPinned`/`pinnedAt` from shared types + mobile's unused `usePinChannel` mutation + desktop's pin UI. Pattern A cross-repo sequencing (mobile first, then shared, then desktop). Discovery during Phase 4-b discussions: mobile DOES have `usePinChannel` mutation defined but with **zero UI callsites** (same Trap F pattern as `setAccentColor`). Not blocking the migration roadmap — listed here for cross-context awareness.
- **Desktop `saveMessage` write-path conversation-preview enrichment** — surfaced by Phase 6 verification 2026-05-29. Desktop's `useConversationPreviews` exists because desktop's write path doesn't populate `Conversation.lastMessagePreview` at save time. Mobile already does (extended `Conversation` type at `hooks/chat/useConversations.ts:14`; shared's `StorageAdapter.saveMessage` signature already supports it via `conversationType`/`icon`/`displayName` params). Aligning desktop's `saveMessage` path to populate `lastMessagePreview` at write time would eliminate the entire `useConversationPreviews` hook as a side effect. Not high-priority — desktop's current pattern works — but worth keeping on the radar for Phase 8 services revisits.

## Explicit non-goals (don't re-debate)

These have been audited and classified as stays-per-app or out-of-scope. Surface a NEW reason if you want to revisit; don't restart the original debate.

- **MessageService** (~2000 lines, deeply coupled to desktop's decrypt pipeline + React Query + ActionQueue). [designs/2026-05-18-services-design.md](designs/2026-05-18-services-design.md) Context.
- **ConfigService, EncryptionService, SpaceService, InvitationService, SyncService, NotificationService, ActionQueueHandlers** — all stays-per-app. Same doc §8-14.
- **ActionQueueService** — re-audited 2026-05-28. Desktop is messaging reliability spine; mobile's `mutationQueue.ts` is a Farcaster-only stub with zero callers. [designs/2026-05-28-actionqueue-reaudit.md](designs/2026-05-28-actionqueue-reaudit.md).
- **SearchService** — re-audited 2026-05-29. Same MiniSearch config across platforms but desktop persists in IndexedDB, mobile rebuilds in-memory. Different storage models. [designs/2026-05-29-searchservice-reaudit.md](designs/2026-05-29-searchservice-reaudit.md).
- **Desktop's `build*Key` / `build*Fetcher` / `useInvalidate*` query helpers** (55 files) — **Phase 3 decision 2026-05-29: stays per-app. Will not migrate.** Four reasons: (1) cache key shapes structurally diverge from shared's `queryKeys` (not just casing — messages key has different segment count and semantics); (2) `build*Fetcher` files are typed to `MessageDB` and some reference DOM APIs; (3) mobile does NOT use `useInvalidate*` wrappers (inlines `queryClient.invalidateQueries` with shared's `queryKeys` directly); (4) the real coupling surface includes the stays-per-app services layer (`MessageService.ts` ~5000 LOC with 15+ direct call sites, plus 5 other services + several components). Refactor cost dwarfs any cross-platform value. Full rationale in [designs/2026-05-28-hooks-audit-refresh.md](designs/2026-05-28-hooks-audit-refresh.md) under "Phase 3 follow-up (2026-05-29) — formal closure".

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
