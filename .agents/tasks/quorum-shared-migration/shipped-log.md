---
type: log
title: Quorum-shared migration — shipped log
status: ongoing
created: 2026-05-28
updated: 2026-06-13
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

## 2026-06-13 — Desktop image-only sends converged onto `post` + `embeddedMedia` (desktop half of image+caption convergence)

**Scope**: desktop side of the cross-repo image+caption convergence. Image-only-no-caption messages were sent as `type:'embed'`, while image+caption already used `type:'post'` + `embeddedMedia`. Two carriers for the same content; mobile only reads `embeddedMedia` on posts, so the `embed` path caused cross-platform image loss. Converge image-only onto `post` + `embeddedMedia` (empty text) so there is ONE canonical image carrier. `embed` is now receive-only legacy.

**Shipped (PR [#201](https://github.com/QuilibriumNetwork/quorum-desktop/pull/201), squash-merged to main)**:
- **Send** (`useMessageComposer.ts`): image-only branch builds `embeddedMedia` (thumbnail entry when present, then full image, shared `key` UUID, raw base64 in `data`) and sends `{ type:'post', text:'', embeddedMedia }` instead of an `EmbedMessage`. Removed the now-unused `EmbedMessage` import.
- **Render** (`Message.tsx`): new self-contained `EmbeddedImage` child component owns its own `isShowingGifAnimation` state (so multiple images animate independently), and replicates the legacy embed GIF behavior in the `post`/`embeddedMedia` render paths (both the markdown and the token-fallback `imageKeys.map`). Static image → modal on click; small GIF → animates immediately; large GIF → static poster + ▶ overlay, click swaps to the animated full GIF in place (no modal).
- **Send button** (`MessageComposer.tsx` + `.scss`): the active accent style now triggers on sendable content (`value.length > 0 || processedImage`), not just while typing. An image with no caption is sendable, so the button must look active. Added a `.message-composer-send-btn.active` SCSS rule mirroring the existing `.typing &` active style; left `isTyping` / the row's `typing` class untouched (it also drives mobile button-hiding).

**Key decision — GIF flag derived, no shared change (Option B)**: `isLargeGif` is NOT sent on the wire. It's derived at render from the `embeddedMedia` shape: a GIF whose `image` entry is `image/gif` AND has a separate `image-thumbnail` entry under the same key. So no `@quilibrium/quorum-shared` type change and no version bump. The desktop `createGifDetector` already derived GIF-ness from the data URI / extension; the only unique signal `isLargeGif` carried ("a thumbnail was generated") is structural in the array.

**Caveat B (payload size) ruled out before shipping**: desktop's old `embed` path already inlined base64 (`imageUrl` was a `data:` URI, not a CDN URL), so moving image-only to `embeddedMedia` is a ~30-byte (data-URI prefix) difference, not a size regression. There is no CDN-upload-then-reference flow anywhere in the image send path.

**Verification**: `tsc --noEmit` clean; `eslint` clean (one pre-existing unused-import warning removed, zero new). Manual smoke test (user-confirmed "all systems go"): image-only static (modal), small GIF (animates immediately), large GIF (poster + click-to-animate), image+caption still works, send button lights up on image attach.

**Note**: multiple images per message is not reachable in the UI yet; the per-image `EmbeddedImage` state is forward-safe for when it is, no current regression.

**Mobile status — STILL OPEN**: this is only the desktop half. The mobile half (read `embeddedMedia` on render so desktop photos become visible on mobile + send `post`+`embeddedMedia`) remains as mobile task `2026-06-13-converge-image-caption-to-post-embeddedmedia.md` and tracker row 1.7. The end-user bug "desktop photos invisible on mobile" is fixed only when the mobile render change ships.

**PRs**: [#201](https://github.com/QuilibriumNetwork/quorum-desktop/pull/201).

---

## 2026-05-30 — Desktop bonus C1 sweep + useMessageFormatting dead code removal

**Scope**: mirror of yesterday's mobile sweep, against desktop. Investigate `src/hooks/business/**`, `src/services/**`, `src/utils/**` for "desktop inlines what shared already exports."

**Result**: 1 actionable finding (turned into dead-code cleanup). Other candidates were Trap D (`extractTextFromMessage` in `db/messages.ts` + `SearchService.ts` joins with `' '` for indexing vs shared's `'\n'` for clipboard — intentionally different consumers; `canManageReadOnlyChannel` has inverted return contract for non-read-only case; `formatFileSize` in image errors uses compact `"50MB"` vs shared's verbose `"50.0 MB"` for inline UI). All correctly skipped.

**Action shipped — `useMessageFormatting.ts` cleanup**:
- Removed `InviteRegex` legacy hardcoded regex (`qm.one|app.quorummessenger.com` only — would silently skip staging/local domains). Zero external consumers (grepped + tsc clean).
- Removed `YTRegex = YOUTUBE_URL_REGEX` re-export — pure pass-through, zero external consumers.
- Removed `markdownPatterns` (15-regex array) + `hasMarkdownPatterns` helper — only call site was commented out at line 98.
- Removed both dead names from the hook's return object.
- Cleaned up the now-unused `YOUTUBE_URL_REGEX` import.

Net **-35 LOC of pure dead surface**. tsc clean. Smoke tested: messages render normally, YouTube embeds work, invite links work (the live `isInviteLink()` path using shared's `getValidInvitePrefixes()` was untouched).

**Cleared stale Paused track**: "Folder name length consistency" entry was stale — `useFolderManagement.ts` already imports `MAX_NAME_LENGTH` from shared (50). The `useFolderNameValidation` hook the entry referenced doesn't exist. Marked resolved in roadmap.

**Mobile**: not touched.
**PRs**: bundled into the session-branch PR.

---

## 2026-05-30 — AES-GCM config-decrypt dedup (desktop-internal Paused track)

**Scope**: collapse the 4 inline copies of the AES-GCM UserConfig decrypt block into a single helper. Pulled from Paused tracks (was queued there because Phase 2 verification ruled it out for shared promotion — mobile uses `@noble/ciphers`, desktop uses Web Crypto; Trap E platform-correct divergence). Desktop-internal cleanup only — no shared / mobile coordination.

**Shipped**:
- `src/utils/crypto.ts` + `src/utils/crypto.web.ts` gain `decryptUserConfig(encryptedHex, privateKeyBytes): Promise<unknown>`. Helper does SHA-512 → first 32 bytes → AES-256-GCM import → split iv (last 24 hex) from ciphertext → decrypt → JSON.parse. Signature verification stays at call sites (it's a separate concern; only `ConfigService` does it).
- 4 consumer sites collapsed: `useOnboardingFlowLogic.ts:194-224`, `useUnifiedOnboardingFlow.ts` (two occurrences at ~219-242 and ~342-371), `ConfigService.ts:75-128`. Net -47 LOC across consumers, +48 LOC helper (one-time).

**Gotcha worth knowing**: Vite's platform-extension resolver picks `.web.ts` over `.ts` when both exist. Initially added the helper only to `crypto.ts` — Vite errored at runtime ("does not provide an export named 'decryptUserConfig'"). Fix: helper added to BOTH `crypto.ts` (so tsc resolves it) AND `crypto.web.ts` (so Vite resolves it at runtime). The pattern follows what the file already does for `sha256`/`base58btc`.

**Smoke testing**:
- Fresh-login profile decrypt path → confirmed display name + profile image load correctly. Covers `useUnifiedOnboardingFlow` site.
- Existing-session config sync after page refresh → confirmed space-moved-out-of-folder change picked up. Covers `ConfigService` site.
- (Pre-existing, unrelated bug logged: UserSettingsModal shows stale display name without refresh — see `.agents/bugs/2026-05-30-user-settings-modal-stale-display-name.md`. NOT caused by this refactor; channel-message rendering reflects the new value correctly.)

**Mobile**: not touched. Mobile uses `@noble/ciphers` — different primitive, intentionally divergent.
**PRs**: bundled into the session-branch PR alongside the workflow rule updates.

---

## 2026-05-30 — Role-mutation helpers extracted (Phase 2 C4)

**Scope**: ship the per-task plan from 2026-05-29 (`2026-05-29-migrate-role-mutation-helpers.md`). Extract two pure role-mutation helpers (`toggleRolePermission`, `setRolePermissions`) duplicated byte-for-byte between desktop and mobile.

**Shipped**:
- [quorum-shared#21](https://github.com/QuilibriumNetwork/quorum-shared/pull/21) — adds `src/utils/roleUtils.ts` + tests + barrel re-export. Version `2.1.0-21`.
- [quorum-desktop#163](https://github.com/QuilibriumNetwork/quorum-desktop/pull/163) — `useRoleManagement.ts` swaps inline include/filter/spread + spread-with-new-array blocks for shared imports. Net -7 LOC.
- Mobile task dropped: [`2026-05-30-mobile-adopt-shared-role-mutation-helpers.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-30-mobile-adopt-shared-role-mutation-helpers.md). Static-only verification, runtime test not required (pure mechanical refactor).

**Version coordination note**: Cassandra pushed a `2.1.0-17` bump (`20934044`) from an older base while our work had progressed to `2.1.0-20`. Her merge resolved correctly — master stayed at `2.1.0-20` (highest-version-wins). Our PR continues to `2.1.0-21`. Worth flagging if it happens again: she may not be tracking the latest version when branching.

**Workflow rule added**: `cross-repo-workflow.md` now has a "Visual smoke test before self-merge" section (2026-05-30). Self-merging desktop is the default, but for changes that can affect runtime behavior (refactors included), the agent must wait for user smoke confirmation before merging. Triggered by this PR: shipped #163 without a manual smoke, user flagged it as a workflow gap.

**Mobile**: task dropped, queued for static-verification session.

**PRs**: shared #21 merged, desktop #163 merged.

---

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

*Phases 3, 4, 4b, 6 resolution closures (4 entries) moved to [shipped-log-archive.md](shipped-log-archive.md) on 2026-05-30 — their key insights are encoded in the consolidated "Top-level lessons" block above and in roadmap.md's phase sections.*

*Older entries (10+ from 2026-05-28 morning through 2026-05-29 early afternoon) moved to [shipped-log-archive.md](shipped-log-archive.md) on 2026-05-29 evening. The compressed format keeps this log focused on the most recent + most actionable history. Top-level lessons consolidated above so they don't get lost as entries age out.*
