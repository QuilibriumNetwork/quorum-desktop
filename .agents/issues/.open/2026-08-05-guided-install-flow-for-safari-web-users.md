---
type: task
title: "Guided install flow for Safari web users (Add to Home Screen / Add to Dock)"
status: open
complexity: medium
ai_generated: true
created: 2026-08-05
updated: 2026-08-05
related_docs:
  - "../../docs/features/responsive-layout.md"
  - "../../docs/features/user-data-backup.md"
related_tasks:
  - "2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md"
  - "2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md"
related_reports:
  - "../../reports/2026-08-05-pwa-mobile-fallback-feasibility.md"
---

# Guided install flow for Safari web users

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Phase 0 is a gate, not a warm-up.** If passkey auth does not work in an iOS
> standalone web app, Phases 1-3 are wasted work. Do not start them first.

**Files**:
- `index.html:5-9` (the production entry — `web/vite.config.ts:94`)
- `web/index.html:5` (dev entry, diverged — see Phase 1)
- `src/components/message/MessageComposer.scss:138`
- `src/components/search/SearchResults.scss:56`
- `src/components/ui/MobileDrawer.scss:18`
- new: an install-prompt component, location TBD (likely `src/components/ui/`)

## What & Why

**Current state.** Installing Quorum as a standalone web app already works
mechanically: `public/manifest.webmanifest` declares `display: standalone` with
192/512/maskable icons, and `index.html` carries `apple-touch-icon` and
`theme-color`. Since iOS 15.4 Safari honours the manifest's `display`, so a user
who finds Share → Add to Home Screen today gets a proper standalone app.

