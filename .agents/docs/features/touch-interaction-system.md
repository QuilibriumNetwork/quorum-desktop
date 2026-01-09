---
type: doc
title: Touch Interaction System
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-11T00:00:00.000Z
---

# Touch Interaction System

## Overview

The touch interaction system provides consistent gesture handling across the application, including long press, scroll vs tap detection, and automatic prevention of browser default behaviors (context menus, text selection) on touch devices. The system respects user permissions and provides optimal performance through proper React patterns.

## Enhanced useLongPress Hook

### Basic Hook: `useLongPress`

```tsx
import { useLongPress } from '../../hooks/useLongPress';

const handlers = useLongPress({
  delay: 500,
  onLongPress: () => {
    // Handle long press
    console.log('Long pressed!');
  },
  onTap: () => {
    // Handle quick tap
    console.log('Tapped!');
  },
  preventTouchDefaults: true, // Default: true
});

// Apply handlers manually
<div {...handlers}>
  Content
</div>
```

### Enhanced Hook: `useLongPressWithDefaults`

**Recommended for most use cases** - automatically handles touch behavior prevention:

```tsx
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { hapticMedium } from '../../utils/haptic';

const handlers = useLongPressWithDefaults({
  delay: 500,
  onLongPress: () => {
    hapticMedium(); // Add haptic feedback
    openModal();
  },
  onTap: () => {
    navigate('/somewhere');
  },
});

// Automatically includes styles and classes for touch prevention
<div
  {...handlers}
  className={`my-class ${handlers.className || ''}`}
  style={handlers.style}
>
  Content
</div>
```

## Features

### Automatic Touch Behavior Prevention

When `preventTouchDefaults: true` (default) and `onLongPress` is defined:

- ✅ **Context Menu**: Prevents browser context menu on long press
- ✅ **Text Selection**: Disables text selection (`user-select: none`)
- ✅ **iOS Callout**: Disables iOS text callout menu (`-webkit-touch-callout: none`)
- ✅ **Tap Highlight**: Removes tap highlight color (`-webkit-tap-highlight-color: transparent`)
- ✅ **Touch Action**: Optimizes touch behavior (`touch-action: manipulation`)

### Cross-Platform Compatibility

- **Touch Devices**: Full gesture and prevention support
- **Desktop**: Standard mouse interactions unchanged
- **Conditional Behavior**: Only applies touch prevention on actual touch devices

### Haptic Feedback Integration

```tsx
import { hapticLight, hapticMedium, hapticHeavy } from '../../utils/haptic';

const handlers = useLongPressWithDefaults({
  onTap: () => {
    hapticLight(); // Subtle feedback for taps
    handleTap();
  },
  onLongPress: () => {
    hapticMedium(); // Standard feedback for long press
    handleLongPress();
  },
});
```

## Configuration Options

### Touch Interaction Constants

Use centralized constants from `src/constants/touchInteraction.ts`:

```tsx
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';

// Standard interactions (channels, groups, buttons)
TOUCH_INTERACTION_TYPES.STANDARD
// delay: 500ms, threshold: 10px

// Content interactions (messages, longer content)
TOUCH_INTERACTION_TYPES.CONTENT
// delay: 600ms, threshold: 10px

// Quick interactions (navigation, selections)
TOUCH_INTERACTION_TYPES.QUICK
// delay: 500ms, threshold: 10px
```

### LongPressOptions Interface

```tsx
interface LongPressOptions {
  /** Delay in ms before triggering long press (default: 500) */
  delay?: number;

  /** Callback for long press gesture */
  onLongPress?: () => void;

  /** Callback for quick tap gesture */
  onTap?: () => void;

  /** Prevent default browser behavior on press start (default: true) */
  shouldPreventDefault?: boolean;

  /** Movement threshold in pixels before canceling long press (default: 10) */
  threshold?: number;

  /** Auto-prevent touch defaults like context menu (default: true) */
  preventTouchDefaults?: boolean;
}
```

## Scroll vs Tap Detection

### The Problem

On touch devices, when users try to scroll a list, their finger lands on a list item. Without proper handling, this registers as a tap instead of a scroll, causing unwanted navigation.

### The Solution: Movement Threshold

The `useLongPress` hook uses a **movement threshold** (default: 10px) to distinguish scrolling from tapping:

- If finger moves **< 10px** → Treat as tap
- If finger moves **≥ 10px** → Treat as scroll (cancel tap)

### Industry Standard Validation

Our 10px threshold aligns with industry standards:

| Platform/Library | Default Threshold |
|------------------|-------------------|
| Android Native (`TOUCH_SLOP`) | ~8-10 dp |
| Hammer.js | 2-10 px |
| use-long-press (npm) | 25 px |
| Common implementations | 5-20 px |

### How It Works

```tsx
// In useLongPress.ts
const move = useCallback((event) => {
  const deltaX = Math.abs(clientX - startPoint.current.x);
  const deltaY = Math.abs(clientY - startPoint.current.y);

  // If movement exceeds threshold, cancel the tap
  if (deltaX > threshold || deltaY > threshold) {
    clearTimeout(timeout.current);
  }
}, [threshold]);
```

### Usage in List Components

For scrollable lists with tappable items (like `DirectMessageContactsList`):

```tsx
const handlers = useLongPressWithDefaults({
  delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
  onLongPress: undefined, // No long press action needed
  onTap: () => {
    hapticLight();
    navigateToItem();
  },
  threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold, // 10px
});

// Touch devices get scroll-aware tap detection
if (isTouch) {
  return (
    <div {...handlers} style={handlers.style}>
      {content}
    </div>
  );
}

// Desktop gets standard click + hover
return (
  <div onClick={handleClick} className="hover:bg-hover">
    {content}
  </div>
);
```

### CSS Hover States on Touch

Hover states should be disabled on touch devices to prevent "sticky hover" after tapping:

```scss
// Only apply hover on devices with true hover capability
@media (hover: hover) and (pointer: fine) {
  .list-item:hover {
    background: var(--color-bg-hover);
  }
}
```

### Adjusting the Threshold

If users report accidental taps while scrolling, increase the threshold:
- **10px** (default) - Good balance for most cases
- **15-20px** - More forgiving, better for fast scrolling
- **25px** - Very forgiving (npm use-long-press default)

## Implementation Examples

### Channel/Group Long Press (Security-Aware)

**IMPORTANT**: Always check user permissions in long press handlers:

```tsx
// In ChannelItem.tsx - Proper permission-aware implementation
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';

const channelHandlers = useLongPressWithDefaults({
  delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
  onLongPress: () => {
    // CRITICAL: Check permissions before allowing editor access
    if (isTouchDevice() && isSpaceOwner) {
      hapticMedium();
      openChannelEditor(channelId);
    }
    // Non-space owners get no action - prevents security bypass
  },
  onTap: () => {
    if (isTouchDevice()) {
      hapticLight();
    }
    navigateToChannel(channelId);
    closeLeftSidebar(); // Auto-close on mobile
  },
  threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,
});

return (
  <div
    {...channelHandlers}
    className={`channel-item ${channelHandlers.className || ''}`}
    style={channelHandlers.style}
  >
    Channel Name
  </div>
);
```

### Component-Level Hook Usage (Recommended)

For optimal performance, create hooks at the component level, not in render loops:

```tsx
// ✅ GOOD - Hook at component level
const MyChannelComponent = ({ channel, isSpaceOwner }) => {
  const handlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    onLongPress: () => {
      if (isSpaceOwner && isTouchDevice()) {
        hapticMedium();
        openEditor();
      }
    },
    // ... other options
  });

  return <div {...handlers}>Content</div>;
};

// ❌ BAD - Hook creation in render loop
const MyListComponent = ({ channels }) => {
  return channels.map(channel => {
    const handlers = useLongPressWithDefaults({ ... }); // Creates new hook instance each render!
    return <div {...handlers}>{channel.name}</div>;
  });
};
```

### Message Long Press

```tsx
// For message interactions
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';

const messageHandlers = useLongPressWithDefaults({
  delay: TOUCH_INTERACTION_TYPES.CONTENT.delay, // 600ms for content
  onLongPress: () => {
    hapticMedium();
    showMessageContextMenu();
  },
  onTap: () => {
    if (message.isReply) {
      scrollToOriginalMessage();
    }
  },
  threshold: TOUCH_INTERACTION_TYPES.CONTENT.threshold,
});
```

