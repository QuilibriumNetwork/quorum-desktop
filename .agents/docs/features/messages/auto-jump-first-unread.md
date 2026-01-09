---
type: doc
title: Auto-Jump to First Unread Message
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-11-13T00:00:00.000Z
---

# Auto-Jump to First Unread Message

## Overview

### Problem
When entering a channel or direct message conversation with unread messages, users always landed at the bottom (most recent messages), forcing them to manually scroll up to find where they left off.

### Solution
Automatically jump to the first unread message when entering a channel or DM with unreads. The system loads messages around the first unread, providing context above (for scrolling up) and below (for scrolling down).

**Key Behavior:**
- Loads 40 messages before + first unread + 40 messages after
- Scrolls to first unread message (81-message context window)
- Unread indicator line shows which messages are unread
- User can scroll both directions with bidirectional pagination

---

## How It Works

### Entry Flow
```
1. User opens channel or DM with unreads
2. System queries getFirstUnreadMessage(afterTimestamp: lastReadTimestamp)
3. If first unread not in current 100 messages:
   → Load messages around first unread (40 before + target + 40 after)
   → Update React Query cache
   → Scroll to first unread
4. If first unread already loaded:
   → Just scroll to it
5. User sees first unread with context in both directions
```

### Edge Cases Handled

**Hash Navigation Priority:**
If URL contains `#msg-{messageId}`, hash navigation takes precedence over auto-jump.

**No Unreads:**
If `lastReadTimestamp === 0` (no read history), normal behavior applies (land at bottom).

**First Unread Already Loaded:**
If first unread is within the initial 100 messages, skip loading and just scroll to it.

---

## Implementation

### Core Logic

**Channels** (Channel.tsx:344-422) and **Direct Messages** (DirectMessage.tsx:338-454) share identical implementation:

```typescript
useEffect(() => {
  // Skip if hash navigation in progress
  if (window.location.hash.startsWith('#msg-')) return;

  // Skip if no unreads
  if (lastReadTimestamp === 0) return;

  const jumpToFirstUnread = async () => {
    // Get first unread message ID
    const firstUnread = await messageDB.getFirstUnreadMessage({
      spaceId, channelId, afterTimestamp: lastReadTimestamp
    });

    if (!firstUnread) return;

    // Check if already loaded
    const isAlreadyLoaded = messageList.some(m => m.messageId === firstUnread.messageId);

    if (isAlreadyLoaded) {
      setScrollToMessageId(firstUnread.messageId);
      return;
    }

    // Load messages around first unread
    const { messages, prevCursor, nextCursor } = await loadMessagesAround({
      messageDB, spaceId, channelId,
      targetMessageId: firstUnread.messageId,
      beforeLimit: 40, afterLimit: 40
    });

    // Update cache and scroll
    queryClient.setQueryData(buildMessagesKey({ spaceId, channelId }), {
      pages: [{ messages, prevCursor, nextCursor }],
      pageParams: [undefined]
    });

    setScrollToMessageId(firstUnread.messageId);
  };

  const timer = setTimeout(() => jumpToFirstUnread(), 100);
  return () => clearTimeout(timer);
}, [channelId, spaceId, lastReadTimestamp, messageDB, messageList, queryClient]);
```

### MessageList Integration (MessageList.tsx:330-356)

```typescript
// Handle programmatic scrollToMessageId
useEffect(() => {
  if (!init || messageList.length === 0 || !scrollToMessageId) return;

  if (!hasProcessedScrollTo) {
    const index = messageList.findIndex(m => m.messageId === scrollToMessageId);

    if (index !== -1) {
      setHasProcessedScrollTo(true);
      setHasJumpedToOldMessage(true); // Disable auto-scroll during pagination

      // Scroll to the message (no highlight - unread line is shown via lastReadTimestamp)
      setTimeout(() => {
        scrollToMessage(scrollToMessageId, virtuoso.current, messageList);
      }, 200);
    }
  }
}, [init, messageList, scrollToMessageId, hasProcessedScrollTo, scrollToMessage]);
```

### New Props

**MessageList.tsx:**
- `scrollToMessageId?: string` - Triggers programmatic scroll without URL hash

**Channel.tsx & DirectMessage.tsx:**
- `scrollToMessageId` state - Holds target message ID for auto-jump

---

## Shared Infrastructure

This feature **reuses** the bidirectional loading pattern from hash navigation:

