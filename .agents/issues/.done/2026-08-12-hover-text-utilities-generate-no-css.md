---
type: bug
title: "hover:text-* utilities do generate CSS — report refuted; a different set of dead colour classes found and fixed"
status: done
priority: medium
created: 2026-08-12
updated: 2026-08-12
area: styling / tailwind / build
repos: quorum-desktop
related:
  - "tailwind.config.js (borderColor.default added)"
  - "src/dev/tests/components/tailwindClassesGenerate.test.ts (regression guard added)"
  - ".agents/issues/.done/2026-08-12-typography-classes-have-no-working-colour.md (found while shipping that)"
---

# `hover:text-*` utilities generate no CSS — REFUTED

## Status

**2026-08-12 — shipped in PR #332** (`fix(styles): colour classes naming an
undefined token now generate CSS`)

**The original report was wrong.** Every `hover:text-*` utility generates, and
generates valid CSS. The evidence in the first version of this file was a
`grep` escaping artifact, not a measurement of the bundle.

Investigating it did surface a real defect of the same *shape* — Tailwind
classes that silently produce no CSS — just not the one reported, and not in
`hover:text-*`. Those are fixed, and a regression guard now fails the test suite
if any new one appears.

## What was actually measured

MEASURED against `dist/web/assets/index-*.css`, read with Node rather than
`grep` (see the trap below). All 14 `hover:text-*` rules were present, with
sound values:

```
.hover\:text-danger:hover{color:var(--color-text-danger)}
.hover\:text-main:hover{--tw-text-opacity:1;color:rgb(var(--color-text-main) / var(--tw-text-opacity,1))}
.hover\:text-warning:hover{color:var(--color-text-warning)}
.hover\:text-strong:hover{color:var(--color-text-strong)}
.hover\:text-danger-hover:hover{--tw-text-opacity:1;color:rgb(var(--danger-hover) / var(--tw-text-opacity,1))}
.hover\:text-accent:hover{color:var(--accent)}
.hover\:text-success:hover{color:var(--color-text-success)}
.hover\:text-surface-7:hover{color:var(--surface-7)}
.hover\:text-surface-10:hover{color:var(--surface-10)}
.hover\:text-accent-600:hover{color:var(--accent-600)}
.hover\:text-white:hover{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}
```

Every variable reached through `rgb(var(--x))` is a numeric triplet
(`--danger-hover: 236 51 51`, `--color-text-main: 54 54 54`), so none of these
hit the PR #331 defect either.

The custom `textColor` key under `theme.extend` was the suspected cause. It is
not a cause of anything; the suspicion was built on the false evidence.

### The trap that produced the false report

GNU grep 3.0 in Git Bash on Windows does **not** match a literal backslash with
the pattern the original recipe used. Against a file provably containing
`hover\:text-danger`:

```bash
grep -o  'hover\\:text-danger' file   # -> 0   (the original recipe)
grep -oF 'hover\:text-danger'  file   # -> 1   (correct)
```

The same broken pattern also reports `hover\:bg-danger` as absent, yet the
original report cited `.hover\:bg-danger:hover` as *present* — the two halves of
its contrast were gathered by different methods, and only one of them worked.

**Use `grep -F`, or read the bundle with Node.** Do not hand-escape backslashes
for grep on this platform.

## The real defect found underneath

Twenty-four class names across the app named a colour the theme does not
define. Tailwind emits nothing for those: the class stays on the element, the
build passes, and the element falls back to whatever it inherits.

Fixed in this change:

| Class | Sites | Fix |
|---|---|---|
| `border-default` | 86 | `theme.borderColor.default` added to the config |
| `divide-default` | 1 | same (divide colours derive from `borderColor`) |
| `hover:text-main-hover` | 1 | → `hover:text-strong` (Roles.tsx) |
| `bg-chat-overlay`, `border-primary`, `text-primary` | 3 | → `bg-modal`, `border-accent`, `text-main` (message-loading card) |
| `focus:border-primary` | 1 | → `focus:border-accent` (Security.tsx) |
| `text-md` | 3 | → `text-base` (Tailwind has no `text-md`) |
| `border-r-1` | 1 | removed (redundant beside `border-r`) |
| `border-top` | 1 | → `border-t border-default` |
| `-accent/<opacity>` family | 10 | → `-accent-rgb/<opacity>` |
| `bg-surface-N/<opacity>` family | 3 | → solid `bg-surface-N` (dev pages) |
| `bg-border`, `bg-muted/20`, `border-muted/30`, `border-default/50` | 12 | → existing surface/subtle tokens (dev pages) |

Two of these are worth calling out:

- **`border-default` hid for so long because it looked right.** Tailwind's
  `theme.borderColor.DEFAULT` names the bare `border` utility and the preflight
  rule that colours *every* element's border. It never created `border-default`.
  Since preflight already paints `var(--color-border-default)`, 86 dead classes
  rendered exactly the colour their author intended.
- **`-accent/<opacity>` cannot work.** An opacity modifier needs a numeric
  triplet, and `--accent` holds a bare `var()`. That is what `accent-rgb`
  (`withOpacityValue('--accent-rgb')`) exists for. Only one site was in
  production code (the markdown blockquote border); the rest were dev pages.

## Regression guard

`src/dev/tests/components/tailwindClassesGenerate.test.ts` builds the utility
CSS from the real `tailwind.config.js`, collects every class written in `src`
(from `className` attributes and from class-list strings returned by helpers),
and fails on any colour-namespace class that matches neither a generated
utility nor a hand-written SCSS class.

It is the sibling of `cssColourVariableFormat.test.ts`, which catches the
neighbouring defect: the class generates, but its `rgb(var(--x))` value is
invalid CSS.

**Confirmed the test can fail**, rather than merely passing: reverting three of
the fixes above turned it red naming exactly the four expected classes
(`border-accent/50`, `border-default`, `divide-default`,
`hover:text-main-hover`), and restoring them turned it green.

Two false-positive traps are handled, both found by running it:

- Comments are blanked first. Prose quotes class names in backticks, which reads
  as a template literal — the test reported its own doc comment otherwise.
- A helper-returned string counts as a class list only when **two or more** of
  its tokens are real classes. One is not enough: the transition value
  `'border-color 0.15s ease-in-out'` contains `ease-in-out`, which is a class.

## Verification

```
yarn vitest --run src/dev/tests/components/tailwindClassesGenerate.test.ts   # 1 passed
yarn test:run                                                               # 151 files, 1409 passed
npx tsc --noEmit --jsx react-jsx --skipLibCheck                             # clean
yarn lint                                                                   # 0 errors
yarn build                                                                  # built in 18s
```

Post-build bundle check: `border-default`, `divide-default`,
`border-accent-rgb/50`, `bg-accent-rgb/10`, `bg-accent-rgb/20`, `bg-modal`,
`border-accent`, `focus:border-accent`, `bg-surface-5`, `border-subtle` and
`text-base` all present; every replaced class gone.

Not verified end-to-end in a browser — the claim here is that the CSS exists
and is valid, which is what was measured.

---

*Last updated: 2026-08-12*
