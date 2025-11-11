# Jump to Present Button

**Status**: ✅ Completed  
**Priority**: Medium  
**Type**: UX Enhancement  
**Complexity**: Medium (1-2 days)  
**Affects**: Message navigation, Scroll tracking  
**Dependencies**: None - Can be implemented standalone  
**Note**: Originally designed to complement Task 01 (smart navigation), but provides value independently

## ✅ IMPLEMENTATION COMPLETED

**Date Completed**: November 11, 2025  
**Files Created/Modified**: 
- `src/hooks/ui/useScrollTracking.ts` (new)
- `src/components/message/MessageList.tsx` (modified)

**Key Features Implemented**:
- ✅ Scroll position tracking using React Virtuoso's built-in callbacks
- ✅ Smart threshold-based button visibility (50+ messages behind)
- ✅ Inline jump button integrated directly into MessageList component
- ✅ Cross-platform compatibility using primitives
- ✅ Internationalization support using Lingui
- ✅ Leverages existing scrollToBottom functionality

**Technical Architecture**:
- Uses `useScrollTracking` hook to monitor scroll position via Virtuoso's `rangeChanged` and `atBottomStateChange` callbacks
- Button appears when user is 50+ messages behind and not at bottom
- Positioned absolutely in bottom-right corner with proper z-index
- Uses existing MessageListRef.scrollToBottom() method for jumping

## Overview

Add a "Jump to present" button that appears when users scroll back in message history, providing quick navigation back to the most recent messages. This enhances UX when users are viewing older messages after using smart navigation.

## Problem Statement

When users navigate to older messages (via smart navigation or manual scrolling):

- ❌ No easy way to quickly return to most recent messages
- ❌ Users must manually scroll through potentially hundreds of messages
- ❌ Unclear whether they're viewing current or historical messages

## Solution: Context-Aware Navigation Button

Show "Jump to present" button when user is viewing older messages:

- **Trigger**: When user scrolls back significantly or is viewing non-recent messages
- **Position**: Fixed bottom-right of message list
- **Action**: Smooth scroll to most recent messages
- **Style**: Use Button primitive with secondary styling

## Technical Implementation

### 1. Scroll Position Tracking

**Create hook for tracking scroll position:**

```typescript
// src/hooks/ui/useScrollTracking.ts
interface ScrollTrackingState {
  isAtBottom: boolean;
  isViewingOlderMessages: boolean;
}

export function useScrollTracking({
  threshold = 1500, // Distance in pixels from bottom
}: {
  threshold?: number;
} = {}) {
  const [scrollState, setScrollState] = useState<ScrollTrackingState>({
    isAtBottom: true,
    isViewingOlderMessages: false,
  });

  const handleScroll = useCallback(
    (scrollInfo: ScrollInfo) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollInfo;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Distance-based detection within the message list container
      // Note: This assumes scrollInfo comes from the message list scroll container,
      // not the entire document/window
      const isAtBottom = distanceFromBottom < 100; // 100px threshold
      const isViewingOlder = distanceFromBottom > threshold;

      setScrollState({
        isAtBottom,
        isViewingOlderMessages: isViewingOlder,
      });
    },
    [threshold]
  );

  return { scrollState, handleScroll };
}
```

### 2. Jump to Present Component

**Create navigation button component:**

```typescript
// src/components/chat/JumpToPresentButton.tsx (if using standalone component)
import { Button, View } from '../primitives';
import { Trans } from '@lingui/macro';

interface JumpToPresentButtonProps {
  isVisible: boolean;
  onJumpToPresent: () => void;
}

export const JumpToPresentButton: React.FC<JumpToPresentButtonProps> = ({
  isVisible,
  onJumpToPresent,
}) => {
  if (!isVisible) return null;

  return (
    <View className="absolute bottom-4 right-4 z-50">
      <Button
        type="secondary"
        onClick={onJumpToPresent}
        className="shadow-lg"
      >
        <Trans>Jump to present</Trans>
      </Button>
    </View>
  );
};
```

**Alternative: Inline Implementation** (recommended based on your note)

Instead of a standalone component, we can implement this directly in the MessageList component:

````typescript
// Directly in MessageList component
const MessageListWithInlineNavigation: React.FC<MessageListProps> = (props) => {
  const { scrollState, handleScroll } = useScrollTracking({
    messageList: props.messages,
    threshold: 50,
  });

  const handleJumpToPresent = useCallback(() => {
    scrollToBottom();
  }, []);

  return (
    <View className="relative flex-1">
      <ScrollView onScroll={handleScroll}>
        {/* Existing message list content */}
      </ScrollView>

      {/* Inline jump button - no separate component needed */}
      {scrollState.isViewingOlderMessages && (
        <View className="absolute bottom-4 right-4 z-50">
          <Button
            type="secondary"
            onClick={handleJumpToPresent}
            className="shadow-lg"
          >
            {scrollState.messagesBehind ?
              `Jump to present (${scrollState.messagesBehind} behind)` :
              'Jump to present'
            }
          </Button>
        </View>
      )}
    </View>
  );
};



### 3. Integration with Message List

**Integrate button inline with existing message list (recommended approach):**

