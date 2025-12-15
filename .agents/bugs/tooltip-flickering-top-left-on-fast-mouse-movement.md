# Tooltip Flickering at Top-Left on Fast Mouse Movement

> **AI-Generated**: May contain errors. Verify before use.

## Status: Open - Broader Scope Identified

Previously accepted as a minor limitation affecting only NavMenu SpaceIcons. **Reopened** because the issue is app-wide and more significant than originally assessed.

## Symptoms

When moving the mouse quickly over any set of tooltips, they briefly flash/flicker at the top-left corner of the viewport (position 0,0) before appearing in the correct position or disappearing.

- **Severity**: Medium - affects UX across the entire application
- **Reproducibility**: Consistent when moving mouse rapidly over any tooltip group
- **Scope**: App-wide (not limited to NavMenu)

### Affected Areas

- **NavMenu SpaceIcons** - original discovery location
- **Message Actions** - hovering quickly over action buttons
- **Channel/DM Header Icons** - bookmarks, pinned messages, notifications icons
- **Any component using Tooltip primitive** - the issue is systemic

## Root Cause

This is a **known limitation of react-tooltip v5** documented in [GitHub Issue #1010](https://github.com/ReactTooltip/react-tooltip/issues/1010).

When moving from one anchor to another quickly:
1. The tooltip's **position is updated before its visibility**
2. This causes the tooltip to briefly appear at default position (0,0) before being hidden
3. The flickering is visible because our CSS removes all transition delays for instant tooltip appearance

Technical explanation from react-tooltip maintainers:
> "The flickering is due to a design limitation on the tooltip. When the anchor element changes between renders (even if it's in the exact same place), we hide the tooltip when recalculating the position."

## Previous Attempted Solutions (NavMenu only)

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

**Final Result**: Implementation worked, but **flickering was only marginally reduced**, not eliminated.

See [Tooltip Shared Mode Task](../tasks/.archived/tooltip-shared-mode-navmenu-flickering.md) for full implementation details.

## Potential Solutions to Investigate

Given the app-wide scope, a more comprehensive fix is warranted:

1. **Switch tooltip library**: Radix UI Tooltip, Floating UI, or Tippy.js may handle rapid anchor switching better
2. **Custom implementation**: Build tooltip with Floating UI directly for full control
3. **CSS workaround**: Investigate if `transition-delay` on opacity could mask the position jump
4. **Debounce hover events**: Add small delay before showing tooltips to prevent rapid switching
5. **Hide during transition**: Force tooltip to be invisible when position is (0,0)

## Related Files

- `src/components/primitives/Tooltip/Tooltip.web.tsx` - Tooltip primitive (web) - **primary fix location**
- `src/components/ui/ReactTooltip.tsx` - ReactTooltip wrapper component
- `src/components/navbar/SpaceIcon.tsx` - SpaceIcon component with Tooltip wrapper
- `src/components/chat/MessageActions.tsx` - Message action buttons with tooltips
- `src/components/chat/ChannelHeader.tsx` - Header icons with tooltips

## References

- [react-tooltip Issue #1010: Position and show status not synchronized](https://github.com/ReactTooltip/react-tooltip/issues/1010)
- [react-tooltip Discussion #1090: Weird position behaviour in dynamic routes](https://github.com/ReactTooltip/react-tooltip/discussions/1090)

---

_Created: 2025-12-10_
_Updated: 2025-12-11 - Attempt 5 completed and worked, but improvement was marginal. Reverted to simple tooltips._
_Updated: 2025-12-15 - Reopened. Issue is app-wide, affecting message actions, header icons, and all tooltip groups. Broader scope warrants revisiting solutions._
