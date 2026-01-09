---
type: task
title: Auto-Jump to First Unread Message + Fix Hash Navigation
status: on-hold
complexity: medium
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Auto-Jump to First Unread Message + Fix Hash Navigation


**Priority**: High (affects pinned messages, search, notifications)
**Type**: UX Enhancement + Bug Fix

**Affects**: Channel navigation, Message loading, Hash navigation, Pinned messages, Search results, Notifications

**Related Bug**: [auto-jump-unread-breaks-message-sync.md](../bugs/auto-jump-unread-breaks-message-sync.md)

---

## Overview

Implement auto-navigation to the first unread message when a user enters a channel with unreads, showing messages **around** the target for optimal UX. Users get context (previous messages) while landing exactly where they need to be.

**BONUS**: This implementation will also fix the existing hash navigation bug where clicking on pinned messages, search results, or notifications fails to load old messages.

## Problems

### Problem 1: Auto-Jump to Unreads (Missing Feature)

Currently when users enter a channel with unread messages:

- Always loads from the bottom (most recent messages)
- Users must manually scroll back to find where they left off
- No automatic positioning based on unread state

**Previous WIP Issue**: Initial implementation (commit `a63f609f`) broke message sync - User B only saw first message from User A, requiring multiple refreshes to see all messages.

### Problem 2: Hash Navigation Broken for Old Messages (Existing Bug)

When users click on:

- **Pinned messages** (`#msg-{messageId}`)
- **Search results** (`#msg-{messageId}`)
- **Mention/reply notifications** (`#msg-{messageId}`)

**Current broken behavior:**

1. System loads 100 most recent messages from bottom
2. Searches for target message in loaded array
3. **If message is older than recent 100**: Message not found, no scroll, user sees wrong content
4. User must manually scroll up to find it

**Real-world failures:**

- Admin pins announcement from 2 weeks ago → Jump button doesn't work
- User searches for "budget" from last month → Click lands at bottom
- Someone mentions you in 3-day-old thread → Notification click shows wrong messages
- Active channels (>100 msgs/day) → Almost guaranteed failure

## Solution: Unified Bidirectional Loading

**Approach**: Load messages **around** a target message (unread OR hash navigation) with optimized limits for UX and performance.

### Strategy

When jumping to a target message (unread OR hash):

**Desktop/Web:**

- Load **40 messages BEFORE** (context for scrolling up)
- Load **40 messages AFTER** (unreads/content)
- **Total: ~80 messages** (20% lighter than normal 100-message pagination)

**Mobile:**

- Load **25 messages BEFORE** (less screen space)
- Load **25 messages AFTER** (less screen space)
- **Total: ~50 messages** (50% lighter than normal 100)

**Why these numbers?**

- 40 before (desktop) = enough context to scroll up naturally (3-4 screens)
- 40 after (desktop) = shows unreads + allows scrolling down without immediate pagination
- 25/25 (mobile) = balanced for smaller screens and performance
- Still lighter than normal 100-message load
- Virtuoso handles lazy loading seamlessly if user scrolls beyond
- Two parallel IndexedDB queries = performant

### Logic

```typescript
async function determineInitialCursor({
  messageDB,
  spaceId,
  channelId,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
}): Promise<{
  mode: 'normal' | 'jump-to-message' | 'jump-to-unread';
  cursor?: number;
} | null> {
  // PRIORITY 1: Check for hash navigation (web only)
  // This handles: pinned messages, search results, notifications
  if (isWeb() && typeof window !== 'undefined') {
    const hash = window.location.hash;
    if (hash.startsWith('#msg-')) {
      const messageId = hash.replace('#msg-', '');

      // Get the target message to find its timestamp
      const message = await messageDB.getMessage({
        spaceId,
        channelId,
        messageId,
      });

      if (message) {
        return {
          mode: 'jump-to-message',
          cursor: message.createdDate,
        };
      }
      // If message not found, fall through to normal behavior
    }
  }

  // PRIORITY 2: Check for unread messages
  const conversationId = `${spaceId}/${channelId}`;

  const { conversation } = await messageDB.getConversation({ conversationId });
  const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

  const firstUnread = await messageDB.getFirstUnreadMessage({
    spaceId,
    channelId,
    afterTimestamp: lastReadTimestamp,
  });

  if (firstUnread) {
    return {
      mode: 'jump-to-unread',
      cursor: firstUnread.timestamp,
    };
  }

  // PRIORITY 3: Normal load from bottom (no unreads, no hash)
  return null;
}
```

