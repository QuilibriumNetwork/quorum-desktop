# Smart Channel Navigation - Core Implementation

**Status**: 🔲 Not Started  
**Priority**: High  
**Type**: UX Enhancement  
**Complexity**: Medium (2-3 days)  
**Affects**: Channel navigation, Message loading, Database queries

## Overview

Implement Discord-style intelligent channel navigation that takes users to the "first message of today" when entering a channel with unread messages. This is the **core functionality only** - UI enhancements are separate tasks.

## Problem Statement

When users enter a channel with unread messages:

- ❌ Always loads from the bottom (most recent messages)
- ❌ Users must manually scroll back through potentially hundreds of messages
- ❌ No contextual entry point for daily conversations

## Solution: Smart Cursor Determination

When user enters a channel:

1. **Check for unread messages** using existing `hasUnreadMessages()`
2. **If no unreads**: Load from bottom (current behavior)
3. **If has unreads**:
   - Find first message sent today (00:00:00 local time)
   - If messages exist today → Jump to first message of today
   - If no messages today → Fall back to first unread message

## Technical Implementation

### 1. Database Enhancement

Add method to existing `MessageDB` class:

```typescript
/**
 * Get the first message sent on a specific day in a channel
 * Uses existing by_conversation_time index for efficiency
 */
async getFirstMessageOfDay({
  spaceId,
  channelId,
  targetDate,
}: {
  spaceId: string;
  channelId: string;
  targetDate: number; // Start of day timestamp (00:00:00)
}): Promise<{ messageId: string; timestamp: number } | null>
```

**Implementation notes:**

- Query range: `[spaceId, channelId, targetDate]` to `[spaceId, channelId, endOfDay]`
- Return first result (earliest message of that day)
- Uses existing index - no performance impact

### 2. Date Utilities

Use existing date library or create minimal utilities:

```typescript
// src/utils/dateUtils.ts
export function getStartOfDay(timestamp?: number): number {
  const date = timestamp ? new Date(timestamp) : new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getEndOfDay(timestamp?: number): number {
  const date = timestamp ? new Date(timestamp) : new Date();
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}
```

### 3. Smart Cursor Integration

Enhance `buildMessagesFetcher.ts` with cursor determination:

```typescript
async function determineInitialCursor({
  messageDB,
  spaceId,
  channelId,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
}): Promise<number | null> {
  const conversationId = `${spaceId}/${channelId}`;

  // 1. Check for unread messages
  const { conversation } = await messageDB.getConversation({ conversationId });
  const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

  const hasUnreads = await messageDB.hasUnreadMessages({
    spaceId,
    channelId,
    afterTimestamp: lastReadTimestamp,
  });

  if (!hasUnreads) {
    return null; // Load from bottom (current behavior)
  }

  // 2. Find first message of today
  const startOfToday = getStartOfDay();
  const firstMessageToday = await messageDB.getFirstMessageOfDay({
    spaceId,
    channelId,
    targetDate: startOfToday,
  });

  // 3. Return smart cursor
  return firstMessageToday?.timestamp ?? lastReadTimestamp + 1;
}
```

## Files to Modify

### New Files

```
src/utils/dateUtils.ts                    # Minimal date utilities
```

### Modified Files

```
src/db/messages.ts                        # Add getFirstMessageOfDay method
src/hooks/queries/messages/buildMessagesFetcher.ts  # Smart cursor determination
```

## Implementation Steps

### Day 1: Database Logic

- [ ] Add `getFirstMessageOfDay()` method to MessageDB
- [ ] Create minimal date utilities
- [ ] Add unit tests for database method

### Day 2: Message Loading Integration

- [ ] Implement `determineInitialCursor()` function
- [ ] Integrate with existing buildMessagesFetcher
- [ ] Test with various scenarios (no unreads, unreads today, old unreads)

### Day 3: Testing & Edge Cases

- [ ] Handle timezone edge cases
- [ ] Performance testing with large message histories
- [ ] Cross-platform testing (web, desktop, mobile)

## Edge Cases

### Time & Date Handling

- **Timezone changes**: User traveling across timezones
- **Midnight boundary**: Messages sent around 00:00:00
- **No messages today**: Graceful fallback to first unread

### Database Edge Cases

- **Empty channels**: No messages at all
- **First day in channel**: User joins mid-conversation
- **Very old unreads**: Messages from weeks/months ago

### Performance

- **Query overhead**: One additional query per channel entry with unreads
- **Index utilization**: Uses existing `by_conversation_time` index
- **Early termination**: Stops at first message found

## Success Criteria

### Functional Requirements

- ✅ Users with unread messages land at first message of today (if exists)
- ✅ Users without unreads load from bottom (current behavior unchanged)
- ✅ Fallback to first unread if no messages today
- ✅ No performance regression on channel loading

### Technical Requirements

- ✅ Backward compatibility with existing infinite scroll system
- ✅ Efficient database queries using existing indexes
- ✅ Proper error handling and graceful degradation
- ✅ Cross-platform compatibility (web, desktop, mobile)

## Testing Strategy

### Unit Tests

- `getFirstMessageOfDay()` with various date scenarios
- Date utility functions with timezone edge cases
- Smart cursor determination with different unread states

### Integration Tests

- Full channel loading flow with mocked message data
- Cross-platform behavior verification
- Performance impact measurement

## Performance Considerations

### Database Impact

- **Query overhead**: One additional DB query per channel entry with unreads
- **Index utilization**: Uses existing `by_conversation_time` index efficiently
- **Query complexity**: Simple range query with early termination

### Memory Impact

- **Minimal**: Only loads timestamp for cursor determination
- **Caching**: Leverages existing React Query caching

## Future Enhancements

After core implementation is complete and validated:

- Date separators between days (separate task)
- "Jump to present" navigation button (separate task)
- User preference settings for navigation behavior

---

**Related Tasks:**

- [02-date-separators.md](./02-date-separators.md) _(Date Separators UI Enhancement)_
- [03-jump-to-present.md](./03-jump-to-present.md) _(Jump to Present Button)_

**Dependencies:**

- Existing unread message system
- React Query infinite pagination system
- Cross-platform date/time handling

**Estimated Timeline:** 2-3 days for core functionality only

_Created: 2025-11-10_
_Last Updated: 2025-11-10_
