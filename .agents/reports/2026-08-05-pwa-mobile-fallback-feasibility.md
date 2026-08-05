---
type: report
title: "PWA feasibility — can quorum-desktop serve mobile users if the native apps lose store distribution?"
ai_generated: true
created: 2026-08-05
updated: 2026-08-05
related_docs:
  - "../docs/features/offline-support.md"
  - "../docs/features/desktop-notifications.md"
  - "../docs/features/security.md"
  - "../docs/features/responsive-layout.md"
  - "../docs/cryptographic-architecture.md"
related_tasks:
  - ".agents/issues/.open/2025-12-14-service-worker-app-updates.md"
---

# PWA feasibility — quorum-desktop as the mobile fallback

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Date:** 2026-08-05
**Question:** If Quorum's native mobile apps lose App Store / Play Store distribution, can `quorum-desktop` be turned into a PWA that serves mobile users acceptably? The UI refactor is understood and accepted as a large but tractable cost. **What else breaks?**

**Evidence labelling.** Every claim below is marked **MEASURED** (a recorded
observation), **READ** (read in this repo or in `quorum-mobile`, with a
reference), or **INFERRED** (reasoned to). Unlabelled prose is framing, not a
claim.

---

## TL;DR

1. **The UI is the biggest chunk of work and the lowest risk.** It is visible, reversible, and reviewable by using it. The crypto/storage/push layer is small in code and can invalidate the whole plan. **Sequence the risky small thing first.**

2. **Background message delivery is the structural problem, not the UI.** A backgrounded mobile browser freezes the page within seconds: no WebSocket, no messages, no notifications. Today's notifications are the in-page `Notification` API only (READ, [desktop-notifications.md](../docs/features/desktop-notifications.md)). None of that survives backgrounding.

3. **But the push architecture already fits.** Mobile's push payload carries **only identifiers, no ciphertext** (READ, `quorum-mobile/ios/QuorumNotificationService/NotificationService.swift`). That is content-less push plus local enrichment, which maps onto Web Push + Service Worker almost exactly — and the SW is better positioned than the iOS NSE, because it reads the same IndexedDB the page uses instead of needing an App Group catalog file.

4. **Storage eviction is the silent data-loss risk, and it is live today.** In a Safari *tab*, WebKit wipes IndexedDB after 7 days without interaction. That is the ratchet state, space keys, and message history. **Home-screen-installed PWAs are exempt.** This makes install a data-integrity requirement, not a nice-to-have.

5. **`largeBlob` on Android Chrome is the one unknown that can kill the plan.** The account private key lives in the passkey's `largeBlob` (READ, [privateKey.ts:6](../../src/utils/privateKey.ts#L6)). Support is confirmed on iOS/Safari 17+; Android is unverified. If it fails there, the mobile fallback degrades to pasting a 114-char hex key. **Test this first.**

6. **Android is no longer the easy escape hatch.** Google's developer-verification programme extends to sideloaded APKs and alternative stores (Sept 2026 in four countries, global 2027), with KYC and registered signing keys. Android converges on the same gatekeeper failure mode as iOS. This *strengthens* the PWA case rather than weakening it.

7. **Production is currently GitHub Pages** (READ, `.claude/skills/deploy/SKILL.md`), which is the same unilateral-removal shape as an app store. **Decided in discussion: this is temporary; the app will be served from the Quilibrium network.** That resolves the hosting concern and makes the fallback argument self-consistent.

8. **Residual, not solved by better hosting:** every page load ships fresh JS that touches the private key, with no signed binary and no user-verifiable build. Mitigable (SW build pinning, published build hashes, content-addressed retrieval), not eliminable. Open question for the lead dev in §8.

---

## 1. Why this is being evaluated

The concern is **not** that Quorum does anything unlawful. It is that app stores
have been increasingly hostile to fully-encrypted messengers, and Quorum is past
that bar: E2EE *and* decentralized, with no server-side plaintext for Quilibrium
Inc. to surrender under subpoena.

