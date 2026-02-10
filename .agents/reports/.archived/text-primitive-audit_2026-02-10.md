---
type: report
title: Text Primitive Audit — Pre-Migration Analysis
ai_generated: true
reviewed_by: null
created: 2026-02-10
updated: 2026-02-10
related_tasks: [remove-text-primitive-web.md - completed] 
---

# Text Primitive Audit — Pre-Migration Analysis

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary

Comprehensive audit of the Text primitive usage in quorum-desktop, conducted prior to migrating production code from `<Text>` components to plain HTML + CSS classes.

| Metric | Count |
|--------|-------|
| Total `<Text` JSX tags | ~279 |
| Production files importing Text | 27 |
| Dev files importing Text | 11 (out of scope) |
| Dead imports | 3 |
| TextHelpers usage (Paragraph, Label, etc.) | 0 |
| Mobile-first `text-xs` violations | ~50+ |
| Mobile-first `text-sm` violations | ~40+ |

---

## Scope & Methodology

- **Scope**: All `.tsx` files in `src/` importing or using `<Text` from primitives
- **Methodology**: Grep/glob searches for imports, JSX tags, prop patterns; manual review of edge cases
- **Tools**: ripgrep for pattern matching, file reads for context analysis
- **Date**: 2026-02-10

---

## Text Primitive Implementation

The Text component (`src/components/primitives/Text/Text.web.tsx`) is a polymorphic React component that:

1. Maps `variant` props to semantic CSS color classes (`text-main`, `text-strong`, etc.)
2. Maps `size` props to Tailwind size classes (`text-xs`, `text-sm`, etc.)
3. Maps `weight`/`align` props to Tailwind utility classes
4. Supports `as` prop for rendering as different HTML elements
5. Auto-detects link variant when `as="a"`
6. Passes through `style`, `onClick`, `href`, `target`, `rel`, `referrerPolicy`

**Key observation**: On web, this is purely a props-to-className adapter. No behavior, accessibility, or state management beyond what the underlying HTML element provides.

**Defaults applied by Text**: `variant="default"` → `text-main`, `size="base"` → `text-base`, `weight="normal"` → `font-normal`, `align="left"` → `text-left`

---

## File-by-File Usage Counts

### Production Code (27 files, ~123 Text tags)

#### `src/components/message/` — 8 files, ~54 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `Message.tsx` | ~50 | Heavy className-only usage, `as="a"` links with href/target/referrerPolicy, `as="span"` with onClick, `style` prop, `size="xs"` on metadata |
| `MessagePreview.tsx` | 6 | Mixed: already has 1 span alongside Text |
| `MessageActionsDrawer.tsx` | 8 | Standard variant/size patterns |
| `InviteLink.tsx` | 4 | Has partial responsive `lg:text-sm` already |
| `MessageEditTextarea.tsx` | 1 | Simple variant/size |
| `MessageComposer.tsx` | 1 | Mixed: already has 4 existing spans |
| `ReactionsList.tsx` | 2 | Mixed: already has 3 existing spans |
| `DateSeparator.tsx` | 1 | Simple |

#### `src/components/search/` — 2 files, ~10 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `SearchResults.tsx` | 5 | Empty states, loading messages |
| `SearchResultItem.tsx` | 5 | Standard variant/size |

#### `src/components/bookmarks/` — 2 files, ~11 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `BookmarksPanel.tsx` | 5 | Empty states, filter controls |
| `BookmarkItem.tsx` | 6 | Standard variant/size with className |

#### `src/components/notifications/` — 2 files, ~6 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `NotificationPanel.tsx` | 3 | Standard |
| `NotificationItem.tsx` | 3 | Mixed: already has 2 spans |

#### `src/components/direct/` — 1 file, ~4 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `EmptyDirectMessage.tsx` | 4 | Standard variant/size |

#### `src/components/user/` — 1 file, ~7 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `UserProfile.tsx` | 7 | `size="xs"` violations, multiple typography issues |

#### `src/components/space/` — 2 files, ~4 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `ChannelList.tsx` | 1 | Simple |
| `RolePreview.tsx` | 3 | Has `style={{ marginTop: 2 }}` inline |

#### `src/components/ui/` — 2 files, ~2 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `ClickToCopyContent.tsx` | 1 | Dynamic className, `style` prop with conditional font-size |
| `MobileDrawer.tsx` | 1 | Simple |

#### `src/components/modals/` — 5 files, ~7 tags

