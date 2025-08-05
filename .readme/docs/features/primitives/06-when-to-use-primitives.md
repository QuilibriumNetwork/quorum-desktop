# When to Use Primitives vs Raw HTML

**[← Back to Primitives INDEX](./INDEX.md)**

[← Back to Docs INDEX](/.readme/INDEX.md)

## Overview

Not every component needs to use primitives. This guide helps decide when primitives add value vs when they're over-engineering.

## Advantages of Using Primitives

### 1. **Design System Consistency**

- Unified color system (accent, surface, text variables)
- Consistent spacing, typography, interactive states
- Theme changes propagate automatically

### 2. **Maintenance Benefits**

- API changes update once, apply everywhere
- Bug fixes in one place benefit all components
- Predictable behavior across the app

### 3. **Developer Experience**

- Known patterns, TypeScript safety, autocomplete
- Less decision fatigue between `<button>` vs `<Button>`
- Faster development with established APIs

### 4. **Future Flexibility**

- Easy native migration if requirements change
- Component evolution (analytics, A/B testing) in one place

## When to Use Primitives

### ✅ **Always Use Primitives For:**

- **Interactive elements**: Button, Input, Select, Modal, Switch
- **Layout containers**: FlexRow, FlexColumn, FlexBetween, Container
- **Design system elements**: Text (with semantic colors), Icon

### 🤔 **Evaluate Case-by-Case:**

- **Simple containers**: Use Container for theme consistency
- **Text elements**: Use Text if you need semantic colors (`text-strong`, `text-subtle`)
- **Form elements**: Use primitives for consistent validation/error states

### ❌ **Don't Force Primitives For:**

- **Highly specialized components**: Complex animations, charts, code editors
- **Third-party library wrappers**: react-virtuoso, react-select containers
- **Performance-critical sections**: Where extra component layers hurt performance
- **Complex SCSS patterns**: Hard-to-primitize animations or layouts

## Practical Examples

### ✅ Good Use of Primitives

```tsx
// Interactive elements benefit from consistency
<Button type="primary" onClick={handleSave}>Save</Button>
<Input value={name} onChange={setName} error={nameError} />

// Layout benefits from responsive patterns
<FlexBetween className="header">
  <Text variant="strong">Title</Text>
  <Icon name="close" onClick={onClose} />
</FlexBetween>
```

### 🤔 Pragmatic Mixed Approach

```tsx
// Keep complex SCSS, but use primitive children
<div className="complex-animation-container">
  <Text variant="subtle">Loading...</Text>
  <Button size="small" onClick={onCancel}>
    Cancel
  </Button>
</div>
```

### ❌ Over-Engineering

```tsx
// Too much abstraction for simple static content
<Container>
  <Container className="wrapper">
    <Text>Simple static text</Text>
  </Container>
</Container>

// vs simpler:
<div className="wrapper">
  <span>Simple static text</span>
</div>
```

## Migration Strategy

### Current Approach: "Primitives-Ready"

1. **Extract business logic** to shared hooks first
2. **Replace interactive elements** with primitives (buttons, inputs)
3. **Keep existing SCSS** for complex styling
4. **Evaluate** case-by-case if full primitive conversion adds value

### Alternative: "Primitives-First"

Only for components that clearly benefit from consistency/reusability.

## Decision Framework

Ask these questions:

1. **Does this element interact with users?** → Use primitive
2. **Does this need theme colors/spacing?** → Use primitive
3. **Is this layout pattern repeated?** → Consider primitive
4. **Is the CSS complex/specialized?** → Keep raw HTML + SCSS
5. **Is this performance-critical?** → Measure first, optimize if needed

## Best Practice

**Use primitives where they add value: consistency, reusability, and maintainability. Don't force them everywhere for ideological purity.**

The goal is shared business logic with appropriate UI abstractions, not primitive components at all costs.

---

*Last updated: 2025-08-05*

---

[← Back to Primitives INDEX](./INDEX.md)
