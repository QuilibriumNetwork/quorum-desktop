---
type: task
title: Remove Text Primitive from Web App
status: not-decided
priority: low
created: 2026-01-14T18:00:00.000Z
updated: 2026-01-14T18:15:00.000Z
---

# Remove Text Primitive from Web App

> **Purpose:** Simplify web codebase by replacing the Text primitive with plain HTML elements and CSS classes.

---

## Decision Status: NOT YET DECIDED

This task documents the **option** to remove the Text primitive from web. We have not committed to doing this.

### Arguments FOR Removing

| Reason | Details |
|--------|---------|
| Simpler code | No abstraction layer, direct HTML |
| Smaller bundle | Remove Text component from web build |
| Standard patterns | Follows typical React/HTML conventions |
| Easier onboarding | New devs don't need to learn Text API |

### Arguments AGAINST Removing

| Reason | Details |
|--------|---------|
| **Easier mobile migration** | Web components using Text primitive are easier to port to mobile since Text is already cross-platform compatible |
| Component reuse | If we copy a web component to mobile, Text just works; HTML elements need conversion |
| Consistency | Same patterns across both codebases |
| Future flexibility | If architecture changes again, Text is already in place |

### Recommendation

**Keep Text primitive for now.** The migration benefit (easier web→mobile component porting) outweighs the simplification benefit. If a component uses `<Text variant="subtle">`, it can be copied to mobile with minimal changes. If it uses `<span className="text-subtle">`, every text element needs manual conversion.

This task should remain as documentation of the option, not an action item.

---

## Context

The Text primitive exists for **cross-platform consistency** with React Native. On mobile, it's required (RN has no `<span>`, `<p>`, `<div>`). On web, it's an unnecessary abstraction layer that just maps props to CSS classes.

With the architecture change to separate repos (quorum-desktop, quorum-mobile), the web app no longer *needs* cross-platform primitives for text rendering, but keeping them may still provide value for component migration.

---

## Current State

| Metric | Value |
|--------|-------|
| Text primitive usages | ~1100 |
| Files affected | TBD (need to count) |
| Complexity | Low (mechanical find-and-replace) |

---

## Migration Mapping

### Variant → CSS Class

| Text Prop | CSS Class |
|-----------|-----------|
| `variant="default"` | `text-main` |
| `variant="strong"` | `text-strong` |
| `variant="subtle"` | `text-subtle` |
| `variant="muted"` | `text-muted` |
| `variant="error"` | `text-red-600 dark:text-red-400` |
| `variant="danger"` | `text-danger` |
| `variant="success"` | `text-success` |
| `variant="warning"` | `text-warning` |
| `variant="link"` | `text-link-primitive` |

### Size → CSS Class

| Text Prop | CSS Class |
|-----------|-----------|
| `size="xs"` | `text-xs` |
| `size="sm"` | `text-sm` |
| `size="base"` | `text-base` |
| `size="lg"` | `text-lg` |
| `size="xl"` | `text-xl` |
| `size="2xl"` | `text-2xl` |
| `size="3xl"` | `text-3xl` |

### Weight → CSS Class

| Text Prop | CSS Class |
|-----------|-----------|
| `weight="normal"` | `font-normal` |
| `weight="medium"` | `font-medium` |
| `weight="semibold"` | `font-semibold` |
| `weight="bold"` | `font-bold` |

### Align → CSS Class

| Text Prop | CSS Class |
|-----------|-----------|
| `align="left"` | `text-left` |
| `align="center"` | `text-center` |
| `align="right"` | `text-right` |

---

## Migration Examples

```tsx
// Before
<Text variant="strong" size="lg">Title</Text>
<Text variant="subtle">Secondary text</Text>
<Text variant="subtle" size="sm" weight="medium">Label</Text>
<Text as="p">Paragraph text</Text>
<Text as="a" href="/link">Link text</Text>

// After
<span className="text-strong text-lg">Title</span>
<span className="text-subtle">Secondary text</span>
<span className="text-subtle text-sm font-medium">Label</span>
<p className="text-main">Paragraph text</p>
<a href="/link" className="text-link-primitive">Link text</a>
```

