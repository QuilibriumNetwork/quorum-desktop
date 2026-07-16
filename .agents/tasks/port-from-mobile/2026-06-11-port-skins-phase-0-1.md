---
type: task
title: "Port skins — Phase 0 (shared promotion) + Phase 1 (colors/fonts/accent engine)"
status: not-started
candidate: 27
created: 2026-06-11
depends_on: []
research: 2026-06-11-skins-deep-dive.md
---

# Port skins — Phase 0 + Phase 1

**Scope: the ready, zero-architectural-risk slice only.** Shared promotion of the pure skin engine + a desktop colors/fonts/accent skin engine with import/export, a Skins settings tab, bundled samples, and the Option-B folder/icon-color legibility fix. **Geometry (Phase 2), gallery (Phase 3), wallpaper/surfaces/icons (Phase 4) are OUT of this task** — see the deep dive §8 and plan them separately once their unknowns resolve.

> **Read first:** [`2026-06-11-skins-deep-dive.md`](2026-06-11-skins-deep-dive.md) — full feasibility study, architecture map, and the decided product calls. This task is the *how*; that doc is the *why*. Don't re-litigate decisions recorded there.

## Decided context (from the deep dive — do not re-open here)
- **App-wide skin, mirrors mobile** (not per-space).
- **Full parity is the eventual goal incl. geometry**, but this task ships colors/fonts/accent only; geometry is Phase 2.
- **Active skin is device-local, never synced** (§10a). No `UserConfig.activeSkinId`, no sync logic.
- **Gallery couples on the schema, not rendering** (§10b) — which is exactly why Phase 0's shared validator matters. Gallery UI itself is Phase 3.
- **Folder/channel/icon colors: Option B** — hue-locked OKLCH legibility nudge, never a retint (§6a Q2).
- **Editor:** import-only is acceptable for this task; a live-preview editor + a real color picker are improvements that can follow (§6a Q1). This task ships import/export + apply; the in-app editor is optional/stretch.

## Out of scope (explicit)
- Geometry runtime scaling (radii/spacing/borders) — Phase 2.
- Gallery browse/install/publish — Phase 3 (also gated on the `/skins` server endpoint being live for desktop — **open infra question, confirm with lead before Phase 3**).
- Wallpaper, per-region surfaces, icon-image substitution — Phase 4.
- Cross-device sync — dropped entirely (§10a).
- `fontScale` for Tailwind fixed-px text — defer the hard part; this task applies `fontScale` to the rem-relative type only and notes the gap (open call in the deep dive).

---

## Phase 0 — shared promotion (quorum-shared PR, then publish)

**Goal:** the pure, RN-free skin engine lives in `@quilibrium/quorum-shared` so desktop consumes it and the eventual gallery has one validator. **Additive, must not break mobile** (mobile is pinned to a published shared version and imports these from its own `theme/skins/` — the shared copies are new surface; mobile switches its imports later, off this task's critical path). See [[feedback_dont_break_mobile_on_shared_changes]] and the [cross-repo workflow](../quorum-shared-migration/cross-repo-workflow.md).

> **When starting Phase 0, graduate the deferred promotion into a real migration task:** create `../quorum-shared-migration/2026-XX-XX-promote-skin-engine.md` per that folder's conventions, and cross-link it here. (Until now it's tracked per-candidate; see deep dive §12.)

**Promote (pure, copy from `quorum-mobile/theme/skins/`):**
- `types.ts` (~205) — types + `SKIN_COLOR_KEYS` / `SLOT_NAMES`.
- `validate.ts` (~488) — the security boundary. Verify it uses only browser-safe primitives (`TextEncoder`/`Uint8Array`/hand-rolled base64 — confirmed in the deep dive). Must be behavior-preserving byte-for-byte.
- `mergeSkin.ts` (~38) — `withAlpha`, `skinFontFamily`.
- `geometry.ts` `deriveGeometry` (the pure part only — the `radius()`/`space()` singleton stays per-app).
- `samples.ts` (~77) — bundled sample data.

