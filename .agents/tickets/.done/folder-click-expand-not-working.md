---
type: bug
title: Folder Click to Expand/Collapse Not Working
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Folder Click to Expand/Collapse Not Working

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Status: ✅ SOLVED

## Symptoms

1. **Click on folder icon does nothing** - No expand/collapse behavior
2. **No tooltip on folder hover** - Folder tooltips don't appear (space tooltips inside folders work fine)
3. **Context menu doesn't open** - Right-click on folder produces no menu
4. **Console shows no click logs** - Even with extensive debug logging, pointer events are not firing

**What DID work:**
- Folders render correctly
- SpaceButton clicks work perfectly (navigation works)
- Space tooltips open to the right correctly

## Root Cause

**The `.expanded-nav-buttons-container` CSS class was creating a full-viewport overlay that captured all pointer events.**

```scss
// THE PROBLEM - in ExpandableNavMenu.scss
.expanded-nav-buttons-container {
  position: fixed;
  bottom: 0;
  left: 0;
  width: $nav-header-width;
  height: 100vh;  // <-- THIS WAS THE BUG!
  // ...
}
```

This container (meant to hold the bottom navigation buttons like settings, create space, etc.) was:
- `position: fixed` - taken out of normal flow
- `height: 100vh` - covering the entire viewport height
- Sitting on top of the folder elements in z-order

Even though the container was visually transparent and only contained buttons at the bottom, it was intercepting all pointer events for the entire nav column.

## Why SpaceButton Worked But FolderContainer Didn't

**This was a red herring.** SpaceButton appeared to work because the spaces rendered higher in the DOM/z-order or because testing happened in areas not covered by the overlay. The actual issue had nothing to do with dnd-kit, event handlers, or component implementation differences.

## Investigation Process

1. Added debug logging to FolderContainer - `handleClick` never fired
2. Added native DOM event listeners - `pointerdown` never fired on folder elements
3. Verified CSS `pointer-events: auto` was set correctly on folder elements
4. Added document-level `pointerdown` listener with capture phase:
   ```javascript
   document.addEventListener('pointerdown', (e) => console.log('CLICK TARGET:', e.target), true);
   ```
5. **This revealed the click was hitting `.expanded-nav-buttons-container` instead of the folder**

## Solution

Modified `src/components/navbar/ExpandableNavMenu.scss`:

```scss
.expanded-nav-buttons-container {
  position: fixed;
  bottom: 0;
  left: 0;
  width: $nav-header-width;
  // height: 100vh; // REMOVED - was blocking clicks on folders above
  padding-bottom: $s-5;
  gap: $s-2;
  pointer-events: none; // Allow clicks to pass through the container

  // Re-enable pointer events on actual buttons
  > * {
    pointer-events: auto;
  }
}
```

Changes:
1. Removed `height: 100vh` - container now only takes the height of its content
2. Added `pointer-events: none` to the container - clicks pass through
3. Added `pointer-events: auto` to children - actual buttons still receive clicks

## Lessons Learned

1. **When clicks don't work, check for overlays first** - Use document-level event listeners with capture phase to find what's actually receiving the event
2. **CSS layout issues can masquerade as JavaScript event problems** - The symptoms suggested dnd-kit was the culprit, but it was pure CSS
3. **`position: fixed` with large dimensions is dangerous** - Always consider what the element might be covering
4. **The `pointer-events` CSS property is powerful for overlay scenarios** - `none` on container + `auto` on children is a common pattern

## Files Modified

- `src/components/navbar/ExpandableNavMenu.scss` - Fixed the overlay issue

## Debug Code to Remove

The following debug code was added to FolderContainer.tsx during investigation and should be cleaned up:

- `DEBUG_DISABLE_DND` flag
- `debugRef` and native event listener setup
- Console.log statements for useSortable result and handleClick

---


_Solved: 2025-12-06_
_Total debugging time: ~2.5 hours_
_Root cause: CSS overlay blocking pointer events_
