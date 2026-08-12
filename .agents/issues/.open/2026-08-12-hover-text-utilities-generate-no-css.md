---
type: bug
title: "No hover:text-* Tailwind utility generates any CSS, so those hover colours have never worked"
status: open
priority: medium
created: 2026-08-12
updated: 2026-08-12
area: styling / tailwind / build
repos: quorum-desktop
related:
  - "tailwind.config.js (custom textColor key is the likely cause)"
  - ".agents/issues/.done/2026-08-12-typography-classes-have-no-working-colour.md (found while shipping that)"
---

# No `hover:text-*` utility generates any CSS

Every `hover:text-<colour>` class in the codebase is inert. The class name is on
the element, but no matching rule exists in the shipped stylesheet, so hovering
changes nothing.

This is **not** the same defect as the `rgb(var(--hex))` bug shipped in PR #331,
though it was found while verifying that one. That bug produced invalid CSS the
browser dropped. This one produces no CSS at all.

## Evidence

MEASURED against the production bundle (`dist/web/assets/index-*.css`), counting
occurrences rather than lines — the bundle is minified onto a single line, so
`grep -c` reports 1 or 0 and is misleading here:

```bash
MAIN=$(ls -S dist/web/assets/*.css | head -1)
for c in 'hover\\:text-accent' 'hover\\:text-danger' 'hover\\:text-warning' 'hover\\:text-subtle'; do
  printf "%-26s %s\n" "$c" "$(grep -o "$c" "$MAIN" | wc -l)"
done
```

| Class | Occurrences in bundle |
|---|---|
| `hover:text-accent` | 0 |
| `hover:text-danger` | 0 |
| `hover:text-warning` | 0 |
| `hover:text-subtle` | 0 |

Enumerating every generated hover text utility returns nothing at all:

```bash
grep -oE '\.hover\\:[!\\]*text-[^{ ,:]*' "$MAIN" | sort -u   # → empty
```

For contrast, the non-hover forms and the background equivalents **do** generate:

- `.text-main{--tw-text-opacity:1;color:rgb(var(--color-text-main) / var(--tw-text-opacity,1))}` — present
- `.text-accent`, `.text-subtle` — present
- `.hover\:bg-danger:hover`, `.hover\:bg-chat-hover:hover` — present

So the `hover:` variant works, and the `text-` utilities work, but not the two
combined. One exception generates fine: the arbitrary-value form
`hover:!text-[var(--color-text-subtle)]` appears in the bundle, which suggests
the named-colour path specifically is what breaks.

## Known affected call sites

These predate PR #331 and have never had a working hover colour:

- `src/components/modals/SpaceSettingsModal/Channels.tsx` — `hover:text-danger` on
  both delete buttons, `hover:text-warning` on the set-as-default button,
  `hover:text-main` on the neutral actions
- Any other `hover:text-*` in the repo; a full sweep has not been done

## Likely cause (INFERRED — not yet confirmed)

`tailwind.config.js` defines a custom `textColor` key under `theme.extend`
alongside a custom `colors` key. The suspicion is that this interacts badly with
variant generation for text colours specifically, since `backgroundColor`
utilities are unaffected. This has **not** been verified; do not treat it as the
diagnosis.

## Suggested approach

1. Confirm the mechanism before changing anything — build with a scratch
   `hover:text-danger` present and diff the emitted CSS against a config where
   `textColor` is removed from `extend`.
2. Check whether the Tailwind major version in use changed variant behaviour for
   keys that shadow `colors`.
3. Only then decide between fixing the config and migrating the call sites to the
   arbitrary-value form that already works.

## Verification

A fix is confirmed when the bundle contains a `.hover\:text-danger:hover` rule:

```bash
yarn build
MAIN=$(ls -S dist/web/assets/*.css | head -1)
grep -o 'hover\\:text-danger' "$MAIN" | wc -l   # must be > 0
```

Worth adding to the regression guard in
`src/dev/tests/components/cssColourVariableFormat.test.ts`, or a sibling test, so
a silently-dropped utility class fails the build rather than the design.

---

*Last updated: 2026-08-12*
