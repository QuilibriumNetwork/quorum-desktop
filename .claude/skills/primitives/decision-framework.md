# 5-Question Decision Framework for Primitives

Quick reference for systematic primitive vs raw HTML decisions.

## The Questions

### 1. **Does this element interact with users?**
- **YES** → **Use primitive** (Button, Input, Select, Switch, Modal)
- **WHY**: Interaction consistency is critical for UX and cross-platform behavior

**Examples:**
- ✅ `<Button onClick={save}>Save</Button>`
- ✅ `<Input value={name} onChange={setName} />`
- ❌ `<button onClick={save}>Save</button>`

### 2. **Does this need theme colors/spacing?**
- **YES** → **Use primitive** (semantic colors, consistent spacing)
- **WHY**: Theme integration and design system consistency

**Examples:**
- ✅ `<Container padding="md" backgroundColor="var(--surface-1)">`
- ✅ `<Text variant="subtle">Secondary text</Text>`
- ❌ `<div style={{padding: '16px', backgroundColor: '#f0f0f0'}}>`

### 3. **Is this layout pattern repeated?**
- **YES** → **Consider primitive** (reusability and consistency)
- **WHY**: Shared patterns benefit from centralized implementation

**Examples:**
- ✅ `<FlexBetween>` for header layouts used across multiple components
- ✅ `<FlexColumn gap="sm">` for form field groups
- 🤔 One-off unique layouts may not need primitives

### 4. **Is the CSS complex/specialized?**
- **YES** → **Keep raw HTML + SCSS** (avoid over-abstraction)
- **WHY**: Complex styling is often easier and more performant with direct CSS

**Examples:**
- ✅ Data tables with CSS Grid
- ✅ Complex animations and transitions
- ✅ Media overlays with absolute positioning
- ✅ Third-party library integration containers

### 5. **Is this performance-critical?**
- **YES** → **Measure first, optimize if needed**
- **WHY**: Extra component layers can impact performance in hot paths

**Examples:**
- 🤔 Long lists with hundreds of items
- 🤔 Real-time updating components
- 🤔 Complex interactive visualizations

## Decision Matrix

| Scenario | Question 1 | Question 2 | Question 3 | Question 4 | Question 5 | **Recommendation** |
|----------|------------|------------|------------|------------|------------|-------------------|
| Save Button | ✅ Interactive | ✅ Theme | ✅ Repeated | ❌ Simple | ❌ Not critical | **Always Primitive** |
| Form Input | ✅ Interactive | ✅ Theme | ✅ Repeated | ❌ Simple | ❌ Not critical | **Always Primitive** |
| Data Table | ❌ Display only | 🤔 Some theme | ❌ Unique layout | ✅ Complex CSS | 🤔 Depends on size | **Raw HTML + SCSS** |
| Simple Card | ❌ Container only | ✅ Theme colors | ✅ Repeated pattern | ❌ Simple | ❌ Not critical | **Consider Primitive** |
| Text Content | ❌ Display only | 🤔 Sometimes | ❌ Various contexts | ❌ Simple | ❌ Not critical | **Primitive if theme needed** |

## Quick Reference

### Always Use Primitives
- Button, Input, Select, TextArea, Switch
- Modal, ModalContainer
- Components that need onClick/onPress

### Usually Use Primitives
- FlexRow, FlexColumn for simple layouts
- Container for themed boxes
- Text when semantic styling needed

### Often Raw HTML
- Complex tables and grids
- Unique animations
- Third-party library wrappers
- Performance-critical repeated elements

### Text Primitive Special Cases

**CRITICAL: Text primitive is INLINE by default** (behaves like `<span>`, not `<p>`)

**Solution depends on component type:**

### **✅ Shared Components: Use Helpers**
**Components without .web/.native suffix - mobile needs automatic spacing**
- ✅ **Headings**: `<Title typography="title">` (helper required for mobile)
- ✅ **Paragraphs**: `<Paragraph typography="body">` (helper required for mobile)
- ✅ **Labels**: `<Label typography="label">` (helper required for mobile)
- ✅ **Help text**: `<Caption typography="small">` (helper required for mobile)

### **❌ Web-Only Components: Use Text + as prop**
**Components with .web.tsx suffix - semantic HTML better**
- ✅ **Headings**: `<Text as="h1" typography="title">` (don't use Title helper)
- ✅ **Paragraphs**: `<Text as="p" typography="body">` (don't use Paragraph helper)
- ✅ **Labels**: `<Text as="span" typography="label">` (don't use Label helper)
- ✅ **Help text**: `<Text as="p" typography="small">` (don't use Caption helper)

### **✅ Mobile-Only Components: Prefer Helpers**
**Components with .native.tsx suffix - helpers provide optimal spacing**
- ✅ **Headings**: `<Title typography="title">` (helper optimal)
- ✅ **Paragraphs**: `<Paragraph typography="body">` (helper optimal)
- ✅ **Labels**: `<Label typography="label">` (helper optimal)
- ✅ **Help text**: `<Caption typography="small">` (helper optimal)

**When Text primitive has compatibility issues:**
- ✅ Use semantic HTML (`<span>`, `<p>`, `<h1>`) with CSS classes (web-only)
- ✅ Wrap Text in Container for block behavior: `<Container><Text>...</Text></Container>` (when helpers not suitable)
- ✅ Prioritize layout correctness and platform optimization over primitive purity

## Implementation Tips

### Start Simple
1. Begin with business logic and data flow
2. Add primitives for interactions first
3. Evaluate layout containers case-by-case
4. Refactor if patterns emerge

### Platform-Specific Examples

#### **Shared Component Example**
```tsx
// File: UserModal.tsx (shared - must use helpers for mobile)
<Modal visible={show} onClose={close}>           {/* Primitive: interaction */}
  <Container padding="lg">                       {/* Primitive: theme spacing */}
    <Title typography="title">User Profile</Title>           {/* Helper: required for mobile */}
    <Paragraph typography="body">                            {/* Helper: required for mobile */}
      Update your profile information below.
    </Paragraph>

    <Label typography="label">Display Name</Label>           {/* Helper: required for mobile */}
    <Input value={name} onChange={setName} />

    <FlexRow gap="sm" justify="end">             {/* Primitive: simple layout */}
      <Button type="subtle" onClick={close}>Cancel</Button>
      <Button type="primary" onClick={save}>Save</Button>
    </FlexRow>
  </Container>
</Modal>
```

#### **Web-Only Component Example**
```tsx
// File: DataTable.web.tsx (web-only - use Text + as prop)
function DataTable({ data }) {
  return (
    <div className="data-table-container">
      <Text as="h1" typography="title">Export Data</Text>    {/* Semantic HTML: better for web */}

      <table className="export-table">
        <thead>
          <tr>
            <th><Text as="span" typography="label">Name</Text></th>     {/* Don't use Label helper */}
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

      <Text as="p" typography="small">                       {/* Don't use Caption helper */}
        Export includes selected fields in CSV format.
      </Text>
    </div>
  );
}
```

### When in Doubt
- **First determine component type** - shared, web-only, or mobile-only
- **Interactive elements** → Always use primitives (Button, Input, etc.)
- **Text elements in shared components** → Use helpers (mobile needs them)
- **Text elements in web-only components** → Use Text + as prop (semantic HTML better)
- **Complex layouts** → Raw HTML acceptable for web-only components
- **Test both approaches** for borderline cases
- **Ask the team** about established patterns

### Quick Decision Guide
- File ends with `.tsx` → Shared → Use helpers
- File ends with `.web.tsx` → Web-only → Use Text + as prop
- File ends with `.native.tsx` → Mobile-only → Use helpers