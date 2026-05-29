---
type: log
title: Quorum-shared migration — shipped log
status: ongoing
created: 2026-05-28
updated: 2026-05-29
audience: read recent entries to catch up on what's changed and why
---

# Quorum-shared migration — shipped log

> Chronological view of completed migrations and verification rounds. Each entry: scope, what shipped (or what was decided), lessons worth carrying forward, mobile status, PRs.
>
> **Companion docs**:
> - [README.md](README.md) — status table per migration row (catalog)
> - [roadmap.md](roadmap.md) — phased plan, what's next, dependencies
> - [shipped-log-archive.md](shipped-log-archive.md) — older entries (2026-05-28 through 2026-05-29 early afternoon); not in the active reading path
>
> **Append-only.** New entries at the TOP. Fix factual errors in place; otherwise add a follow-up entry. When entries accumulate past ~5-6 recent ones, move oldest to the archive file.

---

## Top-level lessons (consolidated, always read)

These are the cross-cutting findings from today's session worth knowing before scoping any new migration work. Each appears with concrete examples across multiple shipped-log entries — both here and in the archive.

### The 6-trap failure-mode taxonomy

Apply as a checklist when verifying any candidate. A hook failing ANY of these is C (stays per-app) or D (defer).

- **Trap A — Already done same-day.** Audit framing went stale before publish. Example: `useKickConfirmation` extraction (desktop refactored to consume `useTwoStepConfirm` the same day the audit recommending the extraction was published).
- **Trap B — Mobile doesn't have the feature.** Even if desktop's logic is pure, mobile has no UI / no parallel data path. Examples: `useFolderStates` (mobile has the type but no folder UI); `useShowHomeScreen`; mobile's `setAccentColor` is wired but has zero callsites.
- **Trap C — Same data, different model.** Mobile's data layer uses the same shape but for a different purpose. Examples: `useSpaceOrdering` (both platforms have `spaceIds` but desktop uses for drag-reorder, mobile sorts by activity); `useConversationPreviews` (desktop fetches at render time, mobile stores at write time).
- **Trap D — Same feature, different algorithm.** Both platforms have the feature but evolved independent implementations with different semantics. Example: `useEmojiPicker` frecency (desktop raw counts vs mobile exponential decay; even data units differ).
- **Trap E — Platform-correct primitive divergence.** Both platforms use platform-appropriate primitives for the same algorithm; forcing convergence would regress one platform. Examples: AES-GCM config decrypt (Web Crypto vs `@noble/ciphers` — desktop would lose hardware acceleration + non-extractable keys); UUID generation (`crypto.randomUUID()` vs polyfill); Ed448 signing (WASM vs `NativeCryptoProvider`).
- **Trap F — Singleton bypass.** A platform has a context system (e.g. `StorageContext`), but the candidate hooks bypass it via a module-level singleton. The context's existence doesn't imply hooks consume it. Example: mobile's `useChannelManagement` uses `getMMKVAdapter()` directly, not `useStorageAdapter()`.

### Cross-cutting lessons (beyond the trap taxonomy)

1. **Test prerequisite chains directly.** "X would unblock Y" needs verification that Y is otherwise unblocked. Otherwise X is solving the wrong problem. (How Phase 4, 4b, and 6 closed: all three were ghost prerequisites where the candidates had a bigger blocker than the "missing abstraction.")

2. **Audit-derived candidate lists need per-hook re-verification.** Lists from audits are a starting point, not a verified scope. The 14-hook Phase 6 list was based on a false premise (that `StorageAdapter` covered the hooks' method needs). The 4 Phase 1 candidates failed for 4 different reasons. Don't trust the audit; verify each candidate against current desktop + mobile + shared state.

3. **The right Phase 6 test isn't "fits StorageAdapter" — it's "shared hook exists AND mobile uses it."** Both conditions must hold; either alone is misleading. Read-path migrations can also masquerade as actually being write-path alignment opportunities.

4. **Bonus C1 findings dominate value capture.** Looking for "what shared already exports that mobile reimplements" is at least as valuable as "what desktop has that we could promote." Multiple Phase 2 rounds surfaced mobile-side C1 cleanups (~140 LOC + 2 real correctness fixes: `isSpaceOwner` gap in mobile's permission hooks, mobile's `getInviteUrlBase` hardcoding prod) that were higher-yield than the original C4 target.

5. **"Duplicated across platforms" ≠ "shareable."** When each platform's implementation reflects a platform-correct primitive choice (Trap E), forcing convergence can be a security or capability regression. Symmetric crypto, UUIDs, and storage primitives are common examples.

6. **`StorageAdapter` is not a drop-in replacement for `useMessageDB()`.** They're different abstraction levels. `MessageDB` is desktop's domain facade (bookmarks, thread stats, read times, pinned messages, encryption states); `StorageAdapter` is the narrow CRUD subset for the sync layer (`SyncService` is its only production consumer). Migrations require hook-specific analysis of which methods are actually needed.

7. **Architectural divergence at the write path can masquerade as a read-path migration opportunity.** When desktop has a hook that exists to compensate for missing data (e.g. `useConversationPreviews` exists because desktop's write path doesn't populate `Conversation.lastMessagePreview`), the real fix is the write-path alignment, not the read-hook migration.

8. **Formal closure is a valid Phase outcome.** Phases 3 (A2 query helpers), 4 (StorageContext), 4b (KeyValueAdapter), 6 (useMessageDB-only hooks) all closed without shipping migrations. Closing the door prevents future sessions from re-investigating the same false-positive signals.

---

## Recent entries (most recent first)

## 2026-05-29 — Phase 5 issue drafted (not filed)

**Scope**: draft the Phase 5 coordination issue text for filing against `quorum-mobile`. Two architectural questions: CryptoProvider DI pattern + broadcast pattern for shared mutation hooks.
**Result**: draft text written and stored locally at `.agents/.temp/2026-05-29-phase5-coordination-issue.md` (gitignored). User decision: file whenever — queue order doesn't matter, lead reviews when convenient. Initially drafted with full filing-trigger logic + pre/post-filing checklists; pared down after user feedback that the format was too verbose for a busy lead.

**Key decisions during drafting**:
- **One combined issue, not two separate.** Lets lead answer one question and punt the other if needed.
- **Question framing softened to "directional preference, not architecture commitment."** "Default to X, refine later" is an acceptable answer. Lowers friction.
- **Added a "punt option" (defer shared mutation hooks).** Gives the lead an out if neither answer feels right yet.
- **Cross-reference to #65 + #66.** Sibling questions; lead can bundle responses.
- **Body kept short** — ~150 words. Two questions, one concrete anchor each, punt option. Iterated down from longer drafts after user feedback that brevity matters more than thoroughness for a busy reviewer.

**Notable insight added to roadmap**: Phase 5's value scales with how many concretely-blocked candidates exist. Today's verifications closed many Phase 6/7 candidates (stays-per-app classifications, mobile-feature-absent, Trap E platform-correct divergence). So the queue of work actually blocked on Phase 5 is smaller than the 2026-05-28 audit assumed.

**No PR. No code. No mobile touch.** Just a draft file + roadmap update.

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

*Older entries (10+ from 2026-05-28 morning through 2026-05-29 early afternoon) moved to [shipped-log-archive.md](shipped-log-archive.md) on 2026-05-29 evening. The compressed format keeps this log focused on the most recent + most actionable history. Top-level lessons consolidated above so they don't get lost as entries age out.*
