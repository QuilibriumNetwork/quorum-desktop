# Tooltip Flickering at Top-Left on Fast Mouse Movement

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When moving the mouse quickly up and down over SpaceIcons in the NavMenu, tooltips briefly flash/flicker at the top-left corner of the viewport (position 0,0) before appearing in the correct position or disappearing.

- **Severity**: Low-Medium - noticeable on first hover, then only during fast movement
- **Reproducibility**: Consistent when moving mouse rapidly over multiple SpaceIcons
- **Affected Components**: `src/components/navbar/SpaceIcon.tsx`, `src/components/navbar/NavMenu.tsx`
- **Does NOT affect**: Slow/normal mouse movement over SpaceIcons (after initial hover)

**Note**: The flickering is more annoying in practice because it happens immediately on the **first hover** over any SpaceIcon. After that initial flicker, subsequent hovers only trigger the flickering when moving the mouse quickly up and down across multiple SpaceIcons in the NavMenu.

## Root Cause

This is a **known limitation of react-tooltip v5** documented in [GitHub Issue #1010](https://github.com/ReactTooltip/react-tooltip/issues/1010).

When moving from one anchor to another quickly:
1. The tooltip's **position is updated before its visibility**
2. This causes the tooltip to briefly appear at default position (0,0) before being hidden
3. The flickering is visible because our CSS removes all transition delays for instant tooltip appearance

Technical explanation from react-tooltip maintainers:
> "The flickering is due to a design limitation on the tooltip. When the anchor element changes between renders (even if it's in the exact same place), we hide the tooltip when recalculating the position."

## Attempted Solutions (Unsuccessful)

### 1. Remove Duplicate Anchor IDs
**Hypothesis**: Duplicate IDs on inner elements might confuse react-tooltip positioning.

**Changes Made**:
- Removed `{...(props.noTooltip ? {} : { id: `${iconId}-anchor` })}` from inner icon div and UserInitials
- The Tooltip primitive already adds anchor ID via cloneElement to the outer wrapper

**Result**: Did not fix the flickering. The duplicate IDs were a legitimate bug fix but not the root cause of flickering.

### 2. Add Micro-Delay to CSS Transitions
**Hypothesis**: A small delay (16ms) would allow positioning calculation to complete before tooltip becomes visible.

**Changes Made**:
```scss
:root {
  --rt-transition-show-delay: 0.016s !important;
  --rt-transition-closing-delay: 0s !important;
}
[class*='react-tooltip'] {
  transition: opacity 0.01s !important;
}
```

**Result**: Did not fix the flickering. The position update still happens before visibility toggle regardless of transition timing.

### 3. Shared Tooltip with Data Attributes
**Hypothesis**: Using a single shared ReactTooltip instance with `data-tooltip-id` and `data-tooltip-content` attributes on anchors would avoid the multi-instance race condition.

**Changes Made**:
- Removed Tooltip primitive wrapper from SpaceIcon
- Added `data-tooltip-id`, `data-tooltip-content`, `data-tooltip-place` attributes to SpaceIcon wrapper div
- Added single `<ReactTooltip id="nav-space-icon-tooltip" />` in NavMenu
- Made `content` prop optional in ReactTooltip wrapper
- Used react-tooltip library directly (bypassing our wrapper)

**Result**: Tooltips stopped appearing entirely. The shared tooltip pattern requires different integration than our current Tooltip primitive architecture supports.

### 4. Using react-tooltip Library Directly
**Hypothesis**: Bypassing our ReactTooltip wrapper and using the library directly might work better with data attributes.

**Changes Made**:
```tsx
import { Tooltip as ReactTooltipLib } from 'react-tooltip';
// ...
<ReactTooltipLib id={SPACE_ICON_TOOLTIP_ID} place="right" className="quorum-react-tooltip-dark" />
```

**Result**: Still no tooltips. The issue is likely with how data attributes are being applied or CSS blocking hover events on the wrapper div.

## Current State

All experimental changes have been **reverted**. The codebase is back to the working state with:
- Individual Tooltip primitive wrappers per SpaceIcon
- Instant tooltip transitions (0s delays)
- Minor flickering present during fast mouse movement

TypeScript errors in `ReactTooltip.tsx` were fixed:
- Changed `strategy` to `positionStrategy` (correct prop name for react-tooltip v5)
- Removed invalid props: `disableFocusListener`, `disableHoverListener`, `disableTouchListener`
- Fixed unused parameter warnings
- Added missing `alwaysVisible` to useEffect dependency arrays

## Potential Future Solutions

### Option 1: Accept Minor Flicker (Current)
- **Pros**: No code changes, works reliably
- **Cons**: Minor visual imperfection during fast movement
- **Recommendation**: Acceptable for now given low impact

### Option 2: Extend Tooltip Primitive for Shared Mode
- Add `shared` mode to Tooltip primitive that uses data attributes
- Requires significant refactor of Tooltip.web.tsx
- Would need parent component to render the actual tooltip element

### Option 3: Switch Tooltip Library
- Consider alternatives: Radix UI Tooltip, Floating UI, Tippy.js
- Would require migration effort across entire codebase
- May have similar limitations or different trade-offs

### Option 4: Custom Tooltip Implementation
- Build custom tooltip using Floating UI directly
- Full control over show/hide timing and positioning
- Significant development effort

## Related Files

- `src/components/navbar/SpaceIcon.tsx` - SpaceIcon component with Tooltip wrapper
- `src/components/navbar/NavMenu.tsx` - Parent component rendering SpaceIcons
- `src/components/ui/ReactTooltip.tsx` - ReactTooltip wrapper component
- `src/components/ui/ReactTooltip.scss` - Tooltip styling and transitions
- `src/components/primitives/Tooltip/Tooltip.web.tsx` - Tooltip primitive (web)
- `src/components/primitives/Tooltip/types.ts` - Tooltip type definitions

## References

- [react-tooltip Issue #1010: Position and show status not synchronized](https://github.com/ReactTooltip/react-tooltip/issues/1010)
- [react-tooltip Discussion #1090: Weird position behaviour in dynamic routes](https://github.com/ReactTooltip/react-tooltip/discussions/1090)

---

_Created: 2025-12-10_
_Updated: 2025-12-10 - Added note about first-hover behavior_