**The problem.** Nobody will find it. iOS has no `beforeinstallprompt`, so there
is no prompt, no hint, and no reason for a user to think they should. Meanwhile
installing is the **only** protection against
[Safari's 7-day IndexedDB wipe](2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md)
that does not require the user to weaken their browser's privacy settings.
Installed web apps are exempt from ITP eviction; tabs are not.

**Desired state.** A Safari user (macOS or iOS) who is not running standalone
sees a clear, dismissible prompt explaining the risk and walking them through the
install, with correct per-platform instructions. Standalone mode then looks and
behaves correctly.

**Value.** Converts a mitigation that exists on paper into one that actually
happens. This is the highest-leverage item in the ITP bug because it prevents the
data loss rather than softening it.

## Context

- **Existing pattern**: viewport bucketing already exists via `useShellState().viewport` ([responsive-layout.md](../../docs/features/responsive-layout.md)). Detection for this task is a different axis (display-mode + engine, not width) so it should not be folded into `useShellState`.
- **Constraint — no install prompt on iOS.** The flow is necessarily instructional, not programmatic. Copy and screenshots do the work.
- **Constraint — separate storage partitions.** See Phase 3; this is the non-obvious one.
- **Constraint — the app must not nag.** These users are privacy-minded and a persistent modal will read as dark-pattern. Dismissible, remembered, and re-surfaced at most rarely.

## Implementation

### Phase 0 — GATE: verify passkey auth works in an iOS standalone web app

1. **On a real iPhone**, add the app to the Home Screen, then attempt a full login: `navigator.credentials.get()` plus a `largeBlob` read.
   - There is precedent for concern: an iOS 26.2 `isUVPAA` bug broke passkey detection in WKWebView (fixed in 26.3). Standalone web apps are not WKWebView, but they are adjacent enough not to assume.
   - **If this fails, stop.** The entire install-based mitigation collapses and the ITP bug needs a different answer.
2. Fold this in as a row of experiment **E1** in the [PWA feasibility report](../../reports/2026-08-05-pwa-mobile-fallback-feasibility.md) §6 rather than running it separately — E1 is already testing `largeBlob` across browsers, so one session answers both.

### Phase 1 — Standalone rendering correctness (small, independent, ships alone)

1. **Add `viewport-fit=cover`** (`index.html:5-9`).
   - Current: `width=device-width, initial-scale=1, interactive-widget=resizes-content`.
   - Without it, standalone on a notched iPhone letterboxes instead of going edge to edge, **and every `env(safe-area-inset-*)` value resolves to 0**.
   - Three rules already depend on those values and have therefore never fired: `MessageComposer.scss:138`, `SearchResults.scss:56`, `MobileDrawer.scss:18`. Expect visible layout shifts once this lands — that is the fix working, not a regression.
2. **Reconcile the two entry HTML files.** `web/index.html:5` is missing `interactive-widget=resizes-content`, so mobile keyboard behaviour differs between dev and prod. Production builds from the root file (`web/vite.config.ts:94`), so prod is currently the *better* one and dev is the outlier. Unrelated to install, found alongside it, cheap to fix.
3. **Walk the app in standalone** for chrome-less breakage: no browser back button, external links, and any flow that assumed a URL bar. Record what breaks rather than fixing opportunistically.

### Phase 2 — The install prompt

1. **Detection.** "Is WebKit" plus "is not standalone". Use `window.matchMedia('(display-mode: standalone)')` with `navigator.standalone` as the iOS fallback. Do **not** key off viewport width — macOS Safari is affected and is a desktop viewport.
2. **Per-platform copy.** iOS Safari → Share → Add to Home Screen. macOS Safari 17+ → File → Add to Dock. iOS Chrome/Brave/Firefox → they are WebKit too and equally affected, but the Add to Home Screen affordance differs per browser; verify each rather than assuming.
3. **Explain the why in one line.** "Safari deletes app data for sites you haven't opened in a week. Installing Quorum keeps your messages." Not a scare banner; a reason.
4. **Dismissal that sticks.** Persist the dismissal, and re-surface at most on a long interval. Never block use.

### Phase 3 — The storage-partition handoff (the non-obvious part)

**An iOS Home Screen web app does not share storage with Safari.** Same origin,
different partition: no shared IndexedDB, localStorage, cookies or service worker
registration. (Cache Storage is the one documented exception.)

So "install it" means **log in again into an empty database**. An existing Safari
tab user who installs leaves their entire DM history behind in the tab.

1. **Say so before they install.** A prompt that silently costs the user their history is worse than no prompt.
2. **Offer the handoff**: export a `.qmbak` from the tab, import it in the installed app.
3. **Be honest about what the handoff delivers.** Per [the backup issue](2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md), a restore returns readable history but **not** DM session continuity — conversations resume on fresh sessions. Do not imply otherwise.
4. **Do not delete anything from the tab.** The tab's data is the user's only copy until they confirm the installed app is working.

> This phase is why the two bugs are not as independent as originally filed: the
> ITP mitigation routes through the backup feature, and the backup feature has a
> gap. Phase 3 can ship with honest copy before that gap is closed, but it cannot
> ship pretending the gap is not there.

## Verification

✅ **Phase 0 gate** — passkey login succeeds in an iOS Home Screen web app, `largeBlob` read included. Record the iOS version tested.

✅ **Safe areas actually apply** — on a notched iPhone in standalone, the composer clears the home indicator and the drawer clears the notch. Compare against a screenshot taken *before* the `viewport-fit` change; if nothing moved, the change did not take effect.

✅ **Detection is correct on all four surfaces** — macOS Safari tab (prompt shown), macOS Safari installed to Dock (no prompt), iOS Safari tab (prompt shown), iOS Home Screen (no prompt). Chrome/Firefox desktop must show nothing.

✅ **Dismissal persists** across a reload and a restart.

✅ **The handoff works end to end** — export from a Safari tab, install, import, and confirm history is readable in the installed app. Confirm the tab's data is untouched.

✅ **TypeScript compiles** — `npx tsc --noEmit`

✅ **No regressions on desktop** — the shell, drawer and composer are unchanged in Electron and Chrome. The `viewport-fit` change is the one with regression potential; check Electron explicitly.

## Definition of Done

- [ ] Phase 0 gate passed and the iOS version recorded
- [ ] `viewport-fit=cover` added; the three existing `env(safe-area-inset-*)` rules verified as now taking effect
- [ ] Dev/prod viewport meta reconciled
- [ ] Standalone walkthrough done; chrome-less breakage recorded (fixed or filed)
- [ ] Install prompt shipped with correct per-platform copy and persistent dismissal
- [ ] Storage-partition warning + `.qmbak` handoff in the flow, with honest copy about what restores
- [ ] TypeScript passes
- [ ] No regressions in Electron / Chrome
- [ ] [ITP bug](2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md) M2 checked off, and its M3 (`navigator.storage.persist()`) either done here or split out

## Open questions

1. **What share of users are on the web app vs Electron, and of those, how many on Safari?** Sets whether this is urgent or merely correct. Unmeasured; no analytics identified.
2. **Do iOS Chrome/Brave/Firefox offer Add to Home Screen, and does it produce a standalone app with its own partition?** They are all WebKit so they are all affected, but the install affordance and the resulting behaviour need checking per browser.
3. **Does macOS "Add to Dock" partition storage the same way iOS does?** Assumed yes by symmetry; unverified. Changes the Phase 3 copy for desktop users if not.
4. **Does the GitHub Pages SPA redirect (`404.html` / `handleredirect.js` / `redirect.js`) behave correctly as a standalone `start_url`?** Untested, and a broken cold start in standalone would be a bad first impression right after asking someone to install.
