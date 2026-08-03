---
type: task
title: "Remove ResponsiveContainer Primitive and Inline Styles"
status: done
complexity: low
ai_generated: true
reviewed_by: feature-analyzer, security-analyst
created: 2025-01-14
updated: 2025-01-14
related_tasks:
  - primitives-optimization.md
---

# Remove ResponsiveContainer Primitive and Inline Styles

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

**Files**:
- `src/components/Layout.tsx:4,200-221`
- `src/components/primitives/ResponsiveContainer/` (to be deleted)
- `src/components/primitives/index.ts:7,38`
- `src/styles/_base.scss` (add layout styles)
- `mobile/test/primitives/PrimitivesTestScreen.tsx:8`
- `mobile/test/primitives/PrimitivesMenuScreen.tsx`

## What & Why

**Current state**: The app uses `ResponsiveContainer`, a misplaced "primitive" that:
- Is only used in one place (Layout.tsx) - not a reusable primitive
- Wraps simple CSS positioning logic in an unnecessary React component
- Native implementation does almost nothing (just adds padding/background)

**Desired state**:
- Move the CSS styles to `_base.scss` where foundational layout belongs
- Replace the React component with a simple `<div className="main-content">`
- Remove ~100 lines of unnecessary abstraction

**Value**: Simplifies codebase by removing a component that shouldn't be a "primitive". The positioning logic stays the same (hardcoded NavMenu widths are necessary since NavMenu uses `position: fixed`), we're just removing the React wrapper.

## Context

- **Why hardcoded values**: NavMenu uses `position: fixed`, which removes it from document flow. We must use hardcoded offsets (`$nav-header-width`, `$nav-header-width-mobile`) to position content next to it. This is unavoidable without a larger refactor of NavMenu positioning.
- **Why `_base.scss`**: It already contains foundational layout styles like `--sidebar-left-width`, scrollbar styles, and utility classes. App layout belongs here, not in a separate file.

## Implementation

### Phase 1: Add Layout Styles to _base.scss

- [ ] **Add main-content styles** (`src/styles/_base.scss`)
  - Done when: Styles added at end of file
  - Verify: `yarn build` succeeds
  - Implementation (copy from ResponsiveContainer.scss):
    ```scss
    /* === APP LAYOUT === */
    /* Main content area - offset from fixed NavMenu */
    .main-content {
      position: fixed;
      width: calc(100vw - $nav-header-width);
      height: calc(100vh - 14px);
      left: $nav-header-width;
      top: 14px;
      border-top-left-radius: 0.75rem;
      background-color: var(--color-bg-sidebar);

      .electron & {
        top: 38px;
        height: calc(100vh - 38px);
      }

      @media (max-width: 480px) {
        width: calc(100vw - $nav-header-width-mobile);
        left: $nav-header-width-mobile;
      }

      &.nav-hidden {
        @media (max-width: 1023px) {
          width: 100vw;
          left: 0;
        }
      }
    }
    ```

### Phase 2: Update Layout.tsx

- [ ] **Update Layout component** (`src/components/Layout.tsx`)
  - Done when: Uses CSS class instead of ResponsiveContainer
  - Verify: Visual appearance identical
  - Changes:
    1. Remove `ResponsiveContainer` from imports (line 4)
    2. Import `useResponsiveLayoutContext` from context
    3. Get `navMenuOpen` state from context
    4. Replace `<ResponsiveContainer>` with `<div className={`main-content${!navMenuOpen ? ' nav-hidden' : ''}`}>`
    5. Replace `</ResponsiveContainer>` with `</div>`

### Phase 3: Cleanup

- [ ] **Delete ResponsiveContainer folder** (`src/components/primitives/ResponsiveContainer/`)
  - Files: `ResponsiveContainer.web.tsx`, `ResponsiveContainer.native.tsx`, `ResponsiveContainer.scss`, `types.ts`, `index.ts`

- [ ] **Update primitives index** (`src/components/primitives/index.ts`)
  - Remove: `export { ResponsiveContainer } from './ResponsiveContainer';`
  - Remove: `export type { ResponsiveContainerProps } from './ResponsiveContainer';`

- [ ] **Update mobile test files**
  - `mobile/test/primitives/PrimitivesTestScreen.tsx`: Remove unused import (line 8)
  - `mobile/test/primitives/PrimitivesMenuScreen.tsx`: Remove any references

- [ ] **Update audit files** (if ResponsiveContainer is listed)

## Verification

✅ **Visual appearance unchanged** at all breakpoints (phone, tablet, desktop)
✅ **NavMenu toggle works** on tablet (<1024px)
✅ **Electron titlebar** offset correct (38px)
✅ **Build succeeds**: `yarn build`
✅ **No console errors**

## Definition of Done

- [ ] Layout styles in `_base.scss`
- [ ] Layout.tsx uses `<div className="main-content">`
- [ ] ResponsiveContainer folder deleted
- [ ] Exports removed from primitives index
- [ ] Mobile test imports cleaned up
- [ ] Build passes, no visual regressions

## Notes

This is a cleanup task, not a CSS architecture change. The positioning logic stays identical - we're just removing an unnecessary React abstraction. The hardcoded NavMenu width values are necessary because NavMenu uses `position: fixed`.

A future task could explore refactoring NavMenu to not use fixed positioning, which would enable true CSS Grid layout. But that's a larger change with more risk.
