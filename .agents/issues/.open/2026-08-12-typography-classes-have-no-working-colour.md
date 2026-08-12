---
type: bug
title: "Four typography classes set a colour that browsers silently drop, so text inherits instead"
status: open
priority: medium
created: 2026-08-12
updated: 2026-08-12
area: styling / typography / theming
repos: quorum-desktop
related:
  - "src/styles/_typography.scss (the four broken rules)"
  - "src/styles/_colors.scss (the mixed hex / rgb-triplet variable formats)"
  - "src/components/message/Message.scss (same defect, found by review 2026-08-12)"
  - ".agents/issues/.done/2026-08-11-dev-pages-design-system-design.md (found while doing this)"
---

# Four typography classes have no working colour

`src/styles/_typography.scss` sets text colour as `rgb(var(--color-text-*))`.
That form requires the variable to hold a **space-separated RGB triplet**. In
`src/styles/_colors.scss` only `--color-text-main` is stored that way. The other
two are hex literals, so the declaration expands to `rgb(#bfb5c8)`, which is
invalid CSS and is dropped by every browser. The element then inherits whatever
colour its parent has.

## Status

Found 2026-08-12 while building the dev-pages shell. **Not fixed** — deliberately
left alone, because correcting it changes production appearance broadly and that
should be its own reviewed change with before/after screenshots. The dev pages
work around it by pairing the class with a Tailwind colour utility.

Reviewed 2026-08-12: scope widened and the approach chosen after a visual
comparison — see **Decision** below. Still unimplemented, by choice.

## Evidence

`src/styles/_colors.scss` — **both themes** carry the identical mixed format, so
a fix has to cover both:

```scss
// dark theme, lines 181-183
--color-text-strong: #f8f7fa;   // hex
--color-text-main: 244 241 246; // rgb triplet
--color-text-subtle: #bfb5c8;   // hex

// light theme, lines 38-40
--color-text-strong: #3b3b3b;   // hex
--color-text-main: 54 54 54;    // rgb triplet
--color-text-subtle: #818181;   // hex
```

MEASURED in a running dev build, on a `<p class="text-label">`:

| | Value |
|---|---|
| computed `color` | `rgb(244, 241, 246)` |
| `--color-text-subtle` | `#bfb5c8` |
| `--color-text-main` | `244 241 246` |
| `<body>` colour | `rgb(244, 241, 246)` |

The element renders at the **main** colour, identical to `body`, rather than the
subtle `rgb(191, 181, 200)` the class asks for. That is the inherited value: the
rule contributed nothing.

## Affected rules

Broken — variable is hex, `rgb()` invalid:

| Line | Class | Intended colour |
|---|---|---|
| 27 | `.text-title-large` | `--color-text-strong` |
| 73 | `.text-label` | `--color-text-subtle` |
| 90 | `.text-small` | `--color-text-subtle` |
| 98 | `.text-small-desktop` | `--color-text-subtle` |

Working — variable is a triplet:

`.text-title` (36), `.text-subtitle` (45), `.text-subtitle-2` (56), `.text-body`
(64), `.text-label-strong` (82).

So of the nine semantic classes, **four of the five that are meant to be subtle
or strong are the broken ones**, which is why the bug is invisible: the two
subtle classes fall back to main, which looks plausible rather than wrong.

## Why it is easy to miss

Inheriting `main` is close enough to correct on a normal page that nothing looks
broken. It only becomes visible when the inherited colour is *not* body text —
which is how it surfaced. A `.text-label` inside an `<a>` inherits the link
colour, so the text rendered accent blue on the dev home page's tool cards.

That is worth checking for elsewhere: any `.text-label` / `.text-small` /
`.text-title-large` inside a link, a `Callout`, or any container that sets its
own colour is currently taking that container's colour, not the intended one.

## Note on Tailwind

`tailwind.config.js` reads the same variables and gets it **right**:

```js
strong: 'var(--color-text-strong)',              // hex, used directly
main: withOpacityValue('--color-text-main'),     // triplet, wrapped
subtle: 'var(--color-text-subtle)',              // hex, used directly
```

So `text-subtle` and `text-strong` as Tailwind utilities work correctly today.
The Tailwind layer is not affected.

## The same bug exists outside typography

> Added by review 2026-08-12. The original write-up said "only the SCSS
> typography classes are affected" — that is **wrong**. A repo-wide sweep for
> `rgb(var(--…))` found a second cluster in `src/components/message/Message.scss`
> with the same defect, plus a worse variant.

READ (`src/components/message/Message.scss`):