| File | Tags | Key Patterns |
|------|------|-------------|
| `EditHistoryModal.tsx` | 3 | `size="xs"` on timestamps |
| `FolderEditorModal.tsx` | 1 | `size="xs"` on help text |
| `CreateSpaceModal.tsx` | 1 | Mixed: already has 1 span |
| `ReactionsModal.tsx` | 2 | Mixed: already has 1 span |
| `UserSettingsModal/General.tsx` | 1 | Mixed: already has 1 span |

### Dev Code (11 files, ~156 tags — OUT OF SCOPE)

| Directory | Files | Tags |
|-----------|-------|------|
| `src/dev/components-audit/` | 1 | ~40 |
| `src/dev/docs/` | 5 | ~50 |
| `src/dev/db-inspector/` | 1 | ~20 |
| `src/dev/DevMainPage.tsx` | 1 | ~15 |
| `src/dev/primitives-playground/` | 3 | ~31 |

---

## Prop Usage Distribution

### Variants

| Variant | Approx. Count | Notes |
|---------|--------------|-------|
| `variant="subtle"` | ~120 | Most common |
| `variant="strong"` | ~80 | |
| `variant="default"` / no variant | ~60 | Often implicit (default) |
| `variant="muted"` | ~40 | |
| No variant, className only | ~80 | Bypasses semantic system |
| `variant="error"` / `variant="danger"` | ~15 | |
| `variant="warning"` | ~10 | |
| `variant="success"` | ~8 | |

### Sizes

| Size | Approx. Count | Migration Note |
|------|--------------|----------------|
| `size="sm"` | ~100 | → `text-base sm:text-sm` |
| `size="xs"` | ~60 | → `text-sm sm:text-xs` |
| `size="base"` / no size | ~50 | Omit (browser default) |
| `size="lg"` | ~45 | → `text-lg` |
| `size="xl"` | ~20 | → `text-xl` |
| `size="2xl"` | ~15 | → `text-2xl` |
| `size="3xl"` | ~8 | → `text-3xl` |

### Weights

| Weight | Approx. Count |
|--------|--------------|
| No weight / `weight="normal"` | ~400+ |
| `weight="bold"` | ~35 |
| `weight="medium"` | ~30 |
| `weight="semibold"` | ~25 |

---

## Edge Cases Catalog

### 1. className-only Text (~80 instances)

Text used as a bare `<span>` wrapper with only `className`, no semantic props. The component applies defaults (`text-main text-base font-normal text-left`) which are overridden by CSS specificity.

**Impact**: Safe to convert to `<span className="...">` dropping the defaults.

**Files with heaviest className-only usage**: `Message.tsx` (~30), `ComponentAuditViewer.tsx` (~15, dev), `FilterableList.tsx` (~8, dev)

### 2. `as` prop usage (~40 instances)

| Element | Count | Files |
|---------|-------|-------|
| `as="h1"` | ~15 | Dev pages (DevMainPage, Docs, Tasks, Reports) |
| `as="p"` | ~10 | Body paragraphs |
| `as="h2"` | ~5 | Section headers |
| `as="h3"` | ~3 | Subsection headers |
| `as="span"` | ~5 | Inline text, mentions in Message.tsx |
| `as="a"` | ~2 | External links in Message.tsx |

### 3. `as="a"` with link props (2 instances)

Both in `Message.tsx`. Uses `href`, `target`, `referrerPolicy` props.
```tsx
<Text as="a" href={tokenData.url} target="_blank" referrerPolicy="no-referrer">
```

### 4. onClick handler (~18 instances)

Mostly in `Message.tsx` (retry buttons) and `ComponentAuditViewer.tsx` (table sorting, dev file).

### 5. style prop (~25 instances)

Used for inline positioning and conditional styling. Notable:
- `Message.tsx`: `style={{ fontSize: 'inherit', wordBreak: 'break-all' }}`
- `ClickToCopyContent.tsx`: Conditional `fontSize` and `userSelect`
- `RolePreview.tsx`: `style={{ marginTop: 2 }}`

### 6. color prop

Used sparingly for inline color overrides. Convert to `style={{ color: '...' }}`.

### 7. Props NOT used anywhere

| Prop | Status |
|------|--------|
| `testId` | Zero usage |
| `numberOfLines` | Zero usage (native-only prop) |
| `truncate` | Zero usage |
| Spread props | Zero usage |
| Forwarded refs | Zero usage |

---

## Mobile-First Typography Violations

### Bare `text-xs` on Readable Content (~50+ violations)

These are instances where bare `text-xs` is used on readable content without the responsive mobile bump (`text-sm sm:text-xs`).

#### High Priority (user-facing, core UI)

| File | Line(s) | Context |
|------|---------|---------|
| `UserProfile.tsx` | 118, 172, 180 | User address, "Removing..." status, role display names |
| `DirectMessageContact.tsx` | 125, 156 | Timestamps, address suffixes |
| `DirectMessageContactsList.tsx` | 368 | Help text |
| `Channel.tsx` | 1042, 1062, 1220, 1238 | Search results, role group headers, "No users found" |

#### Medium Priority (modals, settings)

| File | Line(s) | Context |
|------|---------|---------|
| `InviteLink.tsx` | 101 | Invite description (has `lg:text-sm` but not mobile bump) |
| `Privacy.tsx` | 202, 316 | Error messages, help text |
| `Invites.tsx` | 192 | Invite creator info |

#### Exceptions (acceptable bare `text-xs`)

| File | Line(s) | Context | Why Exception |
|------|---------|---------|---------------|
| `Help.tsx` | 40-60 | `<kbd>` keyboard shortcuts | Keyboard hints |
| `YouTubeFacade.tsx` | 152 | Duration badge | Decorative badge |
| `Account.tsx` | 210 | Status badge | Decorative badge |

### Bare `text-sm` on Important Readable Content (~40+ violations)

| File | Line(s) | Context |
|------|---------|---------|
| `DirectMessageContact.tsx` | 138 | Message preview text |
| `EmptyDirectMessage.tsx` | 54, 56, 79, 81 | Clickable links |
| `UserProfile.tsx` | 153, 177 | Section headers, remove role button |
| `Channel.tsx` | 924 | Channel description |
| `MessageMarkdownRenderer.tsx` | 843, 854 | Code blocks |
| `ChannelEditorModal.tsx` | 162 | Error messages |
| `AddSpaceModal.tsx` | 145, 159, 174, 180, 215, 290 | Inputs, links, separator |
| `Privacy.tsx` | 162, 198, 241, 265, 282 | Multiple instances |

### Text Primitive `size="xs"` in Production (will need mobile bump)

| File | Line(s) | Context |
|------|---------|---------|
| `Message.tsx` | 790, 803 | `<Text variant="muted" size="xs">` — message metadata |
| `EditHistoryModal.tsx` | 93 | `<Text variant="subtle" size="xs">` — timestamps |
| `FolderEditorModal.tsx` | 137 | `<Text variant="subtle" size="xs">` — help text |

---

## Dead Imports

| File | Import | Action |
|------|--------|--------|
| `src/components/ui/YouTubeFacade.tsx` | `import { Icon, Text } from '../primitives'` | Remove `Text` from import |
| `src/dev/DevNavMenu.tsx` | `import { Container, Text, Flex, Icon }` | Dev file — skip |
| `src/dev/primitives-playground/examples/MentionPills.tsx` | `import { Text }` | Dev file — skip |

---

## Files with Mixed Usage (Text + plain HTML)

These files already use both `<Text>` and plain HTML elements, confirming the codebase is inconsistent:

| File | Text Tags | HTML Tags | Elements Used |
|------|-----------|-----------|---------------|
| `MessageComposer.tsx` | 1 | 4 | spans |
| `MessagePreview.tsx` | 6 | 1 | span |
| `ReactionsList.tsx` | 2 | 3 | spans |
| `NotificationItem.tsx` | 3 | 2 | spans |
| `CreateSpaceModal.tsx` | 1 | 1 | span |
| `ReactionsModal.tsx` | 2 | 1 | span |
| `UserSettingsModal/General.tsx` | 1 | 1 | span |

---

## TextHelpers Analysis

The following helper components are exported from `src/components/primitives/Text/TextHelpers.tsx`:

| Component | Purpose | Usage Count |
|-----------|---------|-------------|
| `Paragraph` | Text with `marginBottom={8}` | 0 |
| `Label` | Text with `size="sm" variant="strong" marginBottom={8}` | 0 |
| `Caption` | Text with `size="sm" variant="subtle" marginTop={8}` | 0 |
| `Title` | Text with size/weight mapping and marginBottom | 0 |
| `InlineText` | Passthrough Text wrapper | 0 |

**Recommendation**: Remove from web exports. These were designed for React Native spacing convenience and are unused on web.

---

## Recommendations

1. **Proceed with migration** — Production code uses Text as a no-value abstraction
2. **Apply mobile-first responsive typography** during migration for `size="xs"` and `size="sm"`
3. **Skip dev files** — Internal tools don't need the same polish
4. **Remove TextHelpers from web exports** — Zero usage
5. **Migrate in 5 batches** with commits after each for reviewability
6. **Note for future**: The mobile-first typography violations in non-Text code (bare `text-xs`/`text-sm` already in className) should be addressed in a follow-up task

---

*Report Date: 2026-02-10*
*Report Type: Audit*