## Implementation Steps

### 1. Add Database Method ✅ (Already Done in WIP)

**File**: `src/db/messages.ts`

Method already exists from WIP commit:

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

### 2. Add Bidirectional Loading Helper

**File**: `src/hooks/queries/messages/buildMessagesFetcher.ts`

Add new helper function to load messages around a target:

```typescript
/**
 * Load messages around a target timestamp (bidirectional load)
 * Used for:
 * - Jumping to first unread message
 * - Hash navigation (pinned messages, search results, notifications)
 *
 * Integration notes:
 * - Works with existing Virtuoso infinite scroll
 * - Returns proper cursors for pagination
 * - Queries run in parallel for performance
 * - Platform-aware limits (desktop vs mobile)
 */
async function loadMessagesAround({
  messageDB,
  spaceId,
  channelId,
  targetTimestamp,
  beforeLimit,
  afterLimit,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  targetTimestamp: number;
  beforeLimit?: number;
  afterLimit?: number;
}): Promise<{
  messages: Message[];
  nextCursor: number | null;
  prevCursor: number | null;
}> {
  // Platform-aware defaults
  const defaultBefore = isMobile() ? 25 : 40;
  const defaultAfter = isMobile() ? 25 : 40;

  const actualBeforeLimit = beforeLimit ?? defaultBefore;
  const actualAfterLimit = afterLimit ?? defaultAfter;

  // Run both queries in parallel for performance
  const [olderMessages, newerMessages] = await Promise.all([
    messageDB.getMessages({
      spaceId,
      channelId,
      cursor: targetTimestamp,
      direction: 'backward',
      limit: actualBeforeLimit,
    }),
    messageDB.getMessages({
      spaceId,
      channelId,
      cursor: targetTimestamp,
      direction: 'forward',
      limit: actualAfterLimit,
    }),
  ]);

  // Combine: [older...] + [newer...]
  // This maintains chronological order for Virtuoso
  const messages = [...olderMessages.messages, ...newerMessages.messages];

  return {
    messages,
    // Return cursors so Virtuoso pagination works correctly
    nextCursor: newerMessages.nextCursor,
    prevCursor: olderMessages.prevCursor,
  };
}
```

### 3. Update Message Fetcher

**File**: `src/hooks/queries/messages/buildMessagesFetcher.ts`

Integrate bidirectional loading with existing infinite query flow:

```typescript
const buildMessagesFetcher = ({
  messageDB,
  spaceId,
  channelId,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
}) =>
  wrapPaginatedFetcher(async ({ pageParam: cursor }) => {
    // On initial load (no cursor = first page), determine mode
    if (!cursor) {
      const jumpInfo = await determineInitialCursor({
        messageDB,
        spaceId,
        channelId,
      });

      // Handle both hash navigation AND unread jumps with same logic
      if (
        jumpInfo?.mode === 'jump-to-message' ||
        jumpInfo?.mode === 'jump-to-unread'
      ) {
        // Load messages AROUND the target (hash message OR first unread)
        // This becomes the initial page for React Query infinite query
        // Uses platform-aware defaults (40/40 desktop, 25/25 mobile)
        return await loadMessagesAround({
          messageDB,
          spaceId,
          channelId,
          targetTimestamp: jumpInfo.cursor!,
        });
      }
    }

    // Normal pagination (subsequent pages) or no target (initial page)
    // This path is used by:
    // 1. Initial load when no unreads and no hash
    // 2. Virtuoso atTopStateChange -> fetchPreviousPage()
    // 3. Any subsequent pagination
    const response = await messageDB.getMessages({
      spaceId,
      channelId,
      cursor: cursor?.cursor,
      direction: cursor?.direction,
    });

    return response;
  });
```

### 4. Testing

**Unread Jump Scenarios:**

