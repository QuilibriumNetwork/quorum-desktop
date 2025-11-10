# Date Separators UI Enhancement

**Status**: 🔲 Not Started  
**Priority**: Medium  
**Type**: UI Enhancement  
**Complexity**: Medium (1-2 days)  
**Affects**: Message rendering, UI components  
**Dependencies**: [01-core-implementation.md](./01-core-implementation.md) _(must be completed first)_

## Overview

Add horizontal date separators between messages from different days with centered date labels. This enhances message readability and provides clear visual organization of conversations over time.

## Problem Statement

When viewing message history spanning multiple days:

- ❌ No visual indication where one day ends and another begins
- ❌ Difficult to quickly identify when messages were sent
- ❌ Poor readability when catching up on multi-day conversations

## Solution: Daily Message Separators

Add visual separators between messages from different days:

- Horizontal line with centered date label (e.g., "Today", "Yesterday", "November 9")
- Subtle styling that doesn't interfere with message flow
- Responsive design that works on mobile and desktop

## Technical Implementation

### 1. Component Architecture

**Create new component:**

```typescript
// src/components/message/DateSeparator.tsx
import { Text, View } from '../primitives';

interface DateSeparatorProps {
  timestamp: number;
  label?: string; // "Today", "Yesterday", or formatted date
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({
  timestamp,
  label
}) => {
  const displayLabel = label || formatDateLabel(timestamp);

  return (
    <View className="flex flex-row items-center my-4 px-4">
      <View className="flex-1 h-px bg-border-subtle" />
      <Text
        variant="caption"
        className="mx-3 text-subtle"
      >
        {displayLabel}
      </Text>
      <View className="flex-1 h-px bg-border-subtle" />
    </View>
  );
};
```

### 2. Message Grouping Logic

**Create utility for grouping messages by date:**

```typescript
// src/utils/messageGrouping.ts
import { getStartOfDay, isSameDay } from './dateUtils';

interface MessageGroup {
  date: number; // Start of day timestamp
  messages: Message[];
  label: string; // "Today", "Yesterday", etc.
}

export function groupMessagesByDay(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of messages) {
    const messageDay = getStartOfDay(message.createdDate);

    if (!currentGroup || currentGroup.date !== messageDay) {
      currentGroup = {
        date: messageDay,
        messages: [message],
        label: getDateLabel(messageDay),
      };
      groups.push(currentGroup);
    } else {
      currentGroup.messages.push(message);
    }
  }

  return groups;
}

function getDateLabel(timestamp: number): string {
  const now = Date.now();
  const today = getStartOfDay(now);
  const messageDay = getStartOfDay(timestamp);

  const daysDiff = Math.floor((today - messageDay) / (24 * 60 * 60 * 1000));

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff <= 7)
    return new Date(timestamp).toLocaleDateString('en-US', { weekday: 'long' });
  return new Date(timestamp).toLocaleDateString();
}
```

### 3. Message List Integration

**Integrate separators into existing message list component:**

```typescript
// Integration approach - to be determined based on actual message list component
const MessageListWithSeparators: React.FC<{ messages: Message[] }> = ({
  messages
}) => {
  const messageGroups = useMemo(() =>
    groupMessagesByDay(messages), [messages]
  );

  return (
    <ScrollView>
      {messageGroups.map((group, groupIndex) => (
        <React.Fragment key={group.date}>
          {groupIndex > 0 && <DateSeparator timestamp={group.date} label={group.label} />}
          {group.messages.map(message => (
            <MessageItem key={message.id} message={message} />
          ))}
        </React.Fragment>
      ))}
    </ScrollView>
  );
};
```

## Design Specifications

### Visual Style

- **Separator Line**: Use `--color-border-subtle` for subtle appearance
- **Date Label**: Use `$text-xs-responsive` for consistent text sizing
- **Background**: Text should be transparent (no background needed)

### Responsive Behavior

- **Mobile**: Maintain readability on small screens
- **Desktop**: Proper scaling for larger viewports
- **Dark/Light Theme**: Automatic color adaptation using CSS variables

## Files to Create/Modify

### New Files

```
src/components/message/DateSeparator.tsx       # Date separator component
src/utils/messageGrouping.ts                   # Message grouping utilities
src/components/message/DateSeparator.test.tsx  # Unit tests (optional)
```

### Files to Analyze/Modify

```
src/components/chat/MessageList.tsx            # Main message list component (TBD)
src/components/chat/ChatContainer.tsx          # Container component (TBD)
```

## Implementation Steps

### Day 1: Component Development

- [ ] **Analysis Phase**: Identify the correct message list component
  - Find where messages are currently rendered
  - Understand current message item structure
  - Analyze integration points for separators
- [ ] Create `DateSeparator` component using primitives
- [ ] Create message grouping utilities
- [ ] Unit tests for grouping logic

### Day 2: Integration & Testing

- [ ] Integrate separators into message list rendering
- [ ] Test with various message scenarios:
  - Single day messages
  - Multi-day conversations
  - Empty days (no messages)
  - Very long conversations
- [ ] Cross-platform testing (web, desktop, mobile)
- [ ] Performance testing with large message lists

## Analysis Required

### Message List Component Investigation

Before implementation, need to analyze:

- **Component Location**: Find the actual message list component
- **Rendering Pattern**: Understand how messages are currently rendered
- **Virtualization**: Check if virtual scrolling is used (affects separator insertion)
- **Styling Integration**: Ensure separators match existing message styling

### Performance Considerations

- **Grouping Frequency**: When to recalculate groups (on new messages, scroll, etc.)
- **Render Optimization**: Minimize re-renders when messages update
- **Memory Usage**: Impact of additional separator components

## Testing Strategy

### Visual Testing

- [ ] Test with messages spanning multiple days
- [ ] Verify separator appearance in light/dark themes
- [ ] Test responsive behavior on different screen sizes
- [ ] Check accessibility (screen reader announcements)

### Functional Testing

- [ ] Date grouping accuracy across timezone changes
- [ ] Performance with large message lists (1000+ messages)
- [ ] Integration with infinite scroll loading

## Success Criteria

### Functional Requirements

- ✅ Date separators appear between messages from different days
- ✅ Correct date labels ("Today", "Yesterday", formatted dates)
- ✅ No separators within same-day message groups
- ✅ Works with existing infinite scroll and message loading

### Visual Requirements

- ✅ Separators are visually subtle but clear
- ✅ Consistent styling with rest of application
- ✅ Responsive design works on all screen sizes
- ✅ Proper contrast in light and dark themes

### Performance Requirements

- ✅ No significant impact on scroll performance
- ✅ Efficient re-rendering when new messages arrive
- ✅ Memory usage remains reasonable with large message lists

## Future Enhancements

- **Smart Date Labels**: More intelligent labeling ("This morning", "Last Friday")
- **Collapsible Days**: Allow users to collapse/expand day groups
- **Quick Navigation**: Click date separator to jump to specific day
- **Custom Grouping**: User preferences for grouping (by day, week, etc.)

---

**Related Tasks:**

- [01-core-implementation.md](./01-core-implementation.md) _(prerequisite)_
- [03-jump-to-present.md](./03-jump-to-present.md) _(companion task)_

**Dependencies:**

- Core navigation implementation must be completed first
- Requires analysis of existing message list components
- Date utilities from core task

**Estimated Timeline:** 1-2 days (including analysis phase)

_Created: 2025-11-10_
_Last Updated: 2025-11-10_
