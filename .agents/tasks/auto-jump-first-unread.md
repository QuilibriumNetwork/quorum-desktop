# Auto-Jump to First Unread Message

**Status**: 🟢 Ready to Implement  
**Priority**: Medium  
**Type**: UX Enhancement  
**Complexity**: Low (1-2 days)  
**Affects**: Channel navigation, Message loading

---

## Overview

Implement simple auto-navigation to the first unread message when a user enters a channel with unreads. Similar to Telegram's behavior - no complex logic, just jump to where the user left off.

## Problem

Currently when users enter a channel with unread messages:

- Always loads from the bottom (most recent messages)
- Users must manually scroll back to find where they left off
- No automatic positioning based on unread state

## Solution

**Simple approach**: When user enters a channel, if they have unread messages, jump to the first unread message.

### Logic

```typescript
async function determineInitialCursor({
  messageDB,
  spaceId,
  channelId,
}): Promise<number | null> {
  const conversationId = `${spaceId}/${channelId}`;

  // Get last read timestamp
  const { conversation } = await messageDB.getConversation({ conversationId });
  const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

  // Get first unread message
  const firstUnread = await messageDB.getFirstUnreadMessage({
    spaceId,
    channelId,
    afterTimestamp: lastReadTimestamp,
  });

  // Jump to first unread, or load from bottom if none
  // NOTE: The +1 is because getMessages() excludes the cursor value itself
  return firstUnread ? firstUnread.timestamp + 1 : null;
}
```

## Implementation Steps

### 1. Add Database Method

**File**: `src/db/messages.ts`

Add method to get first unread message:

```typescript
async getFirstUnreadMessage({
  spaceId,
  channelId,
  afterTimestamp,
}: {
  spaceId: string;
  channelId: string;
  afterTimestamp: number;
}): Promise<{ messageId: string; timestamp: number } | null>
```

Uses existing `by_conversation_time` index - no schema changes needed.

### 2. Integrate with Message Fetcher

**File**: `src/hooks/queries/messages/buildMessagesFetcher.ts`

Add cursor determination on initial load:

```typescript
// On initial load (no cursor), determine where to start
if (!cursor) {
  effectiveCursor = await determineInitialCursor({
    messageDB,
    spaceId,
    channelId,
  });
}
```

### 3. Testing

Test scenarios:

- No unreads → loads from bottom (current behavior)
- Has unreads → jumps to first unread
- Very old unreads → jumps to old message
- Cross-platform compatibility (web/desktop/mobile)

## Technical Notes

### The "+1 Pattern"

`getMessages()` uses `IDBKeyRange.bound()` with `upperBoundExclusive = true`, meaning the cursor timestamp itself is excluded. Adding +1ms ensures the target message is included in the range.

### Performance

- Uses existing `by_conversation_time` index
- One additional query per channel entry with unreads
- Query overhead: ~1-5ms
- No new indexes needed

### Edge Cases Handled

- Empty channels → returns null, loads from bottom
- No unreads → returns null, loads from bottom
- Multiple unreads → jumps to oldest first
- Timezone changes → uses user's local timezone

## Success Criteria

- ✅ Users with unreads land at first unread message
- ✅ Users without unreads see current behavior (bottom)
- ✅ No performance regression
- ✅ Cross-platform compatible
- ✅ Backward compatible with existing infinite scroll

## Files to Modify

```
src/db/messages.ts                                    # Add getFirstUnreadMessage()
src/hooks/queries/messages/buildMessagesFetcher.ts    # Add determineInitialCursor()
```

## Critical Edge Cases: Link-Based Navigation

### Scenario Analysis

When users follow **direct message links** from:

- A) Pinned message links (`#msg-{messageId}`)
- B) Search result links (`#msg-{messageId}`)
- C) Notification links (mention/reply, `#msg-{messageId}`)

**What happens currently:**

1. User clicks link → navigates to `/spaces/{spaceId}/{channelId}#msg-{messageId}`
2. MessageList detects hash → scrolls to target message
3. Target message gets highlighted for 6 seconds
4. Hash is removed after 1 second
5. User reads around that message

**The Problem:**

- If target message is NOT the first unread, older unreads are skipped
- When user leaves and returns to channel, where do they go?
- Does lastReadTimestamp get updated?

### Current Read Tracking Behavior

From `.agents/docs/features/mention-notification-system.md`:

```typescript
// Channel.tsx - Read tracking flow
useEffect(() => {
  // Interval (2s) checks if new content to mark as read
  // Updates lastReadTimestamp to "now"
  useUpdateReadTime();
}, [interval]);
```

**Key insight**: Opening a channel marks EVERYTHING as read after 2 seconds, regardless of scroll position.

### Edge Case Resolution

**Scenario**: User has unreads from Jan 1-10. User clicks notification linking to Jan 8 message.

**Current behavior:**

1. Auto-jump loads from bottom (most recent)
2. Hash navigation scrolls to Jan 8 message
3. User sees Jan 8 message highlighted
4. After 2 seconds, lastReadTimestamp updates to "now"
5. ALL unreads (including Jan 1-7) are marked as read
6. User leaves and returns → loads from bottom (no unreads)

**With auto-jump to first unread:**

1. Auto-jump loads from Jan 1 (first unread)
2. Hash navigation OVERRIDES and scrolls to Jan 8 message
3. User sees Jan 8 message highlighted
4. After 2 seconds, lastReadTimestamp updates to "now"
5. ALL unreads (including Jan 1-7) are marked as read
6. User leaves and returns → loads from bottom (no unreads)

### Analysis: Is This a Problem?

**No, because:**

1. **Hash navigation always wins**: The MessageList hash detection (line 251-288) runs AFTER initial load and overrides any auto-jump positioning
2. **Read tracking is channel-level**: Opening a channel marks everything as read after 2s, not scroll-based
3. **User intent is clear**: Following a direct link shows "I want to see THIS message", not "I want to catch up chronologically"
4. **Consistent with current behavior**: This already happens today - clicking a notification marks everything as read

**The auto-jump only affects the INITIAL load position**, which is immediately overridden by hash navigation anyway.

### Implementation Detail

The auto-jump should NOT interfere with hash navigation:

```typescript
// In buildMessagesFetcher.ts
async function determineInitialCursor(...) {
  // Skip auto-jump if URL has a hash target
  if (window.location.hash.startsWith('#msg-')) {
    return null; // Load from bottom, let hash navigation handle it
  }

  // Otherwise, auto-jump to first unread
  const firstUnread = await messageDB.getFirstUnreadMessage(...);
  return firstUnread ? firstUnread.timestamp + 1 : null;
}
```

This ensures:

- ✅ Direct links work exactly as they do today
- ✅ Normal channel entry gets auto-jump behavior
- ✅ No conflicts between systems

## Timeline

- Day 1: Database method + hash detection logic + unit tests
- Day 2: Integration + edge case testing (hash navigation, notifications, search)

## Future Enhancements

After core implementation works well, consider:

- Date separators (show "January 15, 2024" between days) DONE
- "Jump to Present" button (when scrolled away from bottom) DONE
- Visual "NEW" indicator line (Discord-style red line) TO DO

---

**Dependencies**:

- Existing unread tracking system
- Existing hash navigation system (MessageList.tsx line 251-288)
- Read time tracking (useUpdateReadTime)

**Estimated Timeline**: 1-2 days

_Created: 2025-11-11_  
_Replaces: smart-channel-navigation/ folder (over-engineered analysis)_
