---
name: style-guide
description: Use when the user is about to write or modify CSS, SCSS, or styling on this project. Triggers on "load the style guide", "what are the styling rules", before any CSS/SCSS edit, before adding new visual styling, or when the user asks about which variables/colors/breakpoints to use.
---

# Load Styling Guidelines

Before writing or modifying any CSS/SCSS in this repo, read the project's styling references so the work uses the correct tokens and patterns.

## Files to read

1. **`.agents/docs/styling-guidelines.md`** — core rules: when to use Tailwind vs raw CSS, the SCSS variable system, the color system, form fields, breakpoints.
2. **`src/styles/_variables.scss`** — all SCSS variables: `$s-4`, `$text-sm`, `$rounded-lg`, etc.
3. **`src/styles/_colors.scss`** — theme colors, surfaces, accents.

## Apply throughout

- Prefer SCSS variables over hardcoded values for spacing, radii, font sizes.
- Prefer color tokens from `_colors.scss` over hex / `rgb()` literals.
- Use Tailwind vs raw CSS according to the rules in `styling-guidelines.md` — they are not interchangeable here.

## Related skill

- **css-convert** — when retrofitting an existing CSS/SCSS file to follow these rules.
