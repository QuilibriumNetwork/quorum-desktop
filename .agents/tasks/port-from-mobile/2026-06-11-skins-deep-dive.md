---
type: research
title: "Skins (custom themes) — deep dive on porting from mobile to desktop"
status: complete
candidate: 27
created: 2026-06-11
---

# Skins (custom themes) — deep dive (candidate #27)

Not urgent. This is a scoping/feasibility deep dive so we have context when work starts. It maps the mobile skin engine in full, maps desktop's theming architecture, and lands on a concrete difficulty assessment + a phased plan. **Decided (user, 2026-06-11): full parity — colors, fonts, AND geometry; app-wide, mirrors mobile.**

**TL;DR:** The skin *engine* (the declarative manifest + the security-critical validator) is almost entirely portable — it's pure, dependency-free TypeScript and a strong `quorum-shared` promotion candidate. **Colors and fonts apply to desktop trivially** because desktop already drives every color through CSS custom properties (one nuance: a skin carries only 3 accent control points but desktop renders an 11-stop accent ramp — needs a small interpolation helper, see §6). **Geometry is the largest chunk, but smaller than first feared** (audit §4a): desktop expresses radii/spacing via Tailwind utilities + SCSS tokens, but Tailwind uses its *default* scales, so a one-time **~3-file** Tailwind+SCSS → CSS-var bridge re-routes ~1,500 usages at once — the cost is the visual regression pass, not per-component edits. Revised to ~3–5 days. **Phasing** (for shippable increments, not scope-cuts): shared promotion → colors/fonts → geometry → gallery → wallpaper/surfaces/icons. **Cross-device behaviour decided (§10):** active skins stay **device-local** (no cross-device sync — it would force fragile rendering pairing); the **gallery is shared** across both apps but couples only on the *schema* (the shared validator), not on rendering, so it's additive — each app applies what it supports and degrades gracefully.

---

## 1. What the mobile feature actually is

A **skin** is a declarative, validated, code-free token document (`SkinOverride`) that re-themes the *entire app* (it is app-wide, not per-space — confirmed: the active skin is one global selection in `services/theme/skinPrefs.ts`). It can override:

| Capability | Manifest field | Notes |
|---|---|---|
| Colors | `colors.light` / `colors.dark` | 22 named tokens: `accent`/`accentLight`/`accentDark`, `surface0..10`, `textStrong/Main/Subtle/Muted`, `danger/warning/success/info` |
| Corner radii | `radii` | named `sm/md/lg/pill` **or** a global `scale` (0 = square everywhere) **or** absolute `set` |
| Spacing | `spacing` | named `xs..xl` **or** a global `scale` |
| Borders | `borders` | `hairline/thin/thick/color` **or** a global `scale` |
| Font size | `fontScale` | global multiplier 0.7–1.6 on every type token |
| Embedded font | `font` | single TTF/OTF face as a `data:` URI |
| Icon substitution | `icons` | `Record<iconName, {image: dataURI, tint?}>`, up to 400 |
| Wallpaper | `wallpaper` | `data:` image + `fit` (cover/tile/contain) + `scrimOpacity` + `surfaceAlpha` (makes surfaces translucent so it shows through) |
| Frame chrome | `frame` | allow-listed enums: `corner`, `accentBorder`, `headerBar`, `panelGlow` |
| Per-region surfaces | `surfaces` | 12 allow-listed slots (`feed/messages/spaces/profile/button/card/input/header/tabBar/chatBubble/...`), each with bg/fit/opacity/text, cascading by dotted key |

Plus a **server gallery**: browse (popular/new + search), install (counted), and **Ed448-signed publish** (sign `manifest || thumbnail || be64(timestamp)`).

### Mobile source inventory (~2,300 LOC total)

```
theme/skins/types.ts                205  pure types + key lists
theme/skins/validate.ts             488  SECURITY BOUNDARY — pure, zero deps
theme/skins/mergeSkin.ts             38   pure (withAlpha, skinFontFamily)
theme/skins/geometry.ts             85   radius()/space()/border()/font() + scale singleton
theme/skins/frame.ts                31   FrameOptions -> RN ViewStyle (RN-specific)
theme/skins/samples.ts              77   4 bundled sample skins (pure data)
theme/skins/surfaces.tsx           143  useSurface()/<SurfaceBackground> (RN-specific)
theme/skins/skinnableStyleSheet.ts  47   RN StyleSheet re-eval hack (RN-specific)
theme/skins/fontLoader.ts           54   expo-font loader (RN-specific)
theme/ThemeProvider.tsx            117  applies skin into createTheme() (parallels desktop's provider)
theme/themes.ts (skin parts)        ~30  merges skin tokens into the runtime theme object
services/theme/skinPrefs.ts          85   MMKV persistence + re-validate-on-read
services/skins/skinsClient.ts       209  gallery API + Ed448 publish
components/skins/SkinsModal.tsx     406  management UI (apply/import/export/publish/gallery)
components/skins/SkinEditor.tsx     445  live-preview authoring UI
```

---

## 2. Why mobile's architecture makes this "easy" on mobile

Mobile's **entire UI reads from a runtime theme object** via `useTheme()` (colors, radii, spacing, fonts), *plus* four geometry helper functions — `Skin.radius(n)`, `Skin.space(n)`, `Skin.border(n)`, `Skin.font(n)` — that components call **instead of writing raw `borderRadius: 8` / `padding: 16`**. The active skin:

1. merges its color tokens into `createTheme()` (`themes.ts`),
2. updates a module-level geometry singleton (`setSkinGeometry`) that the four helpers read,
3. bumps a version so static `StyleSheet.create` blocks re-resolve (`skinnableStyleSheet.ts`).

So a skin re-themes everything because **there is exactly one chokepoint per token type**. This is the crux: porting difficulty is entirely a function of *how many chokepoints desktop has and whether they're runtime-overridable*.

---

## 3. Desktop's theming architecture (verified)

Desktop is **CSS-custom-property-first**, with three layers:

1. **`:root` / `html.dark` CSS variables** (`src/styles/_colors.scss`) — the canonical render source. `--surface-00..--surface-10`, `--accent-50..900` + `--accent` + `--accent-rgb`, `--color-text-strong/main/subtle/muted`, `--danger/warning/success/info`, and dozens of **semantic composites** (`--color-bg-sidebar: var(--surface-0)`, `--color-bg-modal: var(--surface-2)`, …).
2. **Tailwind config** (`tailwind.config.js`) maps those vars into utility classes (`bg-sidebar`, `text-main`, `bg-accent-500`, `bg-danger/50`).
3. **TS `getColors()` in quorum-shared** — used by RN, **not** consumed on web. Web reads CSS vars.

- **Light/dark:** a class on `<html>` (`html.dark`), toggled by `ThemeProvider.web.tsx`. Persisted in `localStorage('theme')`.
- **Accent:** a class on `<html>` (`html.accent-purple` etc.), each class redefining `--accent-*`. Persisted in `localStorage('accent-color')`. **Not** in `UserConfig`, **not** server-synced.
- **Geometry:** `$rounded-*`, `$s-*`, `$border-*` are **build-time SCSS variables** (`_variables.scss`) compiled to literal px/rem. Plus pervasive **Tailwind geometry classes** (`rounded-lg`, `p-4`, `gap-2`) also baked at build time. Shadows are the exception — already CSS vars.
- **Fonts:** one `@font-face` (Inter) in `_base.scss`. The FontFace API works fine for runtime injection.
- **Icons:** Tabler (`@tabler/icons-react`) via shared's `Icon.web.tsx` + a static name→component map (`iconMapping.ts`, ~260 entries). No runtime override hook.
- **Settings UI:** `UserSettingsModal` with a hardcoded tab array in `Navigation.tsx` (general/privacy/security/notifications/appearance/help/danger) + a `switch`. `Appearance.tsx` (~99 LOC) does theme + 6 accent swatches + language only.
- **Ed448 signing:** desktop has the exact canonicalize-then-sign primitive already, cleanest at `PublicProfileService.signWithUserKey` (`ch.js_sign_ed448` + `int64ToBytes` from shared). A skin-publish endpoint is a direct copy of that pattern.

---

## 4. Capability-by-capability difficulty