Quilibrium's public position on abuse prevention is documented at
[docs.quilibrium.com — how Quilibrium protects privacy without enabling crime](https://docs.quilibrium.com/docs/discover/how-quilibrium-protects-privacy-without-enabling-crime/):
verifiable encryption lets a compliance body confirm the presence of illegal
content **without decrypting it**, after which node operators can blacklist the
offending shards; multiple blocklists can coexist so operators sync whichever
matches their jurisdiction. Token lineage uses modified bloom filters to answer
"has this coin touched a flagged address?" as a yes/no without exposing the
address set.

**The asymmetry that matters here (INFERRED):** app store policy teams do not
adjudicate on technical merit. They act on regulatory and PR exposure. A strong
answer does not protect against a decision made by someone who will not engage
with it. That is the case for building a fallback regardless of how good the
argument is.

### Two different threats, often collapsed

| Threat | Speed | Process | Does a PWA help? |
|---|---|---|---|
| **Policy removal** (Apple/Google decide E2EE messengers are a liability) | Immediate | None. No jurisdiction, no appeal that matters | **Yes, fully immune** |
| **Legal takedown of a domain** | Slow | Needs a jurisdiction and a legal instrument; contestable, mirrorable | Partially; mitigated by decentralized hosting |

The first is the one being planned against, and it is exactly the one a PWA
neutralises. An earlier draft of this analysis over-weighted the second.

---

## 2. Current state of the repo

| Item | Status | Evidence |
|---|---|---|
| Web app manifest | **Present**, `display: standalone`, 192/512/maskable icons | READ, `public/manifest.webmanifest` |
| Service worker | **Absent.** No registration anywhere in `src/` or `web/` | READ, repo-wide grep |
| SW tracked as work | Open issue, but scoped to *update detection*, not PWA | READ, [2025-12-14-service-worker-app-updates.md](../issues/.open/2025-12-14-service-worker-app-updates.md) |
| Notifications | In-page `Notification` API, fired from the WebSocket batch handler | READ, [desktop-notifications.md](../docs/features/desktop-notifications.md) |
| Web Push | **Absent.** No VAPID, no push subscription, no SW `push` handler | READ |
| Offline data | IndexedDB-backed, `networkMode: 'always'` on all local queries, Action Queue for offline sends | READ, [offline-support.md](../docs/features/offline-support.md) |
| Catch-up fetch | Exists (`getInbox` / `buildInboxFetcher`) | READ, [buildInboxFetcher.ts](../../src/hooks/queries/inbox/buildInboxFetcher.ts) |
| Responsive shell | 3-column shell, phone ≤767 / tablet 768–1023 / desktop ≥1024, off-canvas drawer on phone | READ, [responsive-layout.md](../docs/features/responsive-layout.md) |
| Key storage | Account key in passkey `largeBlob`; identity keyset, `space_keys`, `encryption_states` in IndexedDB | READ, [privateKey.ts](../../src/utils/privateKey.ts), [cryptographic-architecture.md](../docs/cryptographic-architecture.md) |
| Production hosting | GitHub Pages, `gh-pages` branch of `quorum-app-prod`, at `app.quorummessenger.com` | READ, `.claude/skills/deploy/SKILL.md` |

### Payload weight (MEASURED, `dist/web/assets`, build of 2026-08-03)

| Asset | Uncompressed |
|---|---|
| `index-*.js` (main bundle) | **2.26 MB** |
| `EmojiPicker-*.js` (lazy chunk) | **4.63 MB** |
| `channelwasm_bg.wasm` | **933 KB** |
| `dist/web/assets` total | 8.8 MB |
| `dist/web` total | 78 MB |

Gzip/brotli figures are **not measured** — that number is needed before drawing
conclusions about cold start.

---

## 3. Findings — the structural problems

### 3.1 Background message delivery

- **Issue**: Mobile browsers freeze backgrounded pages within seconds. The live WebSocket dies, so nothing arrives and nothing notifies until the user foregrounds the app.
- **Impact**: **Blocking.** Without a fix, mobile web is not a messenger, it is a message viewer.
- **Evidence**: Notifications are page-scoped (READ, [desktop-notifications.md](../docs/features/desktop-notifications.md)). Catch-up on foreground already exists via `getInbox` (READ).

**The path forward is short because the design already fits.** Mobile's push
payload contains only `inbox_address` / `hub_address`; the iOS Notification
Service Extension rewrites the title from a locally-maintained catalog, and
explicitly does **not** decrypt the body (READ,
`quorum-mobile/ios/QuorumNotificationService/NotificationService.swift`). A
service worker can do the same job and has an easier time of it: IndexedDB is
shared between page and SW, so there is no App Group file to coordinate.

**The dependency is server-side and not owned by this repo.** `registerPushToken`
currently accepts `platform: 'ios' | 'android'` and an `expo_token` (READ,
`quorum-mobile/services/api/quorumClient.ts:441`). Web Push needs a different
shape: VAPID plus `{ endpoint, p256dh, auth }`. **Confirm with the API owners
before committing to the plan.**

**Platform constraints (from research, sources in §10):**

- iOS: Web Push works **only** for home-screen-installed PWAs (iOS 16.4+). A Safari tab gets nothing.
- iOS: no silent pushes. Every push must render a notification. Compatible with the content-less design, but it rules out using push to quietly sync.
- iOS: **no Background Sync and no Periodic Background Sync at all.** Catch-up can only happen on foreground.
- Android/Chrome: full Web Push plus Background Sync. Substantially better.

**Open question (§8):** does the server retain undelivered inbox messages, and
for how long? That determines whether "no background delivery" means *delayed* or
*lost*.

### 3.2 Storage eviction — the silent data-loss risk

- **Issue**: WebKit applies a 7-day cap on script-writable storage (IndexedDB, LocalStorage, SW registrations) for origins without user interaction. For Quorum that is the identity keyset, `space_keys`, `encryption_states` (ratchet), and all message history.
- **Impact**: **Critical, and live today** for anyone using the web app in a phone browser. Not hypothetical, not future-only.
- **Evidence**: [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/); key locations READ from [cryptographic-architecture.md](../docs/cryptographic-architecture.md) §Key Storage Locations.

**Home-screen-installed web apps are exempt** — they carry their own days-of-use
counter — and on iOS 17+ get up to 20% of disk (vs 80% for the browser itself).
Storage can still be reclaimed under device disk pressure.

**Design consequence (INFERRED):** an *uninstalled* Quorum PWA is actively unsafe
for the user. Install stops being an optional enhancement and becomes a
precondition. That justifies a loud, guided, near-blocking install flow and
`navigator.storage.persist()` on every launch.

**Unresolved and important:** can the app recover from *identity intact (passkey),
ratchet state gone*? If a wiped `encryption_states` means permanently broken DM
sessions rather than a re-handshake, the severity is much higher. Not answered by
the current docs.

### 3.3 Passkey `largeBlob` on mobile browsers

- **Issue**: The ed448 account private key is stored in the passkey's `largeBlob` extension. `largeBlob` support is confirmed on iOS 17 / iPadOS 17 / Safari 17+, but **unverified on Android Chrome with Google Password Manager**, where PRF is the better-supported extension.
- **Impact**: **Potentially plan-killing.** If `largeBlob` fails on Android, mobile users fall back to pasting a 114-char hex key — both a UX disaster and a security downgrade.
- **Evidence**: READ, [privateKey.ts:6](../../src/utils/privateKey.ts#L6). Platform support from [Corbado — passkeys & WebAuthn PRF](https://www.corbado.com/blog/passkeys-prf-webauthn) and [MDN WebAuthn extensions](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/WebAuthn_extensions).

This is cheap to test empirically and expensive to be wrong about. It is
experiment **E1** in §6 and nothing else should start before it resolves.

Secondary unknown: a passkey created on desktop *with* `largeBlob` may not be
usable from a phone whose authenticator lacks the extension, even over the
cross-device hybrid/QR flow. Include that case in E1.

### 3.4 Code-delivery integrity

- **Issue**: Unlike a signed native binary, a web app re-downloads the JavaScript that handles the private key on every load. There is no code signing and no user-verifiable build. A bundle targeted at one user would be undetectable.
- **Impact**: **Structural, mitigable, not eliminable.** This is the long-standing critique of browser-delivered E2EE crypto — the reason Signal has never shipped a web client, and a tradeoff Element/Matrix accepts explicitly.
- **Evidence**: General web platform property; not repo-specific.

Current hosting on GitHub Pages is the sharpest form of this (READ,
`.claude/skills/deploy/SKILL.md`). **Decided in discussion: hosting moves to the
Quilibrium network, static files included.** That materially improves the
picture, since content-addressed retrieval lets a client verify what it received
rather than trusting a host.

Two things remain open even after that move (INFERRED):

1. The browser still bootstraps through a domain and TLS before content addressing applies. Whether that bootstrap is a real weak point depends on how network-served static files are reached from a browser — unknown, see §8.
2. Mitigations worth designing in early rather than retrofitting: **service worker build pinning** (an update requires explicit, visible confirmation showing the new hash, rather than a silent swap), published signed build hashes, and a user-facing "verify this build" surface.

The lead dev started Quorum as a web client and is an experienced cryptographer,
so this tradeoff is near-certainly deliberate rather than overlooked. The useful
move is not to re-litigate it but to ask what the intended integrity story is, so
the SW is built to cooperate with it (§8).

### 3.5 Install friction and cold start

- **Issue**: iOS has no `beforeinstallprompt`. Installation is a manual Share → Add to Home Screen, with different steps per browser. Combined with §3.2, an un-installed user is also a user whose data will be wiped.
- **Impact**: **High**, and compounding — install is both the adoption bottleneck and the data-safety precondition.
- **Evidence**: Platform behaviour; [MobiLoud PWA on iOS](https://www.mobiloud.com/blog/progressive-web-apps-ios).

Cold start compounds it: 2.26 MB of main-bundle JS plus 933 KB of WASM with **no
precaching at all** today (MEASURED + READ). A service worker fixes this and is
required for push anyway, so it does double duty. The 4.63 MB emoji chunk needs a
mobile-specific answer even though it is lazy.

### 3.6 Smaller items

| Item | Note |
|---|---|
| iOS memory ceilings | Virtualized lists + WASM + large IndexedDB. WebKit kills tabs over budget. Needs a soak test on a large space. **Unmeasured.** |
| Badge API | Supported on iOS 16.4+ home-screen apps. Good fit for unread counts; requires notification permission. |
| Web Share Target | Chromium-only. Quorum cannot be a share destination on iOS. |
| Voice/video | If ever on the roadmap, iOS PWA is a dead end (no background audio). Worth knowing before committing. |
| `getUserMedia` | Works in iOS PWAs since 16.4. Camera/mic attachments are fine. |
| Electron key handling | The known Electron key-storage weakness is **orthogonal** to this plan — mobile users hit the browser passkey path. Tracked separately; see [2026-06-22-app-lock-password-gate-research.md](2026-06-22-app-lock-password-gate-research.md) §4. |

---

## 4. Platform capability matrix

| Capability | iOS PWA (installed) | iOS PWA (tab) | Android PWA | Native mobile |
|---|---|---|---|---|
| Web Push / notifications | ✅ 16.4+ | ❌ none | ✅ | ✅ |
| Silent / data-only push | ❌ | ❌ | ✅ | ✅ |
| Background Sync | ❌ | ❌ | ✅ | ✅ |
| Periodic Background Sync | ❌ | ❌ | ✅ (limited) | ✅ |
| IndexedDB survives idle | ✅ exempt | ❌ **7-day wipe** | ✅ | ✅ |
| Storage quota | ~20% of disk | browser-shared | large | device |
| Passkey `largeBlob` | ✅ 17+ | ✅ 17+ | ⚠️ **unverified** | ✅ |
| Badge API | ✅ 16.4+ | ❌ | ✅ | ✅ |
| Share target | ❌ | ❌ | ✅ | ✅ |
| Background audio / calls | ❌ | ❌ | ⚠️ limited | ✅ |
| Install friction | manual, high | n/a | prompt, low | store |

**Reading of the matrix (INFERRED):** installed-iOS is a viable but constrained
messenger. Tab-iOS is not viable at all and should be treated as a
data-loss hazard to be steered out of. Android PWA is close to native for
Quorum's needs.

---

## 5. Distribution alternatives (and a correction)

An earlier framing held that Android sideloading routes around the store
problem. **That is becoming false.**

Google announced (Aug 2025) that certified Android devices will only install apps
from **verified developers**, explicitly covering sideloaded APKs and alternative
stores, not just Play. Verification requires KYC plus registration of package
name and APK signing keys. Rollout: Brazil / Indonesia / Singapore / Thailand
**Sept 2026**, global **2027**. Unverified apps get an "advanced flow" with a
mandatory 24-hour wait, or ADB.

**Noted from discussion:** the KYC requirement itself is not a barrier for
Quilibrium — the lead dev is already publicly identified as Quilibrium Inc.'s CEO
precisely because store distribution requires it. The exposure is not the
identity check, it is that **verification is revocable and is bound to a specific
signing key**. Post-2027 a single entity can withdraw a named developer's ability
to install software on certified Android devices by *any* route.

| Channel | Gatekeeper | Viability post-2027 |
|---|---|---|
| App Store (iOS) | Apple | Policy risk — the scenario being planned against |
| Play Store (Android) | Google | Same |
| Direct APK / F-Droid / Obtainium | Google (verification) | **Degraded** — verification reaches these |
| EU alternative marketplaces (AltStore PAL) | Apple (DMA-constrained) | EU only; narrower than it sounds |
| TestFlight | Apple | Revocable, 10k cap, not a real channel |
| **PWA** | **None** | **The only ungated route on either platform** |

Apple's iOS 17.4 removal of EU home-screen web apps was **reversed** in March
2024, so PWAs work in the EU today. Worth noting that the reversal itself shows
how unilaterally this can change.

---

## 6. Phase 0 — the de-risking experiments

Four experiments, independent of each other and of any UI work. Each has a
pass/fail criterion **written before the test runs**. Total: roughly one to two
weeks. **No production code should be committed to this plan before E1 and E2
report.**

### E1 — `largeBlob` support matrix (highest information, run first)

- **Matrix**: iOS Safari (installed PWA + tab), iOS Chrome, Android Chrome + Google Password Manager, Android Firefox, Samsung Internet.
- **Per cell**: create credential with `largeBlob`, write key, read key back, and separately attempt cross-device (desktop-created passkey used from phone via hybrid/QR).
- **PASS**: read-back succeeds on iOS Safari installed **and** Android Chrome/GPM.
- **FAIL**: any read-back failure on Android Chrome/GPM. → escalate; the plan needs a different key-custody design (PRF, or an explicit key-transfer onboarding), not a patch.

### E2 — storage survival

- Install the PWA on a real iPhone and a real Android device. Seed identity, one space, one DM, some message history. Record `navigator.storage.persist()` return value and `estimate()` per platform. Leave the device idle. Verify at 8 days and 21 days.
- Separately: repeat as an *uninstalled tab* on iOS to confirm the failure mode and measure exactly what is lost.
- **PASS**: installed IndexedDB fully intact at 21 days on both platforms.
- **FAIL**: any loss of `encryption_states` or `space_keys` on an installed app. → the fallback needs server-side or user-driven backup before it can be recommended.
- **Also determine**: whether the app recovers gracefully from "passkey intact, ratchet gone". This is answerable today by clearing IndexedDB while keeping the passkey, and does not need the 21-day wait.

### E3 — Web Push feasibility (external dependency)

- Confirm with the Quorum API owners that `/push/register` can accept `platform: 'web'` with a VAPID subscription (`endpoint`, `p256dh`, `auth`) in place of `expo_token`, and that the relay can send to a Web Push endpoint.
- **PASS**: agreed and scheduled.
- **FAIL / not planned**: mobile web ships without background notifications. Still shippable as "open the app to see new messages", but that must be a **conscious, stated** product decision, not a discovered limitation.

### E4 — cold start on a real device

- Measure gzip/brotli transfer size of the main bundle and WASM, then time-to-interactive on a mid-range Android over throttled 4G, cold cache. Repeat with a precaching SW in place.
- **PASS**: under 5s TTI cold, under 1s warm.
- **FAIL**: → bundle-splitting work becomes a Phase 1 blocker rather than a Phase 3 nicety.

---

## 7. Recommended sequencing

The ordering principle: **the largest work item is the least risky, so it goes
last.** The UI refactor is visible, reversible, and reviewable by using the app.
The storage/key/push layer is small in code and can invalidate everything.

| Phase | Content | Observable outcome |
|---|---|---|
| **0** | E1–E4 (§6). No production code. | A go / no-go / reshape decision with evidence |
| **1** | Service worker: precache, offline shell, build pinning. `navigator.storage.persist()`. Guided per-browser install flow. | App installs to home screen, starts fast, survives being idle |
| **2** | Web Push: SW `push` handler + catalog enrichment + server subscription. | Phone buzzes when someone DMs you, app closed |
| **3** | Mobile UI refactor toward the mobile app's shape. | The app feels native on a phone |

**Run one narrow UI slice in parallel with Phase 0.** The Phase 0 experiments
have long wall-clock latency (E2 is a 21-day wait) but almost no active work, so
the calendar time is free. Take **DM only, end to end** — conversation list →
open → read history → compose → send — and make that one path phone-native. It is
fully reviewable by using it on a phone, it proves or disproves the UI approach
cheaply, and it depends on nobody else's backend.

**Do not** start the full UI refactor before E1 reports.

---

## 8. Open questions

Blocking or near-blocking, and none of them answerable from this repo:

1. **For the API owners:** does the server retain undelivered inbox messages, and for how long? Determines whether missed background delivery means *delayed* or *lost*. (Bears on §3.1.)
2. **For the API owners:** can `/push/register` accept a Web Push subscription (`platform: 'web'`, VAPID)? This is experiment E3 and gates Phase 2 entirely.
3. **For the lead dev:** what is the intended integrity story for delivered web code once the app is served from the Quilibrium network? Specifically, is the client meant to verify the build it received against something, and if so what pins that reference? **Decision-relevant now**: if a verification mechanism is planned, the service worker should be built to cooperate with it from the start rather than retrofitted; if not, the SW is the natural home for build pinning and that is awkward to add later.
4. **For the lead dev:** how is a browser expected to reach network-served static files? Determines whether the domain/TLS bootstrap remains a weak point after the hosting move.
5. **Internal:** can the app recover from "passkey intact, ratchet state gone"? Answerable today (see E2) and it sets the severity of §3.2.

---

## 9. Action items

- [ ] **E1 — `largeBlob` support matrix** — Priority: critical. Blocks everything.
- [ ] **E2 — storage survival test** (start early, 21-day wall clock) — Priority: critical
- [ ] **E2b — "passkey intact, ratchet gone" recovery check** — Priority: high. Answerable immediately.
- [ ] **E3 — confirm Web Push support with API owners** — Priority: high. External dependency.
- [ ] **E4 — cold-start measurement on a mid-range Android** — Priority: medium
- [ ] **Put questions 1–4 (§8) to the lead dev and API owners** — Priority: high
- [ ] **Narrow UI slice: DM path phone-native** — Priority: medium. Runs in parallel with Phase 0.
- [ ] **Fold PWA requirements into the existing SW issue** ([2025-12-14-service-worker-app-updates.md](../issues/.open/2025-12-14-service-worker-app-updates.md)) rather than opening a second SW workstream — Priority: medium

---

## 10. Sources

**Repo evidence** (all READ, references inline above): `public/manifest.webmanifest`,
`src/utils/privateKey.ts`, `src/hooks/queries/inbox/buildInboxFetcher.ts`,
`.agents/docs/cryptographic-architecture.md`,
`.agents/docs/features/{offline-support,desktop-notifications,security,responsive-layout}.md`,
`.claude/skills/deploy/SKILL.md`; and in `quorum-mobile`:
`ios/QuorumNotificationService/NotificationService.swift`,
`services/api/quorumClient.ts`, `.agents/docs/features/notification-system.md`.

**External:**

- [WebKit — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) — 7-day cap, home-screen exemption, iOS 17 quotas
- [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN — WebAuthn extensions](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/WebAuthn_extensions)
- [Corbado — Passkeys & WebAuthn PRF for E2EE](https://www.corbado.com/blog/passkeys-prf-webauthn)
- [Google — Android developer verification](https://developer.android.com/developer-verification) and [9to5Google coverage](https://9to5google.com/2025/08/25/android-apps-developer-verification/)
- [Impact on F-Droid and alternative stores](https://cybersecurefox.com/en/android-developer-verification-play-protect-sideloading-fdroid/)
- [TechCrunch — Apple reverses EU home-screen web app removal](https://techcrunch.com/2024/03/01/apple-reverses-decision-about-blocking-web-apps-on-iphones-in-the-eu/)
- [MagicBell — PWA iOS limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Chrome for Developers — Web Push payload encryption](https://developer.chrome.com/blog/web-push-encryption)
- [Quilibrium docs — privacy without enabling crime](https://docs.quilibrium.com/docs/discover/how-quilibrium-protects-privacy-without-enabling-crime/)

---

## Appendix — what a PWA gains over native

Recorded because the fallback framing understates the case. Independent of any
store-removal scenario:

- **Zero-friction trial.** A link opens a working Quorum on any device, no install, no store account. That is a growth lever available today.
- **Instant updates**, no review queue, no version fragmentation.
- **No 30% cut**, no store account requirement for users.
- **Reach beyond phones**: tablets, ChromeOS, Linux phones, desktop mobile-web.
- **One codebase** already shared with the desktop app.

**Framing decided in discussion:** treat this as *making mobile web genuinely
good*, not as insurance. That reframing matters practically — under it, the
storage and push gaps in §3.1 and §3.2 are **present-day defects** affecting
anyone who opens the web app on a phone today, not hypothetical costs of a future
fallback. They earn their place on current merit.

---

_Created: 2026-08-05_
_Report Type: Research / Feasibility Analysis_
