---
type: log
title: Port-from-mobile shipped log
status: living
created: 2026-06-01
updated: 2026-06-10
---



# Port-from-mobile shipped log

Chronological history of features ported from `quorum-mobile` to `quorum-desktop`, with lessons learned at the top.

## Top-level lessons

- **Symbol-grep is not capability-verification.** The same capability can exist on both apps under different names and different architectures. Two candidates were knocked off in one session this way: #2 Message search (different impl, same UX — desktop uses `<GlobalSearch>` embedded in DM/Channel headers) and #3 Reply tracking (mobile MMKV counter vs desktop's `useReplyNotificationCounts` derived from `MessageDB`). The workflow now requires stating the capability in plain terms and grepping desktop for the *concept*, not the mobile symbol.
- **Port the capability, not the mobile UX pattern.** Mobile UX choices reflect mobile chrome and constraints. Desktop has different chrome and a different UX model (Discord-style spaces + DMs split, not Telegram-style unified list). A feature being shipped on mobile means the *capability* is real; whether the *UX pattern* fits desktop is a separate judgment. Default to desktop's UX language; ask the user when in doubt.
- **The effort is a two-way diff, not a one-way port.** When desktop's implementation is better than mobile's (or mobile lacks a desktop feature entirely), log it in [`../port-to-mobile/candidates.md`](../port-to-mobile/candidates.md) as a future port-to-mobile candidate for the lead dev. We don't act on those directly (mobile is read-only), but recording them gives the lead a curated convergence list.
- **Verify backend assumptions before scoping UI.** #6 was originally framed as "Public profile UI" — implying a directory/browse surface. Investigation against the mobile API client (the source of truth for what the server exposes) showed the server has NO user-enumeration endpoint at all. Neither app can ship a directory without backend work. The same investigation revealed mobile's `NewConversationModal` accepts `@username` via QNS that desktop's `NewDirectMessageModal` doesn't — that's a separable mini-candidate logged under `#12`. The lesson: when a candidate's framing implies a surface (directory, search, browse), check the backend client surface FIRST, not the mobile UI; a single grep against the API client can rule out an entire feature.
- **Rebase, don't merge — and read what landed on main.** During #6's shipping, three commits landed on `main` mid-session, including PR #180 (`fix(action-queue): roll back optimistic state and surface error toasts on enqueue failure`) which changed the save-config enqueue from blocking-`await` to fire-and-forget with rollback. Rebasing surfaced this in a clean conflict block. The fire-and-forget rollback introduced a new consistency hole specific to our port (publish-then-rollback could leave server-published but local-off); a code-review pass before shipping caught it and we added a best-effort revert in the same `.catch` path. Lesson: when shipping over a base that's moving, rebase + read the new commits + re-run code review.
- **"Non-owner can X" needs three checks, not one.** New rule from #29's three-round framing back-and-forth. When a candidate's framing implies "non-owners can do X", verify all three before scoping: (a) **service-layer gate** — grep the service for owner-key checks or role gates (`Only space owners can…`, `requires owner`, key-existence checks like mobile's `getSpaceKey(spaceId, 'owner')`); (b) **manifest-replication** — check whether the field the UI shows is part of the synced/encrypted manifest, in which case non-owners hold the *data* an owner published, not the ability to *do* the thing; (c) **UI is "do" or "view"** — distinguish "this control generates" from "this control reads a synced field". Mobile's InviteModal looks like a generator to a non-owner but is actually a viewer of the owner-published `space.inviteUrl`. A single grep on the service file would have shortcut to the right framing.
- **A capability can have multiple independent enabling steps — "mobile has it" doesn't mean one switch.** From QNS usernames (#12 slice): a user's verified `name.q` only displays if THREE separate things are true — (1) they registered a QNS name, (2) they *elected it as primary* (`updateProfile({primaryUsername})`, a distinct UI action — registering ≠ setting-as-primary), and (3) their published public profile actually carries `primary_username`. Each is a separate code path with its own bug surface. We burned a lot of test time assuming "LaMat has a QNS name" was enough. Lesson: when a display feature depends on remote data, enumerate every step that has to fire for the data to *arrive*, and probe the actual server payload (`curl` the endpoint) before assuming desktop is at fault. The server response is ground truth; both apps' toggles can lie.
- **Distinguish "the code is wrong" from "I can't see it work."** Most of the QNS-slice session was spent unable to *see* `.q` render — which felt like a bug but was three unrelated test-visibility problems (no real data published it; the test value collided with the display name; the render was in a different component than the one being viewed). The fix was a clean temp-injection with a *distinct* value in the *exact* component on screen, then revert. Lesson: when "it's not showing," separate render-correctness (provable in isolation in ~2 min) from data-availability (a separate, often-upstream problem) before debugging the wrong layer. And never test a render with a value that looks identical to an adjacent field.
- **Build at the right altitude, not just to spec — but record drift.** The QNS design specified a resolution rule (QNS name as the primary name, via `resolveDisplayName`), but the implementation drifted to mobile's secondary-handle treatment. That drift surfaced a real product fork (Model A vs B) the user then had to escalate to the lead dev. Lesson: when an implementation diverges from the spec's intent, flag it explicitly rather than quietly shipping the easier version — the divergence is often a decision in disguise.