| Skin capability | Desktop difficulty | Why |
|---|---|---|
| **Colors (22 tokens)** | 🟢 **Trivial** | Desktop already drives every color through `--surface-*`/`--accent-*`/`--color-text-*` and semantic composites cascade off them. Inject with `root.style.setProperty('--surface-0', …)`. No build change. |
| **Accent override** | 🟢 Trivial | Same mechanism; set `--accent-*` on `:root` (bypass or extend the `accent-*` class). |
| **Light/dark base pin** | 🟢 Trivial | Skin's `base` → add/remove `html.dark`. Already how the toggle works. |
| **Embedded font** | 🟢 Easy | `new FontFace(family, dataURI).load()` → `document.fonts.add()`, then override `:root { font-family }`. No infra needed. |
| **fontScale** | 🟡 Medium | No single multiplier exists. Cleanest: set `:root { font-size }` and ensure type scale is rem-relative — **but** desktop type sizes are often Tailwind px classes (`text-sm` = 14px fixed), so a global rem scale won't catch them. Needs either a rem migration or a `--font-scale` var threaded into key text styles. |
| **Wallpaper** | 🟡 Medium | Doable as a fixed background layer + `surfaceAlpha` making `--surface-*` translucent (mobile's `withAlpha` trick maps directly to setting rgba CSS vars). The work is making the right surfaces translucent without wrecking legibility on Electron's chrome (sidebars/modals are opaque `surface*` today). |
| **Frame chrome** | 🟡 Medium | `accentBorder`/`panelGlow`/`headerBar` map to CSS on a few container boundaries; needs identifying those boundaries in desktop's layout and wiring a few classes/vars. Bounded. |
| **Per-region surfaces** | 🟡 Medium | Mobile's `<SurfaceBackground slot>` has no desktop equivalent; each of the 12 slots must be wired to a real desktop region. Incremental (unwired slots are simply ignored), so can ship a subset. |
| **Geometry scale (radii/spacing/borders)** | 🟡 **Medium** (downgraded from 🔴 after the 2026-06-11 audit, §4a) | The biggest chunk, but smaller than first feared: Tailwind uses its **default** scales (no `extend` override), so radii/spacing/borders bridge to CSS vars in **one config file** covering all utility usages at once. See §4a for the counts. |
| **Icon substitution** | 🔴 Hard-ish | The name→component map is a compiled static object. Needs a runtime-override wrapper around shared's `Icon.web.tsx` (`activeSkin.icons[name]` → render `<img>` instead of the Tabler component). Ties into the [mobile icon-primitive migration note](#icon-substitution-shared-icon-tie-in). Skippable for v1. |
| **Gallery + publish** | 🟢 Easy (if server endpoint exists) | Ed448 publish reuses `PublicProfileService` signing verbatim. Gallery is plain fetch + the *same* `validateSkin` re-validation. **Open infra question: is the `/skins` gallery endpoint deployed and is desktop's API base pointed at it?** Mobile hits `getApiConfig().baseUrl + '/skins'`. |

### The geometry approach (was "the crux"; the audit in §4a shrinks it)

Mobile re-skins geometry because every component calls `Skin.radius(n)`/`Skin.space(n)` — one chokepoint. Desktop expresses geometry two ways: **Tailwind utility classes** (`rounded-lg`, `p-4`) and **SCSS `$rounded-*`/`$s-*` tokens**. The original worry was that this is "an app-wide refactor touching every radius/padding." **The §4a audit shows that's not how it plays out** — because Tailwind uses its *default* scales (verified: `tailwind.config.js` has no `borderRadius`/`spacing`/`borderWidth` override), redefining those named scales to point at CSS vars in **one config block** covers *all* utility-class usages simultaneously, with zero per-component edits. The SCSS side is a mechanical find-replace of the token *definitions* (not call sites). So the approach is firmly option **(b) — Tailwind theme → CSS-var bridge** — and it's far more contained than "every file." See §4a for the exact surface and the step-by-step.

(Option (c), scope-cutting geometry, is moot — full parity incl. geometry is the decided scope.)

---

## 4a. Geometry surface audit (2026-06-11, measured not inferred)

Ran a full grep audit of `quorum-desktop/src` to ground the Phase-2 estimate, prompted by the user's hunch that "rounding is mostly buttons/modals/hovers, not many rounded surfaces." **The hunch is essentially correct, and the audit downgrades geometry from 🔴 Hard to 🟡 Medium.**

### Radius surface (the part a skin's "square/rounder" scale touches)
| Where | Count | How it's bridged |
|---|---|---|
| Tailwind `rounded-*` classes in TSX | **202** | **All covered by one `tailwind.config.js` change** — Tailwind uses its *default* `borderRadius` scale (no `extend`), so redefining the scale to `var(--rounded-*)` re-routes every `rounded-lg`/`rounded-md`/`rounded-full` at once. Dominant: `rounded-lg` (86), `rounded` (59), `rounded-md`/`rounded-full` (25 each). |
| SCSS `$rounded-*` token usages | **152** | Covered by editing the **token definitions** in `_variables.scss` (`$rounded-md: var(--rounded-md, …)`) — 1 file, ~9 lines. The 152 *call sites* don't change. |
| Raw literal `border-radius:` in SCSS | **42** | Of these, **29 are intentional non-scaling** (`0`, `50%`, `999px` — circles, pills, squared corners that a scale should leave alone). Only **13 are real px/rem literals** that bypass the token system (e.g. `Switch.scss: 34px`, `_modal_common.scss: 41px/35px`, a few `3px` scrollbar/onboarding bits). Those 13 are the *entire* manual cleanup surface for radii — token-ify them or leave them (most are tiny/decorative). |

**Confirmed the user's hunch on clustering:** `rounded-lg` in TSX concentrates in `message` (7 files), `modals` (6), then `ui`/`bookmarks` — i.e. buttons, modals, cards, message bubbles, dropdowns. No sprawling "every surface is rounded" problem. The 29 non-scaling literals are mostly circles/pills (avatars, status dots, toggles) which *should* stay fixed anyway.

### Spacing surface
| Where | Count | Note |
|---|---|---|
| Tailwind `p-/m-/gap-/space-*` in TSX | **~1,161** | Large, but again **all covered by one Tailwind `spacing` scale redefinition** (default scale, no override). No per-site edits. |
| SCSS `$s-*` token usages | **~850** (top: `$s-2` 202, `$s-1` 180, `$s-4` 148) | Covered by editing the `$s-*` definitions, 1 file. |

The 1,161 number looks scary but is irrelevant to effort — it's the *payoff* of Tailwind's design (one scale, many consumers), not the cost. **Caveat:** scaling *all* spacing app-wide is riskier than radii visually (it shifts every layout), so a conservative v1 could scale **radii + borders only** and treat `spacing.scale` as a later refinement — mobile's spacing-scale samples ("Roomy") are the least essential. Worth a small UX call.

### Border-width surface
Trivial: `$border` (64) / `$border-2` (24) in SCSS, ~325 `border` + a handful of `border-2` in TSX. Same one-config-line bridge. Mobile's `borders.scale` is the lowest-value knob; cheap to include or defer.

### What Phase 2 actually is (revised)
1. **One `tailwind.config.js` edit** — point `theme.extend.borderRadius`, `spacing`, `borderWidth` at `var(--rounded-*)` / `var(--space-*)` / `var(--border-*)` (with literal fallbacks). Covers ~1,500+ utility usages in one shot.
2. **One `_variables.scss` edit** — rewrite the `$rounded-*` / `$s-*` / `$border-*` *definitions* to read the same CSS vars. Covers all ~1,000 SCSS token call sites.
3. **Emit the `:root` / `html.dark` defaults** for those new vars (mirrors the existing color-var blocks).
4. **`SkinService` sets the scaled values** onto the vars from `deriveGeometry`.
5. **Clean up the 13 real raw-literal radii** (optional — token-ify or leave).
6. **Visual regression pass.** Still required (every radius/padding now flows through a var), but the *code* surface is ~3 files, not "every component." The regression is the real time sink, not the edits.

**Revised effort:** the code change is **~1–2 days**; the regression/QA pass is **~2–3 days**. So Phase 2 ≈ **3–5 days**, not the 4–7 I first guessed — and the risk is "did a var fallback get missed somewhere" (catchable in QA), not architectural. **Net: full-parity geometry is clearly doable and not the scary part it looked like before the audit.**

### 4a-bis. Phase-2 spike results (2026-06-11) — bridge VERIFIED, one small gotcha found

Ran a throwaway spike (reverted) to confirm the bridge compiles + renders and to find failure modes before committing the estimate. **There is no architectural unknown — Phase 2 is fully answerable from the codebase, and the spike de-risked it.** Findings:

1. **Tailwind side compiles + emits correctly.** Pointing `borderRadius` at `var(--rounded-*, fallback)` in the config → utilities emit `border-radius: var(--rounded-lg, 0.5rem)`. `rounded-full` (9999px) and `rounded-none` (0) stay fixed as intended. ✅
2. **The two scariest Tailwind utilities survive.** `-mt-4` (negative margin) → `calc(var(--s-4, 1rem) * -1)` — valid. `space-x-4` (nested calc with reverse var) → `calc(var(--s-4,1rem) * calc(1 - var(--tw-space-x-reverse)))` — valid. So `calc()`/negative/`space-*` utilities do **not** break with var-valued spacing. ✅ (This was the main thing I was unsure about.)
3. **`_variables.scss` side bridges cleanly (answers the "we also use _variables.scss" point).** A SCSS var holding a CSS var (`$rounded-lg: var(--rounded-lg, 0.5rem)`) compiles fine and its consumers (`@use '@/styles/variables'`, e.g. `Button.scss: padding: $s-2 $s-4`) emit the `var()` through untouched. Both consumers (Tailwind *and* SCSS) route through the same `--*` vars → they scale in lockstep, no divergence. ✅
4. **The one real gotcha — SCSS compile-time `+` on a geometry var fails SILENTLY.** `$s-10 + $s-0-5` where the operands are `var()` compiles to broken `var(...)var(...)` concatenation (no error, just wrong CSS). Audited the whole repo for this: **exactly 2 sites** do bare SCSS arithmetic on `$s-*`/`$rounded-*`/`$border-*`:
   - `components/primitives/Input/Input.scss:103` + `:273` — `height: $s-10 + $s-0-5` (same expr twice)
   - `styles/_dropdown-result-item.scss:218` — `max-height: $s-80 + $s-7`
   - **Fix:** wrap each in `calc(...)` (`calc($s-10 + $s-0-5)`) — `calc()` with var operands is valid (verified). Every *other* `+` in the repo is already inside `calc()` (safe) or on layout vars (`$screen-*`/`$rail-*`/`$header-*`/`$sidebar-*`) that aren't in the geometry-scaling set. **So the entire breakage surface is 3 lines, mechanically fixable.**
5. **Raw-literal cleanup surface (the spacing/border equivalent of the §4a radius count).** Bare literal `padding`/`margin`/`gap` in SCSS bypassing `$s-*`: ~12 padding + ~14 margin + 4 gap = **~30**; raw `border-width` literals: **1**. These won't scale under a skin (minor visual inconsistency) — token-ify or accept. Same encouraging shape as radii: mostly token-routed already.

**Net after the spike:** the estimate holds at **~3–5 days** (now grounded, not inferred). The "did a fallback get missed" risk is real but the silent-`+` gotcha is the only *non-obvious* trap and it's pre-located (3 lines). The visual regression pass remains the real time sink. **No blocker, no architectural unknown — Phase 2 is ready to plan whenever Phase 1 lands.**

---

## 5. quorum-shared promotion (the clean win regardless of scope)

These are **pure, RN-free, web-safe** and should move to `@quilibrium/quorum-shared` so both apps consume one validator (security-critical: a skin valid on one app and rejected on the other is a UX bug, and a divergent validator is a security risk):

- `theme/skins/types.ts` (205) — pure types + `SKIN_COLOR_KEYS`/`SLOT_NAMES`.
- `theme/skins/validate.ts` (488) — **the security boundary.** Strict allow-list, no-remote-URL rule, image content-sniffing (decodes magic bytes, doesn't trust declared MIME), bounded sizes. Uses only `TextEncoder`/`Uint8Array`/`btoa`-free base64 — runs identically in the browser. **Strong shared candidate.**
- `theme/skins/mergeSkin.ts` (38) — `withAlpha`, `skinFontFamily`. Pure.
- `theme/skins/geometry.ts` deriveGeometry (the pure part) — pure math.
- `theme/skins/samples.ts` (77) — pure data.

**Re-implemented per-platform (not shared):** `fontLoader` (expo-font vs FontFace API), `surfaces` (RN style vs CSS), `skinnableStyleSheet` (RN-only hack, desktop doesn't need it — CSS vars are already live), `frame` (RN ViewStyle vs CSS), and the application point (`ThemeProvider`/`themes.ts` → desktop CSS-var injection).

**Ed448 signing-payload helpers:** skin publish signs `manifest || thumbnail || be64(timestamp)` — the **third** call site (after #5 Reporting and #6 Public Profile) for the canonicalize-then-sign pattern. If skins lands, promote the helpers (`int64BE`/`concatBytes`/sign) to shared at the same time. Note `int64ToBytes` already exists in shared (desktop uses it); mobile's skinsClient rolls its own `int64BE` — converge them.

> ⚠️ **Mobile-safety rule applies** ([[feedback_dont_break_mobile_on_shared_changes]]): any shared promotion must be additive and not break mobile, which is pinned to a published shared version. The validator move must be byte-for-byte behavior-preserving.

---

## 6. Color-token mismatch — VERIFIED counts + the exact mapping to pin

The user flagged this as the main uncertainty, and it is the one thing that **must** be pinned before coding, because the shared validator's allow-list is the contract both apps enforce. I verified the real token sets in both repos (not inferred):

### The skin manifest's color allow-list (the shared contract)
`SKIN_COLOR_KEYS` (`types.ts:38`) — **22 keys**, this is what a skin may override and what the validator accepts:
`accent, accentLight, accentDark` · `surface0..surface10` (11) · `textStrong, textMain, textSubtle, textMuted` · `danger, warning, success, info`.

### Surfaces — 11 vs 12 (clean, minor)
- **Mobile:** `surface0..surface10` = **11** (`themes.ts:135-145`).
- **Desktop:** `--surface-00` **plus** `--surface-0..--surface-10` = **12** (`_colors.scss:23-35`). The extra `-00` is pure white / the app bg + chat input.
- **Mapping to pin:** `skin.surfaceN → --surface-N` for N=0..10 (1:1, no offset — both run lightest-near-0). Desktop's `--surface-00` is **not** a skin token; leave it driven by the base theme, OR alias `--surface-00 := surface0` if a skin should also retint the pure-white app bg. Recommend leaving `-00` un-skinned in v1 (keeps the app frame stable; mobile has no equivalent so imported mobile skins won't define it anyway).

### Accent — the real mismatch (3 control points vs an 11-stop ramp)
This is the substantive one, not the surfaces.
- **A skin carries only 3 accent values:** `accent`, `accentLight`, `accentDark` (`types.ts:12-14`).
- **Mobile renders accent from a 9-stop internal ramp** (`accent[50..900]` in `accentThemes`), but a skin overrides only **3 points**: `500 ← accent`, `200 ← accentLight`, `700 ← accentDark` (`themes.ts:128-130`). The other stops keep the selected base-accent palette. It also derives `accentSoft`/`accentSubtle` as alpha-of-accent at render time.
- **Desktop renders accent from an 11-stop CSS ramp:** `--accent-50, -100, -150, -200, -300, -400, -500, -600, -700, -800, -900` + `--accent` + `--accent-rgb` (`_colors.scss:7-20`), switched wholesale by `html.accent-*` classes.
- **The gap:** a skin gives 3 points; desktop needs ~11 stops + the rgb triple. **Two ways to resolve, pick one and pin it:**
  1. **Inject the 3 and interpolate the rest** — set `--accent-500 ← accent`, `--accent-200 ← accentLight`, `--accent-700 ← accentDark`, then compute the intermediate stops (50/100/150/300/400/600/800/900) by interpolating between the three anchors, and set `--accent`/`--accent-rgb` from `accent`. Faithful to how mobile uses it; a ~20-line color-ramp interpolation helper (shared, pure). **Recommended.**
  2. **Inject only `--accent-500`/`--accent`/`--accent-rgb` and leave the rest of the ramp on the base palette** — simpler, but hover/active accent shades (300/600) won't track a skin's accent, so accent-tinted hovers look "off-palette." Acceptable for a quick v1, but visibly imperfect.
- This is **net-new shared logic** (the ramp interpolation) regardless of which option — it doesn't exist on mobile because RN only needs the 3 points. Small and pure, good shared home.

### Text + semantic — exact match
- **Text:** both have `textStrong/Main/Subtle/Muted` ↔ `--color-text-strong/main/subtle/muted`. 1:1.
- **Semantic:** both have `danger/warning/success/info` ↔ `--danger/--warning/--success/--info` (desktop stores them as space-separated rgb triples for `rgb(var() / opacity)`; the injector must convert the skin's hex → `"r g b"` triple for these four — trivial, ~5 lines).

### Net for the injector
A desktop `applySkin(skin)` writes, per token:
- 11 surfaces → `--surface-0..10` (hex, direct).
- 4 text → `--color-text-strong/subtle/muted` (hex) + `--color-text-main` (rgb triple — note desktop stores `main` as a triple, `strong/subtle/muted` as hex; match each).
- 4 semantic → `--danger/--warning/--success/--info` (hex → rgb triple).
- accent → the 3-point-to-11-stop expansion above + `--accent`/`--accent-rgb`.

All of that is `root.style.setProperty(...)` with **no build change**. The only non-trivial piece is the accent ramp expansion. **Pin the surface 1:1 mapping and the accent option (recommend #1) in the design doc before coding.**

---

## 6a. Color-input UX + interaction with desktop's existing color picker (raised 2026-06-11)

Two questions from the user, both verified in the code.

### Q1 — How does mobile let you pick skin colors? (and is there room to improve?)
**Mobile uses free-form hex text entry, no visual picker, no limited palette.** `SkinEditor.tsx:272` is a plain `TextInput` with `placeholder="#hex / inherit"`; the only visual element is a tiny 26px swatch that previews whatever hex you typed (`SkinEditor.tsx:438`). It exposes just **5 high-impact color fields** (`accent`, `surface1`/Background, `surface2`/Cards, `textMain`/Text, `textMuted`/Muted text — `SkinEditor.tsx:25-31`), even though the manifest supports all 22 tokens. Validation is `HEX_RE` (3/4/6/8-digit hex; the validator also accepts `rgba()`).

**Room for improvement (desktop should do better than a raw hex field):**
- **Add a real color picker.** Desktop is a browser — a native `<input type="color">` or a small HSV picker is trivial and far better UX than typing hex. This is a clear, low-cost desktop optimization over the mobile original.
- **Expose more than 5 tokens, sensibly grouped.** The 5-field limit is a mobile screen-space concession; desktop has room for a grouped editor (accent / surfaces ramp / text / semantic) without overwhelming. Keep "inherit" as the default so a skin only overrides what it sets.
- **Offer the full surface ramp as a single "tint" control + advanced per-token.** Most users want "make it purple-ish," not to set 11 surface steps. A derive-the-ramp-from-one-base-color helper (the same interpolation we're building for accent, §6) could power a one-knob mode, with per-token overrides behind "Advanced." This is a genuine UX upgrade the mobile editor lacks.
- These are **editor-side** improvements — they don't change the manifest/validator (the shared contract stays identical), so they're safe to do desktop-only without breaking gallery interop.

### Q2 — How do the existing folder/channel/icon colors interact with skins? (the important one)
This is the right thing to worry about, and the answer is **mostly good news, with one fix needed.**

**Verified:** desktop's folder/channel/icon colors are **not stored as raw hex** — they're stored as **named tokens** (`'blue'`, `'purple'`, `'green'`, `'default'`, …) and resolved to hex at render time. The picker lives in `IconPicker` (`components/space/IconPicker/`), the palettes are `ICON_COLORS` / `FOLDER_COLORS` in `IconPicker/types.ts:148-168` (8 named options each), and resolution goes through `getIconColorHex()` / `getFolderColorHex()` (`types.ts:172-199`).

**Why "stored as a name, not a hex" matters:** the user's concern — "a color I picked for a folder may look bad under some skins" — is **structurally avoidable** precisely because we stored the *intent* (`'blue'`), not a frozen value. The system can re-resolve `'blue'` to a skin-appropriate blue. Compare: if folders stored `#5f8eeb` directly, they'd be permanently stuck and clash with every dark/neon skin. They don't — so we're in the good position.

**The one real problem:** `getIconColorHex`/`getFolderColorHex` currently resolve to **hardcoded hex literals** (`'blue' → '#3b82f6'`, folder `'blue' → '#5f8eeb'`, etc. — `types.ts:148-168`), **not** to CSS vars or the theme. So today these colors are **frozen** and would **not track a skin** — a folder set to "blue" stays the same `#5f8eeb` even under Midnight Neon, which is exactly the clash the user fears. (They already half-ignore even the *accent* system — note they're a fixed 8-color palette, distinct from the 6 theme accents.)

**The fix (DECIDED: Option B, hue-locked legibility nudge — full detail below).** The user's hard constraint: a chosen color's **hue is intent and must never be repainted** (a red "incidents" icon stays red under every skin). A skin may adjust *only* legibility (lightness) and *only* when the color would otherwise be unreadable on its background. The substrate is still a CSS-var bridge (`--icon-color-*`/`--folder-color-*`, defaults = today's literals), but the live adjustment is a hue-preserving OKLCH lightness nudge, not a retint. Then:
**The DECIDED approach (2026-06-11): Option B — hue-locked legibility nudge, NOT retinting.** The user correctly rejected any approach that repaints these colors: a space owner who set a channel icon **red** ("incidents") or a user who color-codes folders has a *deliberate intent*, and auto-deriving a "skin-harmonious" replacement would destroy it. So the rule is: **the hue is sacred and never changes** — red stays red, blue stays blue, under every skin. The *only* thing a skin may affect is the **lightness/saturation needed for legibility** against its background, and only when the chosen color would otherwise be unreadable.

Three options were weighed:
- **Option A — leave the 10-color palette completely fixed/skin-independent.** Safest for intent, zero work, but the user's real concern stands: a fixed color (e.g. a mid-blue) can become near-invisible on an extreme skin (near-black neon, very light paper). Rejected as v1 *because* of the legibility risk.
- **Option B — lock the hue, let the skin nudge ONLY lightness for legibility (CHOSEN).** "Blue stays blue," but if it's unreadable on the active surface it's lightened/darkened the minimum amount to clear a contrast target. Hue + saturation preserved; presentation adapts only when physics demands it.
- **Option C — fixed by default, skins may ship an optional replacement palette.** More flexible but more work and re-introduces the "repaint intent" risk if authors abuse it. Deferred — only if real demand appears.

**How Option B works (technical):**
1. **Background is known, free.** After a skin applies, surfaces are live CSS vars; each folder/icon color sits on a *known* surface (folders → sidebar surface, channel icons → row surface). So we always know "render this red on *that* background." No guessing.
2. **Hue-preserving adjustment.** Convert the palette color to **OKLCH** (now native CSS, ~40 LOC of pure conversion or a tiny dep), measure WCAG contrast against the surface (~15 LOC), and if it's below target, raise/lower **lightness only** until it clears — hue + chroma locked. Pure function: `(paletteColor, surfaceColor) → adjustedColor`, deterministically unit-testable ("red on near-black → lighter red, same hue").
3. **Conditional — untouched when already legible.** If the chosen color already meets the contrast target (the normal case on most skins, and always without a skin), it is returned **exactly as picked** — zero change, full intent. The nudge fires *only* when contrast fails on an extreme skin, applying the **minimum** correction.
4. **Runs at the existing chokepoints.** `getIconColorHex`/`getFolderColorHex` (`IconPicker/types.ts`) already centralize resolution (~10 call sites). They'd take the resolved surface color and return the nudged value. Entire surface = those two functions.

**Effort & risk (Option B):** ~1–1.5 days for the pure OKLCH helper + wiring the ~10 call sites + unit tests, plus **~0.5 day tuning** the contrast threshold + nudge curve against the real sample skins. **Self-contained — no skin-manifest change, no validator change, no shared/schema change, no gallery impact.** It lives entirely inside desktop's color-resolution functions.
- **The one thing that needs in-browser verification, not just code:** "looks good on every skin" is only knowable by looking. Verify against the neon / near-black / very-light samples before calling it done — too-aggressive a target drifts all colors toward a samey mid-lightness; too-gentle leaves some unreadable. Treat the tuning pass as real work.

**Still bridge the 16 palette literals to CSS vars** (`--icon-color-*`/`--folder-color-*`, defaults = today's literals) as the substrate — it's also the right fix for the *existing* (skin-independent) issue that these don't currently adapt to light/dark properly. Option B's nudge then operates on those resolved values.

> **Cross-link:** this is a *desktop-specific* concern — mobile's skin engine doesn't address folder/channel colors. Net-new desktop work, belongs in Phase 1. Users keep picking from the named palette (no picker-UX change, no stored-data migration) — the reason this is manageable rather than a redesign.

---

## 7. Possible mobile-side improvements (asked for in the brief)

Things worth doing on mobile *before or alongside* a desktop port, to make convergence cleaner:

1. **Promote `validate.ts` + `types.ts` to shared now**, even before any desktop work. It's the single highest-leverage move: locks the manifest contract in one place, and mobile keeps working unchanged (additive). Low risk, high future payoff.
2. **Converge `int64BE` → shared `int64ToBytes`** in `skinsClient.ts` (mobile rolls its own). Trivial, removes a divergence.
3. **`fontScale` doesn't catch everything even on mobile?** Worth confirming mobile applies it uniformly; if desktop needs a `--font-scale` var, designing the token to be a clean multiplier on both sides now avoids divergence.
4. **Icon-substitution shared tie-in** (see below) — already tracked; the skin icon layer is the blocker for the mobile `IconSymbol → shared Icon` migration. Promoting skin types to shared unblocks designing that.
5. **Document the surface-token count contract** (11 vs 12) so the shared validator and both apps agree.

No optimization is *required* to port; these just reduce the eventual desktop-port friction and de-duplicate the security boundary early.

<a id="icon-substitution-shared-icon-tie-in"></a>
### Icon-substitution / shared `Icon` tie-in

Mobile's `IconSymbol → shared Icon` migration was blocked by the lack of a skin icon-substitution path in shared's `Icon`, but **the crash that surfaced is already resolved on mobile with a temporary fix** (a thin local `Icon` wrapper that keeps the `activeSkin.icons[name]` lookup and delegates rendering to shared's `Icon`). So this is **not a blocker** for the skin port — it's an optional convergence bonus. If skins is taken on, moving the icon-substitution layer into shared's `Icon` (skin-aware, driven by shared theme/skin context) would let mobile delete its temporary wrapper and give desktop icon-skinning for free. Worth doing when we wire desktop icon substitution (Phase 4), but it can be done independently and isn't on the critical path.

---

## 8. Phased plan

> **Implementation task drafted (2026-06-11):** [`2026-06-11-port-skins-phase-0-1.md`](2026-06-11-port-skins-phase-0-1.md) covers the ready slice (Phase 0 shared promotion + Phase 1 colors/fonts/accent engine + Option-B folder-color nudge). Phases 2–4 stay here as the plan-of-record and get their own tasks once their unknowns resolve (geometry-bridge spike; `/skins` endpoint confirmation).

**Decided (user, 2026-06-11): full parity — geometry IS in scope.** App-wide skin, mirrors mobile (not per-space). So geometry is no longer a "maybe skip" — it's a required phase, and it's the single largest chunk of work. Phasing is purely for shippable increments, not for deciding what's in/out.

**Phase 0 — shared promotion (no desktop UI yet, ~0.5–1 day)**
Move `types.ts` + `validate.ts` + `mergeSkin.ts` (+ pure `deriveGeometry`, `samples.ts`) into `@quilibrium/quorum-shared`. Repoint mobile imports (additive — must not break mobile, per [[feedback_dont_break_mobile_on_shared_changes]]). Verify mobile + web both build. Pure groundwork, shippable on its own. Add the new pure helpers here too: the **accent 3-point → 11-stop ramp interpolation** (see §6) and a hex→`"r g b"` triple converter for the semantic tokens.

**Phase 1 — colors + accent + fonts + base (~2–4 days)**
- Desktop `SkinService` (web): given a validated `SkinOverride`, inject onto `:root` — 11 surfaces → `--surface-0..10`; 4 text → `--color-text-*` (mind `main` is an rgb triple, the others hex); 4 semantic → `--danger/warning/success/info` (hex→triple); accent → the 3-point expansion + `--accent`/`--accent-rgb`. Pin `html.dark` to the skin's `base`. Load the embedded font via FontFace + override `font-family`.
- Persist active skin + local library in `localStorage`/IndexedDB (mirror `skinPrefs`, re-validate on read).
- New "Skins" tab in `UserSettingsModal` (`Navigation.tsx` + a `case 'skins'`), coexisting with Appearance. Apply/reset + import-from-clipboard/file + export. Bundled samples (the two color-only ones — Midnight Neon, Paper — land fully; Brutalist/Roomy land their colors, geometry follows in Phase 2).
- **Folder/channel/icon palette — Option B hue-locked legibility nudge (§6a Q2).** Bridge the 16 palette literals to `--icon-color-*`/`--folder-color-*` vars (defaults = today's literals), then in `getIconColorHex`/`getFolderColorHex` apply a conditional OKLCH **lightness-only** nudge against the actual surface: hue/chroma locked (red stays red), fires *only* when the chosen color fails a contrast target on an extreme skin, minimum correction. No manifest/validator/shared change. ~1.5–2 days incl. an in-browser tuning pass against the neon/near-black/light samples (the threshold tuning is the only part that needs eyeballing, not just code).
- **Editor color input = a real picker, not raw hex (§6a Q1)** — desktop should ship `<input type="color">`/HSV + grouped tokens + an "inherit" default, improving on mobile's bare hex `TextInput`. Editor-only, doesn't touch the shared manifest/validator.
- **Ships a real, demoable feature** with zero architectural risk.

**Phase 2 — geometry + fontScale (~3–5 days; was the scary one, the §4a audit shrank it)**
Make radii/spacing/border-width runtime-injectable by routing both Tailwind and SCSS through CSS vars. The §4a audit confirmed this is ~3 files of edits + a QA pass, not an every-component refactor (Tailwind uses default scales, so one config block re-routes ~1,500 utility usages):
- **`tailwind.config.js`:** point `borderRadius`/`spacing`/`borderWidth` at `var(--rounded-*)`/`var(--space-*)`/`var(--border-*)` (literal fallbacks). Covers all Tailwind utility call sites at once.
- **`_variables.scss`:** rewrite the `$rounded-*`/`$s-*`/`$border-*` *definitions* to read the same vars. Covers all SCSS token call sites.
- **`:root`/`html.dark`:** emit the new var defaults (mirrors the color-var blocks).
- **`SkinService`:** set scaled values from `deriveGeometry` onto the vars.
- Optional: token-ify the 13 real raw-literal radii (§4a); the 29 non-scaling literals (circles/pills) stay fixed by design.
- `fontScale`: thread a `--font-scale` var; for Tailwind fixed-px text (`text-sm` = 14px) decide rem-migration vs scaling at a few text-style chokepoints.
- **Conservative v1 option:** scale **radii + borders only**, defer `spacing.scale` (scaling all padding shifts every layout — higher visual risk, lowest-value mobile sample). Small UX call.
- **Full visual regression pass required** — the code surface is small (~3 files) but every radius/padding now flows through a var, so QA is the real time sink. Risk is "a fallback got missed" (catchable), not architectural.

**Phase 3 — gallery + publish (~2–3 days, gated on the server endpoint)**
- Browse/install (re-validate every fetched skin client-side), install counter.
- Ed448 publish via the existing `PublicProfileService` signing pattern (third call site → promote the signing helpers to shared here).
- **Confirm first:** is `/skins` deployed and is desktop's API base pointed at it?

**Phase 4 — wallpaper, per-region surfaces, icon substitution**
- Wallpaper layer + `surfaceAlpha` translucency (set `--surface-*` to rgba via `withAlpha`); legibility pass on Electron's opaque chrome.
- Wire the 12 surface slots incrementally (unwired slots are simply ignored).
- Icon substitution: a runtime-override wrapper around shared's `Icon.web.tsx` (`activeSkin.icons[name]` → render `<img>`). Optionally fold the substitution into shared's `Icon` so mobile can drop its temporary wrapper (see §7 — the mobile crash is already fixed, so this is a bonus, not a blocker).

**Cross-device active-skin sync — ❌ removed from scope (see §10a).** The active skin stays device-local on both platforms, matching today's behaviour. The gallery (Phase 3) is shared across both apps but couples only on the schema, not on rendering — see §10b.

**Editor (`SkinEditor`, cross-cuts phases):** mobile ships a live-preview authoring UI (445 LOC). Desktop can ship import-only first (paste/upload JSON, which Phase 1 already covers) and add the editor later — it's the most UI-heavy single piece and isn't required for the capability. Worth a separate scope call on timing.

**Rough total for full parity:** ~10–15 eng-days for Phases 0–4 (down from the pre-audit 12–18 — §4a shrank Phase 2 to ~3–5 days). Phases 0–1 alone (~3–5 days) already ship a real color/font skin engine. No sync phase (dropped, §10a).

---

## 9. Bottom line

- **Capability gap is real** — desktop has nothing comparable (Appearance = theme + 6 accents + language).
- **Decided:** full parity, app-wide, geometry included.
- **Portability:** engine is a clean shared promotion (pure validator + types). Colors/accent/fonts apply trivially via existing `:root` CSS vars (the only non-trivial color piece is the accent 3→11 ramp expansion, §6). Geometry is the real work — an app-wide Tailwind+SCSS → CSS-var bridge plus a full visual regression pass.
- **Shippable increments:** Phase 0+1 (~3–5 days, zero architectural risk) is a real demoable color/font skin engine on its own; geometry (Phase 2) is the big chunk; gallery and wallpaper/surfaces/icons follow.
- **Resolved this session:** surfaces map 1:1 (`surfaceN → --surface-N`, `--surface-00` stays un-skinned in v1); accent resolves via 3-point→11-stop interpolation (recommended option #1); per-platform re-implementations identified; shared promotion agreed; mobile icon-symbol crash already fixed (icon convergence is a bonus, not a blocker); **cross-device active-skin sync dropped (§10a)** — device-local on both platforms; **gallery is shared but couples only on the schema, additive + graceful degradation (§10b).**
- **Still open (smaller calls, not blockers):**
  1. Editor on day one, or import-only first?
  2. Gallery v1 or later? (and is the `/skins` server endpoint live for desktop?)
  3. `fontScale` strategy for Tailwind fixed-px text (rem migration vs chokepoint scaling).
  4. Should `--surface-00` (pure-white app bg) also retint with a skin, or stay fixed? (recommend fixed v1.)

---

## 10. Cross-device behaviour — DECIDED 2026-06-11

This resolves two things that were initially conflated under "sync." They are different couplings, and the decisions differ.

### 10a. Active-skin cross-device sync — ❌ WON'T DO

"Mobile follows me to desktop" (the active skin syncing across a user's devices). **Decision: do not build it.**

- **Rationale (user):** it would force *exact rendering pairing* between the two apps — the synced skin must look identical on both, including geometry/wallpaper that don't translate across form factors (a phone-tuned wallpaper/spacing can be wrong on a wide desktop layout). High coupling cost, fragile, marginal UX gain.
- **Result:** the active skin stays **device-local on both platforms** — exactly today's model (mobile MMKV `skinPrefs.ts`, desktop `localStorage`). No `UserConfig.activeSkinId`, no per-layer sync policy, no form-factor-translation logic. All of that complexity is removed from scope.
- **Note:** this also matches desktop's *existing* behaviour — theme/accent prefs are already device-local (`localStorage`, not synced `UserConfig`). So "skins are per-device" is consistent with how appearance already works.

### 10b. The skin gallery — SHARED, single endpoint, both apps (unavoidable, and the *good* kind of coupling)

If a gallery ships at all, it is inherently cross-platform: there is **one `/skins` server endpoint**, users publish to it from either app, and a user on the other app browsing it will see and can install those skins. You can't have a per-platform gallery without splitting the publish pool, which defeats the point.

**The crucial distinction (this is what 10a's worry does *not* apply to):** the gallery couples the two apps on the **schema** (what a valid skin *is*), NOT on the **rendering** (how it *looks*). Those are very different:

- **Active-sync** demanded *identical rendering* → tight, fragile coupling → dropped (10a).
- **Gallery** demands only a *shared validation contract* → additive, robust → fine.

The shared contract is exactly the `validate.ts` + `types.ts` promotion (Phase 0). Once both apps validate against the same allow-list:

1. A skin published from either app is **installable on either app** (both accept the same manifest shape).
2. Each app **applies whatever subset of the manifest it supports and silently ignores the rest.** The manifest is *already designed this way* — mobile's own `surfaces` slots are documented as "unwired slots are simply ignored until a component adopts them," and the validator accepts the full token set regardless of which app reads it. So if desktop hasn't wired wallpaper, a wallpaper skin still installs and just applies its colors. **No rendering pairing required — only schema agreement.**

This is the "additive" property the user is pointing at: the apps don't need feature-for-feature parity to share a gallery. They need a **shared, additive schema** and **graceful degradation** when one app supports less than the manifest declares.

#### The one real consequence: graceful degradation across capability gaps
If desktop ships fewer capabilities than mobile at some point (e.g. colors but not yet geometry/wallpaper), a desktop user can install a richly-designed mobile skin and see a **flattened version**. This is **acceptable degradation, not a bug.** Two light UX touches make it clean (neither is a blocker):

- Apply-what-we-support silently (the default — the engine already ignores unwired pieces), and/or
- A subtle, optional "some effects aren't supported on this device" hint on install.

It does NOT justify pairing features 1:1. If anything it argues mildly *for* the decided "full parity incl. geometry" build — the more desktop supports, the less any skin degrades. But even at partial support the gallery works correctly.

### Net
- **Active skin: device-local, never synced.** (10a — won't-do. Removes the form-factor-pairing problem entirely.)
- **Gallery: shared, one endpoint, both apps.** Coupling is on the **schema** (the shared `validate.ts`/`types.ts`), which is **additive** — each app applies what it supports and ignores the rest, degrading gracefully across capability gaps. (10b)
- **Implication for the port:** Phase 0 (shared validator promotion) is now doubly load-bearing — it's both the de-dup of the security boundary *and* the contract that lets a shared gallery work without rendering pairing. The dropped sync work (former Phase 5) is **removed**, not deferred.

---

## 11. Is the full feature doable? (the bottom-line question, 2026-06-11)

**Yes — full skins incl. geometry is doable on desktop, with no architectural blocker.** After verifying the architecture *and* running the §4a geometry audit, confidence is high:
- **Colors/accent/fonts/gallery** — easy, ride existing CSS-var + signing infrastructure.
- **Geometry** — the largest chunk, but the audit showed it's a ~3-file bridge (Tailwind default scales + SCSS token defs → CSS vars) covering ~1,500 usages at once, *not* a per-component refactor. ~3–5 days incl. regression QA.
- **Wallpaper/surfaces/icons** — bounded, incremental.
- **Honest residual risk:** the only thing that could enlarge Phase 2 is a missed var-fallback during the bridge — catchable in the regression pass, not architectural. The 13 raw-literal radii (§4a) are the entire manual-cleanup surface for radii.
- **Total: ~10–15 eng-days for full parity (Phases 0–4)**; ~3–5 of those already ship a real color/font engine.

## 12. Where the shared promotion is tracked

The `validate.ts`/`types.ts`/`mergeSkin.ts` promotion described in §5 + Phase 0 is **not yet a standalone task in [`../quorum-shared-migration/`](../quorum-shared-migration/)**, and that's deliberate per the established workflow: that folder's [README](../quorum-shared-migration/README.md) records that **shared promotions discovered during port work are tracked per-candidate here in port-from-mobile**, and only become a standalone migration task when the port is actually picked up. This skin promotion is currently a *planned-but-not-started* Phase 0 of an unstarted port — exactly the "deferred shared-promotion opportunity" category the migration README points back to `candidates.md` for.

**When the skins port is picked up**, Phase 0 should spawn a real `../quorum-shared-migration/2026-XX-XX-promote-skin-engine.md` task (following that folder's cross-repo-workflow rules: additive, mobile-safe, small PR), and this doc + `candidates.md` #27 should link to it. Until then, it lives here so it isn't lost but doesn't clutter the active migration tracker. (Same pattern as the deferred signing-helper promotion flagged under #5/#6.)

---

*Last updated: 2026-06-11*
