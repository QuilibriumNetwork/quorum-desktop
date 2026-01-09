---
type: task
title: "Space Folders: Toggle Indicator Fix for Spaces Inside Folders"
status: done
complexity: medium
ai_generated: true
created: 2025-12-06
updated: 2026-01-09
---

# Space Folders: Toggle Indicator Fix for Spaces Inside Folders

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Related**: `.agents/tasks/space-folders-discord-style.md` (Phase 4)

## Problem

When space icons are inside an expanded folder, the left-side toggle indicators (selected vertical bar and unread dot) are clipped by the folder's `overflow: hidden` CSS property. This property is required for the folder expand/collapse animation to work.

**Current behavior:**
- Toggle indicators don't show for space icons inside folders
- Box-shadow glow is also clipped (we replaced with border as workaround)

**Desired behavior (Discord-like):**
- Toggle indicators show at the exact same left edge position for ALL space icons
- Whether the space is standalone or inside a folder, the indicator appears at the NavMenu's left edge

## Key Files

- `src/components/navbar/SpaceIcon.scss:45-80` - Toggle indicator styles (`.space-icon-selected-toggle`, `.space-icon-has-notifs-toggle`)
- `src/components/navbar/SpaceIcon.tsx:71-75` - Toggle rendering
- `src/components/navbar/Folder.scss:99-112` - `.folder-spaces-wrapper` with `overflow: hidden`
- `src/components/navbar/FolderContainer.tsx` - Folder component
- `src/components/navbar/NavMenu.tsx` - Parent component

## Proposed Solution: clip-path Approach

Use `clip-path` instead of `overflow: hidden` to clip only vertically (for animation) while allowing horizontal overflow (for indicators):

```scss
.folder-spaces-wrapper {
  // Remove overflow: hidden
  // Use clip-path to only clip top/bottom, not left/right
  clip-path: inset(0 -100px 0 -100px); // clips top/bottom at 0, extends left/right by 100px
}
```

**Why this should work:**
- `clip-path: inset()` allows different clipping per side
- Negative values extend the clipping region outward
- Indicators at `left: -15px` would be within the `-100px` extended region
- Vertical clipping still happens for the collapse animation

**Potential issues to verify:**
- Does `clip-path` work with CSS grid animation (`grid-template-rows: 0fr → 1fr`)?
- Browser compatibility (should be fine for modern browsers)
- Does the animation still look smooth?

## Implementation Steps

1. [x] Remove `overflow: hidden` from `.folder-spaces-wrapper`
2. [x] Add `clip-path: inset(0 -100px 0 -100px)` to `.folder-spaces-wrapper`
3. [x] Test folder expand/collapse animation still works
4. [x] Test toggle indicators show for spaces inside folders
5. [x] Test toggle indicators align with standalone space toggles
6. [ ] Verify on mobile breakpoints (manual testing required)

## Alternative Approaches (if clip-path fails)

### Option B: Render toggles at NavMenu level
- Maintain ref map of all SpaceButton positions
- Render indicators as absolute-positioned siblings at NavMenu level
- More complex, requires position recalculation on scroll/resize/animation

### Option C: Portal-based rendering
- Use React portal to render toggles outside folder container
- Calculate positions based on SpaceButton refs
- Similar complexity to Option B

## Current Workarounds in Place

While this is pending, we have:
- Selected spaces inside folders use `outline` instead of `box-shadow` glow (Folder.scss:133-140)
- No toggle indicators show for spaces inside folders (acceptable for now)

## Recent Session Context

The session focused on Phase 4 UI/UX polish:
- Changed all icons to rounded squares (`$rounded-lg`)
- Implemented smooth expand/collapse animation using CSS grid trick
- Made space icons inside folders full size (not small)
- Changed gap to `$s-2-5` to match NavMenu
- Selected spaces inside folders use folder color for border (not accent)

## Resolution

The `clip-path` approach worked successfully:

```scss
.folder-spaces-wrapper {
  // Use clip-path instead of overflow:hidden to allow horizontal overflow (for toggle indicators)
  // while still clipping vertically for the collapse animation
  // inset(top right bottom left) - negative values extend the clipping region outward
  clip-path: inset(0 -100px 0 -100px);
}
```

**Key insight**: `clip-path: inset()` with negative horizontal values allows content to overflow horizontally while still clipping vertically. This is perfect for the CSS grid height animation because:
- Vertical clipping (top/bottom at 0) hides content during collapse
- Horizontal clipping (left/right at -100px) allows toggle indicators to render outside the container

---


_Completed: 2025-12-06_
