# Tooltip Flickering at Top-Left on Fast Mouse Movement

> **AI-Generated**: May contain errors. Verify before use.

## Status: Accepted Limitation

After multiple attempts including a fully functional shared tooltip implementation, the flickering was only **marginally reduced**, not eliminated. The issue appears to be fundamental to react-tooltip v5's positioning logic.

**Decision**: Accept this as a minor visual imperfection. The flickering only occurs during rapid mouse movement and is not severe enough to justify library replacement or custom implementation.

## Symptoms

When moving the mouse quickly up and down over SpaceIcons in the NavMenu, tooltips briefly flash/flicker at the top-left corner of the viewport (position 0,0) before appearing in the correct position or disappearing.

- **Severity**: Low - noticeable on first hover, then only during fast movement
- **Reproducibility**: Consistent when moving mouse rapidly over multiple SpaceIcons
- **Affected Components**: `src/components/navbar/SpaceIcon.tsx`, `src/components/navbar/NavMenu.tsx`
- **Does NOT affect**: Slow/normal mouse movement over SpaceIcons (after initial hover)

**Note**: The flickering happens immediately on the **first hover** over any SpaceIcon. After that initial flicker, subsequent hovers only trigger the flickering when moving the mouse quickly up and down across multiple SpaceIcons in the NavMenu.

## Root Cause

This is a **known limitation of react-tooltip v5** documented in [GitHub Issue #1010](https://github.com/ReactTooltip/react-tooltip/issues/1010).

When moving from one anchor to another quickly:
1. The tooltip's **position is updated before its visibility**
2. This causes the tooltip to briefly appear at default position (0,0) before being hidden
3. The flickering is visible because our CSS removes all transition delays for instant tooltip appearance

Technical explanation from react-tooltip maintainers:
> "The flickering is due to a design limitation on the tooltip. When the anchor element changes between renders (even if it's in the exact same place), we hide the tooltip when recalculating the position."

## Attempted Solutions

### 1. Remove Duplicate Anchor IDs
**Result**: Did not fix flickering (but was a legitimate bug fix).

### 2. Add Micro-Delay to CSS Transitions
**Result**: Did not fix flickering. Position update happens before visibility toggle.

### 3. Shared Tooltip with Data Attributes (Quick Attempt)
**Result**: Tooltips stopped appearing entirely.

### 4. Using react-tooltip Library Directly
**Result**: Still no tooltips.

### 5. TooltipAnchor + TooltipRenderer Components (Full Implementation)

**Implementation**: Created dedicated components for shared tooltip pattern:
- `TooltipAnchor` - adds `data-tooltip-id`, `data-tooltip-content`, `data-tooltip-place` to children
- `TooltipRenderer` - renders single shared tooltip that reads content from anchors

**Key Technical Finding**: react-tooltip v5 with `anchorSelect` does NOT automatically read `data-tooltip-content`. A `render` function is required:

```tsx
<Tooltip
  id={id}
  anchorSelect={`[data-tooltip-id='${id}']`}
  render={({ activeAnchor }) =>
    activeAnchor?.getAttribute('data-tooltip-content') || null
  }
/>
```

**Initial Blocker**: Tooltips appeared not to work. This was caused by **browser caching** - testing in a fresh browser profile confirmed the implementation worked. Hard refresh (`Ctrl+Shift+R`) resolved it.

**Final Result**: Implementation worked, but **flickering was only marginally reduced**, not eliminated. The improvement was not significant enough to justify the added complexity.

**Decision**: Reverted to simple tooltips. Components were removed.

See [Tooltip Shared Mode Task](../tasks/.archived/tooltip-shared-mode-navmenu-flickering.md) for full implementation details.

## Current State

Using original simple `<Tooltip>` wrapper in SpaceIcon. Flickering is accepted as a minor limitation of react-tooltip v5.

## Future Considerations

If this becomes more problematic:

1. **Switch tooltip library**: Radix UI Tooltip, Floating UI, or Tippy.js may handle rapid anchor switching better
2. **Custom implementation**: Build tooltip with Floating UI directly for full control
3. **CSS workaround**: Investigate if `transition-delay` on opacity could mask the position jump

## Related Files

- `src/components/navbar/SpaceIcon.tsx` - SpaceIcon component with Tooltip wrapper
- `src/components/navbar/NavMenu.tsx` - Parent component rendering SpaceIcons
- `src/components/ui/ReactTooltip.tsx` - ReactTooltip wrapper component
- `src/components/primitives/Tooltip/Tooltip.web.tsx` - Tooltip primitive (web)

## References

- [react-tooltip Issue #1010: Position and show status not synchronized](https://github.com/ReactTooltip/react-tooltip/issues/1010)
- [react-tooltip Discussion #1090: Weird position behaviour in dynamic routes](https://github.com/ReactTooltip/react-tooltip/discussions/1090)

---

_Created: 2025-12-10_
_Updated: 2025-12-11 - Attempt 5 completed and worked, but improvement was marginal. Reverted to simple tooltips. Status: Accepted Limitation._
