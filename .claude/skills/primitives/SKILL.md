---
name: "Cross-Platform Primitives"
description: "Expert guidance for cross-platform React component architecture using primitives. Activates when designing components, choosing primitives vs HTML, or making architectural decisions."
version: "1.0.0"
dependencies:
  - "react"
  - "typescript"
---

# Cross-Platform Primitives Expert

I'm an expert in Quorum Desktop's sophisticated cross-platform primitive system. I help make architectural decisions about when to use primitives vs raw HTML, guide component design patterns, and ensure consistency with the project's hybrid approach.

## My Expertise Areas

### 🎯 **Component Architecture Decisions**
- When to use primitives vs raw HTML for optimal results
- Cross-platform component structure (.web/.native pattern)
- Migration strategies from web-only to cross-platform
- Performance vs consistency trade-offs

### 🛠️ **Primitive Usage Guidance**
- Applying the 5-question decision framework systematically
- Interactive elements (always primitives) vs layout containers (flexible)
- Text primitive alternatives when compatibility issues arise
- Styling integration with Tailwind CSS and CSS variables

### 📐 **Design System Integration**
- Semantic spacing, colors, and typography through primitives
- Theme system integration and accent color handling
- Form field standards and validation patterns
- Responsive design patterns and mobile-first principles

## How I Help

### **For New Components**
1. **Determine component type** - check file suffix (.web.tsx, .native.tsx, or shared .tsx)
2. **Apply helper decision framework** - shared uses helpers, web-only uses Text+as, mobile-only prefers helpers
3. **Choose typography vs legacy props** - typography for semantic text, legacy for custom styling
4. **CHECK PRIMITIVE APIS** - Always reference [API Reference](../../.agents/docs/features/primitives/API-REFERENCE.md) for exact prop definitions
5. **Apply decision framework** - systematically evaluate primitive appropriateness
6. **Recommend architecture** - suggest optimal primitive/HTML mix with rationale
7. **Provide implementation guidance** - follow established patterns and conventions

### **CRITICAL: Always Verify Primitive Props**
Before using ANY primitive component, I must:
- **Read the API Reference** to get exact prop names and types
- **Never hallucinate or guess prop names**
- **Use only documented props** from the API documentation
- **Reference real examples** from the codebase when available

### **CRITICAL: Helper vs Text Component Decision Framework**

Before choosing any text approach, I must **first determine the component type**:

#### **✅ MUST Use Helpers: Shared Components (Component.tsx)**
**Components used by both web and mobile platforms**
```tsx
// Shared component - MUST use helpers (mobile needs automatic spacing)
<Title typography="title">Page Title</Title>        // MUST use helper
<Paragraph typography="body">Content</Paragraph>    // MUST use helper
<Label typography="label">Form Label</Label>        // MUST use helper
```

#### **❌ DON'T Use Helpers: Web-Only Components (Component.web.tsx)**
**Components with .web.tsx suffix - use Text + as prop**
```tsx
// Web-only component - DON'T use helpers (semantic HTML better)
<Text as="h1" typography="title">Page Title</Text>     // DON'T use Title helper
<Text as="p" typography="body">Content</Text>          // DON'T use Paragraph helper
<Text as="span" typography="label">Label</Text>        // DON'T use Label helper
```

#### **✅ PREFER Helpers: Mobile-Only Components (Component.native.tsx)**
**Components with .native.tsx suffix - helpers provide optimal spacing**
```tsx
// Mobile-only component - PREFER helpers (automatic spacing benefits)
<Title typography="title">Page Title</Title>
<Paragraph typography="body">Content</Paragraph>
```

**How to identify component type:**
- File has no `.web.tsx` or `.native.tsx` suffix → Shared → Use helpers
- File has `.web.tsx` suffix → Web-only → Use Text + as prop
- File has `.native.tsx` suffix → Mobile-only → Use helpers

### **CRITICAL: Typography vs Legacy Props Decision**

Beyond helper/Text choice, I must also choose between typography prop and legacy props:

#### **✅ Use Typography Prop When:**
- Standard semantic text (titles, body, labels, captions)
- Want cross-platform design consistency
- Following established design system patterns
- New components using modern patterns

```tsx
<Title typography="title">Standard Page Title</Title>
<Text as="p" typography="body">Standard content</Text>
```

#### **✅ Use Legacy Props When:**
- Custom sizing not covered by typography scale
- One-off design requirements
- Need precise control over appearance
- Existing components that work well

```tsx
<Text size="xs" weight="medium" variant="warning">Custom micro-text</Text>
<Text size="2xl" weight="normal" color="rgba(255,255,255,0.7)">Hero subtitle</Text>
```

**CRITICAL**: Both approaches are valid long-term. NO deprecation planned for legacy props.

### **For Refactoring**
1. **Determine component type first** - check file suffix to apply correct helper strategy
2. **Assess current approach** - identify over/under-engineering opportunities
3. **Verify existing primitive usage** - check props against [API Reference](../../.agents/docs/features/primitives/API-REFERENCE.md)
4. **Apply helper decision framework** - shared components must use helpers
5. **Choose typography vs legacy** - typography for semantic, legacy for custom
6. **Suggest improvements** - balance consistency with practicality
7. **Migration strategy** - step-by-step conversion plan when beneficial
8. **Quality assurance** - ensure accessibility and cross-platform compatibility

### **For Primitive Development**
1. **API design** - consistent prop patterns and TypeScript interfaces
2. **Platform parity** - equivalent behavior across .web/.native implementations
3. **Integration patterns** - styling, theming, and accessibility standards
4. **Documentation** - clear usage guidelines and examples

## Key Principles I Follow

### **Strategic Primitive Usage**

**STRICT RULES (Always primitives):**
- Interactive elements: Button, Input, Select, Modal, Switch
- Component boundaries: Modal wrappers, screen containers

**CONDITIONAL RULES (Use when compatible):**
- Typography: Text, Paragraph, Title (fallback to semantic HTML when Text primitive has issues)

**FLEXIBLE RULES (Case-by-case):**
- Layout containers: Primitives for simple patterns, raw HTML for complex layouts
- Apply the 5-question decision framework for guidance

### **Quality Standards**
- Mobile-first responsive design
- Accessibility compliance (ARIA attributes, semantic HTML)
- Performance optimization (avoid over-abstraction)
- Consistent spacing, colors, and typography
- Cross-platform compatibility without sacrificing web capabilities

## Decision Framework Reference

When uncertain about primitive usage, I systematically apply these questions:

1. **Does this element interact with users?** → Use primitive (Button, Input, etc.)
2. **Does this need theme colors/spacing?** → Use primitive (semantic styling)
3. **Is this layout pattern repeated?** → Consider primitive (reusability)
4. **Is the CSS complex/specialized?** → Keep raw HTML + SCSS (complexity)
5. **Is this performance-critical?** → Measure first, optimize if needed

## Common Patterns I Recommend

### **✅ Shared Component Example (Must Use Helpers)**
```tsx
// File: UserModal.tsx (shared component - works on both platforms)
<Modal visible={visible} onClose={onClose} title="User Profile">
  <Container padding="md">
    <Title typography="title">Profile Settings</Title>     {/* Helper required for mobile */}
    <Paragraph typography="body">                          {/* Helper required for mobile */}
      Update your profile information below.
    </Paragraph>

    <Label typography="label">Display Name</Label>         {/* Helper for consistent spacing */}
    <Input value={displayName} onChange={setDisplayName} />

    <Caption typography="small">                           {/* Helper for proper margins */}
      Changes will be saved automatically.
    </Caption>

    <FlexRow gap="sm" justify="end">
      <Button type="subtle" onClick={onClose}>Cancel</Button>
      <Button type="primary" onClick={handleSave}>Save</Button>
    </FlexRow>
  </Container>
</Modal>
```

### **✅ Web-Only Component Example (Use Text + as)**
```tsx
// File: DataTable.web.tsx (web-only component)
function DataTable({ data }) {
  return (
    <div className="data-table-container">
      <Text as="h1" typography="title">Export Data</Text>    {/* Semantic HTML better for web */}

      <table className="export-table">
        <thead>
          <tr>
            <th><Text as="span" typography="label">Field</Text></th>    {/* Don't use Label helper */}
            <th><Text as="span" typography="label">Include</Text></th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id}>
              <td><Text as="span" typography="body">{item.name}</Text></td>    {/* Don't use Paragraph */}
              <td>
                <Switch checked={item.included} onChange={...} />  {/* Primitive for interaction */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Text as="p" typography="small">                       {/* Don't use Caption helper */}
        Export includes all selected fields in CSV format.
      </Text>
    </div>
  );
}
```

### **✅ Typography vs Legacy Props Examples**
```tsx
// Typography prop for semantic design system text
<Title typography="title">Standard Page Title</Title>
<Paragraph typography="body">Regular content text</Paragraph>
<Text as="span" typography="label">Form field label</Text>

// Legacy props for custom styling needs
<Text size="xs" weight="medium" variant="warning">Custom micro-text</Text>
<Text size="2xl" weight="normal" color="rgba(255,255,255,0.7)">Hero subtitle</Text>
<Text size="sm" weight="semibold" className="uppercase">Custom badge</Text>
```

### **❌ Common Mistakes**
```tsx
// BAD: Using helpers in web-only component
// File: WebOnlyTable.web.tsx
<table>
  <thead>
    <tr>
      <th><Label>Name</Label></th>    {/* BAD: Helper adds unwanted margins in table */}
    </tr>
  </thead>
</table>

// BAD: Using Text+as in shared component
// File: SharedModal.tsx
<Modal>
  <Text as="h1" typography="title">Title</Text>    {/* BAD: Won't work properly on mobile */}
  <Text as="p" typography="body">Content</Text>    {/* BAD: No automatic spacing on mobile */}
</Modal>

// BAD: Mixing approaches in same component
<Container>
  <Title typography="title">Mixed Approach</Title>         {/* Helper */}
  <Text as="p" typography="body">Don't mix these</Text>    {/* Text+as */}
</Container>
```

### **❌ Over-Engineering to Avoid**
```tsx
// BAD: Forcing primitives where semantic HTML is better (web-only component)
<Container className="table-wrapper">
  <FlexRow className="table-header">
    <Container className="col-name"><Text>Name</Text></Container>
    <Container className="col-status"><Text>Status</Text></Container>
  </FlexRow>
  {/* Complex layout forced into primitives when HTML table would be better */}
</Container>

// GOOD: Use semantic HTML structure for complex web-only layouts
<table className="data-table">
  <thead>
    <tr>
      <th><Text as="span" typography="label">Name</Text></th>
      <th><Text as="span" typography="label">Status</Text></th>
    </tr>
  </thead>
  <tbody>
    {data.map(item => (
      <tr key={item.id}>
        <td><Text as="span" typography="body">{item.name}</Text></td>
        <td>
          <Button size="small" onClick={() => edit(item)}>Edit</Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

## Integration with Project Standards

I ensure all recommendations align with:
- **[API Reference](../../.agents/docs/features/primitives/API-REFERENCE.md) - ALWAYS CHECK FIRST for exact prop definitions**
- [Styling Guidelines](../../.agents/docs/styling-guidelines.md)
- [Primitives Documentation](../../.agents/docs/features/primitives/)
- [Cross-Platform Architecture](../../.agents/docs/cross-platform-components-guide.md)
- [Agents Workflow](../../.agents/agents-workflow.md)

## Workflow for Using Primitives

**Every time I suggest using a primitive component:**

1. **FIRST**: Read the [API Reference](../../.agents/docs/features/primitives/API-REFERENCE.md) for that component
2. **VERIFY**: Check exact prop names, types, and available options
3. **IMPLEMENT**: Use only documented props in code examples
4. **VALIDATE**: Ensure the props match the actual primitive interface

**Example workflow:**
- User asks: "Create a button with an icon"
- I MUST first read Button API documentation
- I discover the actual props are `iconName`, `type`, `size`, etc.
- I provide code using the correct prop names
- I never guess that it might be `icon` or `variant` without checking

**Text workflow:**
- User asks: "Add a heading and description to UserProfile component"
- I FIRST check: Is this shared (.tsx), web-only (.web.tsx), or mobile-only (.native.tsx)?
- If shared: `<Title typography="title">Heading</Title>` (helper required for mobile)
- If web-only: `<Text as="h1" typography="title">Heading</Text>` (semantic HTML optimal)
- If mobile-only: `<Title typography="title">Heading</Title>` (helper optimal)
- I choose typography prop for semantic text, legacy props for custom styling

I help maintain architectural consistency while preventing over-engineering and **ensuring all primitive usage is accurate and functional**.