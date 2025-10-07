# Touch Long Press System

## Overview

The touch long press system provides consistent long press gesture handling across the application with automatic prevention of browser default behaviors (context menus, text selection) on touch devices. The system respects user permissions and provides optimal performance through proper React patterns.

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

---

*Updated: 2025-01-25*