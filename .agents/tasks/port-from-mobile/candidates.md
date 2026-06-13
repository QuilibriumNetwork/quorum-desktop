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
| **31** | Onboarding key import: paste hex / paste 24 words | A / B | 🟢 / ❔ | Desktop's `ImportKeyStep` is file-upload-only; mobile also offers paste-hex + recovery-phrase. **Hex-paste half is engineering-ready** (SDK `importKeyFile` already parses a 114-char hex string — UI-only). **24-words half needs a product call** (BIP-39 derivation lives only in mobile; recoverability-asymmetry question). Logged 2026-06-11, not yet built (user call). |
| **7** | Profile prefs | C | ❔ | Sub-feature of #6; scope to that effort. |
| **27** | Skins (custom themes) | B/C | ❔ | Large skin engine + gallery on mobile. Low priority but **scope partly decided 2026-06-11: full parity incl. geometry, app-wide.** **Deep dive done** ([`2026-06-11-skins-deep-dive.md`](2026-06-11-skins-deep-dive.md)): engine is a clean shared promotion; colors/fonts/accent apply trivially (CSS vars, minor accent 3→11-stop interp); geometry is the big chunk (Tailwind+SCSS → CSS-var bridge + regression). New open dimension: **cross-device skin sync** (opt-in, off by default, explore "smart" layered sync — §10). Phases 0–4 ~12–18 eng-days; sync is Phase 5. |
| **28** | On-device translation | C | ❔ | Re-implementation, not a port (native engines are mobile-only). Needs product-scope call. |
| **9** | Farcaster integration | C | ❔ | Multi-week social bridge. Gating product decision for #10, #11, #26, #17-Hegemony. |
| **10** | DM ↔ Farcaster casts unification | C | ❔ | Sub-feature of #9. |
| **11** | Scam / spam filter | C | ❔ | Likely Farcaster-specific. Re-evaluate after #9. |
| **12** | QNS marketplace + auctions | C | ❔ / ✅ | Full marketplace still ❔ a product call. **Resolution slice fully shipped on desktop** (PR #190 + #195, 2026-06-10/11): DM search by `@username`, `.q`-suffix validation, Model-B name override (`name.q` overrides display name), mentions by QNS name. Live `.q` dormant pending 2 mobile bugs (publishing the field). |
| **13** | Multi-chain wallet | C | ❔ | Massive. Needs "does desktop want a wallet?" decision. |
| **14** | Calling stack (1:1 voice/video) | C/D | ❔ | WebRTC works in-browser; heavy UX work. Scope call. |
| **15** | Audio spaces (LiveKit) | C/D | ❔ | LiveKit web SDK exists. Scope call. |
| **16** | Mini-apps + in-app browser | C | ❔ | Electron has a browser engine; could reframe. Scope call. |
| **17** | Governance | C | ❔ | Includes the Farcaster-coupled Hegemony view. Scope call. |
| **26** | Onboarding refinements | C | ❔ | `privacy-setup` is a small win; `farcaster-setup` gated on #9. |
| **32** | Hub-log sync transport (replace desktop P2P) | C | ❔ | Mobile replaced P2P mesh sync with a server-side per-hub log (`listen-hub`/`log-since`/`log-append`); desktop still runs P2P (needs an online peer to backfill history). Medium effort (~4–8 eng-days). **Lead-dev call** — architecture + privacy tradeoff (server retains sealed history). User won't self-pick (2026-06-11). |
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

### #31a Onboarding: paste private key (hex) — 🟢 engineering-ready

Desktop's onboarding lets you import an existing account **only by uploading a `.key` file** ([`src/components/onboarding/steps/ImportKeyStep.tsx`](../../../src/components/onboarding/steps/ImportKeyStep.tsx) — drag-and-drop / file picker, `.key` only). Mobile additionally lets you **paste the raw hex private key** ([`quorum-mobile/components/onboarding/HexInputView.tsx`](../../../../quorum-mobile/components/onboarding/HexInputView.tsx) + a "Private Key" tab in [`account-setup.tsx`](../../../../quorum-mobile/app/(onboarding)/account-setup.tsx)). That paste path is missing on desktop. Surfaced by the user 2026-06-11; not previously in this list.

- **Capability-verified missing on desktop.** `ImportKeyStep` has no text input — only `FileUpload`. The unified flow ([`useUnifiedOnboardingFlow.ts`](../../../src/hooks/business/user/useUnifiedOnboardingFlow.ts)) exposes a single import entry, `importKeyFile(file: File)`, which proxies straight to the SDK's `usePasskeyFlow.importKeyFile`. There is no `importFromHex` on desktop.
- **Why this is nearly free — the SDK already parses hex.** Read the SDK's `importKeyFile` body (`@quilibrium/quilibrium-js-sdk-channels`, `dist/index.js`): it reads `file.arrayBuffer()` and branches on the contents —
  1. exactly **57 bytes** → raw ed448 private key (hex-encoded internally),
  2. otherwise UTF-8 text trimmed; if it's **114 hex chars** → used directly as the private key,
  3. if it starts with `{` → parsed as JSON `{ private_key: number[] }`.

  So a pasted 114-char hex key works **through the existing path** by wrapping the string in a synthetic `File`: `flow.importKeyFile(new File([hex], 'imported.key'))`. **No new SDK surface, no crypto, no shared promotion.**
- **Scope = UI only.** Add a "paste private key" affordance to `ImportKeyStep` (tab or secondary input alongside the dropzone): a textarea, client-side validation mirroring mobile (`replace(/^0x/i,'').replace(/\s/g,'').toLowerCase()`, require exactly 114 hex chars, friendly too-short/too-long messages), then construct the `File` and call the existing `flow.importKeyFile`. Reuse the existing `flow.importError` display.
- **Companion: copy private key (hex) in settings — same PR.** Desktop's [`Security.tsx`](../../../src/components/modals/UserSettingsModal/Security.tsx) "Key Export" only **downloads** the `.key` file; there is no copy. Mobile copies the key to the clipboard ([`ProfileModal.tsx` `handleCopyRecoveryPhrase`](../../../../quorum-mobile/components/ProfileModal.tsx)). `getPrivateKeyHex()` **already exists** on desktop and is already wired into `Security.tsx` (it feeds the QR), so a copy button reuses it — UI-only, no plumbing. Symmetric with the paste-in capability, so they belong in one PR. Note the asymmetry: desktop has no mnemonic store, so copy is **hex-only**, never 24 words (mobile copies the mnemonic when present). Also requires deliberate **Security-tab UI consolidation** (download file + copy key + show QR are three actions on the same secret — group them).
- **Class A** (UI/data port, capability already supported underneath). Single small PR. Belongs here in Actionable now.
- **Not built yet (user call, 2026-06-11):** task drafted — [`2026-06-11-port-key-paste-import-and-copy-export.md`](2026-06-11-port-key-paste-import-and-copy-export.md). No PR in flight. Pairs with #31b below (same import surface), but #31a + copy-export can ship standalone.

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
- **2026-06-10 — Scoped slice picked up: QNS usernames (display + search + mention).** Rather than waiting on the full marketplace decision, brainstormed a scoped slice that pulls in ONLY QNS resolution (1 endpoint, `GET /resolve/:name`), not registration/auctions/pricing. Covers four surfaces: DM-search-by-`@username` (the one true port), profile `.q` display (net-new — mobile scaffolds but never plumbs `primaryUsername` to the in-space view), mention-by-username (net-new — mobile never does it), and dot-validation to make the `.q` trust signal unspoofable (net-new — mobile has none). Single shared resolution helper as the spine. Sourcing mirrors mobile (Route A: `primary_username` rides in the published profile, no live reverse-lookup). Design doc: [`.done/2026-06-10-qns-username-display-design.md`](.done/2026-06-10-qns-username-display-design.md). Ground-truth confirmed via live QNS site: names cannot contain dots, which makes the dot-validation airtight.
- **2026-06-10 — ✅ Shipped the slice (PR #190).** Merged to `main`: DM search by `@username` (verified live: `lamat` → `QmVYRWm…YvPY`, the real address), `.q`-suffix validation on display-name inputs, and a Model-A profile `.q` render. Shared support landed in `quorum-shared` #35/#36 (`2.1.0-27`). The `@username` DM gap is now **closed**. Full state: [`.done/2026-06-10-qns-username-display-plan.md`](.done/2026-06-10-qns-username-display-plan.md).
- **2026-06-11 — ✅ Desktop complete (PR #195).** Lead dev (Cassie) confirmed **Model B**: the elected QNS `primary_username` overrides the typed display name everywhere, except a per-space custom name. PR #195 converted every name-render surface (DM/channel/thread/notifications/reactions/profile) to the shared resolution rule and added **Stage 4 mentions** (autocomplete + pill render `name.q`, wire format stays `@<address>`). Search results + bookmarks card deliberately deferred (different data source, low value). All desktop work merged; tsc/build/lint green, 10/10 unit tests. **Remaining is mobile-only:** live `.q` stays dormant until mobile publishes `primary_username` (2 mobile bugs in `quorum-mobile/.agents/bugs/`). Non-blocking open call: `primary_username` in message broadcast vs public-profile-only (`project_qns_username_broadcast_pending` in memory). Plan: [`.done/2026-06-11-qns-username-overrides-display-name-plan.md`](.done/2026-06-11-qns-username-overrides-display-name-plan.md).

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

### #31b Onboarding: paste recovery phrase (24 words) — ❔ needs a product call

The mnemonic half of #31 (see #31a in [Actionable now](#actionable-now) for the hex-paste half). Mobile lets you import an account by **pasting a BIP-39 recovery phrase** ([`quorum-mobile/components/onboarding/MnemonicInputView.tsx`](../../../../quorum-mobile/components/onboarding/MnemonicInputView.tsx) + a "Recovery Phrase" tab in [`account-setup.tsx`](../../../../quorum-mobile/app/(onboarding)/account-setup.tsx)). Desktop has no equivalent.

- **Why this is materially more than #31a.** The BIP-39 → ed448 derivation lives **only in mobile's [`quorum-mobile/services/onboarding/keyService.ts`](../../../../quorum-mobile/services/onboarding/keyService.ts)** (`keyPairFromMnemonic`, `generateMnemonic`, on `@scure/bip39` + `@noble/curves`). It is **not in the SDK** (`usePasskeyFlow` has no mnemonic concept) and **not in `quorum-shared`**. Porting means promoting that pure derivation into shared, then feeding the derived hex into the same `importKeyFile` path as #31a. The functions are pure and portable (no RN deps), so the shared promotion is clean — but it is real work + a `quorum-shared` PR, not a UI-only change.
- **The product call (recoverability asymmetry).** Mobile treats the **mnemonic as the primary recoverable secret** and derives the key from it; there is an explicit comment chain in `OnboardingContext.tsx` ("mnemonic → key is recoverable, key → mnemonic is NOT"). Desktop's storage model is passkey-wrapped key + `.key` export — it has no mnemonic store. If desktop lets a user onboard *via* a mnemonic, desktop still won't be able to hand that mnemonic back later (it'll only ever export the `.key`). That's acceptable, but it's a deliberate decision: are we offering "paste your phrase to import" as a one-way convenience, or implying full phrase-based recovery parity with mobile? **Defer to the lead dev** (user call, 2026-06-11).
- **Dependency:** ships on the same `ImportKeyStep` surface as #31a, so #31a should land first (or together). #31a does not depend on this.

### #32 Hub-log sync transport (replace desktop P2P) — ❔ lead-dev architecture call

**Unusual candidate: this is a transport *replacement*, not a missing feature.** Mobile and desktop currently deliver and back-fill space chat messages by **different mechanisms**, and desktop is the divergent one. Surfaced 2026-06-11 while investigating "joined a space, see no messages and only myself" (which is the expected cold-start on both clients — see [data-management-architecture-guide.md → Cold-start when joining a Space](../../docs/data-management-architecture-guide.md#cold-start-when-joining-a-space-expected-no-messages-only-me) and the [Cross-client divergence](../../docs/quorum-shared-architecture.md#cross-client-divergence-desktop-p2p-vs-mobile-hub-log) section). User won't self-pick — likely the lead dev's to do — but worth tracking.

- **The divergence (verified 2026-06-11, both repos):**
  - **Desktop** uses P2P mesh sync — `sync-request` → `sync-info` → `sync-initiate` → `sync-manifest` → `sync-delta` via `SharedSyncService` ([`src/services/SyncService.ts`](../../../src/services/SyncService.ts), wired through [`MessageService.ts`](../../../src/services/MessageService.ts) + [`MessageDB.tsx`](../../../src/components/context/MessageDB.tsx)). History only back-fills if **another member is online** to serve it (~30s window). No online peer = no back-fill.
  - **Mobile** removed P2P entirely and uses a **server-side per-hub log** — WebSocket frames `listen-hub`/`log-since`/`log-append`/`log-update` ([`quorum-mobile/services/space/hubLogSync.ts`](../../../../quorum-mobile/services/space/hubLogSync.ts), [`hubLogCursor.ts`](../../../../quorum-mobile/services/space/hubLogCursor.ts), `WebSocketContext.tsx` `ingestEntries`/`requestLogSince`). The server replays the retained log from a stored cursor, so a joiner gets recent history **even with no peer online**. P2P sync handlers are gone (dead imports + code comments confirm "peer-to-peer mesh sync is gone").
- **Why migrating desktop is attractive:** removes the "empty until a peer is online" cold-start; enables background/push-driven delivery; converges the two clients onto one transport so the ecosystem doc stops needing a divergence caveat.
- **The product/privacy tradeoff (the actual decision):** P2P keeps message history **only on members' devices** (no server retention — aligns with the "no central server stores your messages" positioning on the landing page). Hub-log means the **server retains the sealed (encrypted) log**. Content stays E2EE either way, but it shifts where history lives and how long the server holds it. For a privacy-first product this is a deliberate philosophical call, not a pure engineering one — and it's the lead dev's to make. Also unresolved: which direction is the intended end state (desktop → hub-log, or mobile eventually back to P2P)?
- **Effort if greenlit: MEDIUM (~4–8 eng-days for someone fluent in both codebases).** Verified scope:
  - **Reuse:** message sealing/unsealing + IndexedDB persistence are identical — log-delivered messages land through desktop's existing `UnsealHubEnvelope` + Triple-Ratchet path. **No schema migration, no crypto rewrite.**
  - **Port from mobile (~150 LOC):** hub-log frame builders (`buildListenHubFrame`/`buildLogSinceFrame` — adapt the signing call from RN native module to desktop's `secureChannel` WASM), the per-hub cursor store (swap MMKV → `localStorage`/IndexedDB), and the `ingestEntries` + gap-detection cursor-advance logic (subtle — must reproduce exactly).
  - **WS layer surgery:** [`WebsocketProvider.tsx`](../../../src/components/context/WebsocketProvider.tsx) has zero hub-log frame awareness — needs a frame-type discriminator + a `listen-hub`/`log-since` resubscribe on reconnect (currently only sends `{ type: 'listen', ... }`).
  - **Send-path change (small):** desktop emits `{ type: 'group', ... }`; switch to `{ type: 'log-append', ... }` — a string constant in ~4 places (payload bytes are identical).
  - **Removal (largest blast radius):** delete `SyncService.ts` (clean, 993 LOC), the 7 sync-* handlers in `MessageService.ts` (~400 LOC, interleaved with useful ingest paths — care needed), the startup/reconnect `requestSync` loop, the "Syncing…" toast lifecycle, and the `requestSync` surface of `MessageDBContext` (4 call sites incl. the SpaceSettings "Sync" button).
- **Two unknowns that must be confirmed before any work (not answerable from desktop source):** (1) is the server-side hub-log transport **enrolled for desktop's hub addresses**? A mobile code comment says the server already dual-writes legacy `group` messages into the log, which suggests yes — but confirm at the infra layer. (2) Is hub-log the **intended convergence target**? Both are lead-dev/infra questions.
- **Class C** (architectural shift + new transport + lead-dev coordination). Not engineering-ready until the two unknowns and the privacy tradeoff are resolved.
- **History:** 2026-06-11 surfaced during the cold-start investigation; user explicitly won't self-pick, parked for the lead dev.
- **2026-06-13 — this migration is the fix for a cluster of open bugs.** Confirmed (lead dev intends to bring the hub log to desktop) that #32 resolves the recurring desktop "fetch-once-at-startup, never reconcile" pattern. Bugs that depend on or are reframed by it:
  - [space-members-missing-no-join-row](../../bugs/2026-06-13-space-members-missing-no-join-row.md) — ~52% of members have no roster row because `join` is an ephemeral one-shot broadcast (this candidate's exact P2P weakness). Includes a **control-handler replay audit** listing the receive handlers (`verify-kicked`, `leave`, several `space!` derefs) that must be made upsert/null-safe **before** the log replays every message on reconnect. PR #199 already hardened the `update-profile` + non-repudiability paths as groundwork.
  - [config-not-refetched-stale-until-restart](../../bugs/2026-06-13-config-not-refetched-stale-until-restart.md) — hub-log replay of config-sync signals IS the websocket-driven refetch that bug needs.
  - [config-sync-space-loss-race-condition](../../bugs/2026-01-09-config-sync-space-loss-race-condition.md) — narrows the failure surface (still needs its own `saveConfig` merge fix).
  - [readonly-channel-receive-side-enforcement-gaps](../../bugs/2026-06-12-readonly-channel-receive-side-enforcement-gaps.md) — **prerequisite**: replay re-persists blocked content every reconnect unless durable-path enforcement is added first.
  - Meta-pattern + the two receive-side prerequisites documented in [dm-architecture-and-debug-playbook.md](../../docs/debugging/dm-architecture-and-debug-playbook.md) ("fetch-once-at-startup pattern").

### #27 Skins (custom themes) — ❔ needs UX call (low priority 2026-06-10)

Bundled samples + locally-saved skins + server gallery. Per-skin: color tokens (accent/surfaces/text/semantic), radii/spacing/borders (with global `scale`), `fontScale`, embedded font face, icon substitution map, wallpaper (cover/tile/contain + scrim), frame chrome, per-region surface backgrounds. All input validated against an allow-list (`validate.ts`) with image content-sniffing. Server gallery is Ed448-signed publish.

Mobile sources: `components/skins/SkinsModal.tsx` + `SkinEditor.tsx`, `services/skins/skinsClient.ts`, `services/theme/skinPrefs.ts`, `theme/skins/{types,validate,mergeSkin,geometry,samples,surfaces,fontLoader,skinnableStyleSheet,frame}.ts`, `components/ui/{AppBackground,SkinTouchable}.tsx`.

- **2026-06-08** — **New candidate, surfaced in the re-audit after the 2026-06-01 mobile bulk merge (`56ffd31`).** User flagged this directly: "one thing that is new in the mobile repo, for instance, is skins. So possibility to choose a skin for your space. A theme."
- **2026-06-10** — User call: low priority right now. Keep on the board (capability gap is real and interesting), don't scope yet.
- **2026-06-11 — Deep dive done** (not urgent, context-gathering): [`2026-06-11-skins-deep-dive.md`](2026-06-11-skins-deep-dive.md). Verified both codebases in full. Key findings: (1) the engine (`validate.ts` 488 LOC security boundary + `types.ts` + `mergeSkin.ts` + pure `deriveGeometry` + `samples.ts`) is pure RN-free TS and a **clean shared promotion** — should move to shared regardless of the desktop decision, to de-dup the security boundary. (2) **Colors/accent/fonts apply to desktop trivially** — desktop already drives every color through `:root` CSS custom properties (`--surface-*`/`--accent-*`/`--color-text-*`) with semantic composites cascading off them, so a skin injects via `root.style.setProperty(...)` with no build change; embedded fonts via the FontFace API. (3) **Geometry is the one genuinely hard part**: mobile re-skins radii/spacing through a single `Skin.radius()`/`space()` chokepoint every component calls, but desktop bakes geometry into **both** compiled SCSS vars **and** pervasive Tailwind utility classes (`rounded-lg`, `p-4`) — runtime scaling needs an app-wide Tailwind-theme→CSS-var bridge + full regression. (4) Ed448 publish reuses desktop's existing `PublicProfileService.signWithUserKey` verbatim (the **third** call site for the canonicalize-then-sign helper promotion, after #5/#6). **Cheapest high-value increment = Phase 0 (shared promotion) + Phase 1 (colors/fonts/accent skin engine + import/export + samples), ~3–5 days, zero architectural risk.**
- **2026-06-11 — user decisions after reviewing the deep dive:** (1) **Full parity — geometry IS in scope** (not a scope-cut); app-wide, mirrors mobile. Geometry becomes Phase 2 (the big chunk: Tailwind+SCSS → CSS-var bridge + full visual regression). (2) Agreed on the `quorum-shared` promotion of `validate.ts`/`types.ts`/`mergeSkin.ts`. (3) The mobile `IconSymbol` crash is **already fixed** with a temporary wrapper, so icon-primitive convergence is a bonus (Phase 4), not a blocker.
- **2026-06-11 — verified the color-token mismatch the user flagged:** surfaces are 11 (mobile) vs 12 (desktop, extra `--surface-00`) → map `surfaceN → --surface-N` 1:1, leave `--surface-00` un-skinned in v1. The real mismatch is **accent**: a skin carries only 3 control points (`accent`/`accentLight`/`accentDark`) but desktop renders an 11-stop ramp → needs a small pure interpolation helper (recommend injecting the 3 anchors + interpolating the rest). Text + semantic tokens match 1:1. Full mapping table in §6 of the doc.
- **2026-06-11 — cross-device behaviour DECIDED (§10 of the doc):** (a) **active-skin sync = won't-do** — it would force fragile *rendering* pairing across form factors (a phone wallpaper/spacing can be wrong on desktop) for marginal gain; the active skin stays **device-local on both platforms**, matching desktop's existing theme/accent behaviour (localStorage, not synced `UserConfig`). The former "Phase 5 sync" is **removed, not deferred.** (b) **The gallery is unavoidably shared** (one `/skins` endpoint, both apps publish/install) **but couples only on the SCHEMA, not on rendering** — once both apps validate against the same promoted `validate.ts`/`types.ts`, a skin from either app installs on either, and each app **applies what it supports and silently ignores the rest** (the manifest is already designed this way: "unwired slots are ignored"). So the feature is **additive**, not feature-paired. One consequence: a desktop user installing a richer mobile skin sees a flattened version = **acceptable graceful degradation**, not a bug (mild argument *for* the full-parity-incl-geometry build). This makes Phase 0 (shared validator) doubly load-bearing: security de-dup + the contract that lets a shared gallery work without rendering pairing.
- **2026-06-11 — geometry surface audit done (§4a of the doc), downgrades geometry 🔴→🟡.** Measured `quorum-desktop/src`: radii = 202 Tailwind `rounded-*` + 152 SCSS `$rounded-*` + 42 raw literals (of which only **13** are real px/rem to clean up; 29 are intentional circles/pills). Spacing = ~1,161 Tailwind + ~850 SCSS. **Tailwind uses DEFAULT scales (no `extend` override)**, so the whole bridge is **~3 files** (one `tailwind.config.js` block re-routes all utility usages at once + one `_variables.scss` token-def rewrite + `:root` var defaults) — NOT a per-component refactor. Confirmed the user's hunch: rounding clusters in buttons/modals/message/dropdowns, no sprawling rounded-surface problem. **Phase 2 revised to ~3–5 days** (code ~1–2d, regression QA ~2–3d); full-parity total Phases 0–4 ≈ **10–15 eng-days** (down from 12–18). Conservative v1 option: scale radii+borders, defer `spacing.scale` (scaling all padding is higher visual risk). **Verdict: full skins incl. geometry is clearly doable; no architectural blocker.**
- **2026-06-11 — color-input UX + existing-color-picker interaction (§6a of the doc):** (Q1) Mobile's skin editor is **bare hex text entry** (a `TextInput`, `placeholder="#hex / inherit"`, 5 exposed tokens of 22) — no visual picker, no palette. Desktop optimization opportunity: ship a real `<input type="color">`/HSV picker + grouped tokens + a one-knob "tint" mode (reuse the accent ramp interpolation). Editor-only, doesn't touch the shared manifest. (Q2 — the important one) Desktop's folder/channel/icon colors are stored as **named tokens** (`'blue'`/`'purple'`/…, `IconPicker/types.ts` `ICON_COLORS`/`FOLDER_COLORS`), NOT raw hex — good, because intent is preserved and can be re-resolved per skin. **But** `getIconColorHex`/`getFolderColorHex` resolve to **hardcoded hex literals**, so today they're frozen and would clash under a skin (a "blue folder" stays `#5f8eeb` under Midnight Neon). **DECIDED fix = Option B (hue-locked legibility nudge), NOT retinting.** User's hard constraint: a chosen color's **hue is deliberate intent and must never be repainted** (a red "incidents" channel icon stays red under every skin; a user's folder color-coding is preserved). The skin may adjust *only* lightness *only* when the color would be unreadable on its surface. Mechanism: bridge the 16 literals to `--icon-color-*`/`--folder-color-*` vars (defaults = current literals → zero change w/o a skin), then a conditional **OKLCH lightness-only** nudge in the two resolver functions — hue+chroma locked, fires only when contrast against the actual surface fails, minimum correction (so on normal skins colors are untouched; on extreme neon/near-black/light skins they stay legible). ~1.5–2 days incl. an in-browser tuning pass against the sample skins (threshold tuning is the only part needing eyeballing). **Self-contained: no manifest/validator/shared/gallery change.** (Option A = leave fixed — rejected, legibility risk; Option C = per-skin replacement palette — deferred, re-introduces repaint-intent risk.) Net-new desktop work, Phase 1.
- **2026-06-11 — Phase 0+1 implementation task drafted:** [`2026-06-11-port-skins-phase-0-1.md`](2026-06-11-port-skins-phase-0-1.md). Scoped to the ready slice (shared promotion of the pure engine + desktop colors/fonts/accent engine + Skins settings tab + import/export + Option-B folder-color nudge), ~3–5 days, zero architectural risk. Still not-started (low priority); ready to pick up when prioritized.
- **2026-06-11 — Phase 2 geometry-bridge SPIKE done (verified, deep dive §4a-bis).** Threw a throwaway Tailwind+SCSS var bridge and compiled it: (1) Tailwind `borderRadius`→`var()` emits correctly, `rounded-full`/`none` stay fixed; (2) the scary utilities survive — `-mt-4`→`calc(var(--s-4)* -1)`, `space-x-4`→nested `calc()` with the var, both valid; (3) **`_variables.scss` bridges in lockstep** (SCSS var holding a `var()` compiles + flows through `@use` consumers like `Button.scss`) — so Tailwind AND SCSS route through the same `--*` vars, no divergence; (4) **one silent gotcha:** bare SCSS `+` on a geometry var compiles to broken `var()var()` (no error) — audited to **exactly 3 lines** (`Input.scss:103,273`, `_dropdown-result-item.scss:218`), fix = wrap in `calc()`; (5) raw-literal cleanup surface ≈ 30 spacing + 1 border. **Phase 2 has NO architectural unknown** — estimate holds ~3–5 days, ready to plan when Phase 1 lands. **Only genuine remaining external unknown across all phases = is the `/skins` gallery endpoint live for desktop (Phase 3, lead/infra question).**
- Remaining smaller open calls (not blockers): editor-on-day-1 vs import-only first; gallery v1 or later (+ is `/skins` endpoint live for desktop?); `fontScale` strategy for Tailwind fixed-px text; scale-spacing-in-v1 vs radii+borders-only.
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
- **🔗 Ties into the mobile icon-primitive migration (2026-06-10).** Mobile is migrating its `IconSymbol` onto shared's `Icon` primitive (`quorum-mobile/.agents/tasks/2026-06-09-migrate-iconsymbol-to-shared-icon-primitive.md`). The blocker there is that shared's `Icon` has **no skin icon-substitution path**, which is part of *this* skin engine. Mobile's interim plan is a thin local `Icon` wrapper that keeps the `activeSkin.icons[name]` lookup and delegates rendering to shared's `Icon`. **If #27 is ever taken on, the icon-substitution layer should move into shared's `Icon` (skin-aware rendering driven by shared theme/skin context) at the same time** — that lets mobile delete its wrapper and gives desktop icon-skinning for free. Conversely, if #27 is never done, the mobile wrapper is the permanent home for icon-skinning and shared's `Icon` stays skin-agnostic. Either way the mobile migration is unblocked; this note records that the icon-primitive rework rides along with the skin port.

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
- Logged in [`../port-to-mobile/candidates.md` #1](../port-to-mobile/candidates.md#1-reply-notification-counts--convergence) as a future port-to-mobile candidate.
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

*Last updated: 2026-06-12 — **#12 QNS usernames marked desktop-complete.** Lead dev confirmed Model B (2026-06-11); PR #195 shipped the override + Stage 4 mentions on top of PR #190's resolution slice. Updated #12's status-board row (now ❔/✅) and notes, added the 2026-06-11 shipped entry, repointed the QNS doc links to `.done/` (all three QNS docs archived). Remaining work is mobile-only (publishing `primary_username`, 2 mobile bugs); the broadcast-vs-public-profile privacy call is non-blocking (`project_qns_username_broadcast_pending`).*

*Previously: 2026-06-11 — **#27 Skins deep dive + user decisions.** New report [`2026-06-11-skins-deep-dive.md`](2026-06-11-skins-deep-dive.md) maps both codebases in full. Engine = clean `quorum-shared` promotion (pure `validate.ts`/`types.ts`); colors/fonts/accent apply trivially via existing `:root` CSS vars (minor: accent 3→11-stop ramp interp). **User decided: full parity incl. geometry** (Phase 2, the big chunk — Tailwind+SCSS → CSS-var bridge + regression), shared promotion agreed, mobile icon crash already fixed (convergence is a bonus). Verified the color-token mismatch the user flagged: surfaces 11-vs-12 map 1:1 (`--surface-00` un-skinned v1), accent is the real mismatch (3 points vs 11-stop ramp), text/semantic match. **New dimension raised: cross-device skin sync** — opt-in, off-by-default acceptable, but explore "smart" layered sync (portable color/font layer synced, form-factor wallpaper/geometry per-device); transport via gallery-skin id in `UserConfig`; scoped Phase 5, not yet designed (§10). No status change (still ❔/low priority, now with a decided scope direction).*

*Previously: 2026-06-11 — **Added #32 Hub-log sync transport (replace desktop P2P).** Surfaced during the "joined a space, see no messages / only me" cold-start investigation. Mobile replaced P2P mesh sync with a server-side per-hub log (`listen-hub`/`log-since`/`log-append`); desktop still runs P2P and needs an online peer to back-fill history. Verified scope in both repos: MEDIUM effort (~4–8 eng-days) — reuse sealing/persistence, port ~150 LOC of hub-log transport from mobile, WS-layer frame routing, swap send frame `group`→`log-append`, remove `SyncService.ts` + 7 sync-* handlers. Class C — lead-dev architecture + privacy call (server retains sealed history vs. P2P device-only), plus two infra unknowns (is desktop's hub enrolled in the log? is hub-log the convergence target?). User won't self-pick. Status-board row added. Cross-refs the two corrected architecture docs.*

*Previously: 2026-06-11 — **Drafted the #31a task** ([`2026-06-11-port-key-paste-import-and-copy-export.md`](2026-06-11-port-key-paste-import-and-copy-export.md)) and folded in the **copy-private-key companion**: desktop's Security tab can only download the `.key` file, while mobile copies the key to clipboard; `getPrivateKeyHex()` already exists and is wired into `Security.tsx` (feeds the QR), so copy is UI-only. Symmetric with paste-in → one PR, plus a deliberate Security-tab UI consolidation (download file + copy key + show QR are three actions on the same secret). #31b (24 words) stays parked on a lead-dev call.*

*Previously: 2026-06-11 — **Added #31 Onboarding key import (paste hex / paste 24 words).** Surfaced by the user; not previously listed. Split into #31a (paste hex private key — 🟢 engineering-ready, UI-only: the SDK's `importKeyFile` already parses a 114-char hex string, so wrapping pasted text in a synthetic `File` reuses the existing path) under Actionable now, and #31b (paste 24-word recovery phrase — ❔ needs a product call: BIP-39→ed448 derivation lives only in mobile's `keyService`, needs shared promotion + a recoverability-asymmetry decision) under Awaiting a product call. Status-board row added. Not built yet (user call): logged for prioritization.*

*Previously: 2026-06-10 — **QNS-username scoped slice of #12 shipped** (PR #190): DM search by `@username`, profile `.q` display, `.q`-suffix validation. Updated #12's status-board row + notes; display-model (A vs B) and mentions remained in flight pending a lead-dev call (since resolved 2026-06-11 → Model B, PR #195). See [`.done/2026-06-10-qns-username-display-plan.md`](.done/2026-06-10-qns-username-display-plan.md).*

*Previously: 2026-06-10 — **Reorganized by actionability instead of by candidate number.** New top-level structure: Quick status board → Actionable now → Awaiting a product-scope call → Resolved archive → Reference. All per-candidate decision notes preserved (moved, not deleted) into the relevant section. Re-verified against `main` at `aac8d0a8`: PR #187 (settings revamp) + #188 (profile sync) did not change any open candidate's status; reporting and skins remain absent from `src/` (Appearance.tsx now ~99 LOC, still theme+accent+language only). User call: both #5 Reporting and #27 Skins are low priority — actionable list is intentionally empty, nothing in flight. Added #30 Per-space bio to the shipped archive (it had a row in the table but no notes block).*
