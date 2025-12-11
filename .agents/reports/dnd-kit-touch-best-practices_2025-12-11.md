# dnd-kit Touch Drag-and-Drop Best Practices Research

> **AI-Generated**: May contain errors. Verify before use.

## Executive Summary

Research into dnd-kit touch support best practices for mobile web apps. The investigation reveals critical configuration issues in our current implementation and provides evidence-based recommendations for fixing non-deterministic touch drag behavior.

## Scope & Methodology

- **Scope**: Touch drag-and-drop support in dnd-kit for web apps that must work on phones
- **Methodology**: Official documentation review, GitHub issue analysis, community best practices
- **Sources**: dnd-kit official docs, GitHub issues/discussions, community guides
- **Timeframe**: December 2025

## Key Findings

### 1. Sensor Selection: Don't Mix PointerSensor and TouchSensor

**Critical Finding**: Using both PointerSensor and TouchSensor simultaneously causes race conditions.

> "You should not be using both PointerSensor and TouchSensor or MouseSensor at the same time."
> — [dnd-kit Sensors Documentation](https://docs.dndkit.com/api-documentation/sensors)

**Valid Combinations**:
- PointerSensor + KeyboardSensor (recommended for most cases)
- MouseSensor + TouchSensor + KeyboardSensor (when separate constraints needed)

**Why PointerSensor is Preferred**:
> "Pointer events are designed to create a single DOM event model to handle pointing input devices such as a mouse, pen/stylus or touch."
> — [dnd-kit Pointer Documentation](https://docs.dndkit.com/api-documentation/sensors/pointer)

### 2. CSS `touch-action` Property is Critical

**For PointerSensor on touch devices**:
> "Using `touch-action: none;` is the only way to reliably prevent scrolling for pointer events."
> — [dnd-kit Pointer Documentation](https://docs.dndkit.com/api-documentation/sensors/pointer)

> "is currently the only reliable way to prevent scrolling in iOS Safari for both Touch and Pointer events."
> — [dnd-kit Documentation](https://docs.dndkit.com/api-documentation/sensors/pointer)

**For TouchSensor**:
> "For draggable elements using the Touch sensor, set `touch-action` to `manipulation`."
> — [dnd-kit Touch Documentation](https://docs.dndkit.com/api-documentation/sensors/touch)

**Scrollable Lists Consideration**:
> "If your draggable item is part of a scrollable list, it's recommended to use a drag handle and set touch-action to none only for the drag handle."
> — [dnd-kit Documentation](https://docs.dndkit.com)

### 3. Activation Constraints for Touch

**Recommendation for touch input**:
> "Some tolerance should be accounted for when using a delay constraint, as touch input is less precise than mouse input."
> — [dnd-kit Touch Documentation](https://docs.dndkit.com/api-documentation/sensors/touch)

**Constraint Types** (mutually exclusive):
1. **Distance Constraint**: Triggers after moving specified pixels
2. **Delay Constraint**: Triggers after holding for specified duration (ms)

**Typical Touch Configuration**:
```javascript
{
  delay: 250,  // ms before drag starts
  tolerance: 5 // px movement allowed during delay
}
```

### 4. Dynamic Constraints Based on Pointer Type

For apps needing different behavior for mouse vs touch, configure PointerSensor dynamically:

```javascript
PointerSensor.configure({
  activationConstraints(event, source) {
    const { pointerType } = event;
    switch (pointerType) {
      case 'mouse':
        return { distance: { value: 5 } };
      case 'touch':
        return { delay: { value: 250, tolerance: 5 } };
      default:
        return { delay: { value: 200 }, distance: { value: 5 } };
    }
  },
});
```

### 5. Known Issues in dnd-kit@next

> "In the old version of dnd-kit, there was a sensor (TouchSensor) that worked well with smartphone screens. In the new version (@dnd-kit/react experimental), this sensor is no longer available."
> — [GitHub Issue #1723](https://github.com/clauderic/dnd-kit/issues/1723)

Our codebase uses the stable `@dnd-kit/core`, not the experimental `@dnd-kit/react`.

## Current Implementation Issues

### Issue 1: Dual Sensors (CRITICAL)
```typescript
// Current: WRONG - both sensors active simultaneously
const sensors = useSensors(
  useSensor(PointerSensor, { ... }),
  useSensor(TouchSensor, { ... })  // Creates race condition
);
```

### Issue 2: Missing touch-action CSS (CRITICAL)
No `touch-action: none` on draggable elements (SpaceButton, FolderButton, FolderContainer).

### Issue 3: Tight Tolerance
Current: `tolerance: 5` - too strict for imprecise touch input.

### Issue 4: isTouchDevice() Detection
Returns true on laptops with touchscreens even when using mouse, applying touch constraints unnecessarily.

## Recommendations

### High Priority

1. **Remove TouchSensor, use only PointerSensor**
   - **Why**: Prevents race conditions between competing sensors
   - **How**: Remove TouchSensor from useSensors() call
   - **Files**: `src/hooks/business/folders/useFolderDragAndDrop.ts:619-624`

2. **Add `touch-action: none` to draggable elements**
   - **Why**: Required for iOS Safari, prevents scroll interference
   - **How**: Add CSS property to `.folder-button`, `.space-icon`, SpaceButton wrapper
   - **Files**:
     - `src/components/navbar/Folder.scss`
     - `src/components/navbar/SpaceIcon.scss`
     - `src/components/navbar/SpaceButton.tsx` (inline style)

3. **Increase tolerance from 5px to 10px**
   - **Why**: Touch input is less precise than mouse
   - **How**: Change tolerance in activation constraint
   - **Files**: `src/hooks/business/folders/useFolderDragAndDrop.ts:616`

### Medium Priority

4. **Reduce delay from 200ms to 150ms**
   - **Why**: 200ms feels sluggish on touch
   - **How**: Adjust delay value
   - **Files**: `src/hooks/business/folders/useFolderDragAndDrop.ts:616`

5. **Consider pointer-type-aware constraints**
   - **Why**: Different optimal values for mouse vs touch
   - **How**: Use activationConstraints function instead of static object

### Lower Priority

6. **Review isTouchDevice() implementation**
   - **Why**: Incorrectly identifies touchscreen laptops as touch devices
   - **How**: Consider using pointer type detection or media queries
   - **Files**: `src/utils/platform.ts:83-91`

## Implementation Plan

### Option A: Minimal Fix (for drag-only scenarios)

1. Remove TouchSensor from useFolderDragAndDrop
2. Add `touch-action: none` to draggable elements
3. Use delay + tolerance for touch activation

```typescript
// Recommended for drag-only (no competing gestures)
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: isTouchDevice()
      ? { delay: 150, tolerance: 10 }
      : { distance: 8 },
  })
);
```

### Option B: Distance-based with separate long-press (Implemented)

When you need both drag AND long-press gestures on the same element:

```typescript
// In useFolderDragAndDrop.ts - distance-based activation
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: isTouch
      ? { distance: 15 } // Touch: activate after 15px movement
      : { distance: 8 }, // Mouse: activate after 8px movement
  })
);

// In component - separate touch event handlers for long-press
const handleTouchStart = (e: React.TouchEvent) => {
  touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  longPressTimer.current = setTimeout(() => {
    onEdit(); // Open modal after 500ms
  }, 500);
};

const handleTouchMove = (e: React.TouchEvent) => {
  // Cancel long-press if moved > 15px (user wants to drag)
  const distance = Math.sqrt(dx*dx + dy*dy);
  if (distance > 15) clearLongPressTimer();
};
```

**Why this works**: Touch events (`onTouchStart/Move/End`) run in parallel with pointer events (dnd-kit). The 15px threshold is shared between cancelling long-press and activating drag.

## Related Documentation

- [dnd-kit Sensors Overview](https://docs.dndkit.com/api-documentation/sensors)
- [PointerSensor Documentation](https://docs.dndkit.com/api-documentation/sensors/pointer)
- [TouchSensor Documentation](https://docs.dndkit.com/api-documentation/sensors/touch)
- [GitHub Issue #435: PointerSensor on touch devices](https://github.com/clauderic/dnd-kit/issues/435)
- [GitHub Discussion #434: Include TouchSensor by default](https://github.com/clauderic/dnd-kit/discussions/434)
- [GitHub Issue #1723: TouchSensor in @dnd-kit/react](https://github.com/clauderic/dnd-kit/issues/1723)
- Internal: `.agents/docs/features/space-folders.md` - Drag and Drop System section

---

_Created: 2025-12-11_
_Report Type: Research_
