---
type: task
title: Primitives System Optimization
status: planned
priority: high
created: 2026-01-14T00:00:00.000Z
updated: 2026-01-14T00:00:00.000Z
---

# Primitives System Optimization

> **Purpose:** Streamline the primitives architecture by consolidating redundant components and removing over-abstractions.

---

## Architecture Context Change

**Important:** The original primitives system was designed for a shared codebase between web and mobile. The architecture has since changed:

| Before | After |
|--------|-------|
| Single repo with shared components | Two separate repos (quorum-desktop, quorum-mobile) |
| Components shared between web & mobile | No fully shared components |
| Primitives needed for cross-platform abstraction | Primitives now optional for web-only code |

This changes the value proposition of some primitives significantly.

---

## Executive Summary

Current state: **23 primitives** with some redundancy and over-abstraction.
Target state: **~19 focused primitives** that provide real cross-platform value.

| Action | Components | Rationale |
|--------|------------|-----------|
| **Keep** | 14 | Core UI primitives with real abstraction value |
| **Consolidate** | 4 → 1 | Flex variants into single `Flex` primitive (full migration, no aliases) |
| **Remove** | 4 | FlexRow, FlexColumn, FlexCenter, FlexBetween, ResponsiveContainer folders |

---

## Analysis: Current Primitives

### ✅ Keep As-Is (High Value)

These primitives provide genuine cross-platform abstraction or semantic value:

| Primitive | Usage | Value Proposition |
|-----------|-------|-------------------|
| **Button** | Core | Event handling (`onClick` vs `onPress`), loading states, variants |
| **Input** | Core | Platform-specific keyboard handling, focus management |
| **TextArea** | Core | Auto-resize, multiline handling differs per platform |
| **Text** | Core | Typography system, semantic variants |
| **Modal** | Core | Portal/overlay handling is completely different per platform |
| **Select** | Form | Native pickers vs custom dropdowns |
| **Switch** | Form | Platform-native toggle implementations |
| **RadioGroup** | Form | Accessibility patterns differ per platform |
| **Tooltip** | UI | Hover vs long-press, positioning logic |
| **Icon** | UI | SVG vs vector icons (RN) |
| **FileUpload** | Form | File handling is fundamentally different |
| **Callout** | UI | Semantic alert/info boxes |
| **ColorSwatch** | Form | Color picker interaction |
| **ScrollContainer** | Layout | ScrollView (RN) vs overflow:auto (web) |

### ⚠️ Consolidate (Redundant)

**Problem:** Four separate Flex components that are just preset configurations.

| Current | Usage Count | What It Actually Does |
|---------|-------------|----------------------|
| FlexRow | ~144 | `flex flex-row` + props |
| FlexColumn | ~52 | `flex flex-col` + props |
| FlexCenter | ~18 | `flex items-center justify-center` |
| FlexBetween | ~8 | `FlexRow` with `justify="between"` |

**Total: ~222 usages** to migrate to unified `Flex` primitive.

### ❌ Remove (Low Value)

| Primitive | Usage | Issue |
|-----------|-------|-------|
| **FlexRow** | 290 | Replaced by `<Flex>` (direction="row" is default) |
| **FlexColumn** | 314 | Replaced by `<Flex direction="column">` |
| **FlexCenter** | 21 | Replaced by `<Flex justify="center" align="center">` |
| **FlexBetween** | 13 | Replaced by `<Flex justify="between">` |
| **ResponsiveContainer** | ~5 | Web-only, tied to NavMenu context, move to Layout |

### 🔧 Keep But Reconsider

| Primitive | Usage | Verdict |
|-----------|-------|---------|
| **Container** | 197 | Keep - useful for cross-platform padding/margin tokens |
| **Spacer** | 77 | Keep - RN needs it, also handles divider use cases with `border` prop |
| **ModalContainer** | Modal infra | Keep - internal modal infrastructure |
| **OverlayBackdrop** | Modal infra | Keep - backdrop handling differs per platform |
| **Portal** | Web only | Keep - web needs it for modal rendering |

---

## The Flex Primitive

### API Design

```tsx
interface FlexProps {
  direction?: 'row' | 'column';  // Default: 'row'
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';  // Default varies by direction
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  wrap?: boolean;
  flex?: number | string;  // flex-grow/shrink shorthand
  children: React.ReactNode;
  className?: string;  // Web
  style?: CSSProperties | ViewStyle;  // Both platforms
  testId?: string;
  [key: string]: any;  // HTML attributes passthrough (onClick, id, aria-*, etc.)
}
```

### Critical Implementation Requirements

| Requirement | Details | Why |
|-------------|---------|-----|
| **forwardRef support** | Web implementation must use `React.forwardRef<HTMLDivElement, FlexProps>` | FlexRow/FlexColumn both support refs - existing code may rely on this |
| **Direction-dependent align default** | `direction='row'` → `align='center'`; `direction='column'` → `align='stretch'` | Matches current FlexRow/FlexColumn defaults - prevents visual regressions |
| **HTML attributes passthrough** | Must spread `{...rest}` props | Current components support onClick, id, aria-*, data-* attributes |
| **Gap string fallback** | Support arbitrary string gap values (not just tokens) | Current type allows `gap?: ... \| string` for backwards compat |

### Migration Patterns

```tsx
// FlexRow → Flex (direction="row" is default)
<FlexRow gap="md" justify="between">     →  <Flex gap="md" justify="between">

// FlexColumn → Flex direction="column"
<FlexColumn gap="md">                    →  <Flex direction="column" gap="md">

// FlexCenter → Flex with center props
<FlexCenter>                             →  <Flex justify="center" align="center">

// FlexBetween → Flex with between
<FlexBetween>                            →  <Flex justify="between">
```

### Why No Aliases (Clean Approach)

Instead of keeping `FlexRow`/`FlexColumn` as aliases:

| Approach | Pros | Cons |
|----------|------|------|
| **Aliases** | Zero migration effort | Two ways to do same thing, ongoing confusion |
| **Full migration** | Single clean API, no technical debt | ~638 find-and-replace operations |

**Decision:** Full migration. This is an internal codebase, not a public library. The migration is mechanical (find-and-replace) and results in a cleaner, more maintainable system.

---

## Implementation Plan

### Phase 1: Create Flex Primitive - DONE

| Task | Status |
|------|--------|
| Create `Flex/` folder structure | ⬜ |
| Create `Flex.types.ts` with unified interface | ⬜ |
| Implement `Flex.web.tsx` | ⬜ |
| Implement `Flex.native.tsx` | ⬜ |
| Create `Flex/index.ts` barrel export | ⬜ |
| Add `Flex` to primitives index | ⬜ |
| Add `Flex` to playground | ⬜ |

**🛑 STOP: Phase 1 Checkpoint**
```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck  # Must pass
yarn build                                        # Must pass
```
- [ ] Open playground, verify Flex renders correctly with all prop combinations
- [ ] Test `direction="row"` and `direction="column"` both work

---

### Phase 2: Migrate All Flex Usages

Migration is split into 4 batches.

#### Batch 2.1: FlexBetween (13 usages) - Smallest, test the process

| Task | Status |
|------|--------|
| Find all `<FlexBetween` usages | ⬜ |
| Replace with `<Flex justify="between">` | ⬜ |
| Update imports in affected files | ⬜ |


```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```
- [ ] Visual check: Open a page that used FlexBetween (e.g., a modal header)

#### Batch 2.2: FlexCenter (21 usages) - DONE

| Task | Status |
|------|--------|
| Find all `<FlexCenter` usages | ⬜ |
| Replace with `<Flex justify="center" align="center">` | ⬜ |
| Update imports in affected files | ⬜ |


```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```
- [ ] Visual check: Open a page with centered content (e.g., loading states, empty states)

#### Batch 2.3: FlexRow (290 usages) - Largest batch DONE

| Task | Status |
|------|--------|
| Find all `<FlexRow` usages | ⬜ |
| Replace with `<Flex>` (direction="row" is default) | ⬜ |
| Update imports in affected files | ⬜ |


```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn build  # Full build check after largest migration
```
Visual checks (these pages have heavy FlexRow usage):
- [ ] Message list - messages should align correctly
- [ ] NavMenu - sidebar items should be horizontal
- [ ] Modal headers - buttons should be inline
- [ ] User profile - avatar and name should be side-by-side

#### Batch 2.4: FlexColumn (314 usages) DONE

| Task | Status |
|------|--------|
| Find all `<FlexColumn` usages | ⬜ |
| Replace with `<Flex direction="column">` | ⬜ |
| Update imports in affected files | ⬜ |

**🛑 STOP: Batch 2.4 Checkpoint**
```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn build
yarn lint
```
Visual checks (these pages have heavy FlexColumn usage):
- [ ] Settings modal - form fields should stack vertically
- [ ] Channel list - channels should stack vertically
- [ ] Message composer - input area layout
- [ ] Onboarding screens - vertical form layout

**Phase 2 Summary:**
| Batch | Component | Count | Status |
|-------|-----------|-------|--------|
| 2.1 | FlexBetween | ~8 | ⬜ |
| 2.2 | FlexCenter | ~18 | ⬜ |
| 2.3 | FlexRow | ~144 | ⬜ |
| 2.4 | FlexColumn | ~52 | ⬜ |
| **Total** | | **~222** | ⬜ |

### Phase 3: Delete Old Flex Primitives - DONE

**Pre-condition:** Phase 2 must be 100% complete with no remaining usages.

| Task | Status |
|------|--------|
| Verify no FlexRow/FlexColumn/FlexCenter/FlexBetween imports remain | ⬜ |
| Remove `FlexRow` export from primitives index | ⬜ |
| Remove `FlexColumn` export from primitives index | ⬜ |
| Remove `FlexCenter` export from primitives index | ⬜ |
| Remove `FlexBetween` export from primitives index | ⬜ |
| Remove `FlexRowProps` type export from primitives index | ⬜ |
| Remove `FlexColumnProps` type export from primitives index | ⬜ |
| Remove `FlexCenterProps` type export from primitives index | ⬜ |
| Remove `FlexBetweenProps` type export from primitives index | ⬜ |
| Delete `FlexRow/` folder | ⬜ |
| Delete `FlexColumn/` folder | ⬜ |
| Delete `FlexCenter/` folder | ⬜ |
| Delete `FlexBetween/` folder | ⬜ |

**🛑 STOP: Phase 3 Checkpoint**
```bash
# Verify no remaining imports
grep -r "FlexRow\|FlexColumn\|FlexCenter\|FlexBetween" src/ --include="*.tsx" | grep -v "Flex " | head -20

npx tsc --noEmit --jsx react-jsx --skipLibCheck  # Must pass - confirms all imports removed
yarn build
```
- [ ] Build passes with no import errors
- [ ] Quick visual sanity check on main app

---

### Phase 4: Remove ResponsiveContainer - DONE

**Known usages:**
- `src/components/Layout.tsx` - wraps main content area
- `mobile/test/primitives/PrimitivesTestScreen.tsx` - test screen import
- `mobile/test/primitives/PrimitivesMenuScreen.tsx` - menu description text

| Task | Status |
|------|--------|
| Audit all ResponsiveContainer usages | ⬜ |
| Inline ResponsiveContainer logic directly into Layout.tsx | ⬜ |
| Move `ResponsiveContainer.scss` styles to Layout styles (src\styles\_base.scss ?) | ⬜ |
| Update mobile test screens (remove import, update text) | ⬜ |
| Remove `ResponsiveContainer` export from primitives index | ⬜ |
| Remove `ResponsiveContainerProps` type export from primitives index | ⬜ |
| Delete `ResponsiveContainer/` folder | ⬜ |

**🛑 STOP: Phase 4 Checkpoint**
```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn build
```
Visual checks (ResponsiveContainer affects main layout):
- [ ] Main app layout looks correct (content area positioning)
- [ ] NavMenu shows/hides correctly at 1024px breakpoint
- [ ] Content doesn't overlap with NavMenu
- [ ] Resize browser window - layout should adapt smoothly

---

### Phase 5: Remove Typography Prop - DONE

**Problem Analysis**

The `typography` prop was added to the Text primitive for modal text consistency. However, it's just a wrapper around CSS classes:

```tsx
// What typography prop does internally (Text.web.tsx line 67):
const classes = clsx(
  `text-${typography}`,  // Just adds "text-body" CSS class!
  ...
);
```

**Current situation: Two parallel systems doing the same thing:**

| Approach | Usage Count | Example |
|----------|-------------|---------|
| CSS Classes | 70 usages | `<div className="text-body">` |
| Typography Prop | 13 usages | `<Text typography="body">` |

**Decision: Remove Typography Prop**

The typography prop adds indirection without value. Remove it and use CSS classes directly.

| Before | After |
|--------|-------|
| `<Text typography="body">` | `<p className="text-body">` or `<span className="text-body">` |
| `<Text typography="body" variant="subtle">` | `<p className="text-body text-subtle">` |
| `<Text typography="label-strong">` | `<span className="text-label-strong">` |
| `<Text typography="small">` | `<span className="text-small">` |

**Files to migrate (13 usages in 5 files):**

| File | Usages | Status |
|------|--------|--------|
| `KickUserModal.tsx` | 3 | ✅ |
| `MuteUserModal.tsx` | 6 | ✅ |
| `LeaveSpaceModal.tsx` | 1 | ✅ |
| `NewDirectMessageModal.tsx` | 2 | ✅ |
| `ConfirmationModal.tsx` | 1 | ✅ |
| **Total** | **13** | ✅ |

#### Step 5.1: Migrate KickUserModal.tsx

| Line | Before | After |
|------|--------|-------|
| 74 | `<Text typography="body" className="font-semibold truncate-user-name">` | `<span className="text-body font-semibold truncate-user-name">` |
| 77 | `<Text typography="small">` | `<span className="text-small">` |
| 85 | `<Text typography="body" variant="subtle">` | `<p className="text-body text-subtle">` |

| Task | Status |
|------|--------|
| Replace typography usages with CSS classes | ✅ |
| Remove Text import if no longer needed | ✅ |
| Visual check: Open Kick User modal | ⬜ |

#### Step 5.2: Migrate MuteUserModal.tsx

| Line | Before | After |
|------|--------|-------|
| 80 | `<Text typography="body" className="font-semibold truncate-user-name">` | `<span className="text-body font-semibold truncate-user-name">` |
| 83 | `<Text typography="small">` | `<span className="text-small">` |
| 95 | `<Text typography="body" className="whitespace-nowrap">` | `<span className="text-body whitespace-nowrap">` |
| 104 | `<Text typography="body">` | `<span className="text-body">` |
| 106 | `<Text typography="small" variant="subtle" className="mt-1">` | `<span className="text-small text-subtle mt-1">` |
| 113 | `<Text typography="body" variant="subtle">` | `<p className="text-body text-subtle">` |

| Task | Status |
|------|--------|
| Replace typography usages with CSS classes | ✅ |
| Remove Text import if no longer needed | ✅ |
| Visual check: Open Mute User modal | ⬜ |

#### Step 5.3: Migrate LeaveSpaceModal.tsx

| Line | Before | After |
|------|--------|-------|
| 39 | `<Text typography="body" variant="subtle">` | `<p className="text-body text-subtle">` |

| Task | Status |
|------|--------|
| Replace typography usage with CSS class | ✅ |
| Remove Text import if no longer needed | ✅ |
| Visual check: Open Leave Space modal | ⬜ |

#### Step 5.4: Migrate NewDirectMessageModal.tsx

| Line | Before | After |
|------|--------|-------|
| 106 | `<Text typography="body" variant="subtle">` | `<p className="text-body text-subtle">` |
| 156 | `<Text typography="label-strong">` | `<span className="text-label-strong">` |

| Task | Status |
|------|--------|
| Replace typography usages with CSS classes | ✅ |
| Remove Text import if no longer needed | ✅ |
| Visual check: Open New Direct Message modal | ⬜ |

#### Step 5.5: Migrate ConfirmationModal.tsx

| Line | Before | After |
|------|--------|-------|
| 55 | `<Text typography="body">` | `<p className="text-body">` |

| Task | Status |
|------|--------|
| Replace typography usage with CSS class | ✅ |
| Remove Text import if no longer needed | ✅ |
| Visual check: Open any confirmation modal | ⬜ |

**🛑 STOP: Step 5.5 Checkpoint**
```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn build
```
Visual checks:
- [ ] KickUserModal - text styling looks correct
- [ ] MuteUserModal - text styling looks correct
- [ ] LeaveSpaceModal - text styling looks correct
- [ ] NewDirectMessageModal - text styling looks correct
- [ ] ConfirmationModal - text styling looks correct

#### Step 5.6: Remove Typography Prop from Text Primitive

| Task | Status |
|------|--------|
| Remove `typography` prop from `Text/types.ts` | ✅ |
| Remove typography handling from `Text.web.tsx` (lines 61-92) | ✅ |
| Remove typography handling from `Text.native.tsx` | ✅ |
| Update playground examples to remove typography demos | ✅ |
| Run type check to confirm no remaining usages | ✅ |

**🛑 STOP: Step 5.6 Checkpoint**
```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck  # ✅ Passed (pre-existing errors only)
yarn build  # ✅ Passed
yarn lint  # ✅ Passed (pre-existing warnings/errors only)
```

**Phase 5 Summary:**
- ✅ 13 typography usages migrated to CSS classes
- ✅ Typography prop removed from Text primitive

---

### Phase 6: Documentation & Cleanup

Update all primitives documentation in `.agents/docs/features/primitives/`:

| Task | File | Status |
|------|------|--------|
| Update API reference with Flex, remove FlexRow/FlexColumn/FlexCenter/FlexBetween | `API-REFERENCE.md` | ⬜ |
| Remove typography prop from API reference | `API-REFERENCE.md` | ⬜ |
| Update quick reference table | `02-primitives-quick-reference.md` | ⬜ |
| Update "when to use primitives" decision tree (Text is optional for web) | `03-when-to-use-primitives.md` | ⬜ |
| Update migration guide examples | `04-web-to-native-migration.md` | ⬜ |
| Update introduction if it references old primitives | `01-introduction-and-concepts.md` | ⬜ |
| Update styling guide if needed | `05-primitive-styling-guide.md` | ⬜ |
| Update primitives index | `INDEX.md` | ⬜ |
| Update playground examples | `src/dev/primitives-playground/` | ⬜ |
| Remove old FlexRow/FlexColumn playground examples | `src/dev/primitives-playground/examples/` | ⬜ |
| Archive `text-primitive-analysis.md` guidance about helpers | - | ⬜ |
| Archive typography sections from `text-styling-consolidation-plan.md` | - | ⬜ |
| Verify build passes | - | ⬜ |
| Verify all tests pass | - | ⬜ |

**🛑 STOP: Phase 6 Final Checkpoint**
```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn build
yarn lint
```
Final verification:
- [ ] Playground shows new Flex primitive
- [ ] Old FlexRow/FlexColumn examples removed from playground
- [ ] Documentation is consistent and references only `Flex`
- [ ] Typography prop removed from all docs
- [ ] Full app walkthrough - check all major screens

---

## Final Primitives Structure

After optimization:

```
primitives/
├── Button/           ✅ Keep
├── Callout/          ✅ Keep
├── ColorSwatch/      ✅ Keep
├── Container/        ✅ Keep
├── FileUpload/       ✅ Keep
├── Flex/             🆕 New (replaces FlexRow, FlexColumn, FlexCenter, FlexBetween)
├── Icon/             ✅ Keep
├── Input/            ✅ Keep
├── Modal/            ✅ Keep
├── ModalContainer/   ✅ Keep (internal)
├── OverlayBackdrop/  ✅ Keep (internal)
├── Portal/           ✅ Keep (web only, internal)
├── RadioGroup/       ✅ Keep
├── ScrollContainer/  ✅ Keep
├── Select/           ✅ Keep
├── Spacer/           ✅ Keep (also handles divider use cases)
├── Switch/           ✅ Keep
├── Text/             ✅ Keep
├── TextArea/         ✅ Keep
├── Tooltip/          ✅ Keep
├── theme/            ✅ Keep
└── index.ts
```

**Summary:**
- **Removed:** FlexRow, FlexColumn, FlexCenter, FlexBetween, ResponsiveContainer (5 folders)
- **Added:** Flex (1 folder)
- **Net change:** 23 → 19 primitive folders

---

## Divider Decision

**Per frontend expert analysis:** No dedicated Divider primitive needed.

Spacer already handles divider use cases with existing props:
```tsx
// Horizontal divider
<Spacer size="none" border borderColor="var(--color-border-default)" />

// Divider with spacing
<Spacer spaceBefore="md" spaceAfter="md" border />
```

If clearer semantics are desired later, a simple alias can be added without a new primitive folder.

---

## Text Primitive Decision

### Context

The Text primitive was designed for cross-platform consistency. With separate repos, its value on web is reduced.

### Decision: Keep but Make Optional (Web)

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Keep Text primitive** | Yes | ~1100 existing usages work fine, no need to remove |
| **Refactor existing usages** | No | High effort, low value - existing code works |
| **New web code** | Use plain HTML + CSS classes | Simpler: `<p className="text-body">` vs `<Text typography="body">` |
| **Text helpers** | Deprecate for web | `Title`, `Paragraph`, `Label`, `Caption` were for mobile's View wrapper problem |

### Going Forward (Web)

**For new web components, prefer:**
```tsx
// Simple and direct
<p className="text-body">Content</p>
<h1 className="text-title">Title</h1>
<span className="text-subtle text-sm">Helper text</span>
```

**Text primitive is still fine for:**
- Existing code (don't refactor)
- When you want theme color variants (`variant="subtle"`)
- Developer preference

### Why Not Refactor Existing Code

| Factor | Assessment |
|--------|------------|
| **Effort** | ~1100 usages to change |
| **Risk** | Potential visual regressions |
| **Value** | None - existing code works |
| **Recommendation** | Leave as-is |

---

## Risk Assessment & Mitigations

### High Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Align default mismatch** | Visual regressions if `<Flex direction="column">` defaults to `align='center'` instead of `align='stretch'` | Implement direction-dependent align default in Flex component |
| **Missing forwardRef** | Build errors or runtime failures if any code passes refs to Flex components | Ensure Flex.web.tsx uses `React.forwardRef` |
| **Import path updates** | Build failures from stale imports | Run TypeScript type-check (`npx tsc --noEmit`) after each migration batch |

### Medium Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| **ResponsiveContainer SCSS** | Layout breaks if styles not properly migrated | Keep ResponsiveContainer.scss content, just move to Layout styles |
| **~222 manual migrations** | Tedious, error-prone | Use IDE multi-cursor/find-replace; migrate by component type (FlexRow, FlexColumn, etc.) in batches |
| **Mobile test screen references** | Test app won't build | Update test screens in Phase 4 |

### Low Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| **FlexCenter unused props** | None - `direction` and `minHeight` props have 0 usages | Safe to ignore - no migration needed for these props |
| **Type export cleanup** | Cleaner API | Remove old type exports in Phase 3 |

### Verification Checklist (Run After Each Phase)

```bash
# 1. TypeScript type-check
npx tsc --noEmit --jsx react-jsx --skipLibCheck

# 2. Build check
yarn build

# 3. Lint check
yarn lint

# 4. Visual regression (manual)
# - Check a few pages with heavy Flex usage
# - Verify layout looks identical before/after
```

---

## Success Criteria

### Required

- [ ] Single `Flex` primitive created with `direction` prop
- [ ] Flex supports `forwardRef` on web
- [ ] Flex has direction-dependent `align` defaults (row→center, column→stretch)
- [ ] All ~222 Flex usages migrated (no aliases)
- [ ] All old Flex type exports removed (`FlexRowProps`, etc.)
- [ ] `FlexRow/`, `FlexColumn/`, `FlexCenter/`, `FlexBetween/` folders deleted
- [ ] `ResponsiveContainer` logic inlined into Layout
- [ ] `ResponsiveContainer/` folder deleted
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `yarn build` completes successfully
- [ ] `yarn lint` passes
- [ ] No visual regressions (spot-check key pages)

### Documentation

- [ ] API-REFERENCE.md updated with Flex
- [ ] All primitives docs updated to remove old Flex references
- [ ] Playground updated with Flex examples
- [ ] Old playground examples (FlexRow, FlexColumn) removed or renamed

---

## Migration Script Approach

The migration can be partially automated:

```bash
# FlexRow → Flex (simplest - just rename)
# Note: FlexRow with no direction is equivalent to Flex with default direction="row"

# FlexColumn → Flex direction="column"
# Need to add direction="column" prop

# FlexCenter → Flex justify="center" align="center"
# Need to add both props

# FlexBetween → Flex justify="between"
# Need to add justify="between" prop
```

Most migrations are mechanical find-and-replace operations that can be done with IDE refactoring tools or scripts.

---

## Related Documents

- [Primitives Migration to quorum-shared](./primitives-migration-to-quorum-shared.md) - Cross-platform migration plan
- [Gap Analysis Report](../reports/primitives-gap-analysis-quorum-shared_2026-01-14.md) - Desktop vs mobile comparison
- [Component Architecture](../docs/quorum-shared-architecture.md) - Overall architecture

---

*Last updated: 2026-01-14T18:00:00Z - Phase 5 complete: Typography prop removed from Text primitive*