**Add two new pure helpers (desktop needs them; mobile doesn't have them):**
- `accentRampFromPoints(accent, accentLight, accentDark)` → the 11-stop desktop ramp (`50..900`) by interpolating the 3 anchors (`500←accent`, `200←accentLight`, `700←accentDark`). ~20 LOC, deterministic, unit-tested. (Deep dive §6, accent option #1.)
- `hexToRgbTriple(hex)` → `"r g b"` string for the semantic + `text-main` tokens desktop stores as triples. ~5 LOC.

**Tasks:**
- [ ] Create `quorum-shared/2026-XX-XX-promote-skin-engine.md` migration task; cross-link.
- [ ] Copy the 5 pure files into `@quilibrium/quorum-shared/src/skins/` (or the package's convention); export from the barrel.
- [ ] Add `accentRampFromPoints` + `hexToRgbTriple` with unit tests.
- [ ] Verify `validateSkin` runs unchanged in a browser context (jsdom/node test).
- [ ] Verify quorum-shared builds; verify mobile still builds against the unchanged local imports (no mobile edit in this task — mobile import-switch is a separate, later mobile PR).
- [ ] Publish the new shared version.

**Acceptance:** shared package builds + publishes; `validateSkin` + `deriveGeometry` + the two new helpers importable from `@quilibrium/quorum-shared`; mobile unaffected.

---

## Phase 1 — desktop colors/fonts/accent engine (quorum-desktop PR)

Depends on the published Phase 0 version.

### 1a. CSS-var substrate
Desktop already drives all color through `:root` / `html.dark` custom properties (`src/styles/_colors.scss`). No build change needed for colors — injection is `root.style.setProperty(...)`.
- [ ] Confirm the full target var set: `--surface-0..10`, `--accent-50..900` + `--accent` + `--accent-rgb`, `--color-text-strong/main/subtle/muted` (note: `main` is an rgb triple, the others hex — match each), `--danger/warning/success/info` (rgb triples). (Mapping table: deep dive §6.)

### 1b. `SkinService` (web) — `src/services/SkinService.ts`
A small service (sits alongside `PublicProfileService.ts` etc.) that applies/clears a validated `SkinOverride` by mutating CSS vars + the font + the `html.dark` class.
- [ ] `applySkin(skin: SkinOverride)`:
  - surfaces → `--surface-0..10` (1:1; **leave `--surface-00` un-skinned** — deep dive §6).
  - text → `--color-text-strong/subtle/muted` (hex) + `--color-text-main` (via `hexToRgbTriple`).
  - semantic → `--danger/warning/success/info` (via `hexToRgbTriple`).
  - accent → `accentRampFromPoints(...)` onto `--accent-50..900`, plus `--accent` (hex) + `--accent-rgb` (triple).
  - base → add/remove `html.dark` to match `skin.base`.
  - font → if `skin.font`, load via FontFace API (`new FontFace(skinFontFamily(skin), data).load()` → `document.fonts.add`), then set `--font-family`/`document.documentElement.style.fontFamily`.
  - `fontScale` → apply to rem-relative type (set a `--font-scale` or scale `:root` font-size); **note the Tailwind fixed-px gap** in a comment (deferred).
- [ ] `clearSkin()` — remove all the inline `:root` properties so the base theme/accent-class takes over again; restore device theme/accent from existing `localStorage`.
- [ ] Re-apply the active skin on app boot (before/at first paint) and on theme-system events. Coexist with the existing `ThemeProvider.web` accent/theme — decide precedence (an active skin pins base + overrides accent vars; clearing a skin returns control to the `accent-*` class + `theme` localStorage).

### 1c. Persistence — mirror mobile `skinPrefs.ts`
- [ ] Active skin id + local library in `localStorage` (or IndexedDB if size warrants), **re-validating with `validateSkin` on read** (same as mobile — never apply an unvalidated stored skin).
- [ ] Keys: active id, per-skin blob, installed-ids list. Bundled `SAMPLE_SKINS` are always available (union with stored, deduped by id), not stored.

### 1d. Skins settings tab — `UserSettingsModal`
- [ ] Add `{ id: 'skins', icon: 'paintbrush' /* or palette variant */, label: t\`Skins\`, className: '' }` to the `categories` array in `Navigation.tsx:17-25` (after `appearance`).
- [ ] Add `case 'skins':` to the switch in `UserSettingsModal.tsx:228` rendering a new `<Skins />` section component.
- [ ] `<Skins>` content (mirror mobile `SkinsModal` "My Skins" tab, web-styled):
  - list: Default (built-in) + samples + locally-saved, with apply/active indicator + delete (non-sample).
  - actions: import from clipboard (paste JSON → `validateSkin` → save), import from file (`.json`), export active (copy JSON to clipboard).
  - **No gallery tab** in this task (Phase 3).
- [ ] Decide: keep `Appearance` (theme/accent/language) separate, or note in it that a skin overrides accent. (Recommend: leave Appearance as-is; a skin simply supersedes it while active.)

### 1e. Option-B folder/channel/icon legibility nudge (§6a Q2)
- [ ] Add `--icon-color-*` / `--folder-color-*` CSS vars to `_colors.scss` `:root`/`html.dark`, **defaults = today's literals** from `IconPicker/types.ts` `ICON_COLORS`/`FOLDER_COLORS` → zero visible change without a skin.
- [ ] Rewrite `getIconColorHex` / `getFolderColorHex` (`src/components/space/IconPicker/types.ts:172-199`) to resolve through those vars.
- [ ] Add a pure OKLCH legibility helper: `legibleOn(color, surfaceColor)` — measure WCAG contrast; if below target, nudge **lightness only** (hue + chroma locked) the minimum amount to clear it; else return unchanged. Unit-test ("red on near-black → lighter red, same hue"; "already-legible → unchanged").
- [ ] Wire the two resolvers to pass the actual surface color (folders → sidebar surface, channel icons → row surface) and apply `legibleOn`. Only active when a skin is applied and contrast actually fails.
- [ ] **In-browser tuning pass** against the sample skins (esp. Midnight Neon / a near-black / a light) to set the contrast threshold + nudge curve. This needs eyeballing, not just code review.

### 1f. Editor (optional / stretch for this task)
- [ ] (Stretch) A live-preview `<SkinEditor>` with a real color picker (`<input type="color">`/HSV) + grouped tokens + "inherit" default. If not in this task, import/export from 1d covers authoring. (§6a Q1.)

**Acceptance (Phase 1):**
- A user can apply a bundled sample skin and the whole app recolors (Midnight Neon, Paper land fully; Brutalist/Roomy show their colors — geometry follows in Phase 2).
- Import a skin JSON (clipboard/file) → validated → applied; export the active skin to clipboard.
- Reset to Default restores the base theme + the user's prior accent/theme.
- Folder/channel/icon colors keep their hue under every sample skin and stay legible (verified in-browser); without a skin they're pixel-identical to today.
- Persists across reload; invalid stored skins are rejected on read.
- `yarn build` + `npx tsc --noEmit` clean; no mobile regression (no shared breaking change).

---

## Open items this task surfaces (not blockers for 0–1)
- `/skins` server endpoint live for desktop? → confirm with lead before scoping Phase 3 (gallery). **(Genuine external unknown — the only one left.)**
- `fontScale` on Tailwind fixed-px text → decide rem-migration vs chokepoint scaling before Phase 2.
- Spacing-scale-in-v1 vs radii+borders-only → Phase 2 UX call.

## Downstream dependency surfaced 2026-06-28 — "shared skin runtime" gates mobile-primitives-in-shared
A separate mobile design discussion (`quorum-mobile/.agents/reports/2026-06-28-shared-primitives-on-mobile-analysis.md`)
concluded that mobile's UI components should eventually become the `.native.tsx` halves of the
quorum-shared primitives — **but that move is blocked on a piece this task does not (yet) build.**

This Phase 0 promotes only the **pure** skin engine and **explicitly keeps `radius()`/`space()`
per-app** (see line ~44). That's correct for desktop's colour/font/accent consumption, because
desktop primitives are CSS-var-driven and skinnable *without* any component change (only Phase 2
geometry var-ification touches them).

But a shared **`.native.tsx`** primitive (e.g. a future shared `Button.native.tsx` ≈ today's mobile
`components/ui/Button.tsx`) reads the skin **from inside the component** (`useSurface`, `Skin.space`)
— RN has no ambient CSS layer to mutate. So for mobile primitives to live in shared, shared needs a
**cross-platform skin runtime**, not just the pure engine:
- `activeSkin` carried in **shared's** theme context (shared's `ThemeProvider` is a flat
  `{ colors, getColor }` today — no skin field). This is the same plumbing the IconSymbol migration
  already names as its Phase-4 prerequisite (`quorum-mobile/.agents/tasks/2026-06-09-migrate-iconsymbol-to-shared-icon-primitive.md`).
- the geometry/surface **runtime** (`radius()`/`space()` singletons + `useSurface`) promoted to
  shared with native + web implementations behind one interface (web impl = the CSS-var/`SkinService`
  path; native impl = mobile's current `theme/skins/` runtime).

**No task owns this runtime layer yet.** It naturally slots between this Phase 0 (pure engine) and
the eventual Phase 4 (icon/surface substitution + primitive promotion). Flagging here so the
skins-port owner scopes it when Phase 1 lands — it is the true gating dependency for
primitives-in-shared on **both** platforms, and the IconSymbol convergence depends on it too.

> **Do NOT swap mobile onto shared's current `ThemeProvider`** as a shortcut — that was considered
> and rejected (it would delete the skin feature and rewrite 158 mobile call sites). The runtime must
> be promoted *up into* shared, not have mobile downgraded onto shared's flat provider.

## Phase 2 readiness note (2026-06-11)
The geometry-bridge spike is **done** (see deep dive §4a-bis): the Tailwind→CSS-var bridge compiles and renders, `calc()`/negative-margin/`space-x` utilities survive, the `_variables.scss` SCSS side bridges in lockstep, and the one silent-failure trap (bare SCSS `+` on a geometry var) is pre-located to **exactly 3 lines** (`Input.scss:103,273`, `_dropdown-result-item.scss:218` — wrap in `calc()`). Raw-literal cleanup surface ≈ 30 spacing + 1 border. So Phase 2 has **no architectural unknown** and is ready to turn into its own task whenever Phase 1 lands; estimate holds at ~3–5 days.

## PR sequencing
1. **quorum-shared PR** (Phase 0) → review/merge → **publish**.
2. **quorum-desktop PR** (Phase 1) consuming the published version. Can be one PR or split (substrate+SkinService / settings UI / folder-color nudge) per reviewer preference — small-PR bias per the cross-repo workflow.
3. **(later, off critical path)** mobile PR switching `theme/skins/` imports to the shared copies + deleting local duplicates — goes to the lead dev, lands whenever.

---

*Last updated: 2026-06-28 — added "Downstream dependency" note: a shared cross-platform skin runtime (activeSkin in shared's theme context + promoted geometry/surface runtime) is the unowned prerequisite gating mobile-primitives-in-shared; surfaced by the mobile primitives analysis report. No scope change to Phase 0–1.*

*Previously: 2026-06-11*
