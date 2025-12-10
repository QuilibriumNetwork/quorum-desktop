# Tooltip Shared Mode for NavMenu Flickering Fix

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Pending
**Complexity**: High
**Created**: 2025-12-10
**Related Bug**: [Tooltip Flickering at Top-Left on Fast Mouse Movement](../bugs/tooltip-flickering-top-left-on-fast-mouse-movement.md)

**Files**:
- `src/components/primitives/Tooltip/Tooltip.web.tsx` (reference)
- `src/components/primitives/Tooltip/types.ts` (modify)
- `src/components/primitives/Tooltip/index.ts` (modify)
- `src/components/primitives/index.ts` (modify)
- `src/components/navbar/SpaceIcon.tsx` (modify)
- `src/components/navbar/NavMenu.tsx` (modify)
- New: `src/components/primitives/Tooltip/TooltipAnchor.web.tsx`
- New: `src/components/primitives/Tooltip/TooltipAnchor.native.tsx`
- New: `src/components/primitives/Tooltip/TooltipRenderer.web.tsx`
- New: `src/components/primitives/Tooltip/TooltipRenderer.native.tsx`

## What & Why

**Problem**: Tooltip flickering at (0,0) when rapidly moving mouse over SpaceIcons in NavMenu. This is a documented react-tooltip v5 limitation ([GitHub Issue #1010](https://github.com/ReactTooltip/react-tooltip/issues/1010)) where multiple tooltip instances cause position/visibility race conditions.

**Solution**: Extend the Tooltip primitive with "shared mode" - ONE ReactTooltip instance serves MULTIPLE anchors via data attributes, each with individual positioning. This eliminates the hide/show cycle that causes flickering.

**Value**: Improved UX in the navigation menu - no more distracting flashes when hovering space icons.

## Context

- **Existing pattern**: `Tooltip.web.tsx` uses `cloneElement` to inject anchor IDs
- **Library behavior**: react-tooltip supports `data-tooltip-*` attributes for shared instances
- **Constraints**: Must maintain backward compatibility with existing Tooltip usages (30+ files)
- **Cross-platform**: Native doesn't need tooltips for nav icons (see Design Decision below)

## Design Decision: No Nav Tooltips on Native

**Decision**: Native implementations (`TooltipAnchor.native.tsx`, `TooltipRenderer.native.tsx`) are intentional no-ops, not fallbacks.

**Rationale**:
- **Discord pattern**: Discord doesn't show tooltips for server icons on mobile - you tap to enter, the name is visible inside
- **No hover on mobile**: Touch devices have no hover state, tooltips would require tap-and-hold which is poor UX for navigation
- **Already disabled**: SpaceIcon already has `showOnTouch={false}` - tooltips are disabled on touch/mobile web too
- **Simplifies implementation**: No need for fallback tooltip logic on native

**Implementation**:
- `TooltipAnchor.native.tsx` → return `{children}` (pass-through)
- `TooltipRenderer.native.tsx` → return `null` (renders nothing)

## Prerequisites

- [x] Review .agents documentation for context
- [x] Check existing Tooltip primitive implementation
- [x] Feature analyzed by feature-analyzer agent
- [ ] Branch created from `develop`

## Implementation

### Phase 1: Types & Exports

- [ ] **Add types to `types.ts`** (`src/components/primitives/Tooltip/types.ts`)
  ```typescript
  export type TooltipPlacement =
    | 'top' | 'top-start' | 'top-end'
    | 'right' | 'right-start' | 'right-end'
    | 'bottom' | 'bottom-start' | 'bottom-end'
    | 'left' | 'left-start' | 'left-end';

  export interface TooltipAnchorProps {
    tooltipId: string;
    content: string;
    place?: TooltipPlacement;
    children: ReactNode;
    disabled?: boolean;
  }

  export interface TooltipRendererProps {
    id: string;
    place?: TooltipPlacement;
    noArrow?: boolean;
    className?: string;
    highlighted?: boolean;
    showOnTouch?: boolean;
  }
  ```
  - Done when: Types compile without errors
  - Reference: Existing `TooltipProps` in same file

### Phase 2: TooltipAnchor Component

- [ ] **Create `TooltipAnchor.web.tsx`** (`src/components/primitives/Tooltip/TooltipAnchor.web.tsx`)
  - Clone child element and inject data attributes:
    - `data-tooltip-id` - which tooltip to show
    - `data-tooltip-content` - the content
    - `data-tooltip-place` - positioning (optional)
  - Validate single React element child (warn if invalid)
  - Support `disabled` prop to skip attributes
  - Done when: Data attributes appear on rendered element
  - Reference: `Tooltip.web.tsx` cloneElement pattern

- [ ] **Create `TooltipAnchor.native.tsx`** (`src/components/primitives/Tooltip/TooltipAnchor.native.tsx`)
  - Just return `{children}` (intentional no-op, not a fallback)
  - Native nav icons don't need tooltips (Discord pattern)
  - Done when: Compiles and returns children unchanged

### Phase 3: TooltipRenderer Component

- [ ] **Create `TooltipRenderer.web.tsx`** (`src/components/primitives/Tooltip/TooltipRenderer.web.tsx`)
  - Render single `ReactTooltip` instance
  - Use CSS attribute selector: `anchorSelect="[data-tooltip-id='${id}']"`
  - Set explicit `zIndex: 9999` (higher than DragOverlay at 999)
  - Support: `highlighted`, `place`, `noArrow`, `showOnTouch` props
  - Done when: Tooltip shows for elements with matching data-tooltip-id
  - Reference: `ReactTooltip.tsx` wrapper component

- [ ] **Create `TooltipRenderer.native.tsx`** (`src/components/primitives/Tooltip/TooltipRenderer.native.tsx`)
  - Return `null` (intentional no-op, not a fallback)
  - Native nav icons don't need tooltips (Discord pattern)
  - Done when: Compiles and returns null

### Phase 4: Exports

- [ ] **Update `index.ts`** (`src/components/primitives/Tooltip/index.ts`)
  ```typescript
  // @ts-ignore - Platform-specific files
  export { TooltipAnchor } from './TooltipAnchor';
  // @ts-ignore - Platform-specific files
  export { TooltipRenderer } from './TooltipRenderer';
  export type { TooltipAnchorProps, TooltipRendererProps, TooltipPlacement } from './types';
  ```
  - Done when: Imports work from `../primitives`

- [ ] **Update barrel export** (`src/components/primitives/index.ts`)
  - Add `TooltipAnchor`, `TooltipRenderer` to exports
  - Done when: Can import from `../primitives`

### Phase 5: Migration (requires Phases 1-4)

- [ ] **Migrate SpaceIcon** (`src/components/navbar/SpaceIcon.tsx`)
  - Change import: `Tooltip` → `TooltipAnchor`
  - Remove `iconId` generation (useMemo with random suffix - no longer needed)
  - Remove anchor ID spreading on inner elements (lines 88, 96)
  - Replace `<Tooltip>` wrapper with:
    ```tsx
    <TooltipAnchor
      tooltipId="nav-space-tooltips"
      content={props.spaceName}
      place="right"
    >
      {iconElement}
    </TooltipAnchor>
    ```
  - Keep `noTooltip` and `isDragging` conditional logic
  - Done when: SpaceIcon renders with data-tooltip-* attributes
  - Verify: Inspect DOM, attributes present on icon wrapper

- [ ] **Add TooltipRenderer to NavMenu** (`src/components/navbar/NavMenu.tsx`)
  - Import `TooltipRenderer` from primitives
  - Add at end of NavMenuContent (before closing `</header>`):
    ```tsx
    <TooltipRenderer
      id="nav-space-tooltips"
      place="right"
      highlighted
      showOnTouch={false}
    />
    ```
  - Done when: Single tooltip instance in DOM
  - Verify: Only one ReactTooltip for all SpaceIcons

## Verification

✅ **Flickering resolved**
   - Test: Rapidly move mouse up/down over SpaceIcons
   - Expected: No (0,0) flash, smooth tooltip repositioning

✅ **Correct positioning**
   - Test: Hover each SpaceIcon
   - Expected: Tooltip appears to the right of each icon

✅ **Correct content**
   - Test: Hover different SpaceIcons
   - Expected: Tooltip shows correct space name for each

✅ **Highlighted styling**
   - Test: Check tooltip appearance
   - Expected: Has highlighted border style

✅ **Drag behavior preserved**
   - Test: Start dragging a SpaceIcon
   - Expected: Tooltips hidden during drag

✅ **Touch devices**
   - Test: On touch device, tap SpaceIcons
   - Expected: No tooltips (showOnTouch={false})

✅ **Existing tooltips unaffected**
   - Test: Check other tooltips in app (buttons, actions, etc.)
   - Expected: Still work with individual Tooltip instances

✅ **TypeScript compiles**
   - Run: `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"`

## Feature Analyzer Findings

**Rating**: Good - Not over-engineered

**Key recommendations incorporated**:
1. Add cloneElement validation for single React element child
2. Set explicit z-index (9999) on TooltipRenderer
3. Native stubs return children/null appropriately
4. Match touch behavior with `showOnTouch={false}`

**Why this is appropriate**:
- Solves documented react-tooltip v5 limitation
- 4 simpler approaches were attempted and failed (see bug report)
- Shared tooltip with data attributes is react-tooltip's recommended solution
- Minimal API surface (2 focused components)
- Backward compatible

## Definition of Done

- [ ] All phases complete
- [ ] TypeScript compiles without errors
- [ ] Flickering test passes (rapid mouse movement)
- [ ] All verification tests pass
- [ ] No console errors
- [ ] Existing tooltip functionality preserved

---

_Created: 2025-12-10_
_Updated: 2025-12-10 - Added design decision for native no-op (Discord pattern)_
