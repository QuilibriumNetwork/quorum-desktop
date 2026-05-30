---
type: archive
title: Quorum-shared migration — shipped-log archive (older entries)
status: archive
created: 2026-05-29
audience: only read if you specifically need historical context
---

# Shipped-log archive — older entries

> Entries here are preserved chronologically but NOT in the active reading path. The active [shipped-log.md](shipped-log.md) keeps the 5 most recent entries plus a consolidated "Top-level lessons" block. Most sessions don't need to read this archive.
>
> **When to read this archive:**
> - You're looking for a specific historical decision and the active log doesn't have it.
> - You want full chronological context on how the trap taxonomy / lessons emerged.
> - You're auditing whether a Phase X decision was applied correctly given what was known at the time.

---

## 2026-05-29 — Phase 6 closure: zero candidates after correct test applied

**Scope**: verify whether `useConversationPreviews` (the single surviving Phase 6 candidate after Phase 4's invalidation) is actually portable to shared. Also spot-check 3 of the other 13 audit-named hooks to confirm Phase 4's invalidation was accurate.
**Result**: classification **C — Phase 6 has zero candidates. Formal closure**.

**Key insight**: Phase 4's invalidation kept `useConversationPreviews` alive on the grounds that it calls `messageDB.getMessage()` exclusively, which IS in `StorageAdapter`. But that test was using the wrong condition. **The correct Phase 6 test is: does a shared hook exist to migrate INTO?** Verification said no:

1. **Shared has no equivalent hook.** `quorum-shared/src/hooks/` exports `useTwoStepConfirm`, `useSpaces`, `useChannels`, `useMessages`, and mutation hooks. No `useConversations`/`useConversationPreviews`/equivalent. The pure `generateMessagePreview` utility IS shared at `src/utils/messagePreview.ts`, and desktop's hook already imports it. That's the only shared piece — not a hook migration.
2. **Mobile uses a different architectural model (Trap C — same feature, different model).** Mobile stores `lastMessagePreview` directly on the `Conversation` record at write time (extended type at `hooks/chat/useConversations.ts:14`). Desktop fetches messages at render time to compute previews on the fly. `StorageAdapter.saveMessage`'s signature already supports write-time enrichment via `conversationType`/`icon`/`displayName` params — suggesting that IS the intended shared pattern. Desktop's hook is a compensating pattern for desktop's write path not enriching the Conversation record.

**Spot-check of other 13 audit-named hooks confirmed Phase 4's verdict** (`useBookmarks` calls `addBookmark`/`removeBookmark`; `useUpdateReadTime` calls `saveReadTime`; `useChannelThreads` calls `getChannelThreads` — none in `StorageAdapter`). Phase 4's sampling was accurate; the audit's 14-hook list does not contain Phase 6 candidates.

**Architectural pointer surfaced for Phase 8** (added to Paused tracks): desktop's `useConversationPreviews` would become unnecessary if desktop's `saveMessage` path populated `Conversation.lastMessagePreview` at write time like mobile does. That's a write-path alignment task, not a hook migration. Not high-priority — current pattern works — but worth keeping on radar for Phase 8 services revisits.

**Action taken**: roadmap Phase 6 section rewritten to mark exit criteria ✅ with full rationale + lessons. Architectural pointer added to Paused tracks.

**Mobile**: not touched.
**PRs**: none — investigation only.

---

## 2026-05-29 — Phase 4b reclassification: `KeyValueAdapter` is a ghost prerequisite

**Scope**: verify whether the `KeyValueAdapter` abstraction proposed for Phase 4b would actually unblock anything when verified against current platform state. Phase 4b was added today during Phase 1 verification as a side finding.
**Result**: classification **C — ghost prerequisite, close**.

Hook-by-hook grep of `localStorage.(getItem|setItem)` in `src/hooks/` found 4 candidates. ALL fail an earlier trap before `KeyValueAdapter` would matter:
- `useFolderStates`: Trap B (mobile no folder UI). `KeyValueAdapter` is gate 2; mobile building folders is gate 1.
- `useAccentColor`: Trap B + D. Mobile's `ThemeProvider` has `setAccentColor` wired but **zero callsites** anywhere — feature in code but not in UX (hardcoded to blue). Even if mobile shipped an accent picker, desktop mutates `document.documentElement.classList` (DOM-only).
- `useShowHomeScreen`: Trap B (no mobile equivalent of empty-DM-home-screen UX).
- `useFrequentEmojis`: already stays-per-app from Phase 1 (Trap D algorithmic divergence).

Mobile has NO shared UI-prefs key-value abstraction. `MMKVAdapter` is for domain entities; `mirroredMMKV` is iOS-NSE-specific; ad-hoc `createMMKV()` calls are per-feature singletons. The premise "mobile would implement `KeyValueAdapter` over MMKV" has no mobile precedent to reference.

Also rejected: extending `StorageAdapter` with `getPreference/setPreference` (Path D from the original proposal). That would be a semantic mismatch — `StorageAdapter` is sync-layer data store, not device-local prefs store.

**Action taken**: roadmap Phase 4b section reclassified to C with full rationale + re-evaluate trigger (mobile ships folder UI OR accent color settings).

**Mobile**: not touched.
**PRs**: none — Phase 4b was a verification/closure task.

---

## 2026-05-29 — Phase 4 reclassification + Phase 6 invalidation: prerequisite chain was a ghost

**Scope**: verify whether Phase 4 (introduce `StorageContext` + `useStorageAdapter()` on desktop) is still real implementation work after Phase 3 closed Cat A2. Apply the same scepticism that surfaced Trap A-E in prior verifications.
**Result**: classification **C — Phase 4 is wrong-shaped, AND it invalidates the audit's Phase 6 candidate list**.

**Three independent reasons Phase 4 isn't a Phase 6 prerequisite:**

1. **`StorageAdapter` is too narrow for the audit's Phase 6 candidates.** Traced `useBookmarks` directly: calls `messageDB.addBookmark()`, `messageDB.removeBookmark()` — NOT in `StorageAdapter`. Same pattern for `useUpdateReadTime` (`saveReadTime`), `useChannelThreads`/`useThreadMessages` (`getChannelThreads`, `getThreadMessages`, `getThreadStats`), pin/mute hooks (`updateMessagePinStatus`, `muteUser`), encryption-state hooks (`getAllEncryptionStates`). Of the audit's 14 named hooks, ONLY `useConversationPreviews` calls exclusively `StorageAdapter`-compatible methods. The other 13 need `MessageDB`-specific richer methods.
2. **13 of 14 audit-named hooks have NO mobile parallel at all.** Phase 6's premise ("swap to `useStorageAdapter()`-routed shared hook") requires the shared hook to exist first. For 13/14 candidates, no such shared hook exists. They are Phase 7 (design-new-shared-hook) territory, not Phase 6 (swap-to-existing) territory.
3. **The one hook with a mobile parallel bypasses mobile's own `StorageContext`.** Mobile's `useChannelManagement` uses `getMMKVAdapter()` — the module-level singleton — NOT `useStorageAdapter()`. Trap F.

**Plus the half-justification was already gone**: the audit's Phase 4 case was two-pronged ("unblocks A2 query helpers + unblocks Cat B useMessageDB-only hooks"). Phase 3 formally closed A2 today.

**Action taken** — two roadmap revisions:
1. **Phase 4 reclassified** from "prerequisite for Phase 6" to "narrow infrastructure nice-to-have, NOT a gate."
2. **Phase 6 candidate list invalidated and revised.** Actual Phase 6 surface is 1 candidate (`useConversationPreviews`) plus possibly `useChannelManagement` (Phase 7-flavored). Other 12 move to Phase 7 territory or stays-per-app.

Phase 4b (`KeyValueAdapter`) unaffected — stands on its own merits.

**Mobile**: not touched.
**PRs**: none — Phase 4 was a verification/decision task, not code.

---

## 2026-05-29 — Phase 3 resolution: A2 query infrastructure stays per-app (formal closure)

**Scope**: resolve the long-standing Cat A2 query infrastructure question — Path A (migrate desktop's 55 query helper files to shared) vs Path B (formally close). The 2026-05-28 hooks audit originally recommended Path A, then withdrew it; Phase 3 was created to make the final call.
**Result**: **Path B — formal closure. Will not migrate.**

**Four compounding grounds for closure** (each verified directly via subagent investigation against current desktop + mobile + shared):

1. **Cache key shapes are structurally divergent**, not just casing. Desktop's messages key is `['Messages', spaceId, channelId, 'with-threads'|'no-threads']`. Shared's is `['messages', 'infinite', spaceId, channelId]`. Different segment count AND different semantics (thread variant vs infinite scroll marker). Migration would require either dropping desktop's thread-variant isolation or adding a mobile-unused key shape to shared.
2. **`build*Fetcher` files are hard-typed to `MessageDB`**. Three sampled (`buildSpacesFetcher`, `buildMessagesFetcher`, `buildBookmarksFetcher`) all import `MessageDB` from `../../../db/messages`. The messages fetcher additionally references `isWeb()` and `window.location.hash` — DOM APIs.
3. **Mobile does NOT use `useInvalidate*` wrappers** (verified by direct grep on `origin/master`, not assumed). Mobile inlines `queryClient.invalidateQueries({ queryKey: queryKeys.<domain>... })` at the call site.
4. **The real coupling surface is far larger than 55 files** — the audit dramatically undercounted. The desktop services layer consumes these factories directly: `MessageService.ts` (~5000 LOC, 15+ call sites using `buildMessagesKey` for `setQueryData` / `invalidateQueries`), plus `SpaceService.ts`, `ConfigService.ts`, `EncryptionService.ts`, `InvitationService.ts`, `ActionQueueHandlers.ts`, `ThreadService.ts`, and component files. Estimated 80-100+ touch points across files explicitly classified as stays-per-app.

**Action taken**: documented the decision in three places:
- `designs/2026-05-28-hooks-audit-refresh.md` — appended "Phase 3 follow-up (2026-05-29) — formal closure" subsection to the "Withdrawn original recommendation" block.
- `roadmap.md` Phase 3 — marked exit criteria ✅ resolved with TL;DR + lessons.
- `roadmap.md` "Explicit non-goals" — strengthened the existing entry from "currently unresolved" to "stays per-app. Will not migrate."

**Bonus C1 finding** (logged for future awareness): mobile's `hooks/chat/useChannelManagement.ts` uses **raw string keys** (`['channels', spaceId]`, `['spaces', spaceId]`, `['spaces']`) instead of shared's `queryKeys` factory. Minor mobile inconsistency — not high-priority enough to drop as a separate task yet, but worth flagging if a future mobile session touches `useChannelManagement`.

**Mobile**: not touched. Mobile is the side that's already done it right (uses shared's `queryKeys` correctly throughout).
**PRs**: none — Phase 3 was a documentation decision.

---

## 2026-05-29 — Phase 2 verification: manifest helpers — no extraction, but big bonus C1 win

**Scope**: verify whether pure manifest-construction / invite-parsing helpers inside `useSpaceCreation` and `useInviteManagement` are extractable to shared. Third Phase 2 candidate.
**Result**: classification **D — bonus C1 findings only**. The headline numbers:

**Audit framing wrong**: `useSpaceCreation` is **101 LOC** of orchestration (audit said ~500 monolith). `useInviteManagement` is **197 LOC** (audit said ~520). Both are thin React shells around `SpaceService.ts` / `MessageDB` — the real logic lives in `SpaceService` which is explicitly stays-per-app per the services design.

**Pure-liftable candidate considered + rejected**: the Space object factory inside `SpaceService.createSpace()` (lines 219-251) is genuinely pure (~20 LOC), and mobile has the byte-identical pattern at `services/space/spaceService.ts:148-177`. BUT the call sites are interleaved with crypto operations, so extracting to a shared `buildSpaceObject()` factory saves zero net LOC at the call site (one inlined block becomes one function call of equivalent length). Weak B candidate — not worth shipping standalone. Manifest-encryption + key derivation are Trap E (`ch.js_sign_ed448` WASM vs `NativeCryptoProvider`).

**Bonus C1 finding (high value)**: mobile has THREE local reimplementations of helpers shared already exports, across TWO files:
- `services/space/inviteService.ts:68-72` — local `getInviteUrlBase()` **hardcodes `app.quorummessenger.com`**. Shared's `getInviteUrlBase()` does proper env detection (prod/staging/localhost). Mobile's invite links in non-prod builds point at production — real correctness bug.
- `services/space/inviteService.ts:26-36` + `hooks/chat/useSpaceActions.ts:26-36` — two copies of a hardcoded `VALID_INVITE_PREFIXES` array. Shared's `getValidInvitePrefixes()` is authoritative.
- `services/space/inviteService.ts:157-189` + `hooks/chat/useSpaceActions.ts:90-128` — two reimplementations of `parseInviteLink`. Shared's `parseInviteParams` is the canonical version desktop adopted in commit `17e19b70` (2026-05-29 morning).

Mobile task dropped at [`2026-05-29-mobile-rewire-invite-helpers-to-shared.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-rewire-invite-helpers-to-shared.md). ~80 LOC removed across 2 files + the prod-domain hardcode bug fixed. Runtime-test required (behavior change in non-prod builds is intentional fix).

**Secondary confirmation**: the desktop `useInviteManagement.ts:97` 1-liner already in Paused tracks (`length === 46` → `isValidIPFSCID`) is confirmed valid. Stays in Paused for bundling with the next invite-touching task.

**Action taken**: mobile task drop + mobile-tasks-pending row added + mobile INDEX regenerated + roadmap updated + Phase 2 marked exit criteria ✅ (all three named candidates resolved). No new desktop per-task file — there's no Phase 2 extraction shape that fits.

**Lessons**: (1) **Audits can overestimate hook sizes** when judging by "monolith" feel rather than LOC. The 101 vs ~500 and 197 vs ~520 gaps in this round are big — and they would have steered scoping wrong if not directly verified. (2) **C1 findings dominated this Phase 2 round's value capture.** Across the two surface-deep Phase 2 candidates with bonus findings (role mutations + manifest), the mobile-side C1s were higher-yield than the C4 extractions. Looking for "what shared already exports that mobile reimplements" is at least as valuable as "what desktop has that we could promote." (3) **`SpaceService.ts` is the next-tier audit target** — it contains the real logic both Phase 2 hooks delegate to. The services-design doc classifies it as stays-per-app, but partial extractions of pure helpers inside it (the Space object factory was one example) could still warrant a separate audit at Phase 8.
**Mobile**: task drop only (this session).
**PRs**: none.

---

## 2026-05-29 — Phase 2 verification: role-mutation helpers scoped (B) + bonus C1 surfaced

**Scope**: verify whether pure role-mutation helpers inside desktop's `useRoleManagement` are extractable to shared. Second Phase 2 candidate.
**Result**: classification **B — ship partial set**. Plus a high-value bonus finding.

**Primary finding (B — clean extraction):** two pure helpers are byte-for-byte identical in desktop + mobile:
- `toggleRolePermission(role, permission)`: 5 LOC each — `useRoleManagement.ts:96-112` (desktop) and `hooks/chat/useRoleManagement.ts:417-422` (mobile).
- `setRolePermissions(role, permissions)`: 3 LOC — desktop `useRoleManagement.ts:114-124`, mobile via `useUpdateRole` aggregate params.

Both extractable cleanly to shared `src/utils/roleUtils.ts`. Per-task file scoped at [`2026-05-29-migrate-role-mutation-helpers.md`](2026-05-29-migrate-role-mutation-helpers.md).

**Scope guardrails** (explicit not-extractions, all justified): UUID gen (Trap E — platform-correct primitive divergence, same as AES-GCM); `toggleRolePublic` (tiny semantic divergence: `=== false` vs `??`; 2 LOC extraction overhead exceeds payoff); per-field setters (1-2 LOC each, too thin for shared API surface); member assignment (desktop doesn't manage membership in this hook).

**Bonus finding (C1, separate task)**: mobile's `useHasPermission`/`useUserPermissions`/`useUserRoles` in `hooks/chat/useRoleManagement.ts:56-115` are full React-hook reimplementations of logic shared already exports as pure functions (`hasPermission`/`getUserPermissions`/`getUserRoles` in `src/utils/permissions.ts`). ~60 LOC duplication on mobile. **Plus a correctness gap**: mobile's hooks don't accept or check `isSpaceOwner`, so space owners get false/empty back from permission checks. Mobile task dropped at [`2026-05-29-mobile-adopt-shared-permission-helpers.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-adopt-shared-permission-helpers.md). Runtime-test required (behavior change for owners is intentional fix).

**Action taken**: per-task file written (desktop side), mobile task dropped, mobile-tasks-pending row added, roadmap updated, Phase 2 next candidate advanced to manifest-construction helpers.

**Lessons**: (1) **B (partial extraction) is a valid Phase 2 outcome** — pure-helper extraction doesn't have to be all-or-nothing. Scope guardrails (UUID gen, near-misses, too-thin helpers) keep the shared API surface tight while shipping the real wins. (2) **Phase 2 verifications surface adjacent C1 findings.** Looking at role-mutation logic surfaced the read-side C1 (mobile reimplements shared's read helpers). Worth treating as a positive externality of thorough investigations. (3) **Correctness gaps are gifts**, especially when found in mobile code we can't run. The `isSpaceOwner` miss in mobile's `useHasPermission` is a real bug; the rewire to shared fixes it as a side effect.
**Mobile**: task drop only (this session). Mobile leg of the extraction queued for after desktop+shared PRs merge.
**PRs**: none — task scoped, not yet executed.