```typescript
// Inline implementation - no separate component needed
import { Trans } from '@lingui/macro';

const MessageListWithInlineNavigation: React.FC<MessageListProps> = (props) => {
  const { scrollState, handleScroll } = useScrollTracking({
    threshold: 1500, // Show button when 1500px+ from bottom
  });

  const handleJumpToPresent = useCallback(() => {
    scrollToBottom();
  }, []);

  return (
    <View className="relative flex-1">
      <ScrollView onScroll={handleScroll}>
        {/* Existing message list content */}
      </ScrollView>

      {/* Simple jump button when not at bottom */}
      {scrollState.isViewingOlderMessages && (
        <View className="absolute bottom-4 right-4 z-50">
          <Button
            type="secondary"
            onClick={handleJumpToPresent}
            className="shadow-lg"
          >
            <Trans>Jump to present</Trans>
          </Button>
        </View>
      )}
    </View>
  );
};
```

## Design Specifications

### Visual Style

- **Button Type**: Secondary button primitive for subtle appearance
- **Position**: Fixed bottom-right corner with proper spacing
- **Shadow**: Subtle shadow for depth (`shadow-lg`)
- **Size**: Default size (normal) for good touch targets and readability
  _Note: Button primitive supports `compact | small | normal | large` sizes, with `normal` as default_
- **Z-index**: High (`z-50`) to appear above message content

### Behavior

- **Show/Hide**: Smooth fade in/out animation when appearing/disappearing
- **Threshold**: Configurable threshold for when to show button (default: 1500px from bottom)
- **Action**: Immediate scroll to bottom (no smooth scroll to avoid delays)
- **State**: Hide immediately after jumping to present

## Files to Create/Modify

### New Files

```
src/hooks/ui/useScrollTracking.ts               # Scroll position tracking hook
```

**Note**: Based on feedback, the jump button will be implemented inline in the MessageList component rather than as a standalone component, reducing complexity and file count.

### Files to Analyze/Modify

```
src/components/chat/MessageList.tsx            # Main message list component (TBD)
src/components/chat/ChatContainer.tsx          # Container component (TBD)
```

## Implementation Steps

### Day 1: Hook Development & Analysis

- [ ] **Analysis Phase**: Identify message list component and scroll handling
  - **CRITICAL**: Find the actual scrollable message list container (not document scroll)
  - Verify scroll events come from the message list container, not window/body
  - Understand existing scroll-to-bottom functionality
  - Analyze best integration point for inline button
- [ ] Create scroll tracking hook with configurable thresholds
- [ ] Unit tests for scroll tracking logic
- [ ] **i18n Setup**: Add lingui imports and translation strings for button text

### Day 2: Integration & Testing

- [ ] Integrate inline jump button with message list component
- [ ] Add translation string to locale files:
  - `"Jump to present"` - Button text
- [ ] Test scroll tracking accuracy with various scenarios:
  - Fast scrolling
  - Slow scrolling
  - Loading new messages while scrolled up
  - Very long message lists
- [ ] Cross-platform testing (web, desktop, mobile)
- [ ] Performance testing for scroll event handling

## Analysis Required

### Message List Component Investigation

Before implementation, need to analyze:

- **Scroll Container**: Find the actual scrollable message list container (not document/window scroll)
- **Scroll Events**: How scroll events are currently handled
- **Existing Navigation**: Check for existing scroll-to-bottom functionality
- **Virtualization**: Understand if virtual scrolling affects position tracking

### Performance Considerations

- **Scroll Event Frequency**: Throttle scroll events to avoid performance issues
- **Position Calculation**: Efficient methods for determining scroll position
- **Re-render Optimization**: Minimize re-renders when scroll state changes

## Testing Strategy

### Functional Testing

- [ ] Button appears at correct scroll threshold
- [ ] Button disappears when at bottom of messages
- [ ] Jump action works correctly and reliably
- [ ] Performance with rapid scrolling

### UX Testing

- [ ] Button doesn't interfere with message interaction
- [ ] Proper positioning on different screen sizes
- [ ] Accessible keyboard navigation
- [ ] Clear visual feedback

### Edge Cases

- [ ] Very short message lists (less scroll distance than threshold)
- [ ] Loading states while jumping to present
- [ ] Network delays during scroll operations

## Success Criteria

### Functional Requirements

- ✅ Button appears when user scrolls back significantly
- ✅ Button reliably jumps to most recent messages
- ✅ Button hides when at bottom of message list
- ✅ Configurable threshold for when to show button (distance-based)

### UX Requirements

- ✅ Button positioning doesn't interfere with message reading
- ✅ Smooth show/hide animations
- ✅ Simple and clean button appearance
- ✅ Works consistently across all platforms

### Performance Requirements

- ✅ No significant impact on scroll performance
- ✅ Efficient scroll event handling
- ✅ Minimal re-renders during scroll operations

## Configuration Options

### Threshold Settings

- **Pixel Distance**: Distance from bottom in pixels (default: 1500px)
- **Time-based**: Hide after certain time of inactivity (future enhancement)

### Customization

- **Button Text**: Configurable button text
- **Position**: Allow different positioning (bottom-left, top-right, etc.)
- **Animation**: Enable/disable show/hide animations

## Future Enhancements

- **Smart Threshold**: Dynamic threshold based on message frequency
- **Keyboard Shortcuts**: Hotkey for jumping to present (e.g., Ctrl+End)
- **Visual Indicator**: Small indicator showing approximate position in history
- **Quick Navigation**: Additional buttons for jumping to specific time periods

---

**Related Tasks:**

- [01-core-implementation.md](./01-core-implementation.md) _(prerequisite)_
- [02-date-separators.md](./02-date-separators.md) _(companion task)_

**Dependencies:**

- Core navigation implementation for scroll-to-bottom functionality
- Requires analysis of existing message list components
- Scroll handling utilities

**Estimated Timeline:** 1-2 days (including analysis phase)

_Created: 2025-11-10_
_Last Updated: 2025-11-10_
````