- **`loadMessagesAround()`** utility (see [hash-navigation-to-old-messages.md](./hash-navigation-to-old-messages.md))
- **`getFirstUnreadMessage()`** database query (MessageDB.ts:1560-1603)
- **`scrollToMessage()`** scroll helper (useMessageHighlight.ts)
- **`hasJumpedToOldMessage`** flag for disabling auto-scroll during pagination

For details on bidirectional loading, React Query cache updates, and pagination behavior, see the hash navigation documentation.

---

## User Experience

### Visual Indicators

**Unread Line:**
Messages after `lastReadTimestamp` show a visual indicator (handled by Message component). No flash highlight is used - the unread line provides persistent visual feedback.

**Scroll Position:**
First unread message is positioned with ~40 messages of context above, allowing users to scroll up for additional context or down to read new messages.

### Pagination Behavior

After auto-jumping:
- **Scroll UP** → Loads older messages (backward pagination)
- **Scroll DOWN** → Loads newer messages (forward pagination)
- **Auto-scroll disabled** until reaching present (`hasNextPage === false`)
- **"Jump to Present" button** appears when scrolled away from bottom

This is identical to hash navigation behavior.

---

## Testing Scenarios

### 1. Standard Auto-Jump
- **Setup**: Channel or DM has 200 messages, user last read at message 100
- **Expected**: Jump to message 101 (first unread) with messages 61-141 loaded
- **Verify**: Can scroll up to see older messages, down to see newer

### 2. Already Loaded Unread
- **Setup**: First unread is within most recent 100 messages
- **Expected**: No reload, just scroll to first unread
- **Verify**: Fast, no loading indicator

### 3. Hash Navigation Priority
- **Setup**: Open channel or DM with `#msg-abc123` and also has unreads
- **Expected**: Hash navigation takes priority, auto-jump is skipped
- **Verify**: Lands on hash message, not first unread

### 4. No Unreads
- **Setup**: User has no read history (`lastReadTimestamp === 0`) or all caught up
- **Expected**: Normal behavior, land at bottom
- **Verify**: Latest messages shown

### 5. Bidirectional Scrolling
- **Setup**: Auto-jumped to first unread in middle of channel or DM history
- **Expected**: Can scroll up/down, auto-scroll disabled, "Jump to Present" button appears
- **Verify**: Scrolling works smoothly, auto-scroll resumes at present

---

## Performance

**Initial Load:**
- Best case: ~100-200ms (first unread in recent 100)
- Average case: ~500ms-1s (database query + cache update)
- Worst case: ~2-3s (slow device, large channel/DM history)

**Message Count:**
- Loads 81 messages (40 + 1 + 40)
- Same as hash navigation
- Sufficient context without memory overhead

---

## Code References

**Modified Files:**
- `src/components/message/MessageList.tsx:69,111,330-356,360-362` - Added `scrollToMessageId` prop and scroll logic
- `src/components/space/Channel.tsx:119-122,344-422,920` - Auto-jump logic and state (Channels)
- `src/components/direct/DirectMessage.tsx:66,82,338-460,719` - Auto-jump logic and state (Direct Messages)
- `src/hooks/business/conversations/useDirectMessagesList.ts:14,36,113` - Added `hasNextPage` support for DMs

**Shared Utilities:**
- `src/hooks/queries/messages/loadMessagesAround.ts` - Bidirectional loading (see hash navigation doc)
- `src/db/messages.ts:1560-1603` - `getFirstUnreadMessage()` query
- `src/hooks/business/messages/useMessageHighlight.ts` - `scrollToMessage()` helper

---

## Related Documentation

- [hash-navigation-to-old-messages.md](./hash-navigation-to-old-messages.md) - Shared bidirectional loading infrastructure
- `.agents/bugs/auto-jump-unread-virtuoso-scroll-conflict.md` - Previous failed attempts and lessons learned

---

## Design Decisions

**Why No Flash Highlight?**
The unread line indicator (provided by `lastReadTimestamp`) already shows which messages are unread. Adding a flash highlight would be redundant and potentially confusing.

**Why 40 Messages Before/After?**
Same as hash navigation. Provides sufficient context for users to understand conversation flow while keeping memory usage reasonable.

**Why Skip When Hash Present?**
Hash navigation is explicit user intent (clicked a link). Auto-jump is convenience feature. Explicit intent wins.

**Why Reuse Hash Navigation Pattern?**
The hash navigation pattern was proven to work with Virtuoso's scroll system. Previous attempts to implement auto-jump failed due to scroll timing issues. Reusing the working pattern ensures reliability.

---

*Last updated: 2025-11-13*
*Verified: 2025-12-09 - File paths and architecture confirmed current*
