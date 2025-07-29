# Primitive Styling Guidelines

_Last updated: July 26, 2025_

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
--color-field-border-error: var(--danger-hex);
// ... more variables
```

### **TypeScript Colors:** `/src/components/primitives/theme/colors.ts`

```typescript
field: {
  bg: '#e6e6eb',        // surface-3
  bgFocus: '#eeeef3',   // surface-2
  border: '#cdccd3',    // surface-6
  borderHover: '#c4c4cb', // surface-7
  borderFocus: '#0287f2', // accent
  borderError: '#e74a4a', // danger
  // ... more properties
}
```

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
--color-border-default  // Standard borders
--color-border-strong   // Form field borders
--color-border-stronger // Hover states
```

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