## Benefits

1. **Consistent UX**: Same long press behavior across all touch interactions
2. **No Browser Conflicts**: Eliminates unwanted context menus and text selection
3. **Easy Integration**: Drop-in replacement for manual event handling
4. **Haptic Feedback Ready**: Seamless integration with the haptic feedback system
5. **Performance**: Optimized touch handling with minimal overhead
6. **Responsive**: Automatic touch device detection and conditional behavior
7. **Security-Aware**: Proper permission checks prevent unauthorized actions
8. **Maintainable**: Centralized constants and reusable components eliminate duplication

## Migration Guide

### Before (Manual Implementation)

```tsx
// Old manual approach
<div
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
  onContextMenu={(e) => e.preventDefault()}
  style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
  className="select-none"
>
```

### After (Enhanced Hook)

```tsx
// New hook approach with constants and security
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';

const handlers = useLongPressWithDefaults({
  delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
  onLongPress: () => {
    // Always check permissions first!
    if (hasPermission && isTouchDevice()) {
      handleLongPress();
    }
  },
  onTap: handleTap,
  threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,
});

<div
  {...handlers}
  className={`my-class ${handlers.className || ''}`}
  style={handlers.style}
>
```

## Drag-and-Drop with Long Press (dnd-kit)

### ⚠️ IMPORTANT: Do NOT use `useLongPress` with draggable elements

When an element uses dnd-kit for drag-and-drop AND needs long-press functionality, **do not use the `useLongPress` hook**. It conflicts with dnd-kit's PointerSensor.

**Why?**
1. `useLongPress` applies `touch-action: manipulation` - dnd-kit requires `touch-action: none`
2. Both systems listen to pointer/mouse events, causing race conditions
3. The 10px threshold in `useLongPress` doesn't match dnd-kit's 15px activation distance

### Correct Pattern for Drag + Long Press

Use raw touch events which run in parallel with dnd-kit's pointer events:

```tsx
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { hapticLight } from '../../utils/haptic';

const MyDraggableComponent = ({ onEdit }) => {
  const isTouch = isTouchDevice();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const { threshold, delay } = TOUCH_INTERACTION_TYPES.DRAG_AND_DROP;

  // dnd-kit sortable
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id });

  // Cancel long-press when drag starts
  useEffect(() => {
    if (isDragging) clearLongPressTimer();
  }, [isDragging]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTouch && e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      longPressTimer.current = setTimeout(() => {
        hapticLight();
        onEdit();
        clearLongPressTimer();
      }, delay);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current && longPressTimer.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      if (Math.sqrt(dx*dx + dy*dy) > threshold) {
        clearLongPressTimer();
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{ touchAction: 'none' }}  // Required for dnd-kit on iOS
      {...attributes}
      {...listeners}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={clearLongPressTimer}
      onTouchCancel={clearLongPressTimer}
    >
      {/* content */}
    </div>
  );
};
```

### CSS Requirements for Draggables

```scss
.draggable-element {
  // Required for PointerSensor - prevents scroll interference on iOS Safari
  touch-action: none;
}

.scrollable-container {
  // Allow vertical scroll but prevent pull-to-refresh
  touch-action: pan-y;
}
```

### Reference
- See: `.agents/reports/dnd-kit-touch-best-practices_2025-12-11.md`
- Implementation: `src/components/navbar/FolderContainer.tsx`

## Architecture Files

### Core Files Created/Modified:
- `src/hooks/useLongPress.ts` - Enhanced with automatic browser prevention
- `src/utils/haptic.ts` - Cross-platform haptic feedback utility
- `src/constants/touchInteraction.ts` - Centralized touch interaction constants
- `src/components/space/ChannelItem.tsx` - Reusable channel component
- `src/components/space/ChannelGroup.tsx` - Refactored to eliminate duplication

### Key Principles:
1. **Security First**: Always check user permissions in touch handlers
2. **Performance**: Create hooks at component level, not in render loops
3. **Consistency**: Use centralized constants for timing and thresholds
4. **Maintainability**: Extract shared components to eliminate code duplication
5. **dnd-kit Compatibility**: Use raw touch events for draggables, not `useLongPress`

---


*Verified: 2025-12-11 - Added dnd-kit drag-and-drop section*
