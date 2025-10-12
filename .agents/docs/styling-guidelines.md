# Styling Guidelines

**Styling standards for the Quorum Desktop cross-platform codebase.**

[← Back to INDEX](./../INDEX.md)

---

## Overview

This project uses a **hybrid CSS system**:
- **Tailwind CSS** - Utility classes in JSX/TSX
- **Raw CSS/SCSS** - Complex, shared, or component-specific styles

---

## Core Principles

### 1. Use the Right Tool

```tsx
// ✅ Tailwind for simple styles
<div className="flex items-center gap-4 p-4 rounded-lg bg-card" />

// ✅ Raw CSS for complex styles
<div className="message-composer" /> {/* See MessageComposer.scss */}
```

### 2. Follow Tailwind's Design Language

- Use `rem` instead of `px`
- Follow Tailwind's spacing scale
- Use CSS variables instead of hardcoded values
- Use SCSS variables from `_variables.scss`

### 3. Never Use `@apply`

**Why?** Loses Tailwind's tree-shaking, makes debugging harder, discouraged by Tailwind team.

```scss
/* ❌ BAD */
.button { @apply px-4 py-2 rounded-md; }

/* ✅ GOOD - Option 1: Tailwind classes */
<button className="px-4 py-2 rounded-md">

/* ✅ GOOD - Option 2: Raw CSS */
.button {
  padding: $spacing-2 $spacing-4;  /* or 0.5rem 1rem */
  border-radius: $rounded-md;      /* or 0.375rem */
}
```

---

## When to Use Tailwind vs Raw CSS

### Use Tailwind Classes When:
- ✅ Simple styles (< 7 classes)
- ✅ One-off modifications
- ✅ Responsive utilities (`md:flex`)
- ✅ Simple state-based styles (`hover:bg-surface-6`)

### Use Raw CSS When:
- ✅ Complex component styles (> 7 classes needed)
- ✅ Shared styles across components
- ✅ Complex pseudo-elements/animations
- ✅ Multi-property state changes

---

## Raw CSS Rules

### 1. Spacing - Use `rem` and SCSS Variables

```scss
/* ✅ BEST */
padding: $spacing-4;      /* p-4 → 1rem → 16px */
gap: $spacing-2;          /* gap-2 → 0.5rem → 8px */

/* ✅ GOOD */
padding: 1rem;
gap: 0.5rem;

/* ❌ BAD */
padding: 16px;
```

**Conversion:** Tailwind number ÷ 4 = rem value (e.g., `gap-6` → `6 ÷ 4 = 1.5rem`)

**Common Values:** `0.25rem` (1), `0.5rem` (2), `0.75rem` (3), `1rem` (4), `1.5rem` (6), `2rem` (8), `3rem` (12)

---

### 2. Colors - Use CSS Variables

```scss
/* ✅ GOOD */
background-color: var(--accent);
color: var(--color-text-main);
border: 1px solid var(--color-border-strong);

/* ❌ BAD */
background-color: #0287f2;
```

---

### 3. Typography

```scss
/* ✅ BEST */
font-size: $text-lg;            /* 1.125rem / 18px */
line-height: $text-lg-lh;       /* 1.75rem */
font-weight: $font-semibold;    /* 600 */

/* ✅ GOOD */
font-size: 1.125rem;
```

**Scale:** `xs` (12px), `sm` (14px), `base` (16px), `lg` (18px), `xl` (20px), `2xl` (24px), `3xl` (30px), `4xl` (36px)

---

### 4. Border Radius, Shadows, Transitions

```scss
/* Border Radius */
border-radius: $rounded-md;    /* 0.375rem / 6px */
border-radius: $rounded-lg;    /* 0.5rem / 8px */

/* Shadows */
box-shadow: $shadow-md;

/* Transitions */
transition: all $duration-200 $ease-in-out;  /* 200ms ease-in-out */
```

**Radius Scale:** `sm` (2px), `md` (6px), `lg` (8px), `xl` (12px), `2xl` (16px), `full` (9999px)

**Duration Scale:** `75ms`, `100ms`, `150ms`, `200ms`, `300ms`, `500ms`

---

### 5. Responsive Breakpoints

```scss
.element {
  padding: 1rem;  /* Mobile-first base */

  @media (min-width: 480px) { padding: 1.5rem; }  /* xs+ */
  @media (min-width: 768px) { padding: 2rem; }    /* md+ */
  @media (min-width: 1024px) { padding: 3rem; }   /* lg+ */
}

/* Or with SCSS variables */
@media (min-width: $screen-xs) { padding: $spacing-6; }
```

**Breakpoints:** Mobile (`<= 480px`), `xs` (480px), `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)

**Tailwind Classes:** `xs:block`, `md:flex`, `lg:p-8`

---

## SCSS Variables

**Location:** `src/styles/_variables.scss` (imported globally)

**Usage:**
```scss
@use 'src/styles/_variables.scss' as *;  /* If not already available */