- No unreads → loads from bottom (current behavior)
- Has unreads → jumps to first unread with context (40 before/40 after)
- Very old unreads → jumps correctly with context
- Many unreads (50+) → shows first 40, natural scroll for more
- Mobile → uses 25/25 limits

**Hash Navigation Scenarios (Bug Fixes):**

- Click pinned message from 2 weeks ago → lands at correct message ✅
- Click search result from last month → lands at correct message ✅
- Click mention notification from 3 days ago → lands at correct message ✅
- Active channel (>100 msgs/day) → all hash navigation works ✅
- Hash navigation gets 40 before/40 after (same as unreads)

**Integration Tests:**

- Hash navigation overrides unread jump (priority order correct)
- Virtuoso pagination works after both jump types
- Scroll up/down triggers fetchPreviousPage correctly
- Cross-platform compatibility (web/desktop/mobile)
- Performance with different channel sizes

## Technical Notes

### Integration with Existing Architecture

**Current Flow:**

1. `Channel.tsx` calls `useChannelMessages()`
2. `useChannelMessages()` calls `useMessages()` (React Query infinite query)
3. `useMessages()` uses `buildMessagesFetcher()` for data fetching
4. Results are flattened: `messages.pages.flatMap(p => p.messages)`
5. `MessageList.tsx` displays messages in Virtuoso
6. Virtuoso `atTopStateChange` triggers `fetchPreviousPage()` for pagination

**Our Solution Integrates Seamlessly:**

- Initial load: Either normal (no unreads) OR bidirectional (has unreads)
- Subsequent pagination: Uses existing `getMessages()` with cursors
- Virtuoso: Receives flat array, handles scrolling automatically
- No changes needed to: Channel.tsx, MessageList.tsx, useMessages.ts, useChannelMessages.ts

### Bidirectional Loading Strategy

Instead of loading from one direction:

1. Load 20 messages BEFORE the first unread (backward direction, for context)
2. Load 20 messages AFTER the first unread (forward direction, show unreads)
3. Combine both result sets in chronological order
4. Return proper cursors for Virtuoso pagination

This gives users context while showing unread content.

### Performance

**Why This Is Efficient:**

- Uses existing `by_conversation_time` index (no schema changes)
- Two indexed queries run **in parallel** (Promise.all)
- Total: ~40 messages (20+20) vs 100 for normal load
- Query time: `max(T_backward, T_forward)` not `T_backward + T_forward`
- Expected overhead: ~2-5ms (acceptable for UX improvement)

**Comparison:**

| Approach                    | Queries      | Messages      | Index Hits | Performance                    |
| --------------------------- | ------------ | ------------- | ---------- | ------------------------------ |
| Normal load                 | 1            | 100           | 1          | Baseline                       |
| Broken WIP                  | 1            | 1-100 (buggy) | 1          | Same, but broken               |
| **Bidirectional (Desktop)** | 2 (parallel) | 80 (40+40)    | 2          | ~2-5ms slower, works correctly |
| **Bidirectional (Mobile)**  | 2 (parallel) | 50 (25+25)    | 2          | ~2-5ms slower, works correctly |

### Limit Tuning

**Desktop/Web:**

- Before: 40 messages (3-4 screens of context for natural scrolling)
- After: 40 messages (shows unreads/content without overwhelming)
- Total: 80 messages (20% lighter than normal 100 pagination)

**Mobile:**

- Before: 25 messages (2-3 screens for smaller viewport)
- After: 25 messages (balanced for mobile performance)
- Total: 50 messages (50% lighter than normal 100 pagination)

**Implementation:**

```typescript
import { isMobile } from '../../../utils/platform';

const beforeLimit = isMobile() ? 25 : 40;
const afterLimit = isMobile() ? 25 : 40;
```

**Why 40/40 for Desktop?**

- Enough context to scroll up naturally without immediate pagination
- Enough content to scroll down and explore without hitting edge
- Still lighter than 100-message normal load
- User can scroll freely in both directions
- Virtuoso pagination kicks in seamlessly when needed

### Virtuoso Integration Details

**Initial Scroll Position:**