---

## Implementation Plan

### Phase 1: Audit & Preparation

| Task | Status |
|------|--------|
| Count exact Text usages with `grep -r "<Text" src/ --include="*.tsx" \| wc -l` | ⬜ |
| List all unique prop combinations used | ⬜ |
| Identify any edge cases (onClick, testId, style prop, etc.) | ⬜ |
| Create migration script or regex patterns | ⬜ |

### Phase 2: Migration by Directory

Migrate in batches by directory to make PRs reviewable:

| Directory | Est. Usages | Status |
|-----------|-------------|--------|
| `src/components/modals/` | TBD | ⬜ |
| `src/components/chat/` | TBD | ⬜ |
| `src/components/settings/` | TBD | ⬜ |
| `src/components/space/` | TBD | ⬜ |
| `src/components/user/` | TBD | ⬜ |
| `src/components/nav/` | TBD | ⬜ |
| `src/components/common/` | TBD | ⬜ |
| `src/dev/` | TBD | ⬜ |
| Other directories | TBD | ⬜ |

### Phase 3: Cleanup

| Task | Status |
|------|--------|
| Remove Text export from primitives index (web only) | ⬜ |
| Keep Text.web.tsx for any remaining edge cases | ⬜ |
| Update playground to show CSS class approach | ⬜ |
| Run full build and lint | ⬜ |
| Visual regression testing on key pages | ⬜ |

---

## Edge Cases to Handle

### 1. onClick Handler
```tsx
// Before
<Text onClick={handleClick}>Clickable text</Text>

// After
<span className="text-main cursor-pointer" onClick={handleClick}>Clickable text</span>
```

### 2. testId Prop
```tsx
// Before
<Text testId="my-text">Test text</Text>

// After
<span className="text-main" data-testid="my-text">Test text</span>
```

### 3. style Prop
```tsx
// Before
<Text style={{ marginTop: 8 }}>Styled text</Text>

// After
<span className="text-main" style={{ marginTop: 8 }}>Styled text</span>
// Or better: <span className="text-main mt-2">Styled text</span>
```

### 4. as Prop (Element Type)
```tsx
// Before
<Text as="h1" variant="strong" size="2xl">Heading</Text>
<Text as="p">Paragraph</Text>
<Text as="a" href="/link">Link</Text>

// After
<h1 className="text-strong text-2xl">Heading</h1>
<p className="text-main">Paragraph</p>
<a href="/link" className="text-link-primitive">Link</a>
```

### 5. Link Props (href, target, rel)
```tsx
// Before
<Text as="a" href="/link" target="_blank" rel="noopener">External link</Text>

// After
<a href="/link" target="_blank" rel="noopener" className="text-link-primitive">External link</a>
```

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Simpler code** | No abstraction layer, direct HTML |
| **Smaller bundle** | Remove Text component from web build |
| **Standard patterns** | Follows typical React/HTML conventions |
| **Easier onboarding** | New devs don't need to learn Text API |
| **Better IDE support** | HTML elements have better autocomplete |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Visual regressions | Batch migrations with visual checks per batch |
| Missing prop mappings | Audit all prop combinations before starting |
| Large PR size | Split by directory, multiple smaller PRs |
| Merge conflicts | Coordinate with team, do during low-activity period |

---

## Success Criteria

- [ ] Zero `<Text` usages in web codebase (excluding playground demos)
- [ ] Build passes
- [ ] Lint passes
- [ ] No visual regressions on key pages
- [ ] Text primitive still works in mobile codebase (unchanged)

---

## Notes

- This is a **low priority** optimization task
- Can be done incrementally over time
- Each batch should be a separate PR for easier review
- Text primitive remains in `primitives/` for mobile compatibility

---

*Created: 2026-01-14T18:00:00Z*
