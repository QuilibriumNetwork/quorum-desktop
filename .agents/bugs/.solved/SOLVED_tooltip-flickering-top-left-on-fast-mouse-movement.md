# Tooltip Flickering at Top-Left on Fast Mouse Movement

> **AI-Generated**: May contain errors. Verify before use.

## Status: SOLVED

## Problem

When moving the mouse quickly over tooltips, they briefly flash at the top-left corner (0,0) before appearing in the correct position.

- **Scope**: App-wide (NavMenu, Message Actions, Header Icons, etc.)
- **Cause**: `opacity: 1 !important` in CSS bypassed react-tooltip's fade-in transition, making the brief (0,0) positioning visible

## Solution

Two changes in `ReactTooltip.tsx` and `ReactTooltip.scss`:

### 1. Add `delayShow={50}` (ReactTooltip.tsx:197)

```tsx
<Tooltip
  // ... other props
  delayShow={50}
/>
```

Gives Floating UI time to calculate position before tooltip appears.

### 2. Let react-tooltip handle opacity transition (ReactTooltip.scss)

**Removed** from mixin:
```scss
opacity: 1 !important; // This was causing the flicker
```

**Added** at bottom of file:
```scss
.react-tooltip {
  --rt-opacity: 1; // Override default 0.9 to ensure full opacity
}
```

The key insight: react-tooltip defaults to `--rt-opacity: 0.9` (90% opaque). Its built-in fade-in transition masks the (0,0) positioning, but we need to override the CSS variable for full opacity.

## What Didn't Work

| Attempt | Result |
|---------|--------|
| Remove duplicate anchor IDs | No effect (but was a valid fix) |
| CSS transition-delay | Position updates before visibility |
| Shared tooltip with data attributes | Tooltips stopped appearing |
| TooltipAnchor + TooltipRenderer components | Marginal improvement only |
| CSS selectors targeting position (0,0) | Selectors didn't match style format |

## Files Changed

- [ReactTooltip.tsx](../../src/components/ui/ReactTooltip.tsx) - Added `delayShow={50}`
- [ReactTooltip.scss](../../src/components/ui/ReactTooltip.scss) - Removed forced opacity, added `--rt-opacity: 1`

## References

- [react-tooltip Issue #1010](https://github.com/ReactTooltip/react-tooltip/issues/1010)

---

_Created: 2025-12-10_
_Solved: 2025-12-15 - Fix: delayShow + let react-tooltip handle opacity transition + override --rt-opacity to 1_
