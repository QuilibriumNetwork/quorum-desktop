---
type: doc
title: When to Use Primitives vs Raw HTML
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-10-14T00:00:00.000Z
---

# When to Use Primitives vs Raw HTML

**[← Back to Primitives INDEX](./INDEX.md)**


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
- **Layout containers**: Flex, Container
- **Design system elements**: Text (native only -- not used on web), Icon

### 🤔 **Evaluate Case-by-Case:**

- **Simple containers**: Use Container for theme consistency
- **Text elements (web)**: Use plain HTML (`<span>`, `<p>`) with CSS typography classes (`.text-label`, `.text-strong`, `.text-subtle`)
- **Form elements**: Use primitives for consistent validation/error states

## Container vs div Decision Framework

### **Use Container when:**

- **Interactive containers**: Need `onClick` (web) / `onPress` (native) support
- **Semantic spacing**: Using `padding="md"` instead of hardcoded `p-4`
- **Cross-platform components**: Component will be used on mobile
- **Theme integration**: Need theme background colors or consistent styling

### **Use div when:**

- **Simple static wrappers**: Pure layout containers with no interaction
- **Complex SCSS patterns**: Heavy animations or specialized styling
- **Performance-critical sections**: Where extra component abstraction matters
- **One-off layouts**: Unique styling that won't be reused

### **Examples:**

```tsx
// ✅ Good Container usage
<Container
  padding="md"
  onClick={handleClick}
  backgroundColor="var(--surface-1)"
>
  Interactive themed container
</Container>

// ✅ Good div usage
<div className="complex-animation-wrapper scroll-container">
  <div className="fade-in-effect">Static content</div>
</div>

// ❌ Over-engineering with Container
<Container>
  <Container className="simple-wrapper">
    <Container>Static text</Container>
  </Container>
</Container>

// ✅ Better approach
<div className="simple-wrapper">
  <span>Static text</span>
</div>
```

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

// Web: Use HTML + CSS classes for text
<Flex justify="between" className="header">
  <span className="text-strong">Title</span>
  <Icon name="close" onClick={onClose} />
</Flex>
```

### 🤔 Pragmatic Mixed Approach

```tsx
// Keep complex SCSS, but use primitive children
<div className="complex-animation-container">
  <span className="text-subtle">Loading...</span>
  <Button size="small" onClick={onCancel}>
    Cancel
  </Button>
</div>
```

### ❌ Over-Engineering

```tsx
// Complex table layout forced into primitives creates unnecessary complexity
<Container className="table-container">
  <FlexRow className="table-header">
    <Container className="col-name"><Text>Name</Text></Container>
    <Container className="col-status"><Text>Status</Text></Container>
    <Container className="col-actions"><Text>Actions</Text></Container>
  </FlexRow>
  {data.map(item => (
    <FlexRow key={item.id} className="table-row">
      <Container className="col-name"><Text>{item.name}</Text></Container>
      <Container className="col-status"><Text>{item.status}</Text></Container>
      <Container className="col-actions">
        <Button size="small" onClick={() => edit(item)}>Edit</Button>
      </Container>
    </FlexRow>
  ))}
</Container>

// vs proper HTML table with primitive buttons:
<table className="data-table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {data.map(item => (
      <tr key={item.id}>
        <td>{item.name}</td>
        <td>{item.status}</td>
        <td>
          <Button size="small" onClick={() => edit(item)}>Edit</Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Problems with the primitive version:**

- Loses semantic HTML table structure (accessibility issues)
- CSS grid/flexbox hacks needed for proper column alignment
- Screen readers can't navigate properly
- Complex responsive behavior needs manual implementation
- Browser table features (sorting, selection) are lost

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

## Text Component Decision Framework

### Web vs Mobile Text Usage

**CRITICAL: Text primitive is **NOT USED on web production code**. It is REQUIRED on native (React Native).**

#### ✅ **Web-Only Components (.web.tsx)**
**For web code, always use plain HTML with CSS typography classes (mandatory -- Text primitive has been removed from all web production code):**
```tsx
// Simpler, no abstraction layer
<p className="text-body">Main content text</p>
<span className="text-small text-subtle">Helper text</span>
<h1 className="text-title">Page title</h1>

// Available CSS classes:
// text-title-large, text-title, text-subtitle, text-subtitle-2
// text-body, text-label, text-label-strong
// text-small, text-small-desktop
// Color: text-strong, text-subtle, text-muted, etc.
```

#### ✅ **Mobile-Only Components (.native.tsx)**
**Must use Text primitive - HTML elements don't work in React Native:**
```tsx
<Text variant="strong" size="lg">Page Title</Text>
<Text>Body content</Text>
<Text variant="subtle" size="sm">Helper text</Text>
```

#### ✅ **Shared Components (Component.tsx)**
**Use Text primitive for cross-platform compatibility:**
```tsx
// Works on both web and mobile
<Text variant="strong" size="lg">Title</Text>
<Text variant="subtle">Description</Text>
```

### When NOT to Use Text Primitive on Web

**Don't use Text on web. It has been removed from all production web code.** The only exception is dev/playground files.

**On web, always use CSS classes:**
- All web-only components (`.web.tsx`)
- All production web code without exception
- Use `<span>`, `<p>`, `<h1>`-`<h6>` with CSS typography classes

**The Text primitive is only for:**
- Native-only components (`.native.tsx`) -- required, HTML elements don't work in React Native
- Shared cross-platform components (`Component.tsx` without platform suffix) that must render on both web and native

## Best Practice

**Use primitives where they add value: consistency, reusability, and maintainability. Don't force them everywhere for ideological purity.**

The goal is shared business logic with appropriate UI abstractions, not primitive components at all costs.

---

_Last updated: 2026-02-10 - Text primitive removed from web production code; now native-only_

---

[← Back to Primitives INDEX](./INDEX.md)
