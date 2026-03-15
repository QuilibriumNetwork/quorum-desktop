---
type: doc
title: Primitive Styling Guidelines
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-10-14T00:00:00.000Z
---

# Primitive Styling Guidelines

**[← Back to Primitives INDEX](./INDEX.md)**


## Overview

This document outlines critical styling consistency rules for all primitive components. These guidelines ensure visual cohesion across our cross-platform design system.

## Form Field Semantic Colors

### **🚨 CRITICAL RULE: Form Field Consistency**

**All form-related primitives MUST use the same semantic color variables:**

- ✅ **Input** - Uses `--color-field-*` variables
- ✅ **TextArea** - Uses `--color-field-*` variables
- ✅ **Select** - Uses `--color-field-*` variables
- ✅ **RadioGroup** - Uses `--color-field-*` variables

### **Required Semantic Classes for Form Fields**

#### **Web (.scss files):**

```scss
// Base state
background-color: var(--color-field-bg);
border: 1px solid var(--color-field-border);
color: var(--color-field-text);

// Hover state
border-color: var(--color-field-border-hover);
background-color: var(--color-field-bg-focus);

// Focus state
border-color: var(--color-field-border-focus);
box-shadow: 0 0 0 2px var(--color-field-focus-shadow);

// Error state
border-color: var(--color-field-border-error);
box-shadow: 0 0 0 2px var(--color-field-error-focus-shadow);

// Placeholder text
color: var(--color-field-placeholder);
```

#### **Mobile (.native.tsx files):**

```typescript
// Use colors.field.* from getColors()
borderColor: colors.field.border;
backgroundColor: colors.field.bg;
// Focus states
borderColor: colors.field.borderFocus;
backgroundColor: colors.field.bgFocus;
// Error states
borderColor: colors.field.borderError;
```

## Semantic Color Variable Locations

### **CSS Variables:** `/src/styles/_colors.scss`

```scss
/* === FORM FIELD SEMANTIC COLORS === */
--color-field-bg: var(--surface-3);
--color-field-bg-focus: var(--surface-2);
--color-field-border: var(--color-border-strong);
--color-field-border-hover: var(--color-border-stronger);
--color-field-border-focus: var(--accent);
--color-field-border-error: rgb(var(--danger));
// ... more variables
```

### **TypeScript Colors:** `/src/components/primitives/theme/colors.ts`

```typescript
// colors.ts uses two-layer architecture:
// Layer 1 — Palette: surfaces, accentColors, utilityColors
// Layer 2 — Semantics: buildSemanticColors() references palette values

// Field colors (mobile-specific, DO NOT sync with web CSS)
field: {
  bg: s['2'],           // surface-2 (darker than web for mobile contrast)
  bgFocus: s['1'],      // surface-1
  border: s['6'],       // surface-6 (stronger than web for mobile visibility)
  borderHover: s['7'],  // surface-7
  borderFocus: accentDefault, // dynamic accent color
  borderError: u.danger,
}
```

> **Note:** `getColors()` combines semantics + accent overrides into the final color object consumed by components.

## General Styling Consistency Rules

### **1. Surface Hierarchy**

- Use semantic surface variables: `--surface-00` through `--surface-10`
- Don't hardcode specific surface values in components
- Follow established surface hierarchy for layering

### **2. Text Color Consistency**

```scss
// Use semantic text classes
--color-text-strong  // Primary headings, emphasis
--color-text-main    // Body text, labels
--color-text-subtle  // Secondary text, descriptions
--color-text-muted   // Disabled text, placeholders
```

### **3. Border Consistency**

```scss
// Use semantic border classes
--color-border-muted    // Very subtle borders (surface-3)
--color-border-subtle   // Light borders (surface-4)
--color-border-default  // Standard borders (surface-6 on mobile)
--color-border-strong   // Form field borders (surface-7)
--color-border-stronger // Hover states (surface-8)
```

> **Mobile vs Web:** Mobile intentionally uses one step stronger borders than web for better visibility on smaller screens. Do not attempt to synchronize mobile border values to match web exactly.

### **4. Creating New Semantic Classes**

**When to create new semantic classes:**

- Multiple components need the same styling pattern
- A color combination appears in 3+ places
- Cross-platform consistency is needed

**How to create semantic classes:**

1. Add CSS variable to `_colors.scss` (both light and dark themes)
2. Add corresponding value to `colors.ts`
3. Document usage in this file
4. Update all relevant components

## Component-Specific Guidelines

### **Interactive States**

All interactive primitives should support:

- **Hover**: Subtle color change (lighter/darker)
- **Focus**: Accent border + subtle shadow
- **Active**: Accent background/border
- **Disabled**: 50-60% opacity

### **Spacing Consistency**

- Use consistent padding/margins across similar components
- Form fields: `px-4 py-2` (16px horizontal, 8px vertical)
- Touch targets: Minimum 44px height for mobile

### **Border Radius**

- Form fields: `rounded-md` (6px)
- Cards/containers: `rounded-lg` (8px)
- Buttons: `rounded-md` (6px)

## Enforcement Checklist

When creating or updating primitives:

- [ ] Does this component use semantic color variables?
- [ ] Are hover/focus states consistent with similar components?
- [ ] Do web and mobile versions use equivalent colors?
- [ ] Are spacing and border radius values consistent?
- [ ] Have I documented any new semantic classes?

## Related Files

- **CSS Variables**: `/src/styles/_colors.scss`
- **TypeScript Colors**: `/src/components/primitives/theme/colors.ts`
- **Form Primitives**: Input, TextArea, Select, RadioGroup
- **Theme System**: `/src/components/primitives/theme/`

---

**⚠️ Remember:** Visual consistency is crucial for user experience. When in doubt, use existing semantic classes rather than creating one-off styles.

_Last updated: 2026-03-15_
_Verified: 2026-03-15 - Updated for two-layer color architecture and border hierarchy_