| Line | Declaration | Why it is dropped |
|---|---|---|
| 151 | `background-color: rgb(var(--surface-2))` | `--surface-2` is hex (`#2c252e` / `#eeeef3`) |
| 153 | `border: 1px solid rgb(var(--surface-4))` | `--surface-4` is hex |
| 221 | `background-color: rgb(var(--surface-3))` | `--surface-3` is hex |
| 222 | `color: rgb(var(--text-main))` | **variable does not exist** (it is `--color-text-main`) |
| 225 | `background-color: rgb(var(--surface-4))` | `--surface-4` is hex |
| 230 | `background-color: rgb(var(--primary))` | **variable does not exist** |
| 231 | `color: rgb(var(--text-on-primary))` | **variable does not exist** |
| 234 | `background-color: rgb(var(--primary-hover))` | **variable does not exist** |

VERIFIED absent: `--text-main`, `--primary`, `--primary-hover` and
`--text-on-primary` are defined nowhere in `src/` or `web/`. They look like
variables from a different naming scheme that was never adopted here.

Only some of this is live:

- **`.message-edit-container` (151, 153) is rendered** — `MessageEditTextarea.tsx:676`,
  with no other class, so nothing else supplies a background. The inline
  message-edit box currently has **no background and no border at all**.
  Note the border is worse than the background: `background-color` is a
  longhand, so only the colour is lost, but `border: 1px solid rgb(var(--surface-4))`
  is a *shorthand* — one invalid component invalidates the whole declaration, so
  the width and style go too and `border-style` stays at its initial `none`.
  This is a real user-visible defect, not just a latent one.
- **`.message-edit-cancel-button` / `.message-edit-save-button` (220-234) are dead
  CSS** — no consumer in any `.tsx`. `MessageEditTextarea.tsx:735` renders
  `.message-edit-actions`, but never the two button classes. Their broken
  declarations are inert; the rules themselves are removable.

Nothing else in the repo is affected: every other `rgb(var(--…))` in `src/`
wraps a variable that genuinely holds a triplet (`--accent-rgb`, `--danger`,
`--warning`, `--success`, `--danger-hover`, `--color-text-main`), and
`--surface-00-rgb` is comma-separated, which is valid inside `rgba()`.

## Options

1. **Change the four rules to `var(--color-text-*)`** — smallest diff, matches
   what the Tailwind config already does. Leaves the variable formats
   inconsistent.
2. **Normalise the variables to RGB triplets** in `_colors.scss` — makes
   `rgb(var(...))` valid everywhere and the format uniform, but every direct
   consumer of those variables has to be found and wrapped first, including the
   Tailwind config above and the three aliases `--color-rail-icon` (line 62),
   `--color-field-text` (121) and `--color-field-option-text` (132).

   MEASURED blast radius: **100 direct `var(--color-text-strong)` /
   `var(--color-text-subtle)` references across 30+ files**, every one of which
   breaks the moment the variable becomes a triplet. Plus 7 more via the three
   aliases. This is a 100-site rename with no compiler to catch a miss — an
   unwrapped consumer fails silently, exactly like the bug being fixed.

Option 1 is the clear choice: 4 lines, in one file, and it converges on the form
the Tailwind config already proves correct. Option 2 is a much larger,
silent-failure-prone change for a consistency benefit only.

Either way this is a **visual** change to production: text that has been
rendering at `main` will start rendering at `subtle` (dimmer) or `strong`
(brighter). Both themes need checking. It should ship with before/after captures
of the main modals and settings panes, not on reasoning alone.

## Visual comparison page

`/dev/typography-compare` (`src/dev/typography-compare/`) renders the current
state and both candidate fixes side by side, in the real stylesheet, with a
theme toggle and a live contrast readout measured off the DOM.

It exists because the decision below could not be made from hex values — "does
the UI still look good" needs an actual look. The left column has no overrides,
so it is genuinely what the app renders today; the other two add exactly the
declaration each fix would add and nothing else.

**Delete the page once this ships and is signed off** — it documents a decision,
not a feature.

## Decision (2026-08-12)

Both open questions were settled by the file's owner after reviewing
`/dev/typography-compare` in both themes. No blockers remain.

1. **Scope is widened** to cover every instance of this defect, not just the
   four typography rules. That means `Message.scss` too.
2. **Take "Fix + AA contrast"** — the third column. Apply the `rgb()` fixes *and*
   darken light-theme `--color-text-subtle` so the result meets WCAG AA. The
   "fix only" variant was rejected on the light theme.

Deliberately **not implemented yet** — scheduled, not abandoned.

### Implementation checklist

- [ ] `src/styles/_colors.scss` line 40 — light theme
      `--color-text-subtle: #818181` → `#696969`.
      Ratios become 5.49 / 5.09 / 4.75 against surface-00 / -1 / -2, so AA passes
      on every surface it is used on. **Dark theme is not touched** — `#bfb5c8`
      already passes at 7.55–9.35.
- [ ] `src/styles/_typography.scss` lines 27, 73, 90, 98 —
      `rgb(var(--color-text-*))` → `var(--color-text-*)`. Four rules, one file.
- [ ] `src/components/message/Message.scss` lines 151, 153 —
      same unwrapping for `--surface-2` / `--surface-4`, restoring the message
      edit box's missing background and border.
- [ ] `src/components/message/Message.scss` lines 220-234 — delete
      `.message-edit-cancel-button` / `.message-edit-save-button`. Dead CSS with
      no `.tsx` consumer, and their `--primary` / `--text-main` references point
      at variables that do not exist.
- [ ] Add the regression guard described under **Verification** below.
- [ ] Delete `src/dev/typography-compare/` and its route + nav entry
      (`Router.web.tsx`, `DevNavMenu.tsx`) once signed off.

Note that the ~11 call sites already pairing the class with a Tailwind colour
utility are unaffected, because `@tailwind utilities` loads after
`_typography.scss` (`src/index.scss:9`) and wins on equal specificity. Verified
on the comparison page.

Darkening `--color-text-subtle` also repairs the ~100 existing direct consumers
of that variable, which fail AA today. That is a side benefit, not extra scope.

## Verification

The instrument is a one-liner in the browser console on any page using the class:

```js
getComputedStyle(document.querySelector('.text-label')).color
```

Broken: matches `getComputedStyle(document.body).color`.
Fixed: `rgb(191, 181, 200)` in the dark theme, `rgb(129, 129, 129)` in light.

For the `Message.scss` case, open a message for editing and run:

```js
getComputedStyle(document.querySelector('.message-edit-container')).backgroundColor
```

Broken: `rgba(0, 0, 0, 0)` (transparent — the declaration was dropped).
Fixed: `rgb(44, 37, 46)` in the dark theme, `rgb(238, 238, 243)` in light.

A **regression guard** worth adding either way: a test that parses
`_colors.scss` and fails if any variable wrapped in `rgb(var(…))` anywhere in
`src/` is not a bare numeric triplet. That catches the whole class of bug
instead of these six instances, and it would have caught the missing
`--primary` / `--text-main` references too.

---

*Last updated: 2026-08-12*

## Review Log
**2026-08-12 - claude-opus-5**: Verified every claim against the code; core diagnosis fully confirmed, but scope was understated. Left open — it is genuinely unfixed and the fix is a broad visual change.
- CONFIRMED exactly: all four broken rules (_typography.scss 27/73/90/98), all five working ones (36/45/56/64/82), the hex-vs-triplet split in _colors.scss, and the tailwind.config.js analysis. Every line number and variable value checked and correct.
- CORRECTED a wrong claim: the doc said 'only the SCSS typography classes are affected'. A repo-wide sweep for rgb(var(--...)) found the same defect in src/components/message/Message.scss at 8 sites. Three of them reference variables that do not exist anywhere (--text-main, --primary, --primary-hover, --text-on-primary). Added a section with the evidence.
- .message-edit-container (Message.scss 151,153) is LIVE (MessageEditTextarea.tsx:676) and renders with no background and no border colour — a real user-visible defect the original write-up missed. The two edit-button rules (220-234) are dead CSS with no .tsx consumer.
- Confirmed no OTHER site is affected: every remaining rgb(var()) in src/ wraps a genuine triplet (--accent-rgb, --danger, --warning, --success, --danger-hover, --color-text-main); --surface-00-rgb is comma-form, valid in rgba().
- Quantified Option 2's blast radius, which the doc left vague: 100 direct var(--color-text-strong|subtle) references across 30+ files, plus 7 via aliases. Strengthened the recommendation for Option 1 accordingly.
- Added the light-theme block (_colors.scss 38-40) alongside the dark one — it has the identical mixed format and a fix must cover both. Added the third alias --color-field-option-text (line 132), which the doc omitted.
- Added a Blockers entry for the scope decision (widen to Message.scss, or split) rather than deciding it, and a verification one-liner for the Message.scss case plus a proposed regression guard that would catch the whole bug class.
- Frontmatter checked: type bug, status open, .open/ folder — all consistent, no change needed.

## Updates
- **2026-08-12 10:18**: Owner reviewed /dev/typography-compare in both themes and chose 'Fix + AA contrast' with scope widened to every instance of the defect. Both Blockers resolved, replaced with a Decision section and an implementation checklist. Implementation deferred by choice — status stays open.
