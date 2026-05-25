---
name: css-convert
description: Use when the user asks to convert a CSS or SCSS file to use the project's `_variables.scss` tokens, replace `@apply` with raw CSS, or align a stylesheet with the styling guidelines. Triggers on "convert this CSS", "use variables in this stylesheet", "remove @apply", "align with styling guidelines".
---

# Convert CSS to Variables + Raw CSS

Rewrite a CSS/SCSS file so it uses the project's design tokens from `src/styles/_variables.scss` and `src/styles/_colors.scss` instead of hardcoded values, and converts any `@apply` Tailwind directives to raw CSS using the same variables.

## Steps

1. **Load the styling rules first** — read `.agents/docs/styling-guidelines.md`. It defines when to use Tailwind vs raw CSS, the variable system, the color tokens, form-field conventions, and breakpoints.
2. **Read the target file** the user named (path comes from the invocation).
3. **Map hardcoded values to variables**:
   - Spacing → `$s-2`, `$s-4`, etc.
   - Font sizes → `$text-sm`, `$text-base`, etc.
   - Radii → `$rounded-md`, `$rounded-lg`, etc.
   - Colors → tokens from `src/styles/_colors.scss` (surfaces, accents, theme colors)
4. **Convert `@apply`** Tailwind utility usage to plain CSS declarations that reference the same SCSS variables.
5. Leave classes untouched when no variable maps cleanly; flag those for the user.

## Reference files

- `.agents/docs/styling-guidelines.md` — core rules
- `src/styles/_variables.scss` — `$s-*`, `$text-*`, `$rounded-*`, etc.
- `src/styles/_colors.scss` — theme colors, surfaces, accents
