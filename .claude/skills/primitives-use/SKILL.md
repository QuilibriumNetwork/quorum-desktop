---
name: primitives-use
description: Use when the user asks to convert a component to use the primitives architecture, replace raw HTML/Tailwind with primitive props, or make a component cross-platform-friendly. Triggers on "use primitives in this component", "convert to primitives", "primitives-ify", "make this primitive-based".
---

# Convert a Component to Use Primitives

Rewrite the named component to rely on `src/components/primitives/*` (`Button`, `FlexRow`, `Text`, etc.) instead of raw HTML, ad-hoc Tailwind, or duplicated styling. The goal is cross-platform reuse and consistency with the project's design system.

## Reference

Read first: `.agents/docs/features/primitives` — full primitives documentation.

## Priority (apply in order)

1. **Use primitive props first**:
   - `Button`: `type="primary|secondary|danger"`, `size="small|normal"`
   - Layout: `<FlexRow gap="sm" justify="between">` instead of `className="flex justify-between gap-2"`
   - `Text` (**native only**): `variant="strong|subtle|muted"`, `size="sm|base|lg"`

2. **For text on web**: use plain HTML (`<span>`, `<p>`) with CSS typography classes (`.text-strong`, `.text-subtle`, `.text-label`, `.text-small`). **The `Text` primitive is native-only — do not use it in web production code.**

3. **If primitive props aren't enough**: fall back to Tailwind tokens (`bg-surface-0`, `text-strong`).

4. **Last resort**: existing CSS modules or hardcoded styles.

## What "convert" means

- Replace `<div className="flex ...">` with the matching primitive when one exists.
- Replace ad-hoc button styling with `Button` + its `type` / `size` props.
- Remove `className` props that duplicate primitive defaults.
- Keep behavior identical — this is a presentation refactor, not a feature change.
- If a primitive doesn't exist for a pattern the component needs, surface that to the user rather than inventing one inline.
