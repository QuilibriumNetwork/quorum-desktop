---
type: task
title: "Guided install flow for Safari users (Add to Dock on macOS, Add to Home Screen on iOS)"
status: open
complexity: medium
ai_generated: true
created: 2026-08-05
updated: 2026-08-05
related_docs:
  - "../../docs/features/responsive-layout.md"
  - "../../docs/features/user-data-backup.md"
  - "../../docs/cryptographic-architecture.md"
related_tasks:
  - "2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md"
  - "2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md"
  - "2025-12-14-service-worker-app-updates.md"
related_reports:
  - "../../reports/2026-08-05-pwa-mobile-fallback-feasibility.md"
---

# Guided install flow for Safari users

> **⚠️ AI-Generated**: May contain errors. Verify before use.
>
> **This is not a mobile task.** macOS Safari on the desktop is hit by ITP
> eviction identically to iOS, and **Add to Dock** is the same fix as Add to
> Home Screen. Both platforms are first-class here. Treating this as a phone
> feature is the mistake this note exists to prevent.
>
> **Two hard gates before any UI work** — see "Blocking constraints".

**Files**:
- `index.html:5-9` — the production entry (`web/vite.config.ts:94`)
- `web/index.html:5` — dev entry, diverged
- `src/components/message/MessageComposer.scss:138`
- `src/components/search/SearchResults.scss:56`
- `src/components/ui/MobileDrawer.scss:18`
- `src/utils/platform.ts:35` — existing `isElectron()`, needed to suppress the prompt
- new: install-prompt component, likely `src/components/ui/`

## What & Why

**Current state.** Installing Quorum as a standalone web app already works
mechanically on both platforms. `public/manifest.webmanifest` declares
`display: standalone` with 192/512/maskable icons; `index.html` carries
`apple-touch-icon` and `theme-color`. Safari 17 (macOS Sonoma) added **Add to
Dock** for any website and honours the manifest, and iOS has honoured
`display: standalone` since 15.4. A user who finds the menu item today gets a
proper standalone app.

