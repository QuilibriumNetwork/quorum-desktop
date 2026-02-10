---
type: task
title: Remove Text Primitive from Production Web Code
status: completed
complexity: medium
ai_generated: true
reviewed_by: null
created: 2026-01-14T18:00:00.000Z
updated: 2026-02-10
related_docs: [text-primitive-audit_2026-02-10.md]
---

# Remove Text Primitive from Production Web Code

> **Purpose:** Simplify web codebase by replacing the Text primitive with plain HTML elements and CSS classes, while applying mobile-first responsive typography via centralized CSS variables.

> **⚠️ AI-Generated**: May contain errors. Verify before use.

---

## Decision Status: APPROVED — IN PROGRESS

**Decision:** Remove Text primitive from all production web code. Keep primitive files intact for native + dev playground.

**Rationale:**
- The Text primitive on web is just a props-to-CSS-classes adapter — no behavior beyond HTML
- Separate repos (quorum-desktop / quorum-mobile) mean no direct component sharing
- Only ~31% of TSX files use Text; ~57% already use plain HTML — the codebase is already hybrid
- Project architecture docs explicitly state: "Text primitive is OPTIONAL on web"
- TextHelpers (Paragraph, Label, Caption, Title, InlineText) have **zero usage** anywhere
- Opportunity to proactively apply mobile-first responsive typography via centralized CSS variables

---

## Context

The Text primitive exists for **cross-platform consistency** with React Native. On mobile, it's required (RN has no `<span>`, `<p>`, `<div>`). On web, it's an unnecessary abstraction layer that maps props to CSS classes.

With the architecture change to separate repos, the web app no longer needs cross-platform primitives for text rendering. The "easier mobile migration" argument is weak because any porting between repos requires significant rework regardless.

---

## Current State (Audited 2026-02-10)

| Metric | Value |
|--------|-------|
| Text JSX tags (production) | ~123 |
| Text JSX tags (dev) | ~156 |
| Files importing Text (production) | 27 |
| Files importing Text (dev) | 11 (skipped) |
| Dead imports | 3 (YouTubeFacade.tsx + 2 dev files) |
| TextHelpers usage | 0 (zero usage anywhere) |
| Complexity | Medium (mechanical, but requires mobile-first typography decisions) |

See [detailed audit report](../reports/text-primitive-audit_2026-02-10.md) for file-by-file breakdown.

---

## Typography System: Two-Layer Approach

The migration uses a **two-layer typography system** that separates sizing from semantics:

### Layer 1: Size Layer (CSS Variables) — Just font-size + line-height, responsive

Centralized CSS custom properties that handle the mobile bump automatically. Change in one place → applies everywhere.

| Variable | Mobile (<480px) | Desktop (≥480px) | Already exists? |
|----------|----------------|-------------------|-----------------|
| `--text-xs-responsive` | 14px (`$text-sm`) | 12px (`$text-xs`) | ✅ Yes |
| `--text-sm-responsive` | 16px (`$text-base`) | 14px (`$text-sm`) | ❌ Add |

These are defined in `_base.scss` `:root` with a `@media (min-width: $screen-xs)` breakpoint (480px), and mirrored as SCSS variables in `_variables.scss` for use in component `.scss` files.

### Layer 2: Semantic Layer (Typography Classes) — Size + color + weight for specific contexts

Pre-composed classes from `_typography.scss` that bundle size, color, weight, and spacing for common UI patterns. These already exist and are used extensively in modals.

| Class | Size | Weight | Color | Responsive? | Typical Use |
|-------|------|--------|-------|-------------|-------------|
| `.text-title-large` | 24px | bold | strong | No | Page headings |
| `.text-title` | 20px | bold | main | No | Section headings |
| `.text-subtitle` | 18px | bold | main | No | Subsections |
| `.text-subtitle-2` | 14px bold uppercase | bold | subtle | No | Category headers |
| `.text-body` | 16px | normal | main | No | Body paragraphs |
| `.text-label` | 14px | normal | subtle | No | Form labels, descriptions |
| `.text-label-strong` | 14px | normal | main | No | Toggle labels in modals |
| `.text-small` | 14→12px | normal | subtle | ✅ Yes | Small metadata, timestamps |
| `.text-small-desktop` | 12px always | normal | subtle | No | Forced small text |

### Decision Logic: Which layer to use?

```
Does a semantic class match the context?
  ├─ Yes → Use the semantic class (.text-label, .text-small, .text-body, etc.)
  └─ No → Is this in a component SCSS file?
       ├─ Yes → Use SCSS variable (font-size: $text-sm-responsive)
       └─ No → Use Tailwind responsive pattern (text-base xs:text-sm)
```

**Prefer semantic classes when they fit.** They provide the most centralized control.
**Fall back to CSS variables in SCSS** when the semantic class has the wrong color/weight.
**Use inline Tailwind responsive patterns as last resort** — only for rare one-off cases.

---

## Pre-Implementation: Infrastructure Changes

Before migrating any Text components, set up the responsive typography infrastructure:

### 1. Add `--text-sm-responsive` CSS variable

**File:** `src/styles/_base.scss` — add alongside existing `--text-xs-responsive` in `:root`

```scss
--text-sm-responsive: #{$text-base};       // 16px on mobile
--text-sm-responsive-lh: #{$text-base-lh}; // 24px on mobile

@media (min-width: $screen-xs) {
  --text-sm-responsive: #{$text-sm};       // 14px on desktop
  --text-sm-responsive-lh: #{$text-sm-lh}; // 20px on desktop
}
```

### 2. Add SCSS variable

**File:** `src/styles/_variables.scss` — add below existing `$text-xs-responsive`

```scss
$text-sm-responsive: var(--text-sm-responsive);
$text-sm-responsive-lh: var(--text-sm-responsive-lh);
```

### 3. Consider updating existing semantic classes

**File:** `src/styles/_typography.scss` — optional, evaluate if `.text-label` and `.text-label-strong` should use `$text-sm-responsive` instead of `$text-sm`. This would make labels automatically responsive. Since these classes are mainly used in modals where mobile readability matters, this could be a good fit.

---

## Migration Mapping

### Variant → CSS Class

| Text Prop | CSS Class |
|-----------|-----------|
| `variant="default"` | `text-main` (omit if redundant with existing classes) |
| `variant="strong"` | `text-strong` |
| `variant="subtle"` | `text-subtle` |
| `variant="muted"` | `text-muted` |
| `variant="error"` | `text-red-600 dark:text-red-400` |
| `variant="danger"` | `text-danger` |
| `variant="success"` | `text-success` |
| `variant="warning"` | `text-warning` |
| `variant="link"` | `text-link-primitive` |
| `as="a"` + no variant | `text-link-primitive` (auto-detect) |

### Size → Replacement (Responsive at `xs: 480px` breakpoint)

| Text Prop | Replacement | Strategy |
|-----------|------------|----------|
| `size="xs"` (readable) | `.text-small` class, or `$text-xs-responsive` in SCSS, or `text-sm xs:text-xs` inline | Prefer semantic class |
| `size="xs"` (decorative) | Bare `text-xs` | Badges, kbd hints — no bump |
| `size="sm"` (readable) | `.text-label` if subtle color fits, or `$text-sm-responsive` in SCSS, or `text-base xs:text-sm` inline | Prefer semantic class |
| `size="sm"` (decorative) | Bare `text-sm` | Rare |
| `size="base"` | *(omit — browser default)* | |
| `size="lg"` | `text-lg` | No bump needed |
| `size="xl"` | `text-xl` | No bump needed |
| `size="2xl"` | `text-2xl` | No bump needed |
| `size="3xl"` | `text-3xl` | No bump needed |

### Weight → CSS Class

| Text Prop | CSS Class |
|-----------|-----------|
| `weight="normal"` | *(omit — browser default)* |
| `weight="medium"` | `font-medium` |
| `weight="semibold"` | `font-semibold` |
| `weight="bold"` | `font-bold` |

### Align → CSS Class

| Text Prop | CSS Class |
|-----------|-----------|
| `align="left"` | *(omit — browser default)* |
| `align="center"` | `text-center` |
| `align="right"` | `text-right` |

### Other Props

| Text Prop | HTML Equivalent |
|-----------|----------------|
| `as="h1"` | `<h1>` (semantic HTML) |
| `as="p"` | `<p>` (semantic HTML) |
| `as="a"` + href | `<a href="...">` with all link props |
| `testId="x"` | `data-testid="x"` |
| `style={...}` | `style={...}` (pass through) |
| `color="..."` | `style={{ color: '...' }}` |
| `onClick={...}` | `onClick={...}` (pass through) |

---

## Migration Examples

```tsx
// Before
<Text variant="strong" size="lg">Title</Text>
<Text variant="subtle">Secondary text</Text>
<Text variant="subtle" size="sm" weight="medium">Label</Text>
<Text variant="muted" size="xs">(edited)</Text>
<Text as="p">Paragraph text</Text>
<Text as="a" href="/link" target="_blank">Link text</Text>
<Text className="message-sender-name">Name</Text>

// After — using semantic classes where they fit
<span className="text-strong text-lg">Title</span>
<span className="text-subtle">Secondary text</span>
<span className="text-label font-medium">Label</span>
<span className="text-small text-muted">(edited)</span>
<p>Paragraph text</p>
<a href="/link" target="_blank" className="text-link-primitive">Link text</a>
<span className="message-sender-name">Name</span>

// After — when semantic class color doesn't match, use CSS var or inline
<span className="text-strong" style={{ fontSize: 'var(--text-sm-responsive)' }}>Strong label</span>
// Or in SCSS: font-size: $text-sm-responsive;
// Or inline Tailwind (last resort): className="text-strong text-base xs:text-sm"
```

---

## Implementation Plan

### Phase 0: Typography Infrastructure ✅

| Task | Status |
|------|--------|
| Add `--text-sm-responsive` CSS variable to `_base.scss` | ✅ |
| Add `$text-sm-responsive` SCSS variable to `_variables.scss` | ✅ |
| Evaluate updating `.text-label` / `.text-label-strong` to use responsive var | ✅ Updated both |
| Verify build + no visual regressions from infrastructure changes | ✅ |

### Phase 1: Audit & Preparation ✅

| Task | Status |
|------|--------|
| Count exact Text usages per file | ✅ Done |
| List all unique prop combinations | ✅ Done |
| Identify edge cases (onClick, style, as, href, etc.) | ✅ Done |
| Document mobile-first typography violations | ✅ Done |
| Create detailed audit report | ✅ Done |

### Phase 2: Migration by Batch

| Batch | Directory | Files | Text Tags | Status |
|-------|-----------|-------|-----------|--------|
| 1 | `src/components/message/` | 8 | ~54 | ⬜ |
| 2 | `search/`, `bookmarks/`, `notifications/`, `direct/` | 7 | ~34 | ⬜ |
| 3 | `user/`, `space/`, `ui/` | 5 | ~12 | ⬜ |
| 4 | `modals/` | 5 | ~7 | ⬜ |
| 5 | Cleanup (dead imports, exports) | 2 | — | ⬜ |

Each batch gets its own commit. TypeScript check + lint after each.

### Phase 3: Cleanup

| Task | Status |
|------|--------|
| Remove dead Text import from YouTubeFacade.tsx | ⬜ |
| Remove TextHelpers from web exports (zero usage) | ⬜ |
| Update primitives/index.ts exports | ⬜ |
| Run full build and lint | ⬜ |
| Visual spot-check key pages | ⬜ |

---

## Edge Cases

### 1. className-only Text (~80 instances)
Text used as bare wrapper with only className, no semantic props. Default classes (`text-main text-base font-normal text-left`) are applied but overridden by CSS. Convert to `<span className="...">` — safe to drop defaults.

### 2. `as="a"` with link props (2 instances in Message.tsx)
```tsx
// Before
<Text as="a" href={url} target="_blank" referrerPolicy="no-referrer">
// After
<a href={url} target="_blank" referrerPolicy="no-referrer" className="text-link-primitive">
```

### 3. onClick handler (Message.tsx)
```tsx
// Before
<Text as="span" onClick={handler} className="message-status__retry">
// After
<span onClick={handler} className="message-status__retry">
```

### 4. style prop (~25 instances)
Pass `style` directly to HTML element. No change beyond removing the wrapper.

### 5. color prop
```tsx
// Before
<Text color="#ff0000">
// After
<span style={{ color: '#ff0000' }}>
```

---

## Success Criteria

- [ ] Zero `<Text` imports in production web code (dev/playground excluded)
- [ ] `--text-sm-responsive` CSS variable added and working
- [ ] Readable `size="xs"` / `size="sm"` content uses responsive sizing (semantic class, SCSS var, or inline pattern)
- [ ] Mobile bump happens at `xs` breakpoint (480px), not `sm` (640px)
- [ ] Build passes (`yarn build`)
- [ ] Lint passes (`yarn lint`)
- [ ] TypeScript passes (`npx tsc --noEmit`)
- [ ] No visual regressions on key pages (messages, profile, notifications, search, modals)
- [ ] Text primitive files untouched (still work for native + dev)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Visual regressions | Batch migrations with visual checks per batch |
| Default class removal causing style loss | Verify CSS specificity for className-only usages |
| Semantic class color mismatch | Fall back to SCSS variable or inline responsive pattern |
| `.text-label` responsive update affecting modals | Test modals thoroughly after infrastructure change |
| Large diff | 5 separate commits, one per batch |

---

*Created: 2026-01-14*
*Updated: 2026-02-10*