---

## 2026-05-29 — Phase 2 verification: AES-GCM config decrypt stays per-app (platform-correct crypto choices)

**Scope**: verify whether the AES-GCM config-decryption block flagged in the 2026-05-29 morning spot-check is a shared-helper extraction candidate. Phase 2 (extract-pure-helpers from monoliths) first verified candidate.
**Result**: classification **C — stays per-app**. Two-layer finding:

**Layer 1 — Desktop duplication is bigger than flagged**: morning spot-check found 2 copies (`useOnboardingFlowLogic.ts:194-224` + `useUnifiedOnboardingFlow.ts:219-242`). Phase 2 verification found **4 copies** — also `useUnifiedOnboardingFlow.ts:342-371` (a second effect in the same file) and `ConfigService.ts:75-128` (production sync path). All four are byte-for-byte identical except for the source variable holding the private key.

**Layer 2 — Mobile has the equivalent at `services/config/configService.ts:192-232`** with semantically identical algorithm (SHA-512 → first 32 bytes → AES-256-GCM, IV = last 24 hex chars, same wire format, same output `UserConfig`). BUT the implementations are platform-correct in different ways:
- Desktop: `window.crypto.subtle.digest` + `importKey` + `decrypt` — Web Crypto API, non-extractable keys, hardware acceleration.
- Mobile: `@noble/hashes/sha2` + `@noble/ciphers/aes.gcm()` — pure JS, natural for React Native (Web Crypto unavailable).

**Why neither shape works for shared extraction**:
- **Shape A (`CryptoProvider` DI)**: semantically mismatched. `CryptoProvider` is the message-layer Ratchet/Ed448/X3DH interface. Symmetric config crypto is a different layer. Adding `aesGcmDecrypt` to that interface would mix domains. Also gated on Phase 5 (desktop doesn't yet instantiate `WasmCryptoProvider`).
- **Shape B (portable `@noble/ciphers` shared util)**: forces desktop to drop Web Crypto. Security regression — Web Crypto keeps key material non-extractable; noble exposes raw `Uint8Array`s in JS heap. Hardware acceleration also lost. Both encrypt and decrypt paths would need conversion. Not worth it for a ~15-LOC helper.

**Action taken**: roadmap updated, candidate marked resolved with cross-link to "Paused tracks" where the desktop-internal cleanup is tracked. Phase 2 next candidate advanced to role-mutation pure functions in `useRoleManagement`. No code change.

**Desktop-internal cleanup still recommended** (added to Paused tracks): collapse the 4 Web Crypto copies into one `decryptUserConfig(encryptedHex, privateKeyBytes)` helper in `src/utils/crypto/` or `src/services/crypto/`. Zero risk, no shared changes, no cross-repo coordination. Worth bundling with any future onboarding-touching task.

**Lessons**: (1) **"duplicated across platforms" ≠ "shareable"** when each platform's implementation reflects a platform-correct primitive choice. The C4 (extract pure helpers) shape works best when both platforms either already use the same primitives, or one platform's primitives are clearly superior. Symmetric crypto is a domain where browser-vs-native primitives diverge for good reasons. (2) **Always count the duplicates** — the morning spot-check found 2; Phase 2 verification found 4. Inline duplication tends to be under-counted when the surrounding hook is long enough that grep-by-name misses copies inside service files. (3) **Desktop-internal cleanup is a valid Phase 2 outcome** even when shared promotion fails. Track it as a Paused-tracks item so it doesn't get lost.

**Mobile**: not touched. Mobile's noble-backed implementation stays as-is.
**PRs**: none — investigation only.

---

## 2026-05-29 — Phase 1 verification: `useEmojiPicker` stays per-app (algorithmic divergence)

**Scope**: verify whether desktop's emoji-picker hooks (`useEmojiPicker`, `useFrequentEmojis`, `useFrequentlyUsed`) are viable shared-promotion candidates. Last Phase 1 candidate.
**Result**: classification **C — stays per-app**. Three independent divergences:
1. **`useEmojiPicker` is DOM-coupled.** Uses `DOMRect`, `window.innerHeight`, `window.innerWidth` to flip the picker upward when there's insufficient space below. Mobile's picker is a `Modal` that slides up from the bottom — different UX paradigm, not just different framework.
2. **Frecency algorithms genuinely differ.** Desktop's `useFrequentlyUsed.ts` tracks raw hit counts (`count + 1`, sorted by `count DESC, lastUsed DESC`). Mobile's `services/emojiFrecency.ts` uses exponential decay (`score * DECAY_FACTOR (0.95)` per use + `Math.pow(0.5, hoursSinceUse/24)` time decay, sorted by decayed score). Different mathematical model.
3. **Data units differ.** Desktop stores unified codepoints (`"1f60d"`) and converts via `unifiedToNative()` at render time. Mobile stores native characters (`"😀"`) directly. Even data normalization would need to happen first.

Plus the persistence layer: desktop `localStorage` (sync) vs mobile `expo-file-system` (async). A `KeyValueAdapter` would NOT unblock this — the divergence is algorithmic, not just storage. If either platform ever wants to converge frecency behavior, that's an algorithm-first decision (pick one model), not a shared-util task.

**Architectural finding promoted to Phase 4b**: the `KeyValueAdapter` gap was confirmed twice in Phase 1 (`useFolderStates`, likely `useAccentColor`). Added as a sub-phase to Phase 4 (`StorageContext` plumbing) — narrow scope, UI prefs only, not a general-purpose store. Won't fix algorithmic mismatches like `useEmojiPicker`.

**Phase 1 wrap-up**: ✅ all four candidates verified. Yield: 1 mobile task drop, 0 shared promotions. Four distinct "trap" failure modes documented (A: same-day stale, B: feature absent, C: same data different model, D: same feature different algorithm). Roadmap recommends advancing to Phase 2 (pure-helper extraction from monoliths) as the next high-leverage move.

**Lessons**: (1) "Category A pure on desktop" continues to be a misleading proxy for "shareable." The actual shareability test is per-pair-of-platforms verification of feature + data model + algorithm — not just import purity. (2) When investigating localStorage-coupled hooks, separate the storage question from the algorithm question. Storage divergence can be unblocked by `KeyValueAdapter`; algorithm divergence cannot. (3) The Phase 1 verification round produced two byproducts worth more than the migrations themselves: the failure-mode taxonomy (4 traps) and the `KeyValueAdapter` finding (Phase 4b).
**Mobile**: not touched.
**PRs**: none — investigation only.

---

## 2026-05-29 — Phase 1 verification: `useFolderStates` deferred (mobile has no folder UI)

**Scope**: verify whether desktop's `useFolderStates` is a viable shared-promotion candidate. Audit classified as Category A pure hook.
**Result**: classification **D — defer**. Two blockers:
1. **Mobile has no folder UI.** `git grep "folder" origin/master -- "*.tsx"` returns zero results. Mobile's `services/config/configService.ts` validates `NavItem[]` for data integrity (`MAX_FOLDERS = 20`, `MAX_SPACES_PER_FOLDER = 100`) but no screen renders `type: 'folder'` items, no expand/collapse affordance, no folder-grouped nav tree. Mobile's spaces list (`app/(tabs)/spaces/index.tsx`) is a flat `FlashList` over `Space[]`. Same blocker as the existing `NavItem.icon`/`.color` deferral row in README — "deferred until mobile builds folders."
2. **No `KeyValueAdapter` abstraction yet in shared.** Desktop's `useFolderStates` uses `localStorage` directly (key `'folderStates'`). Mobile would use MMKV. Shared's `StorageAdapter` covers DB entities (spaces, messages, channels) but not arbitrary key-value UI preferences. Sharing this hook would require designing a new lightweight `KeyValueAdapter` interface — a separate, non-trivial shared API design decision.

**Action taken**: roadmap updated, Phase 1 next candidate advanced to `useEmojiPicker` with a pre-flight risk note (likely same blocker pattern — localStorage-coupled UI state, mobile may or may not have the feature). No code change.
**Lessons**: (1) **three for three in Phase 1 — the audit's Category A classification has not translated to actual shareability**. Pattern is now clear: hooks that are "pure on desktop" frequently fall into one of three traps: (a) already-done same-day (`useKickConfirmation`), (b) feature mobile doesn't have (`useFolderStates`), (c) different mobile data model (`useSpaceOrdering`). (2) **The README status table is doing double duty as a deferral registry.** When a candidate hits classification D, cross-link to the existing deferral row if one exists — avoids duplicate tracking. (3) **The `KeyValueAdapter` gap** is a real architectural finding worth flagging — at least three plausible candidates (`useFolderStates`, `useEmojiPicker`, `useAccentColor`) all hit the same localStorage-coupled UI-prefs pattern. If mobile ever adopts these, the abstraction needs designing first.
**Mobile**: not touched.
**PRs**: none — investigation only.

---

## 2026-05-29 — Phase 1 verification: `useSpaceOrdering` classified as stays-per-app

**Scope**: verify whether desktop's `useSpaceOrdering` (Category A pure hook per the audit) is a viable shared-promotion candidate. Apply the "pure-import ≠ shareable" test against current mobile state.
**Result**: classification **C — stays per-app**. Three independent reasons:
1. **Legacy on desktop.** `NavMenu.tsx:372-376` only calls `useSpaceOrdering` when `!hasItems` — i.e. when the user's config lacks the folder-aware `NavItem[]` format. The active code path for all folder-aware configs is `useNavItems` + `useFolderDragAndDrop`. `useSpaceOrdering` is a backwards-compat shim that's a candidate for desktop deletion once the legacy-config path is confirmed unreachable.
2. **Mobile uses a different ordering model.** Mobile's `app/(tabs)/spaces/index.tsx:~131` sorts spaces by most-recent activity timestamp (`filtered.sort((a, b) => b.timestamp - a.timestamp)`). It reads `config.spaceIds` only as a membership list, never for display order. No user-controlled drag-reorder UI exists on mobile.
3. **Logic is too thin.** Entire hook is ~15 LOC of dedup + ordered ID-to-object join. Even if mobile did need this, it would be a one-liner `useMemo` at the call site, not a shared hook.

**Action taken**: roadmap updated, Phase 1 next candidate advanced to `useFolderStates`. No code change.
**Lessons**: (1) the "pure on desktop = shareable" classification continues to fail the actual shareability test in Phase 1 spot-checks. Two for two in this session: `useKickConfirmation` was obsolete same-day (already done on desktop); `useSpaceOrdering` is a legacy shim mobile doesn't need. (2) **Always check whether mobile's UI even HAS the feature** before scoping a hook migration. Don't assume parallel data models exist just because the data type does (`config.spaceIds` exists on both platforms but is used for different things). (3) Apply the "is this hook still actively used on desktop?" check — a legacy shim isn't worth promoting.
**Mobile**: not touched.
**PRs**: none — investigation only.

---

## 2026-05-29 — Phase 1 verification: `useKickConfirmation` resolved without new shared hook

**Scope**: verify the hooks audit's recommendation to extract `useKickConfirmation` to shared. The audit's claim was "the confirmation state machine is line-for-line identical between desktop and mobile `useUserKicking`."
**Result**: claim verified true *at audit time*, but desktop's 2026-05-28 `useTwoStepConfirm` adoption (PR-set 1) already covered the desktop side — the audit's "extract `useKickConfirmation`" framing was obsolete the day it was published. Mobile is the only remaining inline holdout. No new shared hook needed — `useTwoStepConfirm` already IS the right abstraction at the right level. Wrapping it in a `useKickConfirmation` would add indirection without removing duplication.
**Action taken**: mobile task drop at [`quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-adopt-useTwoStepConfirm-in-useUserKicking.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-adopt-useTwoStepConfirm-in-useUserKicking.md). Mobile's `hooks/chat/useUserKicking.ts` replaces its inlined state machine (~25 LOC) with `useTwoStepConfirm` from shared `2.1.0-18`. Public hook surface unchanged; minor correctness improvement (shared uses `useRef` for timeout + unmount cleanup; mobile's inline version uses `useState` for timeout). Runtime-test required (kick is a live crypto+WS path). Tracked in [mobile-tasks-pending.md](mobile-tasks-pending.md).
**Lessons**: (1) the hooks audit's per-PR recommendations had a same-day-staleness problem — its first recommendation (PR-set 1) shipped same day, making PR-set 2's framing immediately obsolete. Verify any audit candidate against current desktop+mobile state before scoping. (2) Phase 1 of the new roadmap is the right framing — verify, then decide A (mobile task drop) / B (new shared hook) / C (candidate is moot, next). This was an A. (3) The audit IS the candidate menu, but it's a snapshot, not a current-state oracle.
**Mobile**: task dropped (see above). Mobile PR queued for runtime-test session.
**PRs**: none yet — mobile leg pending runtime test.

---

## 2026-05-29 — Cat B small-bucket sweep (no further migrations, dead code found)

**Scope**: continue the small-bucket sweep after shipping `useInviteValidation`. Four more Cat B sub-buckets investigated via parallel subagents:
- `useModalContext only` (3 hooks: `useGroupEditor`, `useSpacePermissions`, `useDirectMessageCreation`) — all correctly Cat B.
- `useDragStateContext only` (2 hooks) — sub-bucket is **actually empty**: both drag hooks also use `useMessageDB`, so they belong in the bigger dual-context bucket. Audit correction. `useFolderDragAndDrop` + `useSpaceDragAndDrop` orchestrate `arrayMove` from `@dnd-kit` + folder/space-specific mutations — no shared util candidates.
- `useClipboardAdapter only` (1 hook: `useCopyToClipboard`) — correctly Cat B. Shared exports `extractMessageRawText` (different concern — message text extraction for copy operations), not React-state clipboard logic.
- `useMessageDB + usePasskeysContext + useRegistrationContext` (7 hooks: `useInviteManagement`, `useSpaceCreation`, `useSpaceLeaving`, `useSpaceManagement`, `useSpaceRecovery`, `useUserKicking`, `useUserSettings`) — all correctly Cat B. One borderline finding in `useInviteManagement` (line 97 uses `manualAddress?.length === 46` as an API-lookup trigger heuristic; tightening to `isValidIPFSCID` would avoid spurious calls but it's a 1-line UX nudge, not a duplication removal — classified C-leaning-A, not actioned).
- `usePasskeysContext only` (7 hooks: `useChannelMessages`, `useDirectMessageData`, `useMutedConversationsSync`, `useKeyBackupLogic`, `useMessageComposer`, `useProfileImage`, `useWebKeyBackup`) — 5 correctly Cat B (including `useMessageComposer` which already correctly imports all its pure helpers from shared: `extractMentionsFromText`, `extractStandaloneYouTubeVideoIds`, `SimpleRateLimiter`, etc.). **2 surprise findings on the two-step-confirm pattern**: `useKeyBackupLogic` (lines 33-34, 90-109) and `useWebKeyBackup` (lines 11-13, 43-60) both inline the same two-step confirmation state machine that shared's `useTwoStepConfirm` (`2.1.0-18`) provides. The 2026-05-28 `useTwoStepConfirm` audit missed these.

**Dead code discovered AND shipped**: investigation of the two-step-confirm finds revealed `handleAlreadySaved` + `getConfirmationButtonText` + `alreadySavedConfirmationStep` were **dead public surface** in BOTH hooks. The only consumer of `useKeyBackup` (`useUnifiedOnboardingFlow`) uses ONLY `keyBackup.downloadKey()`. No UI surface reads the confirmation fields. So while these hooks technically duplicated `useTwoStepConfirm`, refactoring them to use shared would gain nothing at runtime — and per the project's "don't design for hypothetical future requirements" rule, the action taken was **delete the dead two-step surface**, not rewire it. Net -71 LOC across both hooks. Commit `4e4f4d8d`. If a future UI needs two-step confirmation here, `useTwoStepConfirm` from `@quilibrium/quorum-shared` is the obvious primitive — no need for a breadcrumb in the code.

**Tally for the Cat B sweep across two sessions** (2026-05-29 morning + afternoon): 17 + 26 = 43 Cat B hooks investigated across 6 sub-buckets. 2 actionable Cat A migrations shipped (`useAddressValidation`, `useInviteValidation`). Remaining hit rate is dropping. Remaining sub-buckets:
- `useMessageDB only` (14 hooks) — not yet spot-checked.
- `useMessageDB + usePasskeysContext` (26 hooks) — already done 2026-05-29 morning (0 hits).

**Lessons**: (1) negative spot-check rounds are informative — they confirm Cat B classification is mostly correct and rule out whole investigation threads. (2) The "useDragStateContext only" sub-bucket was a phantom in the audit — the dual-context drag hooks were double-listed. Audit correction folded into this entry. (3) When investigating hooks with `useCallback`-shaped pure helpers, also check whether those helpers have any consumer. Dead public surface is its own finding, distinct from a migration opportunity.

**Mobile**: not touched. None of the negative findings have a mobile coordination shape.
**PRs**: none — investigation-only session after the morning's `useInviteValidation` ship.

---

## 2026-05-29 — `useInviteValidation` dedupe (Cat B "useQuorumApiClient only" spot-check)

**Scope**: spot-check the 4 hooks in the "useQuorumApiClient only" Category B sub-bucket (`useInviteValidation`, `useAuthenticationFlow`, `useOnboardingFlowLogic`, `useUnifiedOnboardingFlow`) for the "already-shared-util waiting to be used" pattern. Same pattern that flagged `useAddressValidation` on 2026-05-29 morning.
**Result — 1 Cat A hit**: `useInviteValidation` had an inline `parseInviteLink` (`useCallback`, ~36 LOC including its `InviteInfo` interface) duplicating shared's `parseInviteParams`. Desktop already uses `parseInviteParams` in `InvitationService.ts` (2x) and `AddSpaceModal.tsx` — this hook was the last inline holdout. The returned `parseInviteLink` was dead public surface (zero consumers). Refactored to call `getValidInvitePrefixes` for the prefix gate (already imported) + `parseInviteParams` for extraction. Net 132 → 102 LOC (-30). Commit `17e19b70`.
**Other 3 hooks**: correctly Cat B. `useAuthenticationFlow` is thin state + one API call. `useOnboardingFlowLogic` and `useUnifiedOnboardingFlow` share a copy-pasted AES-GCM config-decryption block — internal desktop duplication, not a shared-util mismatch. Could become a desktop-internal helper; not in scope.
**Lessons**: (1) the `useAddressValidation` pattern from this morning **generalized** — at least one more inline duplication lurked in the same small Cat B sub-bucket. The pattern: hooks written before a shared util landed often keep their inline implementations. (2) Spot-checks against small Cat B sub-buckets are higher-yield than the bigger ones. The 30-min subagent run paid for itself with a ship-able refactor.
**Mobile**: not touched. Mobile's `services/space/inviteService.ts` has its OWN duplicate `VALID_INVITE_PREFIXES` array + parse logic — same convergence opportunity exists there. Not driven from this session: mobile-side adoption is a runtime-test change and the workflow's "we don't run the mobile app" rule applies. Could be a future mobile task drop if scope warrants.
**PRs**: none — direct main commit (small desktop-only refactor, no review needed).

---

## 2026-05-29 — Category B spot-check (no migration, finding logged)

**Scope**: spot-check the 26 hooks in the "useMessageDB + usePasskeysContext" Category B sub-bucket for the "already-shared-util waiting to be used" pattern that `useAddressValidation` exhibited.
**Result**: no Category C findings (no other hooks reimplementing what shared already exports). `useAddressValidation` was a genuine outlier — duplication happened because shared's `isValidIPFSCID` was added after the hook was originally written. Other Category B hooks correctly import existing shared utils (`isMentionedWithSettings`, `getDefaultNotificationSettings`, `hasPermission`, etc.).
**Real future migration candidate flagged**: `getMutedChannelsForSpace` + `isChannelMuted` from desktop's `channelUtils.ts` are pure functions used by 7 hooks (mentions, replies, channel-mute domains), operating on the shared `UserConfig['mutedChannels']` type. Could move to shared once the paused notifications track unblocks (~25 LOC added to shared, 7 consumer imports updated). Deferred — adding now might conflict with whatever architecture the lead-dev picks for notifications.
**Lessons**: (1) the `useAddressValidation` pattern doesn't generalize across the Category B bucket; Category B classification is correct for the other 25 hooks. (2) Spot-checks with subagents are a cheap way to test hypotheses about hook buckets — ~1 session, no code, ruled out a whole investigation thread.

---

## 2026-05-29 — `useAddressValidation` dedupe + folder length alignment

**Scope**: two small desktop-only cleanups on main.
**Shipped**:
- `useAddressValidation.ts` refactored to call shared's existing `isValidIPFSCID(address, true)` instead of reimplementing the base58 format check. `useAddressValidation.native.ts` deleted (no longer needed — shared util is cross-platform safe). Public hook surface unchanged. Net `-123` LOC. Commit `888d76ca`.
- `FolderEditorModal` `maxLength` 40 → 50, aligning with shared `MAX_NAME_LENGTH` (folder validation hook already used the shared constant; only the Input prop lagged). `space-folders.md` updated. Commit `6a7f7868`.
**Lessons**: (1) some "Category B" hooks are actually "shared has this already, just rewire" — `useAddressValidation` looked context-coupled but the heavy logic was a duplicate of shared's `isValidIPFSCID`. (2) `.native.ts` variants in `quorum-desktop` are vestigial cross-platform leftovers — when their `.ts` counterpart converges on a shared util, delete the `.native.ts` in the same commit. Codified in the workflow doc.
**Mobile**: not touched. Both are desktop-only refactors with no protocol or wire-format impact.
**PRs**: none — direct main commits (small refactors, no review needed).

---

## 2026-05-28 — Field validators (`validateSpaceName`, `validateDisplayName`, …)

**Scope**: extract 9 pure field validators to shared with the `errorKey` i18n pattern; refactor 5 desktop validation hooks to thin Lingui-translating wrappers.
**Shipped**: shared `2.1.0-18` → `2.1.0-19` (new `validation/` module: spaceName/displayName/channelName/channelTopic/groupName/deviceName/spaceDescription/userBio/userNote + 42 new tests); desktop validation hooks now route through shared via `errorTranslator.ts`. `MAX_NAME_LENGTH` 40 → 50, new `MIN_NAME_LENGTH = 2` (Space names only — aligned to mobile). Folder names left at 40 (separate `maxLength` prop; flagged in `space-folders.md` for a future PR).
**Lessons**: (1) **i18n-in-shared rule established** (codified in workflow doc) — shared exports `errorKey` codes, platforms own a thin translator. Lets desktop keep Lingui, mobile keep hardcoded English, future mobile-Lingui adoption changes only the wrapper. (2) **Verify rules per-field, not by category** — first pass added `MIN_NAME_LENGTH = 2` to displayName too; turned out mobile only enforces MIN on space names, pre-refactor desktop had no MIN at all. Caught during user smoke test, fixed before ship. (3) **Existing docs lag the migration** — `input-validation-reference.md`, `device-naming.md`, `space-folders.md` all referenced 40-char limit; updated alongside the code change.
**Mobile**: not touched. Mobile has duplicate `validateSpaceName` + inline `MIN_NAME_LENGTH = 2 / MAX_NAME_LENGTH = 50 / MAX_DESCRIPTION_LENGTH = 300` in `SpaceModal.tsx` and `SpaceSettingsModal.tsx`. Adoption task dropped at [`quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-28-adopt-shared-validators.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-28-adopt-shared-validators.md) — needs runtime testing (per the workflow's mobile-testing rule), so deferred. Tracked at [`mobile-tasks-pending.md`](mobile-tasks-pending.md).
**PRs**: shared [#20](https://github.com/QuilibriumNetwork/quorum-shared/pull/20) ✅, desktop [#162](https://github.com/QuilibriumNetwork/quorum-desktop/pull/162) ✅.

---

## 2026-05-28 — `useTwoStepConfirm`

**Scope**: extract two-step confirm primitive (arm → confirm-within-N-seconds) to shared, refactor two desktop hooks.
**Shipped**: shared `2.1.0-17` → `2.1.0-18` (new `useTwoStepConfirm.ts` ~100 LOC); desktop `useUserKicking` + `useSpaceLeaving` refactored (−~55 LOC). Public hook surface unchanged, consumer modals untouched.
**Lessons**: (1) pure imports ≠ shareable — query-key helpers and `useConfirmation` both looked migratable, both withdrew on inspection (key-casing conflict with shared, desktop-only modal orchestration); (2) bundle by shape, not minimal scope — both desktop consumers in one PR avoided leaving half the duplication behind.
**Mobile**: not touched. `hooks/chat/useUserKicking.ts` adoption is ~5 LOC, deferred to a mobile-test session. `ChannelEditorModal.deleteConfirmation` uses the bigger `useConfirmation` orchestration, not this primitive — not a third consumer.
**PRs**: shared [#19](https://github.com/QuilibriumNetwork/quorum-shared/pull/19) ✅, desktop [#161](https://github.com/QuilibriumNetwork/quorum-desktop/pull/161) ✅.

---

*Created 2026-05-29 as the archive for older entries from `shipped-log.md`. Append-only — when more entries accumulate in the main log, the oldest get moved here.*