**The problem.** Nobody will find it. There is no `beforeinstallprompt` in
WebKit on either platform, so there is no prompt, no hint, and no reason for a
user to think they should. Meanwhile installing is the **only** protection
against [Safari's 7-day IndexedDB wipe](2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md)
that does not require the user to switch off their browser's anti-tracking
protection. Installed web apps are exempt from ITP eviction; tabs are not.

**Desired state.** Any Safari user, desktop or mobile, who is not running
standalone sees a clear, dismissible prompt explaining the risk and walking them
through the install for their exact platform. Standalone mode then looks and
behaves correctly on both.

**Value.** Turns a mitigation that exists on paper into one that happens. It is
the highest-leverage item in the ITP bug because it prevents the data loss
rather than softening it.

### Who this is for

| Client | ITP-exposed? | The install | Show the prompt? |
|---|---|---|---|
| **macOS Safari (tab)** | **Yes** | File → Add to Dock (Safari 17+) | **Yes** |
| macOS Safari (in Dock) | No | already done | No |
| **iOS Safari (tab)** | **Yes** | Share → Add to Home Screen | **Yes** |
| iOS (Home Screen) | No | already done | No |
| **iOS Chrome / Brave / Firefox** | **Yes** (all WebKit) | affordance differs per browser, **unverified** | Yes, once verified |
| Electron desktop app | No | n/a | **Never** — suppress via `isElectron()` |
| Chrome / Edge / Brave / Firefox desktop | No | n/a | No (see note) |

> Chromium and Gecko desktop browsers do not time-delete first-party storage, so
> they need no ITP prompt. A generic "install for a better experience" affordance
> for them is a **separate and much lower-value** idea. Do not fold it in here;
> it would dilute a safety message into a marketing one.

## Blocking constraints

### C1 — GATE: passkey auth in a standalone web app is unverified

Nobody has confirmed that `navigator.credentials.get()` plus the `largeBlob`
read work inside a standalone web app, on **either** platform. There is
precedent for concern: an iOS 26.2 `isUVPAA` bug broke passkey detection in
WKWebView, fixed in 26.3. Standalone web apps are not WKWebView but are adjacent
enough not to assume.

**If this fails, stop.** The whole install-based mitigation collapses and the
ITP bug needs a different answer. Test both macOS-in-Dock and iOS-Home-Screen;
do not assume one implies the other.

Fold it in as rows of experiment **E1** in the
[PWA feasibility report](../../reports/2026-08-05-pwa-mobile-fallback-feasibility.md) §6,
which is already testing `largeBlob` across browsers. One session answers both.

### C2 — GATE: the origin must not change during the QStorage migration

**Hosting moves from GitHub Pages to the Quilibrium network in roughly a month.**
That migration must change what sits *behind* `app.quorummessenger.com`, never
the address itself. If the URL changes, two things break at once, for everybody,
irreversibly:

1. **Every passkey stops working.** The SDK calls `navigator.credentials.create` with `rp: { name: 'Quilibrium' }` and **`id` commented out** ([`node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.esm.js:2366-2369`](../../../node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.esm.js#L2366)). When `rp.id` is omitted, WebAuthn defaults it to the **effective domain of the calling origin**, so every existing credential is scoped to `app.quorummessenger.com` exactly — not to `quorummessenger.com`, not to a sibling host. A credential cannot be used from a different registrable domain. Users would be locked out and forced to re-import their raw private key by hex, if they still have it.
2. **Every local database is orphaned.** IndexedDB is keyed by origin. A new origin is a new, empty bucket. Identical failure mode to the ITP wipe, except simultaneous and universal.

An installed web app is pinned to its origin too, so this would also strand
everyone who followed the advice in this task.

**Action:** confirm with whoever runs the migration that the hostname is
unchanged, before shipping any prompt that asks users to install.

> **Forward note, not urgent.** Because `rp.id` is implicit, it cannot later be
> widened to `quorummessenger.com` for subdomain flexibility — existing
> credentials would not be found under the wider ID, making that change its own
> re-registration event. Worth a deliberate decision at some point rather than
> discovering it later.

## Context

- **Existing pattern**: viewport bucketing exists via `useShellState().viewport` ([responsive-layout.md](../../docs/features/responsive-layout.md)). Detection here is a **different axis** (display-mode + engine, not width) and must not be folded into `useShellState`. Keying off width would miss every macOS desktop user, who is exactly half the point of this task.
- **Constraint — no programmatic install on WebKit.** The flow is necessarily instructional on both platforms. Copy and per-platform screenshots do the work.
- **Constraint — separate storage partitions.** See Phase 3. The non-obvious one.
- **Constraint — must not nag.** These users are privacy-minded; a persistent modal reads as a dark pattern. Dismissible, remembered, re-surfaced rarely if ever.
- **Interaction with the service worker** ([2025-12-14-service-worker-app-updates.md](2025-12-14-service-worker-app-updates.md)): once a SW exists it serves the app shell for any route, which makes the host's 404 behaviour irrelevant and retires the `404.html` / `handleredirect.js` / `redirect.js` SPA hack. That removes the main risk of a broken cold start in standalone, and it is one more reason the SW is worth doing early: it serves ITP protection, Web Push, cold start, and host-routing independence at once.

## Implementation

### Phase 0 — Clear both gates

1. **C1**: passkey login in standalone, on macOS-in-Dock and iOS-Home-Screen. Record OS and Safari versions.
2. **C2**: written confirmation that the QStorage migration keeps `app.quorummessenger.com`.

Neither is code. Both can invalidate the rest.

### Phase 1 — Standalone rendering correctness (small, independent, ships alone)

1. **Add `viewport-fit=cover`** (`index.html:5-9`). Current value is `width=device-width, initial-scale=1, interactive-widget=resizes-content`. Without it, standalone on a notched iPhone letterboxes instead of going edge to edge, **and every `env(safe-area-inset-*)` resolves to 0**.
   - Three rules already depend on those values and have therefore never fired: `MessageComposer.scss:138`, `SearchResults.scss:56`, `MobileDrawer.scss:18`. Expect visible layout shifts when this lands. That is the fix working, not a regression.
   - Harmless on macOS; safe-area insets are zero there.
2. **Reconcile the two entry HTML files.** `web/index.html:5` lacks `interactive-widget=resizes-content`, so mobile keyboard behaviour differs between dev and prod. Production builds from the root file (`web/vite.config.ts:94`), so prod is currently the better one and dev is the outlier. Unrelated to install, found alongside it, cheap.
3. **Walk the app in standalone on both platforms** for chrome-less breakage: no browser back button, external link handling, any flow that assumed a URL bar. Window controls differ between a Dock app and a Home Screen app. Record what breaks rather than fixing opportunistically.

### Phase 2 — The install prompt

1. **Detection.** `window.matchMedia('(display-mode: standalone)')`, with `navigator.standalone` as the iOS fallback, plus an engine check for WebKit. **Suppress entirely in Electron** via the existing `isElectron()` (`src/utils/platform.ts:35`) — Electron is Chromium and unaffected, and prompting there would be nonsense.
2. **Per-platform copy**, selected by platform not by viewport:
   - macOS Safari 17+ → **File → Add to Dock**
   - iOS Safari → **Share → Add to Home Screen**
   - iOS Chrome / Brave / Firefox → same underlying exemption, different menu path. Verify each rather than assuming; see open questions.
3. **State the reason in one line.** Something like "Safari deletes app data for sites you haven't opened in a week. Installing Quorum keeps your messages." A reason, not a scare banner.
4. **Dismissal that sticks** across reload and restart, re-surfaced at most on a long interval. Never block use.

### Phase 3 — The storage-partition handoff (the non-obvious part)

**An iOS Home Screen web app does not share storage with Safari.** Same origin,
separate partition: no shared IndexedDB, localStorage, cookies or service worker
registration. Cache Storage is the one documented exception.

So "install it" means **log in again into an empty database**. An existing Safari
tab user who installs leaves their entire DM history behind in the tab.

**Whether macOS Add to Dock partitions the same way is unverified** — assumed yes
by symmetry, but it must be checked, because it decides whether desktop users get
the same warning or a simpler one. See open questions.

1. **Say so before they install.** A prompt that silently costs the user their history is worse than no prompt.
2. **Offer the handoff**: export a `.qmbak` from the tab, import it in the installed app.
3. **Be honest about what the handoff delivers.** Per [the backup issue](2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md), a restore returns readable history but **not** DM session continuity — conversations resume on fresh sessions. Do not imply otherwise.
4. **Do not delete anything from the tab.** Its data is the user's only copy until they confirm the installed app works.

> This phase is why the two bugs are less independent than first filed: the ITP
> mitigation routes through the backup feature, and the backup feature has a gap.
> Phase 3 can ship with honest copy before that gap closes, but not pretending it
> is not there.

## Verification

✅ **C1 gate** — passkey login succeeds in a macOS Dock app **and** an iOS Home Screen app, `largeBlob` read included. Record both OS versions.

✅ **C2 gate** — hostname confirmed unchanged for the QStorage migration, in writing.

✅ **Safe areas actually apply** — on a notched iPhone in standalone, the composer clears the home indicator and the drawer clears the notch. Compare against a screenshot taken *before* the `viewport-fit` change; if nothing moved, the change did not take effect.

✅ **Detection is correct on all six surfaces** — macOS Safari tab (prompt), macOS Safari in Dock (none), iOS Safari tab (prompt), iOS Home Screen (none), Electron (none), Chrome desktop (none).

✅ **Dismissal persists** across reload and restart.

✅ **The handoff works end to end** on both platforms — export from a tab, install, import, confirm history is readable in the installed app, confirm the tab's data is untouched.

✅ **TypeScript compiles** — `npx tsc --noEmit`

✅ **No regressions** — shell, drawer and composer unchanged in Electron and Chrome. `viewport-fit` is the change with regression potential; check Electron explicitly.

## Definition of Done

- [ ] C1 passed on both platforms, versions recorded
- [ ] C2 confirmed in writing
- [ ] `viewport-fit=cover` added; the three existing `env(safe-area-inset-*)` rules verified as now taking effect
- [ ] Dev/prod viewport meta reconciled
- [ ] Standalone walkthrough done on macOS **and** iOS; chrome-less breakage recorded (fixed or filed)
- [ ] Install prompt shipped with per-platform copy, Electron suppression, persistent dismissal
- [ ] Storage-partition warning + `.qmbak` handoff, with honest copy about what restores
- [ ] TypeScript passes; no regressions in Electron / Chrome
- [ ] [ITP bug](2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md) M2 checked off, and its M3 (`navigator.storage.persist()`) either done here or split out

## Open questions

1. **What share of users are on the web app vs Electron, and of those how many on Safari, desktop vs mobile?** Sets whether this is urgent or merely correct. Unmeasured; no analytics identified.
2. **Does macOS "Add to Dock" partition storage separately from Safari, as iOS does?** Assumed yes by symmetry, **unverified**. Changes the Phase 3 copy for desktop users, and desktop users are the ones most likely to have the largest history to lose.
3. **Do iOS Chrome / Brave / Firefox offer Add to Home Screen, does it produce a standalone app, and does that app get its own partition?** All are WebKit so all are ITP-exposed, but the affordance and resulting behaviour need checking per browser.
4. **Does QStorage support an error-document / SPA-fallback setting?** Lower priority than it was: the service worker makes host routing irrelevant once installed. Still matters for the first load before the SW registers.
5. **Does the current `404.html` / `handleredirect.js` redirect behave correctly as a standalone `start_url`?** Testable today on GitHub Pages, and retired entirely once the SW lands.
