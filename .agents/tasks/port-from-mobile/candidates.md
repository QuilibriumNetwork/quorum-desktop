---
type: inventory
title: Mobile features not on desktop — candidate list
status: living
created: 2026-06-01
updated: 2026-06-01
---

# Mobile features not on desktop — candidate list

Running inventory of features that exist on `quorum-mobile` but not on `quorum-desktop`. Updated each session as new candidates surface or existing ones are picked, ported, or rejected.

**Inventory baseline:**
- `quorum-mobile` `master` at `0fa63d4` (2026-05-30)
- `quorum-desktop` `main` at HEAD on `session-2026-06-01`
- `quorum-shared` `master` at `9d1c08f` (2026-05-30)

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
| **1** | **Discover/Explore spaces** (public space directory, search, categories, member counts, join from list) | `app/(tabs)/spaces/discover.tsx`, `hooks/chat/useExploreSpaces.ts`, `services/api/quorumClient.ts` (`DirectoryEntry`, `getDirectory`) | A | 🟢 | Big UX gap — desktop has no space discovery UI. Hooks pure, no native deps. Likely some shareable logic (`DirectoryEntry` type, search/filter algorithm). |
| **2** | **Message search inside a space/DM** | `hooks/chat/useMessageSearch.ts` + UI surfaces | A | 🟢 | Desktop has `SearchService.ts` + `components/search/` for global search but no in-conversation `useMessageSearch` hook. Verify what desktop's `SearchService` actually does vs mobile's pattern. |
| **3** | **Reply tracking** (per-user inbox of @replies to your messages, with read state) | `hooks/chat/useReplyTracking.ts` | A | 🟢 | Desktop has no equivalent. Could be a real UX win — "who replied to me" inbox. |
| **4** | **Space activity feed** (per-space recent activity feed) | `hooks/chat/useSpaceActivity.ts` | A | 🟢 | Desktop has no equivalent. Probably small. |
| **5** | **Reporting / abuse flag** (`report user`, `report message`, `report space` workflow) | `services/reporting/reportService.ts` | A | 🟢 | Trust/safety primitive — desktop has nothing. Likely fully portable; logic might fit shared. |
| **6** | **Public profile** (opt-in profile visible to non-members; bio, links, etc.) | `services/profile/publicProfile.ts`, `hooks/useUserPublicProfile.ts`, `hooks/useMembersWithPublicProfileFallback.ts` | B | 🟢 | The `UserConfig.isProfilePublic` field already landed in shared (PR #159, 2026-05-28) but desktop has no UI/hooks to consume it. **Strong B candidate** — finish what the type-only PR started. |
| **7** | **Profile prefs** (extra profile settings: visibility, defaults) | `services/profile/profilePrefs.ts` | C | ❔ | Sub-feature of #6, scope to that effort. |
| **8** | **OG metadata previews** (link unfurl on messages — show og:title, og:image when a URL is pasted) | `hooks/useOgMetadata.ts` | A | 🟢 | Desktop has `YouTubeEmbed` / `YouTubeFacade` only. Generic link preview is a real UX gain. Logic largely portable (HTTP fetch + HTML parse). |
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

## Complexity ranking (engineering risk, not product value)

Re-ranked 2026-06-01 after spot-reading the mobile sources. Order is safest/smallest first. LOC estimates are mobile-side sources only — the desktop port often needs comparable but not identical surface.

| Rank | # | Feature | LOC (mobile) | Why this rank |
|---|---|---|---|---|
| **1** | **#4** | **Space activity feed** | ~80 | **Safest start.** Pure key-value tracker. One storage-swap point (`react-native-mmkv` → IndexedDB or `localStorage`), zero crypto, zero network. Standalone reader/writer mirroring the desktop pattern. |
| **2** | **#3** | **Reply tracking** | ~115 | Same shape as #4 — literally a sibling pattern in mobile. Same MMKV→web-storage swap. Slightly more state (per-user counts). **Recommended to bundle with #4 in one PR**: one storage-adapter decision made once, used twice; sets the precedent for future "MMKV-keyed hooks" ports. |
| **3** | **#2** | **Message search (in conversation)** | ~150 + UI | Pure MiniSearch. Drop RN's `InteractionManager` wrapping (use `requestIdleCallback` or just synchronous build). **Verify first**: confirm desktop's existing `SearchService` is global, NOT per-conversation. Adds a search bar UI to chat. No crypto, no network. |
| **4** | **#5** | **Reporting** | ~195 service + UI | Standalone trust/safety surface. Touches Ed448 signing (`NativeCryptoProvider` → desktop's `WasmSigningProvider`) + AES-GCM via `@noble/ciphers` (web-compatible). Single API call (`postReport`); server endpoint already exists. Moderate. |
| **5** | **#6** | **Public profile UI** | ~150 svc + ~130 hooks + new UI | **Higher value, larger surface.** Closes a known migration loose end (shared has the `isProfilePublic` + `farcasterLink` field since 2026-05-28; desktop has zero consumer). Needs: publish flow, fetch flow, own-profile UI, viewing-others UI, fallback resolver in member lists. Same Ed448 signing swap as #5. |
| **6** | **#8** | **OG metadata previews** | ~225 | **Hidden caveat that bumps this up the list:** mobile uses RN's no-CORS `fetch`. Desktop is Electron — browsers enforce CORS, killing direct in-renderer fetch for arbitrary URLs. Safe path: renderer → main-process IPC fetch (or a tiny Electron-main HTTP fetcher). Logic is trivial once that path is wired up. Cross-cutting because it adds a new IPC surface. |
| **7** | **#1** | **Discover spaces** | ~85 hook + ~280 screen | **Largest UI lift, no architectural rabbit holes.** Pure data view + join, but lots of UI surface: category chips, debounced search, pagination, member-count formatting, empty states, join flow. Hook itself is tiny; the screen is where the work lives. |

**Recommended first port:** bundle **#4 + #3** in one PR. Lowest possible risk, immediate UX win, establishes the storage-adapter pattern for MMKV-keyed hooks that will repeat for similar features later.

## Original "first picks" (by leverage, not complexity)

Kept for reference. Use the complexity ranking above to decide what to *start*; use this list when balancing value vs. risk after several ports have shipped:

1. **#6 Public profile** — half the work is already done (shared has the type, desktop has the field but no UI). Closes a known migration loose end.
2. **#3 Reply tracking** — small, real UX win, no architectural decisions needed.
3. **#4 Space activity feed** — small, complements #3.
4. **#8 OG metadata** — small per-message UX win, generalizes the existing YouTube embed pattern.
5. **#2 Message search inside conversation** — should be tractable once we see what `SearchService` already does on desktop.
6. **#1 Discover spaces** — bigger UI lift but no architectural rabbit holes; pure data view + join action.
7. **#5 Reporting** — small standalone trust/safety win.

The "❔ needs UX call" rows (#9 Farcaster, #12 QNS, #13 Wallet, #14 Calling, #15 Audio Spaces, #16 Miniapps, #17 Governance) are product decisions, not engineering decisions. They should be discussed before scoping.

## Notes from the 2026-06-01 inventory pass

- Mobile uses an Expo Router structure (`app/` with route folders), NOT `src/`. When inspecting a screen, follow the route folder structure: tabs live in `(tabs)/`, onboarding in `(onboarding)/`.
- The 2026-05-28 "catching up public repo" commit (`98d59a4`) is what gave us this dataset. Mobile's public mirror was ~4 months stale before that — pre-dump audits in the shared-migration folder are out of date.
- Desktop has more mature primitives for the chat surface than mobile in some areas (modals, threads, replies), so for chat-side ports we'll often find desktop has 80% of the substrate, just missing the specific hook.
- The wallet/QNS/calling/Farcaster cluster is product-scope territory — those are huge features and need a user decision before we engineer anything.
- **Verified by grep:** desktop has no `wallet`, `farcaster`, `QNS`, `governance`, `miniapp`, `SocialFeed`, `livekit`, `audio space`, `biometric`, `OTA`, `report`, `reply tracking`, `space activity`, `discover spaces`, `OG metadata`, `useMessageSearch`, `publicProfile` / `isProfilePublic` UI consumer.
- Desktop already has: `usePinnedMessages`, `useDMMute`, `useDMFavorites`, embed UI for YouTube, `SearchService`, `ActionQueueService`, full `bookmarks/channels/conversations/dm/files/folders/invites/mentions/messages/replies/search/spaces/threads/validation` hook trees.

---

*Last updated: 2026-06-01 — initial broad inventory pass + complexity ranking added.*