## 2026-06-10 — #12 slice: QNS usernames (DM search + profile `.q` + validation) shipped (partial; display model + mentions in flight)

- **PR**: [#190](https://github.com/QuilibriumNetwork/quorum-desktop/pull/190) (squash-merged to `main`, 2026-06-10).
- **Shared support**: [quorum-shared #35](https://github.com/QuilibriumNetwork/quorum-shared/pull/35) (resolver + `resolveDisplayName` helper + initial `.q` validation) + [#36](https://github.com/QuilibriumNetwork/quorum-shared/pull/36) (narrowed validation to `.q`-suffix-only). Landed at `2.1.0-27`.
- **Safety snapshot**: `feat/qns-usernames-snapshot-2026-06-10` (local) — the Model-B resume point.
- **Status**: PARTIAL ship. The model-independent core landed; the display model and mentions are blocked on a lead-dev call.

### What shipped

| Piece | State |
|---|---|
| **DM search by `@username`** | ✅ Done + verified live. `useResolveQnsName` → shared `resolveName` (`GET /resolve/:name`) → `deriveAddress` (ed448 pubkey → `Qm…`). `@` is optional (auto-detect: `Qm`-prefix = address, else username). Verified `lamat` → `QmVYRWmquW98yaymeRv7aLn6bqRYr9PAtWcG87Kj25YvPY` (real account). |
| **`.q`-suffix validation** | ✅ Done. Display-name inputs (global `UserSettingsModal` + per-space `SpaceSettingsModal`) reject names ending in `.q` (normalized: trim + lowercase + confusable-dot fold). Mid-name dots (`jane.doe`) stay valid. New shared `hasReservedQnsSuffix` + `'qns-suffix'` reserved type + `displayName.reservedQnsSuffix` errorKey. |
| **Profile `.q` display** | ⚠️ Built as **Model A** (secondary handle in profile card). Render confirmed via temp-injection; dormant with real data (see mobile bugs). |

### In flight (blocked on lead-dev call, asked via Telegram 2026-06-10)

- **Display model A vs B.** A = secondary handle (shipped, mirrors mobile). B = elected primary QNS name overrides the typed display name everywhere, per-space override wins locally (the author's preference + the original design intent). If B: route every name-render through `resolveDisplayName` across `UserProfile`, `DMUserProfileSidebar` (separate component, not currently wired), the DM header, the member list (uses raw `members`, not enriched `effectiveMembers`, for perf), and message authors. Guardrail: `primary_username` must be explicitly user-set, never auto-assigned, or B surfaces a name the user didn't choose.
- **Mentions (Stage 4)** — not started, same decision gates it.

### Why live `.q` can't be seen yet (two MOBILE bugs, filed in mobile `.agents/bugs/`)

1. `primaryUsername` isn't synced to config (shared `UserConfig` has no field for it) and the publish reads a **stale-closure** `user.primaryUsername` → published profile omits `primary_username`. Confirmed by `curl`-ing the server profile (only `display_name`/`profile_image`/`bio`/`timestamp`/`signature`).
2. `isProfilePublic` toggled on mobile doesn't propagate to the same user's desktop (config-sync gap).

Desktop's read/render is correct; it lights up once mobile publishes the field.

### Decision implications surfaced (parked for lead dev)

- Should `primaryUsername` ride in the **profile broadcast** (sent with messages) rather than only the published public profile? That would show the verified name without requiring a separate public-profile toggle — better UX, but a signed-payload change. Raised via Telegram; tracked in memory (`project_qns_username_broadcast_pending`).

### Notes

- `deriveAddress` was implemented with `multiformats` base58btc + `@noble/hashes` (already shared deps) rather than mobile's `bs58`/`multihashes` (not shared deps) — same `Qm…` output, no new dependency. `NameRecord` doesn't exist in shared, so the resolver defines a slim local `QnsNameRecord`.

## 2026-06-08 — #29 Non-owner read-only access to the public invite URL shipped (+ joinInviteLink follow-up identified)

- **Branch**: `feat/port-non-owner-invite-view-from-mobile` (renamed from `session-2026-06-08-2` on `session-2026-06-08-2`).
- **Task file**: [`.done/2026-06-08-port-non-owner-invite-view.md`](.done/2026-06-08-port-non-owner-invite-view.md).
- **PR**: [#182](https://github.com/QuilibriumNetwork/quorum-desktop/pull/182) (merged 2026-06-08).
- **Repos touched**: `quorum-desktop` only. `quorum-shared` was untouched (the `Space.inviteUrl` field has lived in shared for months); `quorum-mobile` is read-only.

### What shipped

| Layer | What |
|---|---|
| Navigation | Invites tab icon `share` → `user-plus`. Non-owner filter loosened to include `'invites'` when `space.inviteUrl` is set (otherwise unchanged — still only `'account'`). |
| Invites tab | When `!isSpaceOwner`, render a stripped-down read-only variant: URL display (`ClickToCopyContent`) + "Send via DM" button expanding the existing `DmPicker` + `Send Link` calling `invite(address, 'public')`. The header now matches Account's typography pattern (`text-title` + `pt-2 text-body`) per inline user feedback. Owner UI completely unchanged. |
| Send mechanics | Reuses `InvitationService.sendInviteToUser` with `mode: 'public'` — forwards `space.inviteUrl` as-is, does NOT consume the eval pool, no owner privilege required. |
| Modal redirect | `SpaceSettingsModal`'s "redirect non-owners off owner-only tabs" effect rewritten to allow `'invites'` when `space.inviteUrl` is set; otherwise bounces to `'account'` as before. |
| Sidebar context menu | `useSpaceContextMenu` now resolves `space.inviteUrl` alongside owner status; "Invite Members" entry shows for non-owners when `hasPublicInvite` and deep-links to the Invites tab. Owner path unchanged. |

### What changed scope mid-stream

- **Lightweight standalone modal vs. reuse the existing Invites tab.** First sketch was a separate read-only modal triggered from a new channel-header invite button. User pushed back: same UI for owners and non-owners, since a user is owner of some spaces and member of others — fragmenting the affordance is confusing. Final decision: reuse `SpaceSettings > Invites` tab and branch internally on `isSpaceOwner`.
- **Whether to port mobile's `ShareInviteSheet`** (slide-up contact-picker sheet, mobile's "share to a DM" UX). Compared side-by-side with desktop's existing `SearchableConversationSelect` + `DmPicker`: desktop's pattern has search, is keyboard-friendly, already polished. Mobile's pattern exists because mobile didn't have an in-tab picker. Decision: do NOT port `ShareInviteSheet`; reuse desktop's picker for non-owners too.
- **Whether non-owners get a generate path at all.** Initial framing in candidates.md said yes (one-time invites work for non-owners at the service layer). User pushback + screenshot inspection + reading `services/space/inviteService.ts:303-305` revealed mobile's actual UX: non-owners only see/share the link the owner already published (replicated via the encrypted manifest). The shipped UI is read-only for non-owners. See [`#29` notes](candidates.md#29-non-owner-read-only-access-to-public-invite-url--shipped-pr-182-2026-06-08) for the full back-and-forth.

### Lessons (also in the top-level block above)

- **"Non-owner can X" needs three checks**: service-layer gate, manifest-replication, "do" vs "view". A single grep on the relevant service file would have shortcut to the right framing for #29.

### Pre-existing JOIN-path crash surfaced during smoke (not introduced by this PR)

Smoke testing #29 led the user to try joining via a public invite link, which fired `"[object Object]" is not valid JSON` at [`InvitationService.ts:593`](../../../src/services/InvitationService.ts#L593). Two independent bugs in `joinInviteLink`:

1. **Response-shape mismatch** at line 593: the server now returns the invite eval as a JSON object `{ciphertext, ephemeral_public_key}` but desktop still does `JSON.parse(inviteEval.data)` expecting a JSON-encoded string. Mobile's `getInviteEval` ([`quorum-mobile/services/api/quorumClient.ts:710-738`](../../../../quorum-mobile/services/api/quorumClient.ts)) defensively handles BOTH shapes.
2. **Wrong ephemeral key used for decryption** at line 587-594: desktop uses the manifest's `ephemeral_public_key`. Mobile uses the eval's OWN ephemeral key when the server provides it ([`quorum-mobile/hooks/chat/useSpaceActions.ts:271-279`](../../../../quorum-mobile/hooks/chat/useSpaceActions.ts) explicitly documents this: every `broadcastSpaceUpdate` re-encrypts the manifest with a fresh ephemeral key but leaves the eval untouched).

Bug 1 causes the hard crash. Bug 2 causes the long-standing "intermittent expiration" behavior tracked at [`2025-09-22-public-invite-link-intermittent-expiration.md`](../../bugs/2025-09-22-public-invite-link-intermittent-expiration.md) (which was over-optimistically marked `likely-resolved-by-consolidation` on the assumption that mobile's server-side eval-reuse fix was sufficient — it wasn't, because desktop's client code never picked up the eval-side ephemeral key change). Both fixed together in a follow-up PR on `session-2026-06-08-3`. The 2026-06-07 invite-consolidation explicitly skipped the join path (§4 of that task file: *"The join path already handles both public ... and private ... correctly"* — that assumption was wrong on the response shape and on the ephemeral key).

## 2026-06-08 — re-audit (no ports shipped; three new candidates added)

Session: `session-2026-06-08-2` in the primary clone.

Pulled all three repos and surveyed mobile's commit delta since the previous baseline:
- `quorum-mobile`: `0fa63d4` (2026-05-30) → `ccd69e6` (2026-06-02). One large content commit (`56ffd31 2026-06-01 "latest update"`) brought in ~12k inserts including three new mainline feature clusters.
- `quorum-shared`: `9d1c08f` (2026-05-30) → `1115a25` (2026-06-05). Type/icon-only additive PRs (`DirectoryEntry`, `UserConfig.hideMutedSpacesFromSidebar`, `Bookmark.cachedPreview` optionals, `IconWallet`). Already consumed during #1 ship.
- `quorum-desktop`: no main movement relevant to the audit.

Added three new candidates to [candidates.md](candidates.md):

- **#27 Skins (custom themes)** ❔ — full skin engine + server gallery + local editor. Desktop's `Appearance.tsx` (96 LOC) only does theme/accent/language; mobile ships ~2000+ LOC across `components/skins/`, `services/skins/`, `services/theme/`, `theme/skins/`, `components/ui/{AppBackground,SkinTouchable}`. Pure-logic shared-promotion candidates if picked up: `validate.ts` (488 LOC, security-critical), `types.ts`, `mergeSkin.ts`. Bundles a third call site for the Ed448 signing-payload helpers deferred from #6.
- **#28 On-device translation** ❔ — native iOS Translation + Android ML Kit module, with `services/translation/*` and `components/translation/*`. Desktop has no equivalent and Electron has no easy bridge to these engines. Realistic paths: cloud (privacy regression vs mobile's on-device guarantee), WASM (size cost), or skip. Re-implementation rather than a port.
- **#29 Non-owner read-only access to the existing public invite URL** 🟢 — smallest port in the queue. Walked through three framings before landing at the right model (recorded in [`#29` notes](candidates.md#29-non-owner-read-only-access-to-public-invite-url--shipped-pr-182-2026-06-08) and the top-level lessons block). Real shape: `space.inviteUrl` (in shared) gets replicated to every member via the encrypted space manifest when the owner generates a public invite. Desktop's only `inviteUrl` consumer is the owner-only `SpaceSettings > Invites` tab. The port = a lightweight read-only modal exposing the URL + copy + share to all members; no generate/regenerate controls for non-owners.

Folded Farcaster-cluster additions in the same mobile delta under existing `❔ needs UX call` rows rather than promoting them to top-level candidates:
- `useBlockedFids`, `useFollowingFids`, `useMutedFids`, `useUserVisibilityActions`, `services/farcaster/socialGraph.ts`, `services/farcaster/feedPrefs.ts` → under #9 Farcaster.
- `services/spaces/farcasterSpaceSocket.ts` → under #15 Audio spaces.
- `components/SocialFeed/views/HegemonyGovernanceView.tsx`, `ProposalVoteBlock.tsx`, `useHegemonyGovernance.ts`, `services/governance/governanceClient.ts` → under #9 + #17 Governance.
- `components/SocialFeed/media/VideoViewer.tsx`, `CastOverflowButton.tsx`, `ProfileOverflowButton.tsx`, `ProfileActionButtons.tsx` → under #9.

Channel-management hooks (`hooks/chat/useChannelManagement.ts` on mobile) confirmed already on desktop as the full `src/hooks/business/channels/*` tree — Class E, not a candidate.

No ports shipped this session. #29 is queued for the next session.

## 2026-06-08 — #30 Per-space profile bio override shipped (+ receive-handler upsert fix + UserProfile bio render)

- **Branch**: `feat/port-per-space-bio`.
- **Task file**: [`.done/2026-06-08-port-per-space-bio.md`](.done/2026-06-08-port-per-space-bio.md) (moved to `.done/` as part of the merge).
- **PR**: [#185](https://github.com/QuilibriumNetwork/quorum-desktop/pull/185).
- **Repos touched**: `quorum-desktop` only. `quorum-shared` was untouched (all types already exported: `UpdateProfileMessage.bio?`, `UserProfile.bio?`, `validateUserBio`, `MAX_BIO_LENGTH=160`). A mobile follow-up task was dropped — see Mobile-side follow-up below.

### What shipped

| Layer | What |
|---|---|
| Editor | Bio TextArea added to Space Settings → Account tab. Section copy rewritten to mobile's framing ("Override your display name, avatar, and bio for this Space. Other Spaces and your global profile are unaffected."). Display name Input error narrowed to `displayNameError` only so bio errors don't visually red-flag the wrong field. |
| Hook | `useSpaceProfile` gained `bio`, `setBio`, `bioErrors` + a `baseline` snapshot captured on load. `onSave` builds a change-only payload (only includes fields that differ from baseline) and skips the broadcast entirely when nothing changed. Mirrors mobile's `SpaceSettingsModal.tsx:459-467` sender-side gate. |
| Wire format | Bio threaded into the `update-profile` payload via the existing `UpdateProfileMessage.bio?: string` shared field. Tag-rotation rebroadcast in `MessageService.ts` also carries the global bio along (when set) so members of every space pick up the current value. |
| Receive | Both receive sites in `MessageService.ts` (`saveMessage` ~L1153 and `addMessage` ~L1655) switched from unconditional overwrite to mobile's upsert-aware merge: truthy check for displayName/userIcon (skip empty strings — wire shape never sends them empty intentionally), `!== undefined` for bio (explicit empty string is a deliberate clear). This was a latent bug — partial profile updates were clobbering receivers' stored fields. |
| Render | "About" section added to `UserProfile.tsx` (the in-channel user-click card). Renders only when bio is non-empty so users without a bio see no empty section. Bio resolution: per-space `member.bio` wins; for own profile, falls back to `UserConfig.bio` via `useQuery` (reactive, not a snapshot); for others with public profile, `useMembersWithPublicProfileFallback` already surfaces `pub.bio`. |
| Data flow | Bio plumbed through 6 intermediate files: `useChannelData.members` map, `useMembersWithPublicProfileFallback` merge, `generateVirtualizedUserList` shape, `UserProfileModalUser` type, `Message.tsx onUserClick` payload, `ThreadPanel.tsx starterUser`, `MessageMarkdownRenderer.tsx` mention click. Without this chain the editor would have no visible effect on the space side. |
| Global bio broadcast | `MessageDB.updateUserProfile` gained a `bio?: string` parameter. `useUserSettings.saveChanges` reads `freshConfig` BEFORE calling `updateUserProfile` and passes bio only when it differs from `freshConfig.bio` — avoids clobbering per-space overrides on unrelated saves (e.g. toggling a notification preference). |
| Cache-first init | `useUserSettings` init effect now reads from React Query cache synchronously first, falls back to `getConfig` (IndexedDB + decryption) only on cache miss. Fixes a race where reopening User Settings right after a save showed stale bio (action queue write hadn't flushed). For warm cache, eliminates the 1-2s "fields flash empty" issue too. |
| Positioning clamp | `calculateModalPosition` now bounds `position.top` against the viewport so the now-taller UserProfile card doesn't clip past the bottom edge. Defense patch; the proper Floating UI refactor is filed as a follow-up task. |
| Drive-bys | (1) `db/messages.ts`: `SpaceMember` intersection in `getSpaceMember` / `getSpaceMembers` / `saveSpaceMember` now declares `bio?: string` (was missing from the type even though it was stored at runtime). (2) Code-review pass during shipping caught + fixed: non-reactive `getQueryData` snapshot in `UserProfile.tsx` swapped for `useQuery` subscription so the card re-renders if the global bio changes while it's open. |

### What changed scope during shipping

- **Scope grew from "just the editor" to "editor + receive fix + render + plumbing".** Initial scope was the textarea. Verification pass showed (a) no space-side surface rendered `member.bio` (the feature would have been invisible without `UserProfile.tsx` render), (b) the receive handlers had a latent clobber bug bundled fix, (c) data flow gaps in 6 files. All bundled rather than split because the editor alone would have shipped a non-functional feature.
- **Bio length cap stays at shared `MAX_BIO_LENGTH=160`.** Mobile has three inconsistent caps (160 onboarding / 256 global / 280 per-space) and ignores the shared validator. User's call was to stay aligned with the shared constant; mobile convergence dropped as a follow-up task.
- **Three follow-up tasks filed.** `2026-06-08-userprofile-positioning-floating-ui.md` (proper architectural fix for the positioning clamp), `2026-06-08-userprofile-card-layout-polish.md` (UI design pass surfaced by the bio addition but with pre-existing roots), `bugs/2026-06-08-user-settings-modal-fields-flash-empty-on-open.md` (cold-start residual after the cache-read fix mitigates the warm-cache case).

### Mobile-side follow-up dropped

- **`2026-06-08-mobile-converge-bio-length-to-shared.md`** — converge mobile's three bio editors (160/256/280) to shared `MAX_BIO_LENGTH=160` + adopt `validateUserBio` (XSS check). Tracker row added to `mobile-tasks-pending.md`. Runtime test required (cap reduction is user-visible for any existing 161–280 char bios on mobile).
  - **Superseded 2026-06-10:** shared [#37](https://github.com/QuilibriumNetwork/quorum-shared/pull/37) made the bio validator **byte-based to match Farcaster** (≤ 256 **bytes** via `MAX_BIO_BYTES`, not 160 chars) and **removed `MAX_BIO_LENGTH`**. The convergence target changed accordingly: the global bio cap now *rises* to 256B (only the per-space 280 editor shrinks), and the task was merged with the display-name convergence (also now 32-byte Farcaster-capped) into a single tracker row 2. See `mobile-tasks-pending.md` row 2 for the corrected scope, which also adds a Farcaster publish-boundary hard-block. The original `MAX_BIO_LENGTH=160` framing in this historical entry is left as-written (it was accurate on 2026-06-08).

### Lessons captured

- **A feature port can have a hidden multiplier.** Shipping the bio editor alone would have shipped a feature with zero visible effect — no space-side surface rendered `member.bio`. Verification pass before drafting the task file caught this; an editor-only port would have been worse than no port (latent invisible data). When scoping a port, grep for the rendering surface, not just the data path.
- **Pre-existing latent bugs adjacent to a port are often worth bundling.** The receive-handler overwrite bug existed before bio; it would have been a clobber problem for any partial profile update. Fixing it in the bio PR is in scope because the new bio-only edit pattern relies on the fix; deferring would have shipped bio + a known bug that bio exposes. Drive-by fixes are fine when the alternative is shipping a known-broken interaction.
- **Code review pre-PR catches subtle staleness issues.** The reviewer flagged a `getQueryData` snapshot vs `useQuery` subscription — a pattern that "works in practice but stops working at the edge." Both fixes from the review were 10 lines combined; both would have been bug reports after merge if not caught. Worth the review pass cost.

## 2026-06-08 — #6 Public profile UI shipped (+ retired speculative `/discover/people`)

- **Branch**: `feat/port-public-profile-from-mobile`.
- **Task file**: [`.done/2026-06-08-port-public-profile.md`](.done/2026-06-08-port-public-profile.md) (moved to `.done/` as part of the merge).
- **PR**: [#181](https://github.com/QuilibriumNetwork/quorum-desktop/pull/181) (merged 2026-06-08).
- **Repos touched**: `quorum-desktop` only. `quorum-shared` was untouched (everything needed already exported, including `int64ToBytes`, `UserConfig.isProfilePublic`, `UserConfig.bio`). `quorum-mobile` is read-only context for this effort.

### What shipped

| Layer | What |
|---|---|
| API client | New URL helper (`getPublicProfileUrl`) + 3 methods on `QuorumApiClient` (`getPublicProfile`, `postPublicProfile`, `deletePublicProfile`) + 3 wire-type interfaces in `baseTypes.ts`. |
| Service | `src/services/PublicProfileService.ts` — signs the canonical payload with `ch.js_sign_ed448`, posts/deletes against the server. Byte-for-byte compatible with mobile's signing (verified during code review). |
| Privacy UI | "Public profile" Switch in the Privacy/Security settings tab, placed right before the disabled "Show Online Status" row to form a coherent visibility cluster. Turning ON triggers a destructive-style confirmation modal (matches mobile's "Make profile public?" alert); turning OFF unpublishes silently. |
| State plumbing | `useUserSettings` exposes `isProfilePublic` / `setIsProfilePublic`, initializes from `config?.isProfilePublic`, includes it in the `save-user-config` action queue payload, and calls publish/unpublish via the service. The publish call now runs BEFORE the fire-and-forget enqueue (with a best-effort revert in the `.catch` if the local save fails — see the lesson above). |
| DM header backfill | `useUserPublicProfile` hook + a fallback chain in `DirectMessage.tsx`'s `members` useMemo. The recipient's name and avatar appear in the DM chat header before they send any message, when they've opted in. |
| Space message backfill | `useMembersWithPublicProfileFallback` hook (with the manual ref-cache perf pattern verbatim-ported from mobile) + wiring in `Channel.tsx`. Senders whose local `SpaceMember` record is empty or stale get backfilled from their public profile in the message list. The member-list sidebar and role logic intentionally don't use the backfilled map (would mean fetching profiles for every space member). |
| Subtractive | Deleted `PeopleTab.tsx/.scss`, `DiscoverSidebar.tsx/.scss`. Simplified `DiscoverPage` to render only the spaces directory. Router redirects `/discover/people` → `/discover/spaces` for stale bookmarks. NavRail entry renamed "Discover" → "Public spaces". |
| Drive-bys | (1) Fixed two latent bugs in `ConfirmationModal.tsx` — the title was hidden inside `.modal-complex-wrapper`-hosted modals because the un-hide CSS rule required a className the component didn't always set, and `variant: 'warning' \| 'info'` rendered unstyled confirm buttons because `Button` only knows `'danger'` as a destructive type. (2) Updated stale `db/messages.ts` comment claiming `bio` was local-only — it's been syncing via UserConfig for months. |

### What changed scope during shipping

- **Public profile directory** — original framing implied one; backend has no enumeration endpoint, so it isn't shippable without server work. People tab was speculative scaffolding from a prior session built on this same assumption. Retired in the same PR.
- **QNS `@username` resolution in `NewDirectMessageModal`** — mobile has it via the QNS client; desktop doesn't have QNS at all. Pulling in QNS would mean a 1,235 LOC client + 451 LOC of hooks + a new base URL — candidate #12 territory, not a small extract. Logged as a mini-candidate under #12.
- **Bio sync** — initial assumption was that bio was local-only on desktop. Investigation showed it's been syncing via UserConfig (the `db/messages.ts` comment was stale). What this PR adds *for bio* is carrying it in the public-profile payload so non-members can see it.
- **Shared promotion of signing helpers** — `int64BE` / `concatBytes` / canonicalize-then-sign helpers are the same pattern Reporting (#5) would use. Deferred to a follow-up: extract once #5 is also picked up and we have two real call sites to lock in the API shape. Cross-pointer added to `quorum-shared-migration/README.md`.

### Lessons captured (also pulled into the top-level block above)

- **Verify backend assumptions before scoping UI.** Saved us from shipping a permanently-empty directory page.
- **Rebase, don't merge — and read what landed on main.** PR #180's fire-and-forget enqueue introduced a race that only surfaced because we walked the diff and re-ran code review on the rebased branch.

## 2026-06-01 — folder scaffolded + initial inventory + capability-verification pass

- Created `.agents/tasks/port-from-mobile/` with README, workflow, candidates, shipped-log, desktop-better-than-mobile.
- Pulled all three repos; confirmed mobile master at `0fa63d4` (2026-05-30), shared at `9d1c08f` (2026-05-30).
- Session branch: `session-2026-06-01`.
- Inventory pass identified 26 candidate features.
- Capability-verification rule introduced after two candidates (#2, #3) were initially ranked as "ready to pick" then knocked off when closer reading found desktop has them under different names.
- **Final status after this session:**
  - 🟢 **#1 Discover spaces** — user's first pick. Capability-verified missing on desktop (`JoinSpaceModal` + `AddSpaceModal` are invite-link-only). Next session: draft task file.
  - 🟢 **#6 Public profile UI** — capability-verified missing. Queued behind #1.
  - ⏸️ **#5 Reporting** — capability missing but deprioritized (user call: not a near-term product priority).
  - ❌ **#2 Message search** — desktop has it via `<GlobalSearch>` embedded in DM + Channel headers.
  - ❌ **#3 Reply tracking** — desktop has it under a different name (`useReplyNotificationCounts`), strictly better. Logged in `desktop-better-than-mobile.md` #1 as a future port-to-mobile candidate.
  - ❌ **#4 Last-message-preview / spaces sort** — UX-pattern conflict (Discord vs Telegram model).
  - ⚠️ **#8 OG metadata** — Farcaster-only on mobile; not a chat feature. Demoted.
  - ❔ Product-scope candidates (#9 Farcaster, #12 QNS, #13 Wallet, #14 Calling, #15 Audio spaces, #16 Miniapps, #17 Governance) — need product decisions before scoping.

---

*Last updated: 2026-06-08 — **#29 Non-owner read-only access to the public invite URL shipped** (PR #182). Reused the existing `SpaceSettings > Invites` tab + sidebar context menu instead of a new modal, per user feedback ("don't fragment the affordance between owners and non-owners — same user is owner of some spaces and member of others"). Smoke test surfaced a pre-existing crash on the JOIN path (`InvitationService.joinInviteLink` line 593, `"[object Object]" is not valid JSON`) — addressed separately on `session-2026-06-08-3`.*

*Previously: 2026-06-08 — re-audit entry added (no ships). Three new candidates: #27 Skins, #28 On-device translation, #29 Non-owner read-only access to the existing public invite URL. New top-level lesson recorded: "non-owner can X" needs three checks (service-layer gate, manifest replication, UI is "do" or "view").*