.card {
  padding: $spacing-6;
  font-size: $text-lg;
  border-radius: $rounded-lg;
  box-shadow: $shadow-md;
  transition: all $duration-200 $ease-in-out;
}
```

**Available:**
- Spacing: `$spacing-0` → `$spacing-96`
- Typography: `$text-xs` → `$text-9xl`, `$text-*-lh` (line-heights)
- Font Weights: `$font-thin` → `$font-black`
- Line Heights: `$leading-none`, `$leading-tight`, `$leading-3` → `$leading-10`
- Letter Spacing: `$tracking-tighter` → `$tracking-widest`
- Border Radius: `$rounded-none` → `$rounded-full`
- Shadows: `$shadow-sm` → `$shadow-2xl`
- Transitions: `$duration-75` → `$duration-1000`, `$ease-linear/in/out/in-out`
- Breakpoints: `$screen-xs/sm/md/lg/xl/2xl`

---

## CSS Variables & Colors

**Files:**
- `src/styles/_colors.scss` - Theme colors (light/dark, accent, surfaces)
- `src/styles/_variables.scss` - Tailwind design tokens
- `tailwind.config.js` - Tailwind configuration

### Surface Hierarchy

```scss
/* Light theme (default) */
--surface-00: #ffffff;   /* Pure white */
--surface-0:  #fefeff;   /* App background */
--surface-1:  #f6f6f9;   /* Sidebar */
--surface-2:  #eeeef3;   /* Cards */
--surface-3:  #e6e6eb;   /* Inputs */
--surface-6:  #cdccd3;   /* Borders */
--surface-7:  #c4c4cb;   /* Strong borders */
```

### Text Colors

```scss
--color-text-strong: #3b3b3b;  /* Headings */
--color-text-main: 54 54 54;   /* Body (RGB - use with rgb()) */
--color-text-subtle: #818181;  /* Secondary */
--color-text-muted: #b6b6b6;   /* Disabled */
```

### Accent & Utility Colors

```scss
/* Dynamic accent (blue/purple/fuchsia/orange/green/yellow) */
--accent: var(--accent-500);
--accent-rgb: 2, 135, 242;

/* Utility colors (RGB for opacity support) */
--danger: 231 74 74;    /* Use: rgb(var(--danger)) */
--warning: 231 176 74;
--success: 70 194 54;
--info: 48 149 189;
```

### Semantic Backgrounds

```scss
/* Prefer semantic names over raw surfaces */
background-color: var(--color-bg-app);      /* or bg-app */
background-color: var(--color-bg-sidebar);  /* or bg-sidebar */
background-color: var(--color-bg-card);     /* or bg-card */
background-color: var(--color-bg-modal);    /* or bg-modal */
```

---

## Form Field Standards

**CRITICAL:** All form components must use `--color-field-*` variables.

```scss
.input-field {
  background-color: var(--color-field-bg);
  border: 1px solid var(--color-field-border);
  color: var(--color-field-text);

  &::placeholder { color: var(--color-field-placeholder); }
  &:hover { border-color: var(--color-field-border-hover); }
  &:focus {
    border-color: var(--color-field-border-focus);  /* Uses accent */
    box-shadow: 0 0 0 2px var(--color-field-focus-shadow);
  }
  &.error { border-color: var(--color-field-border-error); }
}
```

**Available Variables:** `--color-field-bg`, `-bg-focus`, `-border`, `-border-hover`, `-border-focus`, `-border-error`, `-text`, `-placeholder`, `-focus-shadow`, `-error-focus-shadow`

**Reference:** [Primitive Styling Guide](./features/primitives/05-primitive-styling-guide.md)

---

## Migration from @apply

~10 files currently use `@apply` - migrate incrementally.

**Option 1: Move to Tailwind Classes**
```scss
/* Before */
.badge { @apply inline-flex items-center px-3 py-1 rounded-full; }

/* After */
<span className="inline-flex items-center px-3 py-1 rounded-full">
```

**Option 2: Convert to Raw CSS**
```scss
/* Before */
.row { @apply odd:bg-surface-4 even:bg-surface-3; }

/* After */
.row {
  &:nth-child(odd) { background-color: var(--surface-4); }
  &:nth-child(even) { background-color: var(--surface-3); }
}
```

---

## Quick Reference

### When to Use What

| Scenario | Use |
|----------|-----|
| Simple layout (< 7 classes) | Tailwind classes |
| Complex component | Raw CSS + SCSS variables |
| Shared styles | Raw CSS in shared file |
| Spacing/sizing | `$spacing-*` or `rem` |
| Colors | CSS variables (`var(--accent)`) |
| Form fields | `--color-field-*` variables |
| Breakpoints | SCSS: `@media (min-width: $screen-md)` / Tailwind: `md:` |

### Checklist

**Before writing styles:**
- [ ] Can I use Tailwind classes? (< 7 classes)
- [ ] Using `rem`, not `px`?
- [ ] Using CSS variables for colors?
- [ ] Using SCSS variables from `_variables.scss`?
- [ ] Avoiding `@apply`?
- [ ] Will this work on mobile?

---

## Related Documentation

- [Primitive Styling Guide](./features/primitives/05-primitive-styling-guide.md) - Form fields & semantic colors
- [Cross-Platform Theming](./features/cross-platform-theming.md) - Theme system
- [AGENTS.md](./../AGENTS.md) - Quick file lookup

---

## Summary

1. **Tailwind in JSX** for simple styles (< 7 classes)
2. **Raw CSS** for complex/shared styles
3. **Never use `@apply`**
4. **Use SCSS variables** (`$spacing-4`, `$text-lg`)
5. **Use `rem`** instead of `px`
6. **Use CSS variables** for colors
7. **Form fields use `--color-field-*`**
8. **Think cross-platform**

---

_Last updated: 2025-10-12_
