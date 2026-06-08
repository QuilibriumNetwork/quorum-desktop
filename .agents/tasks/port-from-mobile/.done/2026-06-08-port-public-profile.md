---
type: task
title: Port the public-profile capability from mobile + retire `/discover/people`
status: in-progress
complexity: medium
created: 2026-06-08
updated: 2026-06-08
branch: feat/port-public-profile-from-mobile
candidate: '#6'
---

# Port public profile from mobile + remove speculative `/discover/people`

## What

Port the public-profile capability that mobile actually ships, and remove the speculative `/discover/people` People tab that was scaffolded on the (now-disproven) assumption that a public-profile **directory** existed or was coming.

**Three additive pieces** (port what mobile ships) **+ one subtractive piece** (remove speculation):

1. **Publish toggle** in desktop's profile-edit UI — `isProfilePublic` switch that publishes/unpublishes a signed plaintext profile to `POST/DELETE /users/:addr/public-profile`.
2. **Single-user resolve-by-address** in DM chat header — fill displayName/avatar in the DM header before the first message arrives, when the local Conversation row has no displayName/icon yet (mirrors mobile `app/(tabs)/messages/dm/[id].tsx` line 108).
3. **Member-fallback resolver** in space + DM message rendering — fill displayName/avatar/bio for senders the local SpaceMember/conversation record doesn't have, using a per-field timestamp comparison (chat broadcast wins if newer, public profile wins otherwise). Mirrors mobile `useMembersWithPublicProfileFallback`.
4. **Remove the People tab + simplify Discover chrome.** Delete `PeopleTab.tsx/.scss`, delete `DiscoverSidebar` (degenerate with one section left), rename NavRail entry from "Discover" to "Public spaces" pointing directly to `/discover/spaces`, simplify the routing.

## Why

Three reasons stacked, in order of importance:

1. **Real UX gap.** Right now on desktop, if you receive a DM from someone you don't share a space with, the chat header may show "Unknown User" until they send a message that includes their displayName broadcast. Mobile resolved this by falling back to the user's published public profile (if they've opted in). Bringing this to desktop closes a visible UX gap and ships an "opt-in to be discoverable" toggle parity-with-mobile.

2. **Closes a shared-migration loose end.** `UserConfig.isProfilePublic` and `UserConfig.farcasterLink` landed in `@quilibrium/quorum-shared` in PR #159 (2026-05-28) as type-only additions. Desktop has the field in its local `UserConfig` mirror ([`src/db/messages.ts:60-61`](../../../src/db/messages.ts#L60-L61)) but **zero readers/writers**. This port wires up the consumer the type-only PR anticipated.

3. **Removes a UI that turned out to be backend-blocked.** During scoping we discovered the server exposes **no profile-enumeration endpoint** — no `GET /users`, no `GET /directory/users`, no `?search=`. Every public-profile fetch is resolve-by-known-address. Mobile has no profile directory either, for the same reason. So the speculative People tab at `/discover/people` (with its own docblock acknowledging "no list/search endpoint exists yet") can't be backed by anything portable, and should be removed rather than left as a permanently-empty placeholder. With only one section left, the entire `DiscoverSidebar` collapses — and the cleaner UX is to make the NavRail "Public spaces" entry navigate straight to `/discover/spaces`.

## Capability verification

Done 2026-06-08. Mobile sources fully read; desktop confirmed missing all three pieces.

| Capability | Mobile location | Desktop today |
|---|---|---|
| Publish toggle + sign + POST/DELETE `/users/:addr/public-profile` | `services/profile/publicProfile.ts` (123 LOC), wired into `components/UnifiedProfileEditModal.tsx` (line 539+, 1976+ — toggle + auto-republish on profile edit) | ❌ no API methods, no toggle in `UserProfileEdit.tsx` |
| Single-user fetch by address (DM header backfill) | `hooks/useUserPublicProfile.ts` (39 LOC), used in `app/(tabs)/messages/dm/[id].tsx:108-110` | ❌ no hook, no consumer |
| Member-map fallback resolver (chat rendering backfill) | `hooks/useMembersWithPublicProfileFallback.ts` (132 LOC), used in `components/Chat/SpaceChatArea.tsx:40,209` + `components/Chat/DMChatArea.tsx:33,157` | ❌ no hook, no consumer |
| Public-profile **directory / search** | — | — (mobile doesn't have this either; backend doesn't expose enumeration) |

Symbol-grep confirmed no `useUserPublicProfile`, `publishPublicProfile`, `useMembersWithPublicProfileFallback`, or any UI consumer of `isProfilePublic` on desktop.

Backend endpoint inventory (from mobile API client, the source of truth for what the server exposes):
- `GET /users/:addr/public-profile` — resolve by known address (returns `null` on 404).
- `GET /users/by-fid/:fid` — reverse-lookup by known Farcaster fid.
- `POST /users/:addr/public-profile` — publish (body includes signed payload).
- `DELETE /users/:addr/public-profile` — unpublish (signed body).
- ❌ No `GET /users`, no `GET /directory/users`, no `?search=`.

## Scope clarifications (decisions locked 2026-06-08)

- **No QNS resolution in this PR.** Mobile's `NewConversationModal` accepts both `Qm...` addresses AND `@username` (via QNS `useResolveName`). Desktop's `NewDirectMessageModal` accepts only raw addresses. Pulling in QNS would mean adding a new 1,235-LOC API client + 451 LOC of hooks + a new base URL (`names.quilibrium.com`) — that's candidate #12 (QNS marketplace) territory, not a small extract. The `@username` UX gap stays as a separate mini-candidate logged under `### #12` in [candidates.md](candidates.md#12-qns-marketplace).
- **DM-list search stays a local-list filter.** [`DirectMessageContactsList.tsx:127-134`](../../../src/components/direct/DirectMessageContactsList.tsx#L127-L134) filters existing conversations by `displayName`/`address` substring. We do **not** turn it into a remote-user-discovery surface. That's a separable UX question and would only be useful with a backend enumeration endpoint we don't have.
- **Existing `NewDirectMessageModal` flow stays put.** Desktop's [address-only "New Direct Message" modal](../../../src/components/modals/NewDirectMessageModal.tsx) using [`useDirectMessageCreation`](../../../src/hooks/business/conversations/useDirectMessageCreation.ts) already covers "I know the recipient's address, start a chat" — no changes needed in this PR.
- **Bio is already synced — no new work needed.** Initial scoping assumed bio was local-only. Verification proved it isn't: [`useUserSettings.ts:115`](../../../src/hooks/business/user/useUserSettings.ts#L115) loads `setBio(config?.bio ?? '')` and [line 317](../../../src/hooks/business/user/useUserSettings.ts#L317) writes `bio: bio.trim() || undefined` into the UserConfig posted to `/users/:addr/config`. Bio already syncs cross-device on desktop, mirroring mobile. The comment in [`db/messages.ts:59`](../../../src/db/messages.ts#L59) (`// User's bio/description (local-only for now)`) is **stale** and gets a drive-by update to current reality (synced via UserConfig, published when `isProfilePublic=true`). The historical bio task ([`.agents/tasks/.done/2025-01-06-add-user-bio-field.md`](../.done/2025-01-06-add-user-bio-field.md)) shipped local-only; cross-device sync was added later without updating the comment. What this PR adds *for bio* is **carrying it in the public-profile payload** so non-members can see it via `GET /users/:addr/public-profile` — already covered by `publishPublicProfile` including `bio`.

## Mobile sources to study

- [`quorum-mobile/services/profile/publicProfile.ts`](../../../../quorum-mobile/services/profile/publicProfile.ts) — publish/unpublish service. The signing payload has **two formats** (v1 backward-compat, v2 with `primaryUsername`); the server picks by same condition. Includes optional `farcasterLink` carrying its own internal signature. **Pure logic candidate for shared promotion** — `int64BE`, `concatBytes`, canonicalize-then-sign helpers.
- [`quorum-mobile/hooks/useUserPublicProfile.ts`](../../../../quorum-mobile/hooks/useUserPublicProfile.ts) — React Query hook, 1h staleTime, 24h gcTime, returns null on 404, `retry: false`.
- [`quorum-mobile/hooks/useMembersWithPublicProfileFallback.ts`](../../../../quorum-mobile/hooks/useMembersWithPublicProfileFallback.ts) — `useQueries` over visible-but-unresolved addresses, per-field fallback by timestamp, **manual ref-cache** to avoid identity churn on every render (important perf note in the source).
- [`quorum-mobile/services/api/quorumClient.ts`](../../../../quorum-mobile/services/api/quorumClient.ts) lines 755-867 — `getPublicProfile`, `postPublicProfile`, `deletePublicProfile`, `getUserByFarcasterFid`. Note the 2MB cap + soft-fallback-on-oversize behavior.
- [`quorum-mobile/components/UnifiedProfileEditModal.tsx`](../../../../quorum-mobile/components/UnifiedProfileEditModal.tsx) — toggle UX (line 1976+), auto-publish on edit (line 851+, 933+).
- [`quorum-mobile/components/Chat/SpaceChatArea.tsx`](../../../../quorum-mobile/components/Chat/SpaceChatArea.tsx) line 40, 209 — fallback-resolver consumer pattern in space chat.
- [`quorum-mobile/components/Chat/DMChatArea.tsx`](../../../../quorum-mobile/components/Chat/DMChatArea.tsx) line 33, 157 — same for DM chat.
- [`quorum-mobile/app/(tabs)/messages/dm/[id].tsx`](../../../../quorum-mobile/app/(tabs)/messages/dm/[id].tsx) line 108-110 — single-user fetch for DM header.

## Desktop files to create / modify

### Phase A — API client (additive)

- **CREATE** URL helpers in [`src/api/quorumApi.ts`](../../../src/api/quorumApi.ts) following the `getDirectoryUrl` precedent:
  - `getPublicProfileUrl(address)` → `/users/${address}/public-profile`
  - (Optional, defer if not needed in this PR) `getUserByFarcasterFidUrl(fid)` → `/users/by-fid/${fid}`
- **MODIFY** [`src/api/baseTypes.ts`](../../../src/api/baseTypes.ts) `QuorumApiClient`: add three methods next to `exploreSpaces` (line 475):
  - `getPublicProfile(address)` — `GET`, returns `PublicProfileResponse | null` on 404, soft-fallback on RESPONSE_TOO_LARGE.
  - `postPublicProfile(address, body)` — `POST` with signed payload.
  - `deletePublicProfile(address, body)` — `DELETE` with signed payload.
- **EXPORT** the `PublicProfileResponse` type from `baseTypes.ts` (mirror mobile's shape: `display_name`, `profile_image`, `bio`, `primary_username?`, `timestamp`, `signature`, `farcaster?`).

### Phase B — Signing service (additive, with shared-promotion call to make)

- **CREATE** `src/services/PublicProfileService.ts` (mirrors mobile's `services/profile/publicProfile.ts`):
  - `publishPublicProfile({ address, displayName, profileImage, bio, primaryUsername?, farcasterLink? })`.
  - `unpublishPublicProfile(address)`.
  - Uses desktop's existing Ed448 signing infrastructure (whatever the existing key/sign path in desktop is — look at how `ConfigService.ts` or `ActionQueueHandlers.ts` post user-config does it, then mirror).
- **SHARED-PROMOTION DECISION**: the v1/v2 payload-build + canonicalize-then-sign helpers (`int64BE`, `concatBytes`, the two payload-format selector) are pure logic and used by both apps. Reporting (candidate #5) uses the same pattern. **Recommendation: defer the shared promotion to a follow-up.** Reason: promoting on first use risks getting the API shape wrong; we'd be choosing it from one consumer. Once #5 (Reporting) is also picked up and we see both call sites, we can extract a `@quilibrium/quorum-shared/signing/payloadBuild.ts` (or similar) that fits both. For this PR, copy the helpers desktop-local into `PublicProfileService.ts` and mark them with a `// TODO(shared-promotion): see candidates.md #6 + #5` comment.

### Phase C — Toggle UI (additive)

Desktop's settings modal has multiple tabs. The toggle belongs in **`Privacy.tsx`** (the "Privacy/Security" tab), not General, because the user's mental model of "who can see me" lines up with the existing privacy controls (delivery receipts, read receipts, typing indicators, "Show Online Status"). The disabled `Show Online Status` row at [`Privacy.tsx:252-271`](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L252-L271) is the natural anchor — the new toggle goes **right before** it, between the dashed divider at line 252 and the disabled row at line 253. This puts "publish my profile so anyone can see me" next to "be visible as active" — a coherent visibility cluster.

(Aside: the Privacy.tsx tab is already crowded; might split into separate Privacy and Security tabs later. Not in scope for this PR — flagged 2026-06-08 as a "watch for scattering vs. crowding" concern.)

- **MODIFY** [`src/components/modals/UserSettingsModal/Privacy.tsx`](../../../src/components/modals/UserSettingsModal/Privacy.tsx):
  - Add an `isProfilePublic` Switch row immediately before the dashed-divider+Show Online Status block (currently at line 252-271).
  - Switch label: e.g. `t\`Make profile discoverable\`` or `t\`Public profile\``; tooltip explains "Anyone can fetch your displayName, avatar, and bio by your address. They can already start a DM if they have your address — this lets them see who you are first." (Final wording to be reviewed during implementation; match the tone of adjacent tooltips.)
  - When toggled **on**: call `publishPublicProfile({ address, displayName, profileImage, bio })`. Show a toast/error on failure but keep the local setting authoritative (mirrors mobile's "best-effort" pattern).
  - When toggled **off**: call `unpublishPublicProfile(address)`. Same best-effort pattern.
  - When the user saves changes to displayName/avatar/bio in any tab AND `isProfilePublic === true`: auto-republish (mirrors mobile `UnifiedProfileEditModal.tsx:851+` pattern). This logic lives in `useUserSettings.saveChanges` rather than Privacy.tsx itself, since saveChanges is the single funnel that fires on settings save. Defer the Farcaster-link branch (desktop has no Farcaster — see candidate #9).
- **MODIFY** [`src/components/modals/UserSettingsModal/UserSettingsModal.tsx`](../../../src/components/modals/UserSettingsModal/UserSettingsModal.tsx): wire the new `isProfilePublic`/`setIsProfilePublic` state through to Privacy's prop signature (same pattern as the other settings already plumbed through, e.g. `deliveryReceipts`, `readReceipts`).
- **MODIFY** [`src/hooks/business/user/useUserSettings.ts`](../../../src/hooks/business/user/useUserSettings.ts):
  - Add `isProfilePublic` state, initialized from `config?.isProfilePublic ?? false` (same shape as the existing bio init at line 115).
  - Include `isProfilePublic` in the `newConfig` object at line 306-329 (same shape as bio at line 317).
  - Export `isProfilePublic`/`setIsProfilePublic` from the return object (same shape as the existing pairs).
  - In `saveChanges`, after the `actionQueueService.enqueue('save-user-config', ...)`, if `isProfilePublic` is true, call `publishPublicProfile(...)` (or `unpublishPublicProfile(...)` if it just flipped to false). This is the single auto-republish funnel for the "edit profile while public" flow.
- **UPDATE COMMENT** in [`src/db/messages.ts:59`](../../../src/db/messages.ts#L59) (drive-by): change `// User's bio/description (local-only for now)` to `// User's bio; synced via UserConfig (since 2025-01) and published in public profile when isProfilePublic=true`.

### Phase D — DM header single-user fetch (additive)

- **CREATE** `src/hooks/business/user/useUserPublicProfile.ts` (mirror of mobile's hook, adapted for desktop's React Query setup):
  - `useQuery({ queryKey: ['user-public-profile', address], queryFn: () => apiClient.getPublicProfile(address), staleTime: 60*60*1000, gcTime: 24*60*60*1000, retry: false })`.
- **MODIFY** [`src/components/direct/DirectMessage.tsx`](../../../src/components/direct/DirectMessage.tsx) — find where the DM chat header reads displayName + avatar (around the header-render path; mobile uses `recipientPublicProfile = useUserPublicProfile(recipientAddress, { enabled: !isFarcasterConversation })`). Plug the same hook in, fall back to the public-profile data when the conversation row's displayName/icon are missing.

### Phase E — Member-fallback resolver (additive, the meat)

- **CREATE** `src/hooks/business/user/useMembersWithPublicProfileFallback.ts` (mirror of mobile's hook):
  - Inputs: `members: MemberMap` (from `useSpaceMembers` or DM equivalent), `visibleAddresses: string[]`.
  - Internal: `useQueries` over addresses with no display_name AND no profile_image in `members`.
  - Output: a backfilled `MemberMap` with the per-field timestamp-comparison fallback.
  - **CRITICAL perf note from mobile source:** must use the manual ref-cache pattern (line 67-94 in the mobile file). `useQueries` returns a fresh array reference every render; naive `useMemo` over it would invalidate every render and force every downstream memo (messages array, virtualized list data) to recompute. Read the mobile comment carefully and port the ref-cache pattern verbatim.
- **MODIFY** [`src/components/space/Channel.tsx`](../../../src/components/space/Channel.tsx) (the space chat area, line 253 reads `members`):
  - Compute `visibleSenderAddresses` (de-duped list of senderIds across loaded messages).
  - Wrap `members` with `useMembersWithPublicProfileFallback(members, visibleSenderAddresses)` to produce `effectiveMembers`.
  - Pass `effectiveMembers` everywhere the existing `members` is consumed (notably `mapSenderToUser` at line 1218 area).
- **MODIFY** [`src/components/direct/DirectMessage.tsx`](../../../src/components/direct/DirectMessage.tsx) — same pattern for DM rendering. The DM equivalent of "memberMap" may be a smaller construct; investigate during implementation.

### Phase F — Remove the speculative People tab + simplify Discover chrome (subtractive)

- **DELETE** [`src/components/discover-page/PeopleTab.tsx`](../../../src/components/discover-page/PeopleTab.tsx) and [`PeopleTab.scss`](../../../src/components/discover-page/PeopleTab.scss).
- **DELETE** [`src/components/shell/DiscoverSidebar.tsx`](../../../src/components/shell/DiscoverSidebar.tsx) and its `.scss` (degenerate with one section left).
- **MODIFY** [`src/components/discover-page/index.ts`](../../../src/components/discover-page/index.ts) — drop the `PeopleTab` re-export.
- **MODIFY** [`src/components/discover-page/DiscoverPage.tsx`](../../../src/components/discover-page/DiscoverPage.tsx):
  - Drop the `PeopleTab` import.
  - Drop the `isPeople = location.pathname.startsWith('/discover/people')` branch.
  - The `mode='discover'` rendering becomes `<DiscoverTab />` directly. Update the docblock listing `/discover/people` accordingly.
- **MODIFY** [`src/components/Router/Router.web.tsx`](../../../src/components/Router/Router.web.tsx):
  - Line 160 redirect `/discover` → `/discover/spaces` stays.
  - Line 162 catch-all `path="/discover/:section"` becomes `path="/discover/spaces"` (no more variable section). Optionally add a fallthrough redirect `/discover/people` → `/discover/spaces` for any stale bookmarks.
- **MODIFY** [`src/components/shell/useSidebarMode.ts`](../../../src/components/shell/useSidebarMode.ts) line 18 — `/discover` no longer needs its own sidebar mode. Drop the `discover` mode entirely and let the discover route fall through to whatever the default is (likely none / chat-area-only).
- **MODIFY** [`src/components/shell/AppShell.tsx`](../../../src/components/shell/AppShell.tsx) line 283 — the `isDiscoverLeaf` regex (`/^\/discover\/(spaces|people)/`) becomes `/^\/discover\/spaces/` or just `/^\/discover/`. Verify what it gates.
- **MODIFY** [`src/components/shell/NavRail.tsx`](../../../src/components/shell/NavRail.tsx) line 45 area:
  - Rename the entry label from `t\`Discover\`` (or whatever it is — verify) to `t\`Public spaces\``.
  - Route stays `/discover/spaces` (already correct).
  - Active matcher at line 90+ (`if (location.pathname.startsWith('/discover')) return 'discover'`) — keep the `id='discover'` to avoid renaming everywhere; just change the user-visible label.
- **VERIFY** no leftover references to `/discover/people` in any redirect map, breadcrumb, or test fixture (`grep -r "/discover/people"`).
- **Lingui**: removed strings (`People`, `Search by name or address...`, `Public profiles aren't searchable yet.`) will drop out on the next `yarn extract`. Updated string ("Public spaces" on the NavRail) gets picked up the same way. Don't manually edit `.po` files.

### Phase G — Shared promotion (deferred)

Per the decision in Phase B, no shared package changes in this PR. The signing-payload helpers stay desktop-local with a `// TODO(shared-promotion)` marker. Logged in [candidates.md `### #6`](candidates.md#6-public-profile-ui--in-progress-2026-06-08) under "Shared-promotion opportunity" so the lead dev can pick it up when Reporting (#5) lands and we see both call sites.

## Build sequence

1. **Phase A** (API client) — type-safe scaffolding, no behavior change yet. `yarn tsc --noEmit` should pass.
2. **Phase B** (service) — wire the signing. Unit test against a known good payload from mobile if possible (snapshot the bytes; the server verifies signatures so a regression here is silent until publish/fetch round-trip).
3. **Phase F** (subtractive cleanup) — do this **before** Phase C-E so the additive work doesn't pile up around chrome we're about to delete. Smaller diffs, easier review.
4. **Phase C** (toggle) — ship the user-visible piece.
5. **Phase D** (DM header) — quick win.
6. **Phase E** (member resolver) — most subtle, biggest blast radius. Save for last. Pay attention to the manual-ref-cache pattern.
7. Smoke test in dev (see below).
8. Open PR.

## Smoke test plan

Run with `yarn dev`:

- [ ] **Toggle on/off + persistence**
  - Open Settings → Privacy/Security. Toggle `isProfilePublic` on (the new switch right before "Show Online Status"). Verify (a) no error toast (b) network tab shows `POST /users/<addr>/public-profile` returning 200 (c) reload the app and the toggle is still on.
  - Toggle off. Verify `DELETE /users/<addr>/public-profile` fires.

- [ ] **Auto-republish on profile edit**
  - With toggle on, change displayName. Save. Verify a new `POST /users/<addr>/public-profile` fires with the new displayName.
  - Change bio. Save. Verify republish includes the new bio.
  - Toggle off. Edit profile again. Verify NO publish call fires.

- [ ] **DM header backfill (golden path)**
  - As user A (with `isProfilePublic=true`, displayName "Alice"), publish profile.
  - As user B (different browser profile / device), open a fresh DM to user A's address (no prior conversation, no shared space).
  - Verify the DM header shows "Alice" before A sends any message. Currently this shows "Unknown User" or the raw address.

- [ ] **Member-fallback in spaces chat**
  - Join a public space (via Discover) where there's a message from a user whose `SpaceMember` record is empty.
  - Verify their displayName/avatar appears (resolved from public profile) instead of address-only.

- [ ] **Member-fallback in DM chat (group DMs, if applicable)** — same as above for the DM surface.

- [ ] **Perf — no render storm**
  - Open a busy chat (50+ unique senders). Open React DevTools Profiler. Send a message in a different unrelated channel.
  - Verify the busy chat does NOT re-render its message list. (The mobile-source perf note specifically calls out that a naive `useMemo` would cause render storms; verify the ref-cache pattern holds.)

- [ ] **People tab is gone**
  - `/discover/people` URL → redirects to `/discover/spaces` (no 404).
  - NavRail "Public spaces" entry exists, navigates to `/discover/spaces`.
  - No leftover DiscoverSidebar visible at `/discover/spaces`.
  - No console errors related to dropped imports.

- [ ] **Existing regressions**
  - DM-list search field still filters local conversations as before (no remote lookup leak).
  - `NewDirectMessageModal` still accepts raw addresses + navigates correctly.
  - Existing bio rendering in `DMUserProfileSidebar.tsx` still works for users who don't have published profiles.

## PR description sketch

```markdown
## What
Port the public-profile capability from `quorum-mobile`: publish/unpublish toggle, single-user resolve-by-address for DM headers, and member-map fallback resolver in space + DM chat rendering. Remove the speculative `/discover/people` People tab + simplify Discover chrome since the backend exposes no profile enumeration (neither app has a directory).

## Mobile source
- `quorum-mobile/services/profile/publicProfile.ts` (publish/unpublish)
- `quorum-mobile/hooks/useUserPublicProfile.ts` (single-user fetch)
- `quorum-mobile/hooks/useMembersWithPublicProfileFallback.ts` (chat-rendering fallback)
- `quorum-mobile/components/UnifiedProfileEditModal.tsx` (toggle UX pattern)
- `quorum-mobile/components/Chat/SpaceChatArea.tsx` + `DMChatArea.tsx` (consumers)

## Why
- Closes a real UX gap: DM headers from strangers no longer say "Unknown User" before the first message arrives.
- Closes the shared-migration loose end where `UserConfig.isProfilePublic` shipped as type-only in shared PR #159 (2026-05-28) but desktop had zero consumer.
- Removes a UI built on the assumption that a public-profile directory was coming. It isn't — see the candidates.md investigation: the server is a resolve-by-known-address store for profiles, not an enumeration index. Neither app has (or can have) a directory without backend changes.

## Cross-repo summary
- **quorum-shared**: not touched. Signing helpers are kept desktop-local pending a follow-up extraction once Reporting (#5) lands and we have two call sites.
- **quorum-desktop**: THIS PR.
- **quorum-mobile**: not touched (read-only for this effort).

## Smoke test
- [ ] Toggle on/off persists across reloads, POST/DELETE fires correctly
- [ ] Auto-republish fires on profile edit when toggle is on
- [ ] DM header shows displayName from public profile for strangers
- [ ] Member fallback resolver fills displayName/avatar in spaces + DM chat
- [ ] No render storm in busy chats (ref-cache pattern preserved)
- [ ] `/discover/people` redirects to `/discover/spaces`; NavRail entry reads "Public spaces"
- [ ] No regression in DM-list search, NewDirectMessageModal, bio rendering
```

## Open questions surfaced during scoping

(For the lead dev / record. No action needed in this PR.)

- **QNS `@username` in `NewDirectMessageModal`** — desktop is missing the `@username → address` resolution path that mobile has. Logged under [candidates.md `### #12`](candidates.md#12-qns-marketplace) as a mini-candidate worth picking up if/when QNS goes in product scope.
- **Backend never exposed user enumeration** — record this in [`desktop-better-than-mobile.md`](desktop-better-than-mobile.md)? Actually no, neither app has it, so it's not a "desktop is better" thing — it's a product/backend gap. Already captured in [candidates.md `### #6`](candidates.md#6-public-profile-ui--in-progress-2026-06-08); nothing to add elsewhere.
- **`v2:primary_username` signing path** — mobile's publish payload has a v1/v2 split (line 92-100 of `publicProfile.ts`); v2 carries an optional `primaryUsername`. Desktop doesn't have QNS, so it'll only ever publish v1 payloads. Note in `PublicProfileService.ts` and leave the v2 path as a `// reserved for future QNS integration` stub.
- **Farcaster link in published profile** — mobile bundles a `farcasterLink` (with its own internal Quorum-side signature) on publish when the user has Farcaster connected. Desktop doesn't have Farcaster (candidate #9). Skip this branch entirely; profile payloads from desktop will never include `farcaster`.

## Verification checkboxes (per workflow.md)

- [x] Capability verification: stated in plain terms, grepped desktop for the concept, read mobile sources in full.
- [x] "Port the capability, not the UX pattern": scope adjusted after discovering mobile's "feature" is invisible plumbing, not a directory. People tab removal is the UX-adjustment consequence.
- [x] Pre-flight pulls: all three repos up to date (mobile `ccd69e6`, shared `1115a25`, desktop main `2b874159`).
- [x] Branch: `feat/port-public-profile-from-mobile` (renamed from `session-2026-06-08` since the scope is clear).
- [ ] Phases A-F implemented.
- [ ] Smoke test passed in dev.
- [ ] PR opened.
- [ ] User confirmation before self-merge.
- [ ] Move this task file to `.done/` in the merge commit.
- [ ] Update [shipped-log.md](shipped-log.md).

---

*Last updated: 2026-06-08*
