---
type: inventory
title: Mobile features not on desktop — candidate list
status: living
created: 2026-06-01
updated: 2026-06-10
---

# Mobile features not on desktop — candidate list

Running inventory of features that exist on `quorum-mobile` but not on `quorum-desktop`. Updated each session as new candidates surface or existing ones are picked, ported, or rejected.

**This file is organized by actionability, not by candidate number.** Read top-to-bottom:

1. [Quick status board](#quick-status-board) — every candidate, one line each. Scan this first.
2. [Actionable now](#actionable-now) — engineering-ready, no product decision blocking. **This is the pick-next list.**
3. [Awaiting a product-scope call](#awaiting-a-product-scope-call) — fit desktop in principle but need a yes/no from the lead dev before scoping.
4. [Resolved archive](#resolved-archive) — shipped (✅), won't-port (❌), already-on-desktop (E). Full decision notes preserved here so nothing is re-litigated. Read only when verifying a past call.
5. [Reference](#reference) — classification key, how-to-read, baseline, inventory-pass notes.

---

## Inventory baseline

- `quorum-mobile` `master` at `ccd69e6` (2026-06-02) — re-baselined 2026-06-08 in `session-2026-06-08-2`. Previous baseline was `0fa63d4` (2026-05-30); the delta added candidates **#27 Skins**, **#28 On-device translation**, **#29 Non-owner invite drawer**. Farcaster-specific additions in the same delta are folded into existing `❔` rows (#9, #15, #17), not promoted to top-level candidates until those product calls are made.
- `quorum-desktop` `main` — last verified 2026-06-10 at `aac8d0a8` (after PR #187 settings revamp + #188 profile sync; neither changed an open candidate's status — verified by grep that `Appearance.tsx` still ships theme+accent+language only and that reporting/skins remain absent from `src/`).
- `quorum-shared` `master` at `1115a25` (2026-06-05).

---

## Quick status board

Legend: 🟢 ready to pick · 🚧 in progress · ✅ shipped · ⏸️ paused · ❌ won't port · ❔ needs UX call

| # | Feature | Class | Status | One-line state |
|---|---|---|---|---|
| **5** | Reporting / abuse flag | B | ⏸️ | Engineering-ready, but deprioritized (user call, low priority 2026-06-10). Bundles the deferred Ed448 signing-helper shared-promotion. |
| **7** | Profile prefs | C | ❔ | Sub-feature of #6; scope to that effort. |
| **27** | Skins (custom themes) | B/C | ❔ | Large skin engine + gallery on mobile. Needs product-scope call. Low priority (2026-06-10). |
| **28** | On-device translation | C | ❔ | Re-implementation, not a port (native engines are mobile-only). Needs product-scope call. |
| **9** | Farcaster integration | C | ❔ | Multi-week social bridge. Gating product decision for #10, #11, #26, #17-Hegemony. |
| **10** | DM ↔ Farcaster casts unification | C | ❔ | Sub-feature of #9. |
| **11** | Scam / spam filter | C | ❔ | Likely Farcaster-specific. Re-evaluate after #9. |
| **12** | QNS marketplace + auctions | C | ❔ / 🚧 | Full marketplace still ❔ a product call. **Scoped resolution slice shipped** (PR #190, 2026-06-10): DM search by `@username`, profile `.q` display, `.q`-suffix validation. Display-model (A vs B) + mentions pending lead-dev call. |
| **13** | Multi-chain wallet | C | ❔ | Massive. Needs "does desktop want a wallet?" decision. |
| **14** | Calling stack (1:1 voice/video) | C/D | ❔ | WebRTC works in-browser; heavy UX work. Scope call. |
| **15** | Audio spaces (LiveKit) | C/D | ❔ | LiveKit web SDK exists. Scope call. |
| **16** | Mini-apps + in-app browser | C | ❔ | Electron has a browser engine; could reframe. Scope call. |
| **17** | Governance | C | ❔ | Includes the Farcaster-coupled Hegemony view. Scope call. |
| **26** | Onboarding refinements | C | ❔ | `privacy-setup` is a small win; `farcaster-setup` gated on #9. |
| **1** | Discover/Explore spaces | A | ✅ | Shipped as `/spaces` page (PR #170, 2026-06-04). |
| **6** | Public profile | B | ✅ | Shipped 2026-06-08. |
| **29** | Non-owner invite URL view | A | ✅ | Shipped 2026-06-08 (PR #182). |
| **30** | Per-space profile bio override | A | ✅ | Shipped 2026-06-08 (PR #185). |
| **2** | Message search in conversation | E | ❌ | Already on desktop (`<GlobalSearch>`, different impl). |
| **3** | Reply tracking | E | ❌ | Already on desktop, strictly better. |
| **4** | Last-message-preview / spaces sort | A | ❌ | UX-pattern conflict (Discord vs Telegram model). |
| **8** | OG metadata previews | A | ⚠️ | Farcaster-only on mobile; not a chat feature. Re-pick only if #9 ships. |
| **18** | Image attachments / media save | E | ❌ | Already on desktop (mobile's headers say "mirrors desktop"). |
| **19** | Mention extraction utility | E | — | Covered by desktop's `components/mentions/` + shared `parseMentions`. |
| **20** | Emoji frecency | E | — | Different algorithm (desktop raw-counts, mobile decay). Not a port. |
| **21** | Offline mutation queue | E | — | Desktop has `ActionQueueService`. Stays per-app by design. |
| **22** | Biometric / device-bound auth | D | — | Mobile-only (WebAuthn is a separate product decision). |
| **23** | OTA updates | D | — | Expo OTA vs Electron auto-updater. Different paradigm. |
| **24** | Network state detection | E? | — | Trivial; `navigator.onLine`. Skip unless needed. |
| **25** | Push notifications stack | D | — | Paused in shared-migration roadmap. Don't re-open. |

---

## Actionable now

> **As of 2026-06-10: the actionable list is empty by user choice.** The only engineering-ready candidate (#5 Reporting) is deprioritized, and the next-biggest opportunity (#27 Skins) is also low priority. Nothing is in flight. When priorities shift, #5 is the cleanest pick-up; see [#5 below](#5-reporting---deprioritized-but-engineering-ready) for why.

A candidate belongs here when it is (a) capability-verified missing on desktop, (b) sized for a single feature PR, and (c) not blocked on a product decision. Move a row up from [Awaiting a product call](#awaiting-a-product-scope-call) once its scope question is answered.

### #5 Reporting — ⏸️ deprioritized but engineering-ready

The one candidate that is both verified-missing on desktop and well-bounded. Currently parked by user call (low priority, reaffirmed 2026-06-10), so it sits between "actionable" and "awaiting" — no product question blocks it, only prioritization.

- **What it is:** trust/safety abuse-flag flow. `report cast` / `report message` workflow with an E2E-respecting per-report key — encrypt the reported plaintext under a fresh AES-GCM key (known only to reporter + server), sign with the Ed448 inbox key. ~195 LOC service + a `ReportModal`, single API call.
- **Mobile sources:** `services/reporting/reportService.ts`, `components/ReportModal.tsx`, used from `DMChatArea`, `SpaceChatArea`, `CastThreadModal`, `SocialFeedModal`, `ProfileModal`.
- **Why it's still on the board:** the capability gap is real (desktop has no abuse-flag flow), and the implementation is clean and bounded — a relatively easy trust/safety primitive to pick up if product direction shifts.
- 🔗 **When picked up, bundle the deferred shared-promotion.** Reporting and #6 Public Profile use the same canonicalize-then-sign pattern (build a canonical `"prefix:fields...:" + int64BE(timestamp)` byte payload, then `js_sign_ed448`). #6 ([shipped 2026-06-08](.done/2026-06-08-port-public-profile.md)) deferred the shared promotion deliberately so we'd have two real call sites before locking the API shape. With #5 also implementing it, that condition is met — the helpers should land in `@quilibrium/quorum-shared` and both `PublicProfileService` (desktop) + the new ReportingService (desktop) + mobile's two equivalents consume them. Note `int64ToBytes` already exists in shared (desktop's `ConfigService` uses it); mobile rolls its own `int64BE` — a follow-up mobile-task-pending entry. See [#6 archive note](#6-public-profile-ui--shipped-2026-06-08) and the [quorum-shared-migration cross-pointer](../quorum-shared-migration/README.md).
- **History:** 2026-06-01 user call "not a priority right now." 2026-06-10 reaffirmed low priority.

---

## Awaiting a product-scope call

These fit desktop UX in principle but require a decision that's the lead dev's, not an engineering one (new dependency, architectural shift, "do we want this surface at all?"). They are **not** ranked by engineering risk — they're blocked on product, period. Don't scope engineering until the question is answered.

The headline questions, grouped:

- **"Customization" track:** #27 Skins, #28 Translation.
- **"Big new product surface" cluster:** #9 Farcaster, #12 QNS, #13 Wallet, #14 Calling, #15 Audio spaces, #16 Miniapps, #17 Governance. These are the multi-week features; each needs a yes/no/later before anyone engineers.
- **Sub-features gated on a parent decision:** #7 (→#6, done), #10/#11 (→#9), #26 (→#9 partly).

### #7 Profile prefs

- _(no notes yet — sub-feature of #6, which shipped. Re-scope if extra profile-settings surface is wanted.)_

### #9 Farcaster integration

Full social-feed bridge: feed, channel, profile, search, submit cast, thread, notifications, signer lifecycle. `hooks/useFarcaster*.ts` (~10 hooks), `services/farcaster/*` (~9 files), `services/farcasterClient.ts`, `components/SocialFeed/`.

- Shared already has a Farcaster module (`@quilibrium/quorum-shared/src/farcaster/`, 2026-05-30 dump). Mobile uses some of it + its own hooks.
- **Ask user:** do we want a Farcaster surface on desktop at all? If yes, this is multi-week, and it unblocks #10, #11, the Hegemony part of #17, and the `farcaster-setup` part of #26.

### #10 DM ↔ Farcaster direct casts unification

- Sub-feature of #9. Mobile presents native DMs and Farcaster direct casts in one list (`useFarcasterDirectCasts`, `useUnifiedConversations`). Only meaningful if #9 ships first.

### #11 Scam filter / spam filter

- `services/farcaster/scamFilter.ts`. Likely Farcaster-specific. Re-evaluate after #9.

### #12 QNS marketplace + auctions

Browse names, create auctions, make offers, register payment. `hooks/useQNSMarketplace.ts`, `hooks/useQNSPayment.ts`, `hooks/useQNS.ts`, `components/qns/*Modal.tsx`.

- **2026-06-08 — QNS client shape (learned while scoping #6).** QNS (Quilibrium Name Service) is a separate API (default base URL `https://names.quilibrium.com`) consumed by mobile via `services/api/qnsClient.ts` (1,235 LOC client) + `hooks/useQNS.ts` (451 LOC of React Query hooks). A real product surface, not a small utility:
  - **Resolution:** `useResolveName`, `useResolveBatch`, `useReverseLookup`, `useBucketLookup` (privacy-preserving stealth lookup).
  - **Registration:** availability checks, pricing, invite-code validation, ownership types (ethereum vs quilibrium), full registration mutation.
  - **Reverse lookup:** `address → @username` for display alongside addresses anywhere.
- **2026-06-08 — Desktop has ZERO QNS plumbing.** Grep confirms: no `useResolveName`, no `qns`, no `names.quilibrium.com` anywhere in `quorum-desktop/src`.
- **2026-06-08 — Mini-candidate: `@username` in `NewDirectMessageModal`.** Mobile's `NewConversationModal` accepts both `Qm...` addresses AND `@username` (QNS-resolved); desktop's `NewDirectMessageModal.tsx` accepts only raw addresses. A real UX-parity gap for users with QNS names. Could be a **scoped slice of #12** (just `useResolveName`) IF the full marketplace is in scope — otherwise it commits desktop to a new base URL + client without a broader product reason. Lead dev's call.
- **2026-06-08** — Re-evaluate after a QNS marketplace product decision. If in scope → multi-PR; if not → the `@username` gap stays a "would be nice" with no portable fix.
- **2026-06-10 — Scoped slice picked up: QNS usernames (display + search + mention).** Rather than waiting on the full marketplace decision, brainstormed a scoped slice that pulls in ONLY QNS resolution (1 endpoint, `GET /resolve/:name`), not registration/auctions/pricing. Covers four surfaces: DM-search-by-`@username` (the one true port), profile `.q` display (net-new — mobile scaffolds but never plumbs `primaryUsername` to the in-space view), mention-by-username (net-new — mobile never does it), and dot-validation to make the `.q` trust signal unspoofable (net-new — mobile has none). Single shared resolution helper as the spine. Sourcing mirrors mobile (Route A: `primary_username` rides in the published profile, no live reverse-lookup). Design doc: [`2026-06-10-qns-username-display-design.md`](2026-06-10-qns-username-display-design.md). Ground-truth confirmed via live QNS site: names cannot contain dots, which makes the dot-validation airtight.
- **2026-06-10 — ✅ Shipped the slice (PR #190).** Merged to `main`: DM search by `@username` (verified live: `lamat` → `QmVYRWm…YvPY`, the real address), `.q`-suffix validation on display-name inputs, and a profile `.q` render. Shared support landed in `quorum-shared` #35/#36 (`2.1.0-27`). The `@username` DM gap is now **closed**. 🚧 **Still in flight (blocked on lead-dev call):** (a) the display model — Model A (secondary handle, as shipped) vs Model B (QNS name overrides the display name everywhere, per-space override wins; the author's preference, asked via Telegram); (b) **mentions** (Stage 4, not started). Live `.q` display is also blocked by two mobile bugs (primary_username not published/synced; isProfilePublic not syncing) — filed in `quorum-mobile/.agents/bugs/`. Full state + resume point: [`2026-06-10-qns-username-display-plan.md`](2026-06-10-qns-username-display-plan.md) PROGRESS section.

### #13 Multi-chain wallet

Solana/EVM/Kaspa/Bittensor; balances, history, send/receive, swap via Jupiter/Li.Fi/Relay. `services/wallet/*`, `hooks/useWallet.ts`, `hooks/useWalletSelection.ts`, `hooks/useWarpcastWallet.ts`, `hooks/useTokenInfo.ts`, `components/wallet/*`.

- Massive feature. **Ask user:** does the desktop product want a wallet at all? If yes — phased multi-PR effort, lots of new deps (likely `@solana/web3.js`, EVM lib, etc.).

### #14 Calling stack

1:1 voice/video over WebRTC, SFU, signaling, blind-tokens, native call screens. `services/calling/*`, `context/CallContext.tsx`, `components/Call/*`.

- WebRTC works in browsers, so technically possible, but needs heavy UX work. **Ask user:** in scope or out? If in, very large effort.

### #15 Audio spaces

LiveKit-backed group audio rooms ("Twitter Spaces" style). `services/spaces/livekit*.ts`, `context/AudioSpaceContext.tsx`.

- LiveKit web SDK exists, so technically portable. **Ask user:** scope.

### #16 Mini-apps + in-app browser

`browser.tsx` screen, miniapp WebView bridge with ethereum provider injection, secure signing for dApps. `app/browser.tsx`, `app/apps.tsx`, `services/miniapp/*`, `context/MiniappOverlayContext.tsx`.

- Desktop is Electron — has a built-in browser engine. Could be reframed as "desktop opens miniapps in a new window." **Ask user:** scope.

### #17 Governance

Proposal voting, governance hooks. `hooks/useGovernance.ts`.

- **Ask user:** is governance a planned desktop feature?
- **2026-06-08 (re-audit)** — mobile added a `HegemonyGovernanceView` (`/hegemony` portal-API feed with proposal cards + FOR/AGAINST tallies + reply threads, ~377 LOC) plus a `ProposalVoteBlock` component and a `useHegemonyGovernance` hook (60s `staleTime`). Wired into `SocialFeed/views/`, so it's effectively a Farcaster-surface governance view, not standalone. Folds under both #9 (Farcaster) and #17 — same product-scope call gates both.

### #26 Onboarding refinements

Farcaster setup step + privacy setup step in the onboarding flow. `app/(onboarding)/farcaster-setup.tsx`, `app/(onboarding)/privacy-setup.tsx`.

- If we ship Farcaster (#9), parts of `farcaster-setup` translate. `privacy-setup` is a cleaner UX for the same toggles desktop already has in `UserSettingsModal` — a possible small standalone win independent of #9.

### #27 Skins (custom themes) — ❔ needs UX call (low priority 2026-06-10)

Bundled samples + locally-saved skins + server gallery. Per-skin: color tokens (accent/surfaces/text/semantic), radii/spacing/borders (with global `scale`), `fontScale`, embedded font face, icon substitution map, wallpaper (cover/tile/contain + scrim), frame chrome, per-region surface backgrounds. All input validated against an allow-list (`validate.ts`) with image content-sniffing. Server gallery is Ed448-signed publish.

Mobile sources: `components/skins/SkinsModal.tsx` + `SkinEditor.tsx`, `services/skins/skinsClient.ts`, `services/theme/skinPrefs.ts`, `theme/skins/{types,validate,mergeSkin,geometry,samples,surfaces,fontLoader,skinnableStyleSheet,frame}.ts`, `components/ui/{AppBackground,SkinTouchable}.tsx`.

- **2026-06-08** — **New candidate, surfaced in the re-audit after the 2026-06-01 mobile bulk merge (`56ffd31`).** User flagged this directly: "one thing that is new in the mobile repo, for instance, is skins. So possibility to choose a skin for your space. A theme."
- **2026-06-10** — User call: low priority right now. Keep on the board (capability gap is real and interesting), don't scope yet.
- **Note on framing:** the skin engine is **app-wide**, not per-space, on mobile. The active skin is stored in `services/theme/skinPrefs.ts` (one global selection per user) and merged via `theme/skins/mergeSkin.ts`. Per-space skinning isn't shipped on mobile — what ships is "the whole app gets reskinned." Confirm with the user whether desktop scope is "app-wide skin" (mirrors mobile) or "per-space skin" (new capability neither app has).
- **Capability shape on mobile:**
  - **SkinOverride manifest** (`theme/skins/types.ts`) is a strictly-typed declarative document, not code. Validated by `validate.ts` (488 LOC) against an allow-list. Every override bounded: colors = 22 named tokens, geometry = named tokens + global `scale` multiplier, fonts = single embedded face (data URI), wallpaper = data URI + fit/scrim/alpha, icons = `Record<symbolName, data URI>`, "frame" = small allow-list of corner/border/header/glow enums, surfaces = 12 allow-listed slot names with bg/fit/opacity/text overrides.
  - **Gallery** (`services/skins/skinsClient.ts`) — Ed448-signed publish (same identity-key pattern as #5/#6), content-hash IDs, popular/new sort + search, install counter.
  - **Local management** (`SkinsModal.tsx`) — apply/reset, import from clipboard/.json, export, browse + install from gallery, edit via `SkinEditor.tsx`.
- **Desktop has nothing comparable.** `src/components/modals/UserSettingsModal/Appearance.tsx` (~99 LOC after the PR #187 settings revamp): light/dark/system theme + 6 fixed accent swatches + language. No skin engine, gallery, wallpaper, font scale, or icon substitution.
- **Pure-logic shared-promotion candidates** (if picked up):
  - `theme/skins/types.ts` (~205 LOC) — pure types, zero runtime.
  - `theme/skins/validate.ts` (~488 LOC) — security-critical allow-list validator. Must match byte-for-byte between apps or a skin valid on one and rejected on the other is a UX bug. Strong shared candidate.
  - `theme/skins/mergeSkin.ts` (~38 LOC) — pure merge.
  - `geometry.ts` (~85 LOC) — pure math.
  - **Re-implementations** (not shared): font loading (RN `expo-font` vs web `FontFace`), surface backgrounds (RN style vs CSS), wallpaper rendering, icon substitution at the IconSymbol layer.
- **Bundles a third signing-payload helper opportunity.** Skin publish signs `manifest || thumbnail || be64(timestamp)` with Ed448 — same pattern as #5 and #6. If picked up after #5, the deferred shared-promotion finally has THREE call sites. If skins lands first, it should pull the helpers into shared so #5 has a precedent.
- **Open product/UX questions:**
  1. Scope: app-wide skin (mirrors mobile) or per-space skin (new capability)?
  2. Editor parity: ship an in-app editor (mobile has one) or import-only via JSON?
  3. Gallery: ship publish/install on day one or save for v2?
  4. Wallpaper feasibility on Electron with the existing chrome (sidebars/modals on `surface*` layers — wallpaper would need to opt out of opaque surface defaults to be visible).

### #28 On-device translation — ❔ needs UX call

Language detection + translate-in-place wrapper around posts/messages, per-language target preferences, force-translate toggle, model-availability gating. `modules/quorum-translation/*` (native iOS Translation framework + Android ML Kit), `services/translation/{availability,forceTranslate,translationCache,translationPrefs,useTranslatable}.ts`, `components/translation/{Translatable,TranslateLanguageModal,TranslateToggle,languages}.tsx`.

- **2026-06-08** — **New candidate, surfaced in the re-audit after the 2026-06-01 mobile bulk merge (`56ffd31`).**
- **Capability shape on mobile:**
  - Native module `modules/quorum-translation/` — iOS Translation framework (Apple) + Android ML Kit. Detection (BCP-47/ISO-639 + confidence) + translate(text, source, target) + ensureModel(source, target) for the one-time on-device model download.
  - Service layer (`services/translation/`): availability gating, per-language target prefs, force-translate toggle, session cache, the React hook (`useTranslatable.ts`, ~254 LOC).
  - UI: `Translatable.tsx` wraps any text node; `TranslateLanguageModal.tsx` is the prefs sheet; `TranslateToggle.tsx` is the per-post chip.
  - **Privacy invariant:** post/message text never leaves the device; only the model download hits the network. Deliberate, documented design.
- **Desktop has no equivalent.** Grep confirms no translation modules/hooks/services in `src/`.
- **Desktop ports the capability, not the implementation.** Electron has no Apple Translation / ML Kit equivalent. Realistic paths:
  1. **Cloud translation API** (OpenRouter LLMs, DeepL, Google Cloud Translation). Privacy regression vs mobile's on-device guarantee. Cheap, fast, easy.
  2. **WASM-based** (Bergamot, or transformers.js quantized models). Preserves the privacy invariant. Large model download (~20-50MB/pair), slower than native.
  3. **OS-level** — macOS has a system Translation framework callable via native bridges; Windows 11 has built-in translation but no easy Electron bridge. Inconsistent.
  4. **Skip** — may not be a desktop priority.
- **Not a port — a re-implementation.** Mobile's API surface is reusable (`useTranslatable` signature, prefs shape, `Translatable` wrapper) but the engine must be swapped. If picked up: implement the desktop-side engine first behind the same hook surface, then wire the existing components.
- **Open product question:** is translation a desktop priority? If yes, which engine path?

---

## Resolved archive

Shipped (✅), won't-port (❌), and already-on-desktop (Class E) candidates. Full decision notes preserved so calls aren't re-litigated across session boundaries. **Don't delete these** — they're the durable "we decided X about candidate N" record. Read when verifying a past decision or when a candidate looks like it might already be covered.

### Shipped ✅

#### #1 Discover spaces — shipped (PR #170, 2026-06-04)

Shipped as the `/spaces` page (PR 1 = #170). My Spaces + Discover tabs, mock-mode aware hook, `icon-layout-grid-add` entry point, "Hide muted Spaces from sidebar" toggle. Shared additive PR landed `DirectoryEntry`/`DirectoryResponse`/`SpaceCategory` + `UserConfig.hideMutedSpacesFromSidebar`.

- **2026-06-03** — PR 2 (retire `AddSpaceModal` + `CreateSpaceModal`, remove navbar `+`, build Join-via-link + Create tabs) marked **obsolete** after the new UI shell (PR #171) made the SpacesSidebar `+` button a deliberate fixture with a context menu surfacing both modals. The "page is the hub for everything" premise no longer holds.
- **Task files** in `.done/`: [`2026-06-01-port-discover-spaces.md`](.done/2026-06-01-port-discover-spaces.md), [`-plan.md`](.done/2026-06-01-port-discover-spaces-plan.md), [`-pr2.md`](.done/2026-06-01-port-discover-spaces-pr2.md).
- **Historical context (kept for memory):** User's pick for first port. Capability-verified missing: desktop's `JoinSpaceModal`/`AddSpaceModal` were invite-link-only (paste → validate → join), no public-directory browse, no category filtering. `useSpaceJoining` was reusable as the join mutation; the missing pieces were the directory data + UI. The server directory endpoint already existed (mobile called it); desktop's API client needed the same methods.

#### #6 Public profile UI — shipped (2026-06-08)

Opt-in publish + resolve-by-address; backfills chat rendering for users we don't share a space with. Task file: [`.done/2026-06-08-port-public-profile.md`](.done/2026-06-08-port-public-profile.md).

- **2026-06-08 — ✅ Shipped.** Branch `feat/port-public-profile-from-mobile`. 8 commits — API client + service, `/discover/people` retirement, `Privacy.tsx` toggle with destructive-style confirmation, DM-header backfill, space-message-sender backfill (manual ref-cache perf pattern), ConfirmationModal latent-bug fixes. See [shipped-log.md](shipped-log.md).
- **2026-06-08 — Directory ruling: NOT a portable directory feature.** Original framing implied a browse/search surface. The server exposes only:
  - `GET /users/:addr/public-profile` — resolve **by known address** only.
  - `GET /users/by-fid/:fid` — reverse-lookup **by known fid** only.
  - **No `GET /users`, no `/directory/users`, no `?search=`.** A key-value resolver, not an enumeration index. (Spaces have a real `GET /directory`; profiles deliberately don't.)
  - Mobile has no profile directory either. The speculative People tab on desktop (`/discover/people`) was **removed in this PR**.
- **2026-06-08 — What mobile actually ships (the real capability):**
  1. **Publish toggle** (`isProfilePublic` switch → `publishPublicProfile`/`unpublishPublicProfile`, auto-republish on edit).
  2. **Single-user resolve-by-address** in DM screen — fills displayName/avatar in the chat header before the first message arrives.
  3. **Member-fallback resolver** in `SpaceChatArea`/`DMChatArea` — fills displayName/avatar/bio for senders the local record lacks/has stale (per-field timestamp comparison).
  - All three are invisible plumbing improving chat rendering for users you don't share a space with — not profile-browsing.
- **2026-06-08 — Address-resolution scope.** Mobile's `NewConversationModal` accepts `Qm...` AND `@username` (QNS); desktop's `NewDirectMessageModal` accepts only raw addresses. QNS resolver is available client-side on mobile but not a small extract — see [#12](#12-qns-marketplace--auctions). Decision: don't bundle QNS; the `@username` gap stays a separate small follow-up.
- **Closed a shared-migration loose end.** Shared had `UserConfig.isProfilePublic` + `farcasterLink` since PR #159 (2026-05-28); desktop read/wrote the field nowhere.
- **Shared-promotion opportunity:** the signed-payload helpers in `publicProfile.ts` (`int64BE`, `concatBytes`, canonicalize-then-sign) are the same pattern as reporting — pure logic, deferred to #5 to get a second call site. See [#5](#5-reporting---deprioritized-but-engineering-ready).

#### #29 Non-owner read-only access to public invite URL — shipped (PR #182, 2026-06-08)

Any member can view/copy/share the public invite URL **the owner already published** (the link is `spaceId` + the shared `configKey`, replicated to every member via the encrypted space manifest, so no owner privilege is needed to display it). Members CANNOT generate/regenerate. Task file: [`.done/2026-06-08-port-non-owner-invite-view.md`](.done/2026-06-08-port-non-owner-invite-view.md).

- **2026-06-08 — ✅ Shipped (PR #182).** Branch `feat/port-non-owner-invite-view-from-mobile`. Reused the existing `SpaceSettings > Invites` tab — branched on `isSpaceOwner` to render a stripped-down read-only variant (URL + Copy + existing `DmPicker` calling `invite(address, 'public')`, which forwards `space.inviteUrl` without consuming the eval pool). Extended the sidebar context-menu "Invite Members" entry to non-owners when `space.inviteUrl` is set; flipped the Invites tab icon `share` → `user-plus`. Owner UI untouched. Smoke-test surfaced a pre-existing JOIN-path crash (`InvitationService.joinInviteLink:593`, `"[object Object]" is not valid JSON`) — unrelated; fixed separately in PR #183.
- **2026-06-08 — corrected framing after user pushback (twice) + a screenshot.** Took three rounds. Recording the path so we don't re-litigate:
  1. **First (wrong):** "any member can generate public link."
  2. **Second (still wrong):** "non-owners can generate one-time private invites, public stays owner-only" — based on the `useInviteManagement.ts:64-65` comment and assuming the modal showed both options.
  3. **Correct:** the screenshot was the **post-generate state**. The `useEffect` at `InviteModal.tsx:56-67` reads `space.inviteUrl` on open; if set, the modal skips the toggle and shows the existing link. User's insight: **the owner's link is replicated to all members.** Confirmed.
- **How the link replicates (verified in `services/space/inviteService.ts`):** public link format (line 482) `${getInviteUrlBase(true)}#spaceId=${spaceId}&configKey=${configPrivateKeyHex}` — only `spaceId` + the shared `configKey`, both already local to every member. When the owner generates a public invite, the service re-uploads the encrypted+signed space manifest (442-471) with `space.inviteUrl` populated. Non-owners decrypt with their `configKey` and save it via normal sync. So "non-owner sees the link" = "non-owner reads what the owner already published."
- **What non-owners get on mobile:** view + copy + share via in-app DM picker (`ShareInviteSheet`) or system share. **NOT generate/regenerate** — the "Generate New Link" button is rendered but throws `"Only space owners can generate public invites"` at `inviteService.ts:303-305`. A mobile UX bug (control that errors on use) we did NOT replicate.
- **Desktop state (verified 2026-06-08):** `Space.inviteUrl` exists in shared (`quorum-shared/src/types/space.ts:69`) and is populated identically; desktop only exposed it via `SpaceSettingsModal > Invites.tsx`, filtered out for non-owners by `Navigation.tsx:32-34`. So non-owners held the data but couldn't see it.
- **Lesson for the workflow:** when a candidate's framing implies "non-owner can do X", check (a) the service-layer gate, (b) whether the synced data already contains the result of an owner action, (c) whether the UI is "do" or "view." A single grep for the service-layer gate would have shortcut to the right framing.

#### #30 Per-space profile bio override — shipped (PR #185, 2026-06-08)

Set a different bio per Space; falls back to global bio when no override. Task file: [`.done/2026-06-08-port-per-space-bio.md`](.done/2026-06-08-port-per-space-bio.md).

- **2026-06-08 — ✅ Shipped.** Surfaced by user during session — not in the original 2026-06-01 sweep because the editor lives inline inside mobile's `SpaceSettingsModal.tsx`, not as a standalone hook/screen. Desktop already had per-space displayName + avatar override; bio was the missing third leg. Mobile sources: `components/SpaceSettingsModal.tsx`, `services/space/spaceMessageService.ts` (`SendUpdateProfileParams.bio`), `context/WebSocketContext.tsx` (upsert-aware receive handler).
- **Bundled:** receive-side upsert-aware merge fix in `MessageService.ts` (mobile already had this — desktop was clobbering partial updates), bio render in `UserProfile.tsx`, self-fallback to `UserConfig.bio`, modal positioning viewport clamp. Two follow-up tasks filed (Floating UI positioning refactor, UserProfile layout polish). Mobile follow-up dropped to converge bio caps (160/256/280 → shared `MAX_BIO_LENGTH=160`).

### Won't port ❌

#### #2 Message search — ruled out (Class E)

- **2026-06-01** — Desktop already has this. `<GlobalSearch>` is embedded in `DirectMessage.tsx` (~844) and `Channel.tsx` (~1529) headers, scoped to the current conversation. Mobile uses in-memory MiniSearch; desktop uses IndexedDB-persisted `SearchService` (arguably better — full history, not just loaded scroll). Same UX, different impl. Not a port.

#### #3 Reply tracking — removed (desktop strictly better)

- **2026-06-01** — Original framing "desktop has no per-channel unread-replies-to-me badge" was wrong (symbol-grep for `useReplyTracking` returned nothing, which misled). Desktop has the capability under different names: `useReplyNotificationCounts`, `useSpaceReplyCounts`, `useAllReplies`, `useChannelMentionCounts`, `NotificationService`, `NotificationPanel`. Strictly better: derived from `MessageDB` (no state divergence vs WebSocket counter), respects `notificationSettings.isMuted` + `isNotificationTypeEnabled('reply')` + per-channel `mutedChannels` + per-thread read state, caps at `9+`. Shipped as a deliberate desktop project ([`.done/reply-notification-system.md`](../.done/reply-notification-system.md)).
- Logged in [`desktop-better-than-mobile.md` #1](desktop-better-than-mobile.md#1-reply-notification-counts) as a future port-to-mobile candidate.
- **Lesson** (now in workflow.md): symbol-grep for the mobile name isn't enough — the same capability can exist under different names and architectures. Capability-verification is now a required step.

#### #4 Last-message-preview + spaces-list sort — won't port

- **2026-06-01** — The hook tracks per-space `{timestamp, preview, senderName}`; the spaces tab reads it to sort by recency + show a last-message preview. **Decision: won't port.** Two reasons:
  1. **Sort conflict.** Desktop follows the Discord model: spaces are commitments, manually ordered with folders, no auto-sort by activity; DMs are inbox-shaped and recency-sorted with favorites pinned. That asymmetry is a deliberate product choice. Mobile's recency-sort fits Telegram's unified-list model. Auto-sort would punish anchor communities when they go quiet and break the user's spatial map.
  2. **Preview snippet + chrome conflict.** Desktop's space sidebar is icon-only (hover = name tooltip). A per-space preview line has no room without expanding chrome, and "last message anywhere in this space" is usually not the meaningful one in a many-channels world. Discord doesn't ship this for the same reason; Telegram does because it mixes 1:1 and group in one list.
- Desktop already has "something happened" signal (the dot on the space icon) — the correct level for Discord-style chrome. Revisit only if a future redesign opens the sidebar.
- **Rule captured** (now in workflow.md): "Port the underlying capability, not the mobile UX pattern."

#### #8 OG metadata — Farcaster-only on mobile ⚠️

- **2026-06-01** — Mobile only uses `useOgMetadata` in `SocialFeedModal.tsx` (Farcaster feed). NOT in `SpaceChatArea`/`DMChatArea`. So it isn't a port of a live chat feature — it'd be a desktop-only extension into chat surfaces. Plus the CORS-bypass-via-Electron-IPC caveat. Re-pick only if Farcaster (#9) goes in scope.

#### #18 Image attachments / media library save — removed (desktop has it, Class E)

- **2026-06-09** — **Decision: removed (Class E).** Mobile's own headers admit it: `services/media/imageAttachment.ts:5` "Mirrors desktop behavior"; `customAssets.ts:5` "Matches desktop behavior." These are ports OF the desktop pipeline.
  - Desktop equivalents: `src/utils/imageProcessing/{unifiedProcessor,compressor,config}.ts`, `src/hooks/business/ui/useCustomAssets.ts`, `src/components/modals/ImageModal.tsx`, and the `useFileUpload`/`useSpaceFileUploads`/`useWebFileUpload` paths.
  - `saveToLibrary` is mobile-OS-specific (`expo-media-library`); on Electron the context menu's "Save Image As…" is the equivalent for free.
- **Constant-diff result:** message-attachment pipeline matches exactly (maxW/H 1200, q0.8, thumbnail threshold 300px, thumbnail max 300px, input cap 25MB, GIF cap 2MB). Emoji dimension differs by design (mobile 128px source vs desktop 36px — desktop renders at fixed CSS sizes, mobile at variable DPR). Sticker differs by design (mobile 512 vs desktop 400). One real minor drift: mobile iterates compression to ≤1MB for E2EE; desktop does a single q0.8 pass. A 20-line follow-up if anyone ever reports oversized attachments.
- **Lesson** (consistent with #3): a mobile service file whose header says "mirrors desktop" is a signal to capability-grep desktop first, before adding the row.

### Already on desktop / not a port (Class E, no action) — #19–#25

Quick rulings from the 2026-06-01 pass; no per-candidate deep-dive warranted.

- **#19 Mention extraction** — desktop has `components/mentions/` + `parseMentions` from shared. Covered.
- **#20 Emoji frecency** — desktop has raw-counts; mobile has exponential-decay. Different algorithms, not a port.
- **#21 Offline mutation queue** — desktop has `ActionQueueService` + persistence in `db/messages.ts`. Different impl on purpose; stays per-app.
- **#22 Biometric / device-bound auth** — mobile-only; WebAuthn is a separate product decision.
- **#23 OTA updates** — Expo OTA vs Electron auto-updater. Different paradigm.
- **#24 Network state detection** — trivial; desktop likely has `navigator.onLine`. Skip unless a need appears.
- **#25 Push notifications stack** — already paused in [quorum-shared-migration roadmap](../quorum-shared-migration/roadmap.md) (notifications convergence, mobile #65). Don't re-open.

---

## Reference

### Classification key

| Class | Meaning |
|---|---|
| **A. Direct port** | Exists on mobile, not on desktop, fits desktop UX, no major architectural shift |
| **B. Port with shared promotion** | A, plus pure logic that could live in shared (do both in one effort) |
| **C. Conditional port** | Fits in principle but needs a deeper decision (architecture, new dep, UX, lead-dev coordination) |
| **D. Won't port** | Doesn't fit desktop UX, or fundamentally mobile-only (iOS NSE, native camera, etc.) |
| **E. Already on desktop** | Looked similar but desktop has it — confirmed and ruled out |

### How to read / how to use

- Each candidate is a **feature**, not a hook. One feature can imply multiple files on both sides. Pick a row from [Actionable now](#actionable-now), read the mobile sources, then draft a `YYYY-MM-DD-port-<slug>.md` task with the concrete file plan.
- **Verification rule (standing):** before drafting a task, grep that the hook/service is actually rendered in mobile's `app/` or `components/` (not just defined). Defined-but-unused = not a shipped feature; flag it instead of porting blind. And on the desktop side, capability-grep before assuming a gap — same capability can exist under a different name (see #3, #18).
- **Port the capability, not the UX pattern.** Desktop has different chrome and a different UX model (Discord-style spaces + DMs split) than mobile (Telegram-style unified list). A feature shipping on mobile means the *capability* is real; whether the *UX pattern* fits desktop is a separate judgment (see #4).

### Notes from the 2026-06-01 inventory pass

- Mobile uses an Expo Router structure (`app/` with route folders), NOT `src/`. Tabs live in `(tabs)/`, onboarding in `(onboarding)/`.
- The 2026-05-28 "catching up public repo" commit (`98d59a4`) gave us this dataset. Mobile's public mirror was ~4 months stale before that — pre-dump audits in the shared-migration folder are out of date.
- Desktop has more mature primitives for the chat surface than mobile in some areas (modals, threads, replies), so chat-side ports often find desktop has 80% of the substrate, just missing the specific hook.
- The wallet/QNS/calling/Farcaster cluster is product-scope territory — see [Awaiting a product-scope call](#awaiting-a-product-scope-call).
- **Verified by grep (2026-06-01, re-confirmed 2026-06-10):** desktop has no `wallet`, `farcaster`, `QNS`, `governance`, `miniapp`, `SocialFeed`, `livekit`, `audio space`, `biometric`, `OTA`, `report`, `skins`, `reply tracking`, `space activity`, `discover spaces` (now shipped), `OG metadata`, `useMessageSearch`, `publicProfile`/`isProfilePublic` UI consumer (now shipped).
- Desktop already has: `usePinnedMessages`, `useDMMute`, `useDMFavorites`, embed UI for YouTube, `SearchService`, `ActionQueueService`, full `bookmarks/channels/conversations/dm/files/folders/invites/mentions/messages/replies/search/spaces/threads/validation` hook trees.

---

*Last updated: 2026-06-10 — **QNS-username scoped slice of #12 shipped** (PR #190): DM search by `@username`, profile `.q` display, `.q`-suffix validation. Updated #12's status-board row + notes; display-model (A vs B) and mentions remain in flight pending a lead-dev call. See [`2026-06-10-qns-username-display-plan.md`](2026-06-10-qns-username-display-plan.md) PROGRESS section.*

*Previously: 2026-06-10 — **Reorganized by actionability instead of by candidate number.** New top-level structure: Quick status board → Actionable now → Awaiting a product-scope call → Resolved archive → Reference. All per-candidate decision notes preserved (moved, not deleted) into the relevant section. Re-verified against `main` at `aac8d0a8`: PR #187 (settings revamp) + #188 (profile sync) did not change any open candidate's status; reporting and skins remain absent from `src/` (Appearance.tsx now ~99 LOC, still theme+accent+language only). User call: both #5 Reporting and #27 Skins are low priority — actionable list is intentionally empty, nothing in flight. Added #30 Per-space bio to the shipped archive (it had a row in the table but no notes block).*
