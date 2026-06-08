---
type: inventory
title: Mobile features not on desktop — candidate list
status: living
created: 2026-06-01
updated: 2026-06-08
---

# Mobile features not on desktop — candidate list

Running inventory of features that exist on `quorum-mobile` but not on `quorum-desktop`. Updated each session as new candidates surface or existing ones are picked, ported, or rejected.

**Inventory baseline:**
- `quorum-mobile` `master` at `ccd69e6` (2026-06-02) — re-baselined 2026-06-08 in `session-2026-06-08-2`. Previous baseline was `0fa63d4` (2026-05-30); the delta added candidates **#27 Skins**, **#28 On-device translation**, **#29 Non-owner invite drawer**. Farcaster-specific additions in the same delta (block/mute/follow visibility actions, `feedPrefs`, `farcasterSpaceSocket`, `HegemonyGovernanceView`, `VideoViewer`, `CastOverflowButton`/`ProfileOverflowButton`/`ProfileActionButtons`) are folded into existing `❔` rows (#9 Farcaster, #15 Audio spaces, #17 Governance) and not promoted to top-level candidates until those product calls are made.
- `quorum-desktop` `main` at HEAD on `session-2026-06-08-2`
- `quorum-shared` `master` at `1115a25` (2026-06-05)

## Classification

| Class | Meaning |
|---|---|
| **A. Direct port** | Feature exists on mobile, doesn't exist on desktop, fits desktop UX, no major architectural shift needed |
| **B. Port with shared promotion** | A, plus pure logic that could live in shared (do both in the same effort) |
| **C. Conditional port** | Fits desktop UX in principle but requires a deeper decision (architectural shift, new dependency, UX questions, lead-dev coordination) |
| **D. Won't port** | Doesn't fit desktop UX, or fundamentally mobile-only (iOS NSE, native camera, etc.) |
| **E. Already on desktop** | Looked similar but desktop actually has it — confirmed and ruled out |

## How to read this table

Each row is a **feature**, not a hook. One feature can imply multiple files on both sides. Pick a row, read the mobile sources, then draft a `YYYY-MM-DD-port-<slug>.md` task with the concrete file plan.

## Candidate table

Legend: 🟢 ready to pick · 🚧 in progress · ✅ shipped · ⏸️ paused · ❌ won't port · ❔ needs UX call

| # | Feature | Mobile location | Class | Status | Notes |
|---|---|---|---|---|---|
| **1** | **Discover/Explore spaces** (public space directory, search, categories, member counts, join from list) | `app/(tabs)/spaces/discover.tsx`, `hooks/chat/useExploreSpaces.ts`, `services/api/quorumClient.ts` (`DirectoryEntry`, `getDirectory`) | A | ✅ | **Shipped on desktop** as `/spaces` page (PR 1 = #170, 2026-06-04). PR 2 (retire legacy modals + remove navbar `+`) marked obsolete after new UI shell PR #171 made the SpacesSidebar `+` button a deliberate fixture. Task files moved to `.done/`. |
| **2** | **Message search inside a space/DM** | `hooks/chat/useMessageSearch.ts` + UI surfaces | E | ❌ | **Already on desktop, different implementation.** Desktop embeds `<GlobalSearch>` directly in `DirectMessage.tsx` + `Channel.tsx` headers, scoped to the current conversation. Mobile uses in-memory MiniSearch over loaded messages; desktop uses `SearchService` over IndexedDB-persisted history (arguably better — full history, not just loaded scroll). Different impl, same UX. Not a port. |
| **3** | ~~**Reply tracking**~~ | `hooks/chat/useReplyTracking.ts` | E | ❌ | **Already on desktop — strictly better.** Desktop has `useReplyNotificationCounts` + `useSpaceReplyCounts` + `useAllReplies` + `useChannelMentionCounts` + `NotificationService` + `NotificationPanel`, all derived from `MessageDB` with read-state tracking and respecting user notification settings. Mobile's MMKV counter is a less-capable parallel implementation. See [`desktop-better-than-mobile.md` #1](desktop-better-than-mobile.md#1-reply-notification-counts) for the full side-by-side. Not a port. |
| **4** | ~~**Last-message-preview + spaces-list sort**~~ | `hooks/chat/useSpaceActivity.ts` | A | ❌ | **Won't port** (2026-06-01). UX-pattern conflict with desktop's Discord-style model. See `### #4` notes. |
| **5** | **Reporting / abuse flag** (`report cast`, `report message` workflow with E2E-respecting per-report key) | `services/reporting/reportService.ts`, `components/ReportModal.tsx`, used from `DMChatArea`, `SpaceChatArea`, `CastThreadModal`, `SocialFeedModal`, `ProfileModal` | B | 🟢 | **Shipped on mobile.** Trust/safety primitive — desktop has nothing. Logic: encrypt reported plaintext under a fresh AES-GCM key (only known to reporter + server), sign with Ed448 inbox key. **Bundled shared-promotion when picked up** — see [`### #5` notes](#5-reporting--deprioritized): same canonicalize-then-sign helpers as `#6` Public Profile (shipped 2026-06-08 with the promotion deferred to this moment). |
| **6** | **Public profile** (opt-in publish + resolve-by-address; backfills chat rendering for users we don't share a space with) | `services/profile/publicProfile.ts`, `hooks/useUserPublicProfile.ts`, `hooks/useMembersWithPublicProfileFallback.ts`, consumed in `UnifiedProfileEditModal.tsx` (toggle), `dm/[id].tsx` (header), `SpaceChatArea.tsx` + `DMChatArea.tsx` (fallback) | B | ✅ | **Shipped 2026-06-08** ([task file in `.done/`](.done/2026-06-08-port-public-profile.md)). Closed the `UserConfig.isProfilePublic` shared-migration loose end (shared PR #159, 2026-05-28). Bundled removal of the speculative `/discover/people` People tab + `DiscoverSidebar` (no backend enumeration endpoint exists; neither app has a profile directory). Code-review pass during shipping caught and fixed a rollback consistency hole new to desktop after main's PR #180 (fire-and-forget enqueue). |
| **7** | **Profile prefs** (extra profile settings: visibility, defaults) | `services/profile/profilePrefs.ts` | C | ❔ | Sub-feature of #6, scope to that effort. |
| **8** | **OG metadata previews** (link unfurl: og:title, og:image when a URL is pasted) | `hooks/useOgMetadata.ts`, used in `components/SocialFeedModal.tsx` | A | ⚠️ | **Only shipped in mobile's Farcaster feed (SocialFeedModal), NOT in space chat or DM chat.** If we don't port Farcaster (#9, product-scope decision), this becomes a desktop-only extension into chat surfaces rather than a port of a shipped chat feature. Plus the CORS-bypass-via-Electron-IPC caveat. Demote unless Farcaster is in scope. |
| **9** | **Farcaster integration** (full social-feed bridge: feed, channel, profile, search, submit cast, thread, notifications, signer lifecycle) | `hooks/useFarcaster*.ts` (~10 hooks), `services/farcaster/*` (~9 files), `services/farcasterClient.ts`, `components/SocialFeed/` | C | ❔ | Shared already has a Farcaster module (`@quilibrium/quorum-shared/src/farcaster/`, 2026-05-30 dump). Mobile uses some of it + its own hooks. **Ask user**: do we want a Farcaster surface on desktop at all? If yes, this is multi-week. |
| **10** | **DM ↔ Farcaster direct casts unification** (`useFarcasterDirectCasts`, `useUnifiedConversations`) | `hooks/chat/useFarcasterDirectCasts.ts`, `hooks/chat/useUnifiedConversations.ts` | C | ❔ | Sub-feature of #9. Mobile presents native DMs and Farcaster direct casts in one list. Only meaningful if #9 ships first. |
| **11** | **Scam filter / spam filter** | `services/farcaster/scamFilter.ts` | C | ❔ | Likely Farcaster-specific. Re-evaluate after #9 decision. |
| **12** | **QNS marketplace + auctions** (browse names, create auctions, make offers, register payment) | `hooks/useQNSMarketplace.ts`, `hooks/useQNSPayment.ts`, `hooks/useQNS.ts`, `components/qns/*Modal.tsx` | C | ❔ | Real product surface. **Ask user**: should desktop have a QNS marketplace? Could fit. |
| **13** | **Multi-chain wallet** (Solana/EVM/Kaspa/Bittensor; balances, history, send/receive, swap via Jupiter/Li.Fi/Relay) | `services/wallet/*`, `hooks/useWallet.ts`, `hooks/useWalletSelection.ts`, `hooks/useWarpcastWallet.ts`, `hooks/useTokenInfo.ts`, `components/wallet/*` | C | ❔ | Massive feature. **Ask user**: does the desktop product want a wallet at all? If yes — phased multi-PR effort. Touches a lot of new deps (likely `@solana/web3.js`, EVM lib, etc.). |
| **14** | **Calling stack** (1:1 voice/video over WebRTC, SFU, signaling, blind-tokens, native call screens) | `services/calling/*`, `context/CallContext.tsx`, `components/Call/*` | C/D | ❔ | Real-time calling on desktop is technically possible (WebRTC works in browsers) but needs heavy UX work. **Ask user**: in scope or out? If in scope, very large effort. |
| **15** | **Audio spaces** (LiveKit-backed group audio rooms, "Twitter Spaces" style) | `services/spaces/livekit*.ts`, `context/AudioSpaceContext.tsx` | C/D | ❔ | LiveKit web SDK exists, so technically portable. **Ask user**: scope. |
| **16** | **Mini-apps + in-app browser** (`browser.tsx` screen, miniapp WebView bridge with ethereum provider injection, secure signing for dApps) | `app/browser.tsx`, `app/apps.tsx`, `services/miniapp/*`, `context/MiniappOverlayContext.tsx` | C | ❔ | Desktop is an Electron app — has a built-in browser engine. Could be reframed as "desktop opens miniapps in a new window". **Ask user**: scope. |
| **17** | **Governance** (proposal voting, governance hooks) | `hooks/useGovernance.ts` | C | ❔ | **Ask user**: is governance a planned desktop feature? |
| **18** | **Image attachments / media library save** | `services/media/imageAttachment.ts`, `services/media/saveToLibrary.ts`, `services/media/customAssets.ts` | A/E | ❔ | Desktop has `components/files/` but worth checking whether image-attach UX on send matches mobile's. Could yield small UX-parity wins. |
| **19** | **Mention extraction utility** | `services/farcaster/mentionExtraction.ts` | E | — | Desktop already has `components/mentions/` + `parseMentions` from shared. Likely fully covered. |
| **20** | **Emoji frecency** | `services/emojiFrecency.ts`, `hooks/useEmojiFrecency.ts` | E | — | Trap D from the shared-migration roadmap — desktop has raw-counts version, mobile has exponential-decay. Different algorithms, not a port. |
| **21** | **Offline mutation queue + query persistence** | `services/offline/*`, `services/observability/*` | E | — | Desktop has `ActionQueueService.ts` + persistence in `db/messages.ts`. Different impl on purpose. Stays per-app per shared-migration decision. |
| **22** | **Biometric / device-bound auth** | `hooks/useBiometricAuth.ts` | D | — | Mobile-only. Web equivalent (WebAuthn) is technically possible but is a separate product decision. |
| **23** | **OTA updates** | `hooks/useOTAUpdate.ts` | D | — | Expo OTA. Desktop ships via Electron auto-updater (different paradigm). |
| **24** | **Network state detection** | `hooks/useNetworkState.ts` | E? | — | Trivial; desktop likely has `navigator.onLine` somewhere. Skip unless we hit a need. |
| **25** | **Push notifications stack** (Expo push registration, iOS NSE, background fetch, classifier) | `services/notifications/*` | D / paused | — | Already paused in [quorum-shared-migration/roadmap.md](../quorum-shared-migration/roadmap.md) (notifications convergence track, mobile #65). Don't re-open. |
| **26** | **Onboarding refinements** (farcaster setup step, privacy setup step in the onboarding flow) | `app/(onboarding)/farcaster-setup.tsx`, `app/(onboarding)/privacy-setup.tsx` | C | ❔ | If we ship Farcaster (#9), parts of `farcaster-setup` translate. `privacy-setup` is a cleaner UX for the same toggles desktop has in `UserSettingsModal`. Possible small win. |
| **27** | **Skins (custom themes)** — bundled samples + locally-saved skins + server gallery; per-skin: color tokens (accent/surfaces/text/semantic), radii/spacing/borders (with global `scale`), `fontScale`, embedded font face, icon substitution map, wallpaper (cover/tile/contain + scrim), frame chrome, per-region surface backgrounds. All input validated against an allow-list (`validate.ts`) with image content-sniffing. Server gallery is Ed448-signed publish | `components/skins/SkinsModal.tsx` + `SkinEditor.tsx`, `services/skins/skinsClient.ts`, `services/theme/skinPrefs.ts`, `theme/skins/{types,validate,mergeSkin,geometry,samples,surfaces,fontLoader,skinnableStyleSheet,frame}.ts`, `components/ui/{AppBackground,SkinTouchable}.tsx` | B/C | ❔ | **New since 2026-05-30 audit.** Desktop's `Appearance.tsx` only ships theme (light/dark) + 6 accent swatches + language. Mobile ships a ~2000+ LOC skin engine that's a different category of capability. **Ask user**: is "user-customizable themes + gallery" in the desktop product scope? If yes — large multi-PR effort; `validate.ts` (488 LOC, all pure logic) + `types.ts` + `mergeSkin.ts` are clean shared-promotion candidates because the validation is security-critical and platform-agnostic. |
| **28** | **On-device translation** (language detection + translate-in-place wrapper around posts/messages, per-language target preferences, force-translate toggle, model-availability gating) | `modules/quorum-translation/*` (native iOS Translation framework + Android ML Kit module), `services/translation/{availability,forceTranslate,translationCache,translationPrefs,useTranslatable}.ts`, `components/translation/{Translatable,TranslateLanguageModal,TranslateToggle,languages}.tsx` | C / D-mobile-only | ❔ | **New since 2026-05-30 audit.** Native module is iOS/Android-specific (Apple Translation + ML Kit). Desktop has no equivalent and no native bridge. On Electron the realistic paths are (a) cloud translation API (OpenRouter/Google/DeepL — privacy regression vs mobile's on-device guarantee), (b) WASM model (large download, slower), or (c) skip. **Ask user**: is translation a desktop product priority? If yes — re-implementation, not a port. |
| **29** | **Non-owner read-only access to the existing public invite URL** — any member can open an InviteModal from the space root view and see/copy/share the public invite URL **that the owner already published**. The link is replicated to every member via the encrypted space manifest (the link contains only `spaceId` + the shared `configKey` that every member already has locally), so no owner privilege is needed to display or share it. Members CANNOT generate or regenerate the link; the visible "Generate New Link" button silently fails for non-owners (a mobile UX bug we should not replicate). Members CANNOT generate one-time invites from this surface either — the mobile space-landing-page invite modal jumps past the toggle when `space.inviteUrl` is set, going straight to the public-link view | Surface: `app/(tabs)/spaces/[id]/index.tsx` (header invite button, ungated). Modal: `components/InviteModal.tsx` (the `useEffect` at lines 56-67 reads `space.inviteUrl` from local storage and skips the toggle entirely when present). Manifest replication: `services/space/inviteService.ts:442-471` re-uploads the space record with `inviteUrl` set when the owner generates a public invite; non-owners pick it up via normal manifest sync. Owner-only gate at `services/space/inviteService.ts:303-305` | A | ✅ | **Shipped 2026-06-08** (PR #182). Surfaced the non-owner view inside the existing `SpaceSettings > Invites` tab (kept owner UI unchanged); also extended the sidebar context-menu "Invite Members" entry to non-owners when `space.inviteUrl` is set; flipped the Invites tab icon `share` → `user-plus`. See [task file in `.done/`](.done/2026-06-08-port-non-owner-invite-view.md). |
| **30** | **Per-space profile bio override** (set a different bio per Space; falls back to global bio when no override) | `components/SpaceSettingsModal.tsx` (per-space profile block + UI), `services/space/spaceMessageService.ts` (`SendUpdateProfileParams.bio`), `context/WebSocketContext.tsx` (upsert-aware receive handler) | A | ✅ | **Shipped 2026-06-08** ([task file in `.done/`](.done/2026-06-08-port-per-space-bio.md)). Surfaced by user during session — not in original 2026-06-01 sweep because the editor lives inline inside mobile's `SpaceSettingsModal.tsx`, not as a standalone hook/screen. Desktop already had per-space displayName + avatar override; bio was the missing third leg. Bundled: receive-side upsert-aware merge fix in `MessageService.ts` (mobile already had this — desktop was clobbering partial updates), bio render in `UserProfile.tsx` (no space-side surface rendered `member.bio` before), self-fallback to `UserConfig.bio`, modal positioning viewport clamp. Two follow-up tasks filed (Floating UI positioning refactor, UserProfile layout polish). Mobile follow-up dropped to converge bio caps (160/256/280 → shared `MAX_BIO_LENGTH=160`). |

## Complexity ranking (engineering risk, not product value)

Re-ranked 2026-06-01 after spot-reading the mobile sources AND verifying each is actually wired into a live mobile screen (not just code-without-UI). Order is safest/smallest first.

**Verification rule (kept as a standing rule for future inventory passes):** before ranking, grep that the hook/service is actually rendered in `app/` or `components/` (not just defined). If it's defined but not used by any UI, it's not really a shipped feature — flag it instead of porting blind.

LOC estimates are mobile-side sources only — the desktop port often needs comparable but not identical surface.

| Rank | # | Feature | LOC (mobile) | Live on mobile? | Why this rank |
|---|---|---|---|---|---|
| — | **#1** | **Discover spaces** | ~85 hook + ~280 screen | ✅ shipped | **Shipped on desktop** as `/spaces` page (PR 1 = #170, 2026-06-04). PR 2 (legacy-modal retirement) obsoleted by new UI shell (#171). Task files in `.done/`. |
| — | **#6** | **Public profile UI** | ~125 svc + ~170 hooks + new UI | ✅ shipped | **Shipped 2026-06-08.** Closed the `UserConfig.isProfilePublic` shared-migration loose end (shared PR #159, 2026-05-28). Scope ended up narrower than original framing — mobile has no directory/search either, server only exposes resolve-by-known-address. Bundled retirement of speculative `/discover/people` People tab + `DiscoverSidebar`. See [task file in `.done/`](.done/2026-06-08-port-public-profile.md) and [shipped-log.md](shipped-log.md). |
| — | **#29** | **Non-owner read-only access to public invite URL** | small UI + read existing `space.inviteUrl` | ✅ shipped | **Shipped 2026-06-08** (PR #182). Reused the existing `SpaceSettings > Invites` tab (kept owner UI unchanged), branching on `isSpaceOwner` to render a stripped-down read-only variant. Reuses the existing `DmPicker` + `invite(address, 'public')` mode which forwards `space.inviteUrl` without consuming the eval pool. Also extended the sidebar context-menu "Invite Members" entry to non-owners when `space.inviteUrl` is set; flipped the Invites tab icon from `share` to `user-plus`. See [task file in `.done/`](.done/2026-06-08-port-non-owner-invite-view.md). |
| — | **#5** | **Reporting** | — | ⏸️ deprioritized | **Not a priority on desktop right now** (user call 2026-06-01). Capability still missing on desktop; revisit when trust/safety becomes a product priority. **When picked up, bundle the deferred shared-promotion from #6** (canonicalize-then-sign helpers). See [`### #5` notes](#5-reporting--deprioritized). |
| ❔ | **#27** | **Skins (custom themes)** | ~2000+ LOC engine on mobile | ✅ live on mobile | **Needs product-scope call.** Desktop's `Appearance.tsx` only does theme+accent+language. Mobile ships a full skin engine + gallery. Pure-logic shared candidates: `validate.ts` (488 LOC, security-critical), `types.ts`, `mergeSkin.ts`. Bundles a third call site for the deferred Ed448 signing-payload helpers (#5, #6). |
| ❔ | **#28** | **On-device translation** | iOS Translation + Android ML Kit native module + service layer | ✅ live on mobile | **Re-implementation, not a port.** Native engines are mobile-only; desktop would need cloud, WASM, or skip. Privacy-preserving (mobile is on-device); cloud would regress that. UI surface is reusable behind a swapped engine. |
| — | **#2** | ~~Message search (in conversation)~~ | — | E (already shipped) | **Removed.** Desktop has `<GlobalSearch>` embedded in DM + Channel headers, scoped to current conversation. Different impl (IndexedDB-indexed vs in-memory MiniSearch), same UX. Not a port. |
| — | **#3** | ~~Reply tracking~~ | — | E (desktop strictly better) | **Removed.** Desktop has a more capable derived-from-store implementation that respects notification settings + per-thread read state. See [`desktop-better-than-mobile.md` #1](desktop-better-than-mobile.md#1-reply-notification-counts). |
| — | **#4** | ~~Last-message-preview / spaces-list sort~~ | — | ❌ UX-pattern conflict | **Won't port.** Desktop follows Discord model (spaces = manually ordered; DMs = recency-sorted with favorites). Mobile follows Telegram model (unified list, recency-sorted, previews). Mobile's `useSpaceActivity` fits neither desktop's chrome nor UX model. See `### #4` notes. |
| — | **#8** | ~~OG metadata previews~~ | — | ⚠️ Farcaster-only on mobile | **Demoted.** Mobile only uses OG metadata in `SocialFeedModal` (Farcaster feed). Not a chat feature. Re-pick only if Farcaster (#9) goes in scope. |

**#1 Discover spaces shipped** as `/spaces` page (PR #170, 2026-06-04). PR 2 (legacy-modal retirement + navbar `+` removal) marked obsolete on 2026-06-03 after the new UI shell (PR #171) made the SpacesSidebar `+` button a deliberate fixture of the new chrome.

**✅ #6 Public profile UI shipped (2026-06-08).** Scope clarified during pickup: mobile has no profile directory either (server doesn't expose user enumeration — see [#6 notes](#6-public-profile-ui--shipped-2026-06-08)), so the port = the resolve-by-address plumbing mobile actually ships (toggle, DM-header backfill, member fallback resolver). Speculative `/discover/people` People tab + `DiscoverSidebar` retired in the same PR. See [task file in `.done/`](.done/2026-06-08-port-public-profile.md) and [shipped-log.md](shipped-log.md).

## Original "first picks" (by leverage, not complexity)

Kept for reference. Use the complexity ranking above to decide what to *start*; use this list when balancing value vs. risk after several ports have shipped:

1. **#6 Public profile** — half the work is already done (shared has the type, desktop has the field but no UI). Closes a known migration loose end.
2. **#3 Reply tracking** — small, real UX win, no architectural decisions needed.
3. **#4 Space activity feed** — small, complements #3.
4. **#8 OG metadata** — small per-message UX win, generalizes the existing YouTube embed pattern.
5. **#2 Message search inside conversation** — should be tractable once we see what `SearchService` already does on desktop.
6. **#1 Discover spaces** — bigger UI lift but no architectural rabbit holes; pure data view + join action.
7. **#5 Reporting** — small standalone trust/safety win. Bundles a deferred shared-promotion from #6 (signing-payload helpers).

The "❔ needs UX call" rows (#9 Farcaster, #12 QNS, #13 Wallet, #14 Calling, #15 Audio Spaces, #16 Miniapps, #17 Governance) are product decisions, not engineering decisions. They should be discussed before scoping.

## Per-candidate notes & decisions

Lightweight running notes per candidate — user comments, dev concerns, scope clarifications, "why we changed our mind" moments. Add a dated bullet under the relevant `### #N` heading whenever we make a call or surface a concern. Keep it short; if something gets big, promote it into a task file.

This is the durable place for "we decided X about candidate N" so it survives session boundaries.

### #1 Discover spaces ✅ shipped

- **2026-06-04** — **Shipped** as the `/spaces` page (PR 1 = #170). My Spaces + Discover tabs, mock-mode aware hook, `icon-layout-grid-add` entry point, "Hide muted Spaces from sidebar" toggle. Shared additive PR landed `DirectoryEntry`/`DirectoryResponse`/`SpaceCategory` + `UserConfig.hideMutedSpacesFromSidebar`.
- **2026-06-03** — PR 2 (retire `AddSpaceModal` + `CreateSpaceModal`, remove navbar `+` button, build Join via link + Create space tabs) marked **likely-obsolete** after the new UI shell (PR #171) made the SpacesSidebar `+` button a deliberate fixture with a context menu surfacing both modals. The "page is the hub for everything" premise no longer holds; modals are now part of the sidebar's flow.
- **Task files** moved to `.done/`: [`2026-06-01-port-discover-spaces.md`](.done/2026-06-01-port-discover-spaces.md), [`2026-06-01-port-discover-spaces-plan.md`](.done/2026-06-01-port-discover-spaces-plan.md), [`2026-06-01-port-discover-spaces-pr2.md`](.done/2026-06-01-port-discover-spaces-pr2.md).
- **Historical context (kept for memory):** User's pick for first port. **Capability-verified missing on desktop:** `JoinSpaceModal` and `AddSpaceModal` are invite-link-only (paste invite → validate via `useInviteValidation` → join via `useSpaceJoining`). There is no public-directory browse view, no category filtering, no server-curated discovery. `useSpaceJoining` is reusable as the join mutation; the missing pieces are the directory data + UI.
- **Mobile sources** (read at inventory pass): [`app/(tabs)/spaces/discover.tsx`](../../../../quorum-mobile/app/(tabs)/spaces/discover.tsx) (~284 LOC screen), [`hooks/chat/useExploreSpaces.ts`](../../../../quorum-mobile/hooks/chat/useExploreSpaces.ts) (~85 LOC), [`services/api/quorumClient.ts`](../../../../quorum-mobile/services/api/quorumClient.ts) (`DirectoryEntry` type + `getDirectory`/`exploreSpaces` methods).
- **Server-side:** the directory endpoint already exists (mobile calls it). Desktop's API client surface needs the same methods added.
- **Scope sketch** (to be refined in the task file):
  - Add `DirectoryEntry` type + `exploreSpaces` method to desktop's API client
  - Port `useExploreSpaces` hook (debounced search, category filter, offset pagination)
  - Build a desktop discovery surface — likely a modal or a dedicated route, fitting desktop's existing space-modal pattern (`JoinSpaceModal` / `AddSpaceModal`)
  - Use existing `useSpaceJoining` for the join action; existing `SpaceIcon` for the visual
  - Consider whether `DirectoryEntry` type / `SpaceCategory` enum belongs in shared (likely yes — both apps consume them)
- **Open UX questions for the task file:**
  - Modal vs dedicated route on desktop?
  - Where does it surface from — a button in the spaces sidebar, a section in `AddSpaceModal`, something else?
  - Category list: keep mobile's 7-category enum verbatim, or revisit categories?
- Next session: capability check is done; create `2026-XX-XX-port-discover-spaces.md` task file, rename session branch when work crystallizes.

### #2 Message search ❌ ruled out

- **2026-06-01** — Desktop already has this. `<GlobalSearch>` is embedded in `DirectMessage.tsx` (line ~844) and `Channel.tsx` (line ~1529) headers, scoped to the current conversation context. Mobile uses in-memory MiniSearch, desktop uses IndexedDB-persisted `SearchService`. Same UX, different impl. Not a port.

### #3 Reply tracking ❌ removed (desktop has it, strictly better)

- **2026-06-01** — Original framing: "Desktop has no per-channel unread-replies-to-me badge." Wrong. Symbol-grep for `useReplyTracking` returned nothing on desktop and that's what got me here.
- **2026-06-01** — **Decision: removed from candidates.** Desktop has the capability under a different name and a fundamentally different architecture: [`useReplyNotificationCounts.ts`](../../../src/hooks/business/replies/useReplyNotificationCounts.ts), plus `useSpaceReplyCounts`, `useAllReplies`, `useChannelMentionCounts`, `NotificationService`, `NotificationPanel`. Desktop's implementation is strictly better: derived from `MessageDB` (no state divergence vs WebSocket counter), respects `notificationSettings.isMuted` + `isNotificationTypeEnabled('reply')` + per-channel `mutedChannels`, respects per-thread read state via `threadReadTimes`, caps at `9+`. The reply-notification system was shipped as a deliberate desktop project with a `.done/` task file ([`.agents/tasks/.done/reply-notification-system.md`](../.done/reply-notification-system.md)) and architecture docs.
- **2026-06-01** — Mobile's `useReplyTracking` is logged in [`desktop-better-than-mobile.md` #1](desktop-better-than-mobile.md#1-reply-notification-counts) as a "desktop is better, mobile could converge" item. Future port-to-mobile candidate (high cost — needs persisted message store with read-state tracking).
- **Lesson** (now in workflow.md): Symbol-grep for the mobile name isn't enough — same *capability* can exist under different names and different architectures. Capability-verification is now a required step.

### #4 Last-message-preview + spaces-list sort ❌ won't port

- **2026-06-01** — Original name "space activity feed" was misleading. There's no activity-feed page on mobile. The hook tracks per-space `{timestamp, preview, senderName}` and the spaces-tab list reads it to (a) sort spaces by recency and (b) show the last-message preview under each space name.
- **2026-06-01** — **Decision: won't port.** Two reasons:
  1. **Sort behavior conflict.** Desktop intentionally follows the Discord model: spaces are *commitments* (communities chosen by the user), manually ordered with folder support, no auto-sort by activity. DMs are *inbox-shaped* and sort by recency with favorites pinning to top — that asymmetry is a real product choice, not a quirk. Mobile's recency-sort fits Telegram's unified-list model, not desktop's Discord-style model. Auto-sort by activity would punish anchor communities the moment they go quiet and reward whichever space is loudest today; it also breaks the user's spatial mental map ("where in the list is the dev space").
  2. **Preview snippet UX conflict + chrome conflict.** Desktop's space sidebar is icon-only — hovering shows a tooltip with just the space name. A per-space last-message preview line has no room to live unless we expand the chrome (e.g. extend tooltip or widen sidebar), and either change is clunky for what's likely low-value info. In a Discord-style spaces-have-many-channels world, the "last message anywhere in this space" is usually NOT the meaningful one. Discord itself doesn't ship a preview snippet on the server list for this reason; Telegram does because it mixes 1:1 and group chats in one list and needs the disambiguation.
- **2026-06-01** — Desktop already has a "something happened in this space" signal (the dot on the space icon) which is the correct *level* of signal for a Discord-style chrome. What's missing is "what / when", and the chrome has no room for it. Not a current priority. If a future redesign opens the sidebar up, revisit.
- **Rule captured from this discussion** (now in workflow.md): "Port the underlying capability, not the mobile UX pattern. Desktop has different chrome and a different UX model (Discord-style spaces + DMs split) than mobile (Telegram-style unified list). A feature being shipped on mobile means the *capability* is real; whether the *UX pattern* fits desktop is a separate judgment."

### #5 Reporting ⏸️ deprioritized

- **2026-06-01** — User call: not a priority on desktop right now. The capability is still missing on desktop (no equivalent abuse-flag/report flow exists), but it's not on the near-term roadmap. Revisit when trust/safety becomes a product priority.
- Keep the row alive (not "won't port") because the capability gap is real — if the product direction shifts, this is a relatively clean trust/safety primitive to pick up: ~195 LOC service + a ReportModal, single API call, well-bounded.
- 🔗 **When this port is picked up: also extract signing-payload helpers into `@quilibrium/quorum-shared`.** Reporting and #6 Public Profile use the same canonicalize-then-sign pattern (build a canonical `"prefix:fields...:" + int64BE(timestamp)` byte payload, then `js_sign_ed448`). #6 ([shipped 2026-06-08](.done/2026-06-08-port-public-profile.md)) deferred the shared promotion deliberately so we'd have two real call sites before locking the API shape. With #5 also implementing it, that condition is now met — the helpers should land in shared and both `PublicProfileService` (desktop) + the new ReportingService (desktop) + mobile's two equivalents should consume them. Note `int64ToBytes` already exists in shared and is what desktop's `ConfigService` uses; mobile rolls its own `int64BE` and would also be a follow-up mobile-task-pending entry. See [#6 notes](#6-public-profile-ui--shipped-2026-06-08) and [quorum-shared-migration/README.md cross-pointer block](../quorum-shared-migration/README.md).

### #6 Public profile UI ✅ shipped (2026-06-08)

- **2026-06-08 — ✅ Shipped.** Branch `feat/port-public-profile-from-mobile`. Task file: [`.done/2026-06-08-port-public-profile.md`](.done/2026-06-08-port-public-profile.md). Implementation in 8 commits — API client + service, /discover/people retirement, Privacy.tsx toggle with destructive-style confirmation, DM-header backfill, space-message-sender backfill (with manual ref-cache perf pattern), ConfirmationModal latent-bug fixes. See [shipped-log.md](shipped-log.md) for what was learned during shipping.
- **2026-06-08** — **Picked up.** Branch `session-2026-06-08`. Task file: [`2026-06-08-port-public-profile.md`](2026-06-08-port-public-profile.md).
- **2026-06-08 — Directory ruling: NOT a portable directory feature.** The original candidate framing ("Public profile UI") implied a browse/search surface. Investigation showed otherwise. The server exposes:
  - `GET /users/:addr/public-profile` — resolve **by known address** only.
  - `GET /users/by-fid/:fid` — reverse-lookup **by known Farcaster fid** only.
  - **No `GET /users`, no `GET /directory/users`, no `?search=` endpoint.** The server is a key-value resolver for profiles, not an enumeration index. (Spaces have a real `GET /directory` with categories + admin-approved submissions; profiles deliberately do not.)
  - Mobile has no profile directory either — same backend constraint. The speculative People tab on desktop (`/discover/people`, scaffolded with a docblock saying "no list/search endpoint exists yet") is being **removed in this PR**.
- **2026-06-08 — What mobile actually ships (the real capability):**
  1. **Publish toggle** in `UnifiedProfileEditModal.tsx` (`isProfilePublic` switch → `publishPublicProfile` / `unpublishPublicProfile`). Auto-republishes on profile edit when toggle is on.
  2. **Single-user resolve-by-address** in DM screen (`dm/[id].tsx`) — fills displayName/avatar in the chat header before the first message arrives, when the local Conversation row has no displayName/icon yet.
  3. **Member-fallback resolver** in `SpaceChatArea.tsx` + `DMChatArea.tsx` — fills displayName/avatar/bio for senders the local SpaceMember record doesn't have or has stale (per-field timestamp comparison; chat broadcast wins if newer, public profile wins otherwise).
  - All three are invisible plumbing that improves chat rendering for users you don't share a space with — not a profile-browsing feature.
- **2026-06-08 — Address-resolution scope clarification.** Mobile's `NewConversationModal` accepts `Qm...` addresses AND `@username` (resolved via QNS). Desktop's `NewDirectMessageModal` accepts only raw addresses (no QNS). The QNS resolver IS available client-side on mobile (`useResolveName` from `useQNS.ts`, calling `https://names.quilibrium.com`) but **not a small extract** — see [#12 QNS marketplace notes](#12-qns-marketplace) for the full QNS shape we'd be pulling in. Decision: don't bundle QNS into this port. The `@username` UX gap stays as a separate (small) follow-up.
- **Closes a shared-migration loose end.** Shared has had `UserConfig.isProfilePublic` and `UserConfig.farcasterLink` since PR #159 (2026-05-28). Desktop reads/writes the field nowhere — the type-only PR was completed but the consumer was never built.
- **Mobile sources:** [`services/profile/publicProfile.ts`](../../../../quorum-mobile/services/profile/publicProfile.ts) (publish/unpublish, 123 LOC), [`hooks/useUserPublicProfile.ts`](../../../../quorum-mobile/hooks/useUserPublicProfile.ts) (resolve-by-address, 39 LOC), [`hooks/useMembersWithPublicProfileFallback.ts`](../../../../quorum-mobile/hooks/useMembersWithPublicProfileFallback.ts) (member fallback resolver, 132 LOC). Consumers: `UnifiedProfileEditModal.tsx` (toggle), `dm/[id].tsx` (header), `SpaceChatArea.tsx` + `DMChatArea.tsx` (rendering fallback).
- **Shared-promotion opportunity:** the signed-payload-build helpers in `publicProfile.ts` (`int64BE`, `concatBytes`, canonicalize-then-sign pattern) are the same pattern used by reporting and are pure logic — candidates for promotion to shared as a Class B port. Decide during scoping.

### #7 Profile prefs

- _(no notes yet — sub-feature of #6)_

### #8 OG metadata ⚠️ Farcaster-only on mobile

- **2026-06-01** — Mobile only uses `useOgMetadata` in `SocialFeedModal.tsx` (the Farcaster feed view). NOT used in `SpaceChatArea` or `DMChatArea`. So this isn't a port of a live chat feature — it'd be a desktop-only extension into chat surfaces. Plus the CORS-bypass-via-Electron-IPC caveat. Demoted from "🟢 ready to pick". Re-pick only if Farcaster (#9) goes in scope.

### #9 Farcaster integration

- _(no notes yet — needs UX-scope decision)_

### #12 QNS marketplace

- **2026-06-08 — QNS client shape (learned while scoping #6).** QNS (Quilibrium Name Service) is a separate API (default base URL `https://names.quilibrium.com`) consumed by mobile via [`services/api/qnsClient.ts`](../../../../quorum-mobile/services/api/qnsClient.ts) (1,235 LOC client) + [`hooks/useQNS.ts`](../../../../quorum-mobile/hooks/useQNS.ts) (451 LOC of React Query hooks). It's a real product surface, not a small utility:
  - **Resolution**: `useResolveName(name)`, `useResolveBatch(names)`, `useReverseLookup(keyOrAddress)`, `useBucketLookup(bucketTag)` (privacy-preserving stealth lookup).
  - **Registration**: availability checks (`useCheckAvailability`), pricing (`usePricing`), invite-code validation, ownership types (ethereum vs quilibrium), full registration mutation.
  - **Reverse lookup**: `address → @username` for display alongside addresses anywhere.
- **2026-06-08 — Desktop has ZERO QNS plumbing.** Grep confirms: no `useResolveName`, no `qns`, no `names.quilibrium.com` reference anywhere in `quorum-desktop/src`.
- **2026-06-08 — Mini-candidate spotted: `@username` in `NewDirectMessageModal`.** Mobile's `NewConversationModal` accepts both `Qm...` addresses AND `@username` (QNS-resolved); desktop's [`NewDirectMessageModal.tsx`](../../../src/components/modals/NewDirectMessageModal.tsx) accepts only raw addresses. This is a real UX-parity gap for users with QNS names — they currently have to find/paste their counterpart's `Qm...` address even if they know the `@username`. Could be picked up as a **scoped slice of #12** (just `useResolveName`, not the full marketplace) IF the full QNS marketplace is in scope on the roadmap — otherwise it commits desktop to a new base URL + client without a broader product reason. Surface for the lead dev's product call.
- **2026-06-08** — Re-evaluate after a QNS marketplace product decision is made. If QNS goes in scope, this is a multi-PR effort; if it doesn't, the `@username` UX gap stays a "would be nice" with no portable fix.

### #13 Multi-chain wallet

- _(no notes yet — needs UX-scope decision)_

### #14 Calling

- _(no notes yet — needs UX-scope decision)_

### #15 Audio spaces

- _(no notes yet — needs UX-scope decision)_

### #16 Mini-apps + browser

- _(no notes yet — needs UX-scope decision)_

### #17 Governance

- _(no notes yet — needs UX-scope decision)_
- **2026-06-08 (re-audit)** — mobile added a `HegemonyGovernanceView` (`/hegemony` portal-API feed with proposal cards + FOR/AGAINST tallies + reply threads, ~377 LOC) plus a `ProposalVoteBlock` component and a `useHegemonyGovernance` hook with 60s `staleTime`. It's wired into `SocialFeed/views/` so it's effectively a Farcaster-surface governance view, not a standalone governance feature. Fold under both #9 (Farcaster) and #17 — same product-scope call gates both.

### #27 Skins (custom themes) ❔ needs UX call

- **2026-06-08** — **New candidate, surfaced in the re-audit after the 2026-06-01 mobile bulk merge (`56ffd31`).** User flagged this directly: "one thing that is new in the mobile repo, for instance, is skins. So possibility to choose a skin for your space. A theme."
- **Note on framing**: the skin engine is **app-wide**, not per-space, on mobile. The active skin is stored in `services/theme/skinPrefs.ts` (one global selection per user) and merged into the theme via `theme/skins/mergeSkin.ts`. Per-space skinning isn't a shipped capability yet on mobile — what mobile ships is "the whole app gets reskinned". Worth confirming with the user whether the desktop scope is "app-wide skin" (mirrors mobile) or "per-space skin" (new capability neither app has yet).
- **Capability shape on mobile**:
  - **SkinOverride manifest** (`theme/skins/types.ts`) is a strictly-typed declarative document — not code. Validated by `validate.ts` (488 LOC) against an allow-list. Every override is bounded: colors are 22 named tokens, geometry is named tokens + a global `scale` multiplier, fonts are a single embedded face (data URI), wallpaper is a data URI + fit/scrim/alpha, icons are a Record<symbolName, data URI>, "frame" is a tiny allow-list of corner/border/header/glow enums, surfaces are 12 allow-listed slot names (`feed`, `cast`, `wallet`, `messages`, `spaces`, `profile`, `button`, `card`, `input`, `header`, `tabBar`, `chatBubble`) with bg/fit/opacity/text overrides.
  - **Gallery** (`services/skins/skinsClient.ts`) — Ed448-signed publish (same identity-key pattern as #5 Reporting + #6 Public profile), content-hash IDs, popular/new sort + search, install counter.
  - **Local management** (`SkinsModal.tsx`) — apply/reset, import from clipboard/.json, export to clipboard, browse + install from gallery, edit via `SkinEditor.tsx`.
- **Desktop has nothing comparable.** Current `src/components/modals/UserSettingsModal/Appearance.tsx` (96 LOC): light/dark/system theme + 6 fixed accent swatches + language. No skin engine, no gallery, no wallpaper, no font scale, no icon substitution.
- **Pure-logic shared-promotion candidates** (if this is picked up):
  - `theme/skins/types.ts` (~205 LOC) — pure types, zero runtime.
  - `theme/skins/validate.ts` (~488 LOC) — security-critical allow-list validator. Has to match byte-for-byte between apps or a skin valid on one and rejected on the other becomes a UX bug. Strong shared candidate.
  - `theme/skins/mergeSkin.ts` (~38 LOC) — pure merge function.
  - Geometry helpers (`geometry.ts`, ~85 LOC) — pure math.
  - **Re-implementations** (not shared): font loading (RN `expo-font` vs web `FontFace`), surface backgrounds (RN style vs CSS), wallpaper rendering, icon substitution at the IconSymbol layer (mobile uses RN images, desktop would use `<img>`/SVG).
- **Bundles a third signing-payload helper opportunity.** The skin publish signs `manifest || thumbnail || be64(timestamp)` with Ed448 — same canonicalize-then-sign pattern as #5 Reporting and #6 Public profile. If skins is picked up AFTER #5, the deferred shared-promotion of signing helpers from #6 finally has THREE call sites, not two. (If skins lands before #5, it should pull the helpers into shared so #5 has a precedent to follow.)
- **Open product/UX questions for the user**:
  1. Scope: app-wide skin (mirrors mobile) or per-space skin (new capability)?
  2. Editor parity: do we ship an in-app editor (mobile has one) or import-only via JSON?
  3. Gallery: do we ship the publish/install gallery on day one or save that for v2?
  4. Wallpaper feasibility on Electron with the existing chrome (sidebars, modals on `surface*` layers — wallpaper would need to opt out of opaque surface defaults to be visible).

### #28 On-device translation ❔ needs UX call

- **2026-06-08** — **New candidate, surfaced in the re-audit after the 2026-06-01 mobile bulk merge (`56ffd31`).**
- **Capability shape on mobile**:
  - Native module `modules/quorum-translation/` — iOS Translation framework (Apple) + Android ML Kit. Detection (BCP-47/ISO-639 + confidence) + translate(text, source, target) + ensureModel(source, target) for the one-time on-device language-model download.
  - Service layer (`services/translation/`): availability gating (`availability.ts`), per-language target preferences (`translationPrefs.ts`), force-translate toggle (`forceTranslate.ts`), session cache (`translationCache.ts`), the React hook (`useTranslatable.ts`, ~254 LOC).
  - UI: `components/translation/Translatable.tsx` wraps any text node; `TranslateLanguageModal.tsx` is the preferences sheet; `TranslateToggle.tsx` is the per-post chip.
  - **Privacy invariant**: post and message text never leaves the device. Only the language-model download hits the network. This is a deliberate, documented design — see `services/translation/useTranslatable.ts` and the module-level docblocks.
- **Desktop has no equivalent.** Grep confirms no translation-related modules/hooks/services exist anywhere in `src/`.
- **Desktop ports the capability, not the implementation.** Electron has no built-in Apple Translation / ML Kit equivalent. Realistic paths:
  1. **Cloud translation API** (OpenRouter LLMs, DeepL, Google Cloud Translation). Privacy regression vs mobile's on-device guarantee. Cheap, fast, easy to ship.
  2. **WASM-based translation** (Bergamot/Mozilla's `bergamot-translator`, or transformers.js running quantized models). Preserves the privacy invariant. Large model download (~20-50MB per language pair). Slower than native. Real product call needed.
  3. **OS-level integration** — macOS has system Translation framework callable via native bridges, Windows 11 has built-in translation but no easy Electron bridge. Inconsistent.
  4. **Skip** — translation may not be a desktop priority.
- **Not a port — a re-implementation.** Mobile's API surface is reusable (the `useTranslatable` hook signature, the prefs shape, the `Translatable` wrapper component) but the engine has to be swapped. If picked up, scope it as "implement the desktop-side engine first behind the same hook surface, then wire the existing components".
- **Open product question**: is translation a desktop priority? If yes, which engine path?

### #29 Non-owner read-only access to the existing public invite URL ✅ shipped (2026-06-08)

- **2026-06-08 — ✅ Shipped (PR #182).** Branch `feat/port-non-owner-invite-view-from-mobile`. Implementation reused the existing `SpaceSettings > Invites` tab — branched on `isSpaceOwner` to render a stripped-down read-only variant for non-owners (URL display + Copy + existing `DmPicker` calling `invite(address, 'public')`, which forwards `space.inviteUrl` without consuming the eval pool). Also extended the sidebar context-menu "Invite Members" entry to non-owners under the same `space.inviteUrl !== ''` condition; flipped the Invites tab icon `share` → `user-plus`. Owner UI untouched. See [task file in `.done/`](.done/2026-06-08-port-non-owner-invite-view.md). Smoke-test surfaced a pre-existing crash on the JOIN path (`InvitationService.joinInviteLink` line 593, `"[object Object]" is not valid JSON`) — unrelated to this port and addressed in a separate follow-up PR.
- **2026-06-08** — **New candidate, surfaced in the re-audit after the 2026-06-01 mobile bulk merge (`56ffd31`).** User flagged this directly: "from a space, even if you are not an owner of the space, you can actually invite other users in. You have access to a drawer with the invite link that you can copy. you can even generate a new link. There is a generate new link button."
- **2026-06-08 — corrected framing after user pushback (twice) and a screenshot**. Took three rounds to land at the right model. Recording the full path so we don't re-litigate it next session:
  1. **First framing (wrong):** "any member can generate public link" — surface read of the modal's pre-generate UI suggested both toggle options were available to non-owners. User pushed back: "are you sure?"
  2. **Second framing (still wrong):** "non-owners can generate one-time private invites, public invites stay owner-only" — based on reading `useInviteManagement.ts` line 64-65 comment ("Only space owners can generate public invites") and assuming the modal showed both options to non-owners. User shared a screenshot of the modal showing only an existing "Invite Link" field + Copy/Share + "Generate New Link" — no toggle, no "One-Time/Public" choice.
  3. **Correct framing (this entry):** the screenshot was the **post-generate state** of the modal (line 222-296 of `InviteModal.tsx`). The `useEffect` at lines 56-67 reads `space.inviteUrl` from local storage on open; if it's set, the modal skips the toggle and jumps straight to "show the existing link". User pushed back a third time with the right insight: **"maybe when the space owner creates a public invite link, that same link is made available to all users."** Confirmed.
- **How the link replicates to non-owners (verified in `services/space/inviteService.ts`)**:
  - Public invite link format (line 482): `${getInviteUrlBase(true)}#spaceId=${spaceId}&configKey=${configPrivateKeyHex}`. It contains only the **`spaceId`** and the **shared `configKey`** — both of which every space member already has locally. No owner-specific secret in the URL itself.
  - When the owner generates a public invite, the service re-uploads the **space manifest** to the server (lines 442-471), encrypted with the shared config key and signed with the owner key. The manifest includes the space record with `space.inviteUrl` populated (line 485-486 happens before any client-side caching).
  - Non-owners decrypt the manifest with their copy of the `configKey` and save the updated Space (with `inviteUrl`) to local storage via the normal sync path. Once synced, `getSpace(spaceId).inviteUrl` returns the same value for everyone.
  - So mobile's "non-owner sees the link" is actually "non-owner reads the value the owner already published, replicated via the encrypted manifest" — not "non-owner generates anything."
- **What non-owners actually get on mobile (the real capability)**:
  - **View** the existing public invite URL (if the owner has generated one).
  - **Copy** to clipboard.
  - **Share** via in-app DM contact picker (`ShareInviteSheet`) or system share sheet.
  - **NOT generate or regenerate** — the "Generate New Link" button is rendered but calls `useGeneratePublicInvite` which throws `"Only space owners can generate public invites"` at `services/space/inviteService.ts:303-305`. This is a small mobile UX bug ("show a control that errors on use") that we should NOT replicate on desktop.
  - **NOT generate one-time invites** from this surface — the modal jumps past the toggle when `space.inviteUrl` is set, so non-owners on a space with a published public link never see the one-time option. Mobile *does* technically allow non-owners to generate one-time invites (the eval-pool path doesn't require owner key), but this surface doesn't expose it; the only path that would is the toggle pre-generate screen, which only renders when `space.inviteUrl` is unset.
- **Mobile surface map**:
  - `app/(tabs)/spaces/[id]/index.tsx` (space landing page) — line 79-85 renders an `IconSymbol="person.badge.plus"` button in the header **without any owner gate**. Setting `inviteVisible` opens the InviteModal.
  - `app/(tabs)/spaces/[id]/[channelId].tsx` (per-channel view) — line 200-204 also renders the invite icon BUT it's gated by `isSpaceOwner`. Two surfaces, two gates: the per-space landing is open to all members (read-only); the per-channel header is owner-only.
  - `components/InviteModal.tsx` — read existing `space.inviteUrl` from local space storage (lines 56-67), generate private (`useGenerateInvite`) / public (`useGeneratePublicInvite`, owner-only at the service layer), copy (`useCopyInviteLink`), share via in-app DM contact picker (`ShareInviteSheet`) or system share (`useShareInvite`).
- **Desktop state (verified 2026-06-08)**: `Space.inviteUrl` exists in shared (`quorum-shared/src/types/space.ts:69`) and is populated identically on desktop — the same manifest-sync path puts the owner's published link into every member's local Space record. But desktop only exposes `space.inviteUrl` via `SpaceSettingsModal > Invites.tsx`, and that tab is filtered out for non-owners by `Navigation.tsx:32-34`. So non-owners hold the data but can't see it.
- **Scope of this port**: expose `space.inviteUrl` (when set) + copy + (optionally) DM-share to all members via a lightweight read-only modal triggered from the space chrome. **Do NOT show any generate/regenerate controls to non-owners** — they'd error like mobile's do. Owners keep the heavier `SpaceSettings > Invites` tab for the full surface (one-time generate, public generate/regenerate, direct-DM invite by address).
- **Open UX questions for the task file**:
  1. **Where does the affordance live?** Channel header (matches the existing owner-only invite icon's location)? Space sidebar? Worth a UX call — mobile's pattern is "space landing page header" but desktop doesn't have an analogous landing page (going to a space takes you straight to a channel).
  2. **What if `space.inviteUrl` is empty** (owner hasn't published one yet)? Show "No public invite available — ask a space owner to generate one"? Hide the affordance entirely? Probably the former: a visible, disabled-with-explanation state is more helpful than a missing button.
  3. **Is "share via DM" worth porting** (mobile's `ShareInviteSheet` — pick a DM contact and send the link as a message), or is "copy + system clipboard" enough? DM-share is a real UX win on mobile but desktop's clipboard ergonomics are different.
- **Mobile sources**: [`app/(tabs)/spaces/[id]/index.tsx`](../../../../quorum-mobile/app/(tabs)/spaces/[id]/index.tsx) (header wiring), [`components/InviteModal.tsx`](../../../../quorum-mobile/components/InviteModal.tsx) (lines 56-67 = the read; lines 222-296 = the read-only display branch), [`components/ShareInviteSheet.tsx`](../../../../quorum-mobile/components/ShareInviteSheet.tsx), [`services/space/inviteService.ts`](../../../../quorum-mobile/services/space/inviteService.ts) (lines 442-471 = manifest re-upload with `inviteUrl`).
- **Shared promotion**: none expected — `inviteUrl` is already in `quorum-shared/src/types/space.ts`. This is pure UI exposure of an already-synced field.
- **Lesson for the workflow** (not yet in workflow.md, propose adding): when a candidate's framing implies "non-owner can do X", check (a) the service-layer gate, (b) whether the synced data already contains the result of an owner action, and (c) whether the UI is "do" or "view." Took three rounds to get this right; a single grep for the service-layer gate would have shortcut to the correct framing.

## Notes from the 2026-06-01 inventory pass

- Mobile uses an Expo Router structure (`app/` with route folders), NOT `src/`. When inspecting a screen, follow the route folder structure: tabs live in `(tabs)/`, onboarding in `(onboarding)/`.
- The 2026-05-28 "catching up public repo" commit (`98d59a4`) is what gave us this dataset. Mobile's public mirror was ~4 months stale before that — pre-dump audits in the shared-migration folder are out of date.
- Desktop has more mature primitives for the chat surface than mobile in some areas (modals, threads, replies), so for chat-side ports we'll often find desktop has 80% of the substrate, just missing the specific hook.
- The wallet/QNS/calling/Farcaster cluster is product-scope territory — those are huge features and need a user decision before we engineer anything.
- **Verified by grep:** desktop has no `wallet`, `farcaster`, `QNS`, `governance`, `miniapp`, `SocialFeed`, `livekit`, `audio space`, `biometric`, `OTA`, `report`, `reply tracking`, `space activity`, `discover spaces`, `OG metadata`, `useMessageSearch`, `publicProfile` / `isProfilePublic` UI consumer.
- Desktop already has: `usePinnedMessages`, `useDMMute`, `useDMFavorites`, embed UI for YouTube, `SearchService`, `ActionQueueService`, full `bookmarks/channels/conversations/dm/files/folders/invites/mentions/messages/replies/search/spaces/threads/validation` hook trees.

---

*Last updated: 2026-06-08 — **#29 Non-owner read-only access to the existing public invite URL shipped** (PR #182). Status flipped to ✅ in the main candidate table, the complexity-ranking row, and the per-candidate notes header. Smoke-testing surfaced a pre-existing crash on the JOIN side (`InvitationService.joinInviteLink` line 593, `"[object Object]" is not valid JSON`) — fix is in flight on `session-2026-06-08-3` as a separate follow-up PR.*

*Previously: 2026-06-08 — re-audit of mobile since previous baseline (`0fa63d4` 2026-05-30 → `ccd69e6` 2026-06-02). Three new mainline-app candidates added: **#27 Skins (custom themes)** ❔, **#28 On-device translation** ❔, **#29 Non-owner read-only access to the existing public invite URL** 🟢. #29 took three framing rounds to land: first version said "non-owners can generate" (wrong — service layer gates by owner key), second said "non-owners can generate one-time invites" (still wrong — that path exists in the service but isn't exposed by the relevant mobile surface, which jumps past the toggle when `space.inviteUrl` is set), third version (user-led: "maybe the owner's link is replicated to all members") is the right model: the link is just `spaceId + configKey` (both shared) and gets replicated via the encrypted manifest. Non-owners read what the owner already published. Captured the back-and-forth as a "lesson for the workflow" inside the #29 notes; consider promoting it to workflow.md next session if a similar trap reappears. Farcaster-cluster additions in the same mobile delta (block/mute/follow visibility actions, `feedPrefs`, `farcasterSpaceSocket`, `HegemonyGovernanceView`, `VideoViewer`, social-graph overflow buttons) folded under existing `❔ needs UX call` rows (#9 Farcaster, #15 Audio spaces, #17 Governance — added a re-audit note to #17). Channel-management hooks confirmed already-on-desktop (E class).*

*Previously: 2026-06-08 — #6 Public profile UI shipped. Status flipped to ✅ across the candidate table, complexity-ranking table, the per-candidate notes header, and the "Next up" footer. Per-candidate notes for #6 retained as-is (capability investigation + directory ruling + scope clarification) since the reasoning still applies to anyone reading. See [shipped-log.md](shipped-log.md) for what was learned during shipping (including a publish/rollback consistency race introduced by main's PR #180 and fixed before merge).*

*Previously: 2026-06-08 — #6 Public profile UI picked up on `session-2026-06-08`. Scope clarified during pickup: backend exposes no user-enumeration endpoint, so neither app has a profile directory. The port is what mobile actually ships (publish toggle, DM-header backfill, member fallback resolver). Bundled removals: speculative `/discover/people` People tab + simplified Discover chrome. Added #12 QNS notes covering the client shape (1,235 LOC, 451 LOC of hooks) and a "mini-candidate" observation that the `NewDirectMessageModal` is missing `@username` support — picked up later only if QNS goes in scope.*

*Previously: 2026-06-07 — #1 marked ✅ shipped (PR #170, 2026-06-04). PR 2 task file obsoleted by new UI shell (PR #171) on 2026-06-03; the SpacesSidebar `+` button is now a deliberate fixture, so retiring the modals is no longer the plan. All three #1-related task files moved to `.done/`.*

*Previously: 2026-06-01 — #3 removed (desktop has it, strictly better — logged in [`desktop-better-than-mobile.md`](desktop-better-than-mobile.md) #1). #5 deprioritized (user call, not a near-term product priority). #6 and #1 capability-verified missing on desktop. User picked #1 Discover spaces as the first port; #6 queued behind it. Earlier today: #2 ruled out (desktop has in-conversation search via `GlobalSearch`); #4 reframed then dropped (UX-pattern conflict with Discord-style desktop model); #8 demoted (Farcaster-only on mobile).*