- Without unreads: `initialTopMostItemIndex={messageList.length - 1}` (bottom)
- With unreads: Virtuoso receives combined array, shows middle naturally
- The first unread message will be at index ~20 (after the 20 "before" messages)
- Virtuoso's `alignToBottom={true}` doesn't apply here - natural positioning

**Pagination After Jump:**

- Scroll up → hits `atTopStateChange` → `fetchPreviousPage()` → loads older with `prevCursor`
- Scroll down → (if needed) loads newer messages
- Cursors returned by `loadMessagesAround()` connect seamlessly to `getMessages()`

### Edge Cases Handled

- Empty channels → returns null, loads from bottom
- No unreads → returns null, loads from bottom (normal 100 message load)
- Few unreads (1-5) → shows all with full context
- Many unreads (50+) → shows first 20, Virtuoso pagination loads more naturally
- Very old unreads → loads context from that time period
- Hash navigation → skips auto-jump, loads normally, hash scroll overrides
- Timezone changes → uses user's local timezone
- Rapid-fire messages → all load correctly (fixes original bug)

## Success Criteria

**Unread Jump:**

- ✅ Users with unreads land at first unread message WITH context (40 before/40 after)
- ✅ All messages from rapid-fire senders load correctly (fixes original bug)
- ✅ Users without unreads see current behavior (bottom 100)

**Hash Navigation (Bug Fixes):**

- ✅ Clicking pinned messages works for ANY age (fixes bug)
- ✅ Clicking search results works for ANY age (fixes bug)
- ✅ Clicking notifications works for ANY age (fixes bug)
- ✅ Hash navigation loads target WITH context (40 before/40 after)

**Performance & Compatibility:**

- ✅ No significant performance regression (<10ms acceptable)
- ✅ Mobile uses lighter limits (25/25)
- ✅ Cross-platform compatible (web/desktop/mobile)
- ✅ Backward compatible with existing infinite scroll
- ✅ Virtuoso pagination works correctly after initial jump
- ✅ Hash navigation takes priority over unread jump

## Files to Modify

```
src/db/messages.ts                                    # getFirstUnreadMessage() - ALREADY DONE
src/hooks/queries/messages/buildMessagesFetcher.ts    # Add loadMessagesAround() + update fetcher
```

## Architecture Flow Diagram

```
User enters channel with unreads
         ↓
useChannelMessages() calls useMessages()
         ↓
buildMessagesFetcher() (initial load, no cursor)
         ↓
determineInitialCursor() checks for unreads
         ↓
    [Has unreads?]
    /           \
  YES            NO
   ↓              ↓
loadMessagesAround()    getMessages()
   ↓                    (normal: bottom 100)
Load 20 before + 20 after
   ↓
Return {messages: 40, nextCursor, prevCursor}
         ↓
useChannelMessages flattens: pages.flatMap(p => p.messages)
         ↓
MessageList receives flat array (40 or 100 messages)
         ↓
Virtuoso displays messages
         ↓
User scrolls up → fetchPreviousPage()
         ↓
buildMessagesFetcher() with cursor + direction
         ↓
getMessages() (normal pagination)
         ↓
Load next 100 messages (backward)
```

## Compatibility Notes

**No Changes Required To:**

- ✅ `src/components/space/Channel.tsx` - uses same `fetchPreviousPage()` API
- ✅ `src/components/message/MessageList.tsx` - receives same flat message array
- ✅ `src/hooks/business/channels/useChannelMessages.ts` - flattening logic unchanged
- ✅ `src/hooks/queries/messages/useMessages.ts` - infinite query config unchanged
- ✅ Virtuoso configuration - pagination callbacks work as before

**Only Changes:**

- 📝 `src/db/messages.ts` - getFirstUnreadMessage() already added ✅
- 📝 `src/hooks/queries/messages/buildMessagesFetcher.ts` - add logic for initial load

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

- Day 1: ✅ Database method (getFirstUnreadMessage) - DONE in WIP
- Day 2: Implement loadMessagesAround() helper + update determineInitialCursor() + update fetcher
- Day 3: Integration testing + verification:
  - Test unread jumps (various scenarios)
  - Test hash navigation (pinned, search, notifications)
  - Test priority (hash overrides unread)
  - Test mobile vs desktop limits
  - Test pagination after jumps

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
