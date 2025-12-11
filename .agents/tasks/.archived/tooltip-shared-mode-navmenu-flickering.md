# Tooltip Shared Mode for NavMenu Flickering Fix

> **AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Abandoned
**Complexity**: High
**Created**: 2025-12-10
**Related Bug**: [Tooltip Flickering at Top-Left on Fast Mouse Movement](../bugs/tooltip-flickering-top-left-on-fast-mouse-movement.md)

## Outcome

**Implementation was completed and functional**, but testing revealed the shared tooltip approach only **marginally reduces** the flickering rather than eliminating it. The improvement was not significant enough to justify the added complexity.

**Decision**: Reverted to original simple tooltips. This task is preserved for future reference if a better solution is found.

## What & Why

**Problem**: Tooltip flickering at (0,0) when rapidly moving mouse over SpaceIcons in NavMenu. This is a documented react-tooltip v5 limitation ([GitHub Issue #1010](https://github.com/ReactTooltip/react-tooltip/issues/1010)) where multiple tooltip instances cause position/visibility race conditions.

**Attempted Solution**: Extend the Tooltip primitive with "shared mode" - ONE ReactTooltip instance serves MULTIPLE anchors via data attributes, each with individual positioning.

**Expected Value**: Eliminate the hide/show cycle that causes flickering.

**Actual Result**: Flickering was only slightly reduced, not eliminated. The issue appears to be deeper in react-tooltip's positioning logic.

## Implementation Summary

Two new components were created:

### TooltipAnchor
- Wraps child element and injects `data-tooltip-id`, `data-tooltip-content`, `data-tooltip-place` attributes
- Uses `cloneElement` pattern similar to existing Tooltip primitive
- Native version is a no-op (returns children unchanged)

### TooltipRenderer
- Renders single shared `<Tooltip>` instance from react-tooltip
- Uses `anchorSelect="[data-tooltip-id='${id}']"` to find all anchors
- Uses `render` function to read content from each anchor's `data-tooltip-content`
- Native version returns `null`

### Key Technical Finding

react-tooltip v5 with `anchorSelect` does NOT automatically read `data-tooltip-content`. A `render` function is required:

```tsx
<Tooltip
  id={id}
  anchorSelect={`[data-tooltip-id='${id}']`}
  render={({ activeAnchor }) =>
    activeAnchor?.getAttribute('data-tooltip-content') || null
  }
  // ... other props
/>
```

### Blocker Resolved

Initial implementation appeared broken (tooltips not showing). The issue was **browser caching** - testing in a fresh browser profile confirmed the implementation worked. Hard refresh (`Ctrl+Shift+R`) resolved it.

## Design Decision: No Nav Tooltips on Native

Native implementations are intentional no-ops:
- **Discord pattern**: Discord doesn't show tooltips for server icons on mobile
- **No hover on mobile**: Touch devices have no hover state
- **Already disabled**: SpaceIcon uses `showOnTouch={false}`

## Future Considerations

If revisiting this issue:

1. **Consider different tooltip library**: Radix UI Tooltip, Floating UI, or Tippy.js may handle rapid anchor switching better

2. **Custom implementation**: Build tooltip with Floating UI directly for full control over show/hide timing

3. **CSS-only approach**: Investigate if CSS `transition-delay` on opacity could mask the position jump

4. **Accept the limitation**: The flickering is minor and only occurs on very rapid mouse movement

## Files (Removed)

These files were created but have been removed:
- `src/components/primitives/Tooltip/TooltipAnchor.web.tsx`
- `src/components/primitives/Tooltip/TooltipAnchor.native.tsx`
- `src/components/primitives/Tooltip/TooltipRenderer.web.tsx`
- `src/components/primitives/Tooltip/TooltipRenderer.native.tsx`

Types added to `types.ts` and exports in `index.ts` were also removed.

---

_Created: 2025-12-10_
_Updated: 2025-12-11 - Status: Abandoned. Implementation worked but improvement was marginal. Reverted to simple tooltips._
