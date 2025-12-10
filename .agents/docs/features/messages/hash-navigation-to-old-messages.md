# Hash Navigation to Old Messages

## Overview

### Problem
Clicking links with `#msg-{messageId}` would silently fail if the target message wasn't in the currently loaded ~100 messages. This affected search results, pinned messages, notifications, and direct URL hashes in both channels and direct messages.

### Solution
Bidirectional message loading automatically fetches messages around the target when clicked. Users can then scroll both directions:
- **Up**: Load older messages (existing behavior)
- **Down**: Load newer messages until reaching present (new)

The system loads 40 messages before + target + 40 messages after, creating an 81-message context window centered on the target.

---

## How It Works

### Navigation Flow
```
1. User clicks link → #msg-{messageId}
2. MessageList searches current messages → Not found
3. Calls onHashMessageNotFound(messageId)
4. Shows loading spinner
5. Queries IndexedDB for target message + surrounding context
6. Updates React Query cache with new page
7. MessageList re-renders → Target found
8. Scrolls to target + highlights
```

### Scrolling Behavior

After jumping to an old message:
- **Manual scrolling works normally** - no auto-scroll interference
- **Scroll up** → `fetchPreviousPage()` loads older messages
- **Scroll down** → `fetchNextPage()` loads newer messages
- **Reach present** → Auto-scroll resumes for real-time messages

Auto-scroll is controlled by two conditions:
```typescript
followOutput={(isAtBottom) => {
  if (hasJumpedToOldMessage) return false;           // Manual pagination mode
  if (isAtBottom && hasNextPage === false) return 'smooth';  // At actual present
  return false;
}}
```

---

## Implementation

### Core Components

**1. Bidirectional Loading Utility** (`src/hooks/queries/messages/loadMessagesAround.ts`)
```typescript
async function loadMessagesAround({
  messageDB, spaceId, channelId, targetMessageId,
  beforeLimit = 40, afterLimit = 40
}): Promise<{
  messages: Message[];
  targetMessage: Message;
  prevCursor: number | null;
  nextCursor: number | null;
}>
```

**2. MessageList Props** (`src/components/message/MessageList.tsx`)
```typescript
interface MessageListProps {
  onHashMessageNotFound?: (messageId: string) => Promise<void>;
  isLoadingHashMessage?: boolean;
  fetchPreviousPage: () => void;
  fetchNextPage: () => void;
  hasNextPage?: boolean;
}
```

**3. Hash Detection Logic** (MessageList.tsx:299-307)
```typescript
if (onHashMessageNotFound && !hasProcessedHash) {
  setHasProcessedHash(true);
  setHasJumpedToOldMessage(true);  // Disable auto-scroll
  onHashMessageNotFound(msgId).catch(console.error);
}
```

**4. Parent Component Handler**

**Channels** (Channel.tsx:292-336) and **Direct Messages** (DirectMessage.tsx:465-507) share identical handler:

```typescript
const handleHashMessageNotFound = useCallback(async (messageId: string) => {
  setIsLoadingHashMessage(true);
  const { messages, prevCursor, nextCursor } = await loadMessagesAround({
    messageDB, spaceId, channelId, targetMessageId: messageId
  });
  queryClient.setQueryData(buildMessagesKey({ spaceId, channelId }), {
    pages: [{ messages, prevCursor, nextCursor }],
    pageParams: [undefined],
  });
  setIsLoadingHashMessage(false);
}, [messageDB, spaceId, channelId, queryClient]);
```

Note: For Direct Messages, both `spaceId` and `channelId` are set to the conversation address.

### State Management

**Jump Flag** - Tracks hash navigation state:
```typescript
const [hasJumpedToOldMessage, setHasJumpedToOldMessage] = useState(false);

// Set on hash navigation
setHasJumpedToOldMessage(true);

// Reset when:
// 1. User reaches present (hasNextPage === false)
// 2. User clicks "Jump to Present" button
// 3. User navigates to different channel/conversation
```

This prevents auto-scroll during manual pagination while allowing it to resume naturally at the present.

---

## Loading Indicator

A centered spinner with "Loading message..." text appears during the async fetch operation:

```typescript
{isLoadingHashMessage && (
  <div className="absolute top-1/2 left-1/2 ...">
    <Spinner />
    <span>Loading message...</span>
  </div>
)}
```

**Why needed**: IndexedDB queries + React Query updates can take 100ms-2s depending on channel size and device performance.

---

## Error Handling

**Message not found**:
```typescript
const targetMessage = await messageDB.getMessage({...});
if (!targetMessage) throw new Error('Message not found');
```
→ Hash removed from URL, loading indicator hidden, user not stuck

**Database errors**: Caught, logged, hash removed to prevent infinite retry

**Network errors**: Same handling (though rare for IndexedDB operations)

---

## Universal Fix

All components using `#msg-{messageId}` benefit automatically in both channels and direct messages:
- ✅ Search results (`SearchResults.tsx`)
- ✅ Pinned messages (`PinnedMessagesPanel.tsx`)
- ✅ Notifications (`NotificationPanel.tsx`)
- ✅ Direct URL hashes (bookmarked/shared links)
- ✅ Future components using this pattern

No changes required in navigation sources - fix is centralized in MessageList and works for both channels and DMs.

---

## Testing Guide

### Key Scenarios

**1. Navigation to Old Messages**
- Search for message from weeks ago in channel/DM → Click result → Should load and scroll
- Click old pinned message → Should load and scroll
- Click notification for old reply/mention in channel/DM → Should load and scroll

**2. Bidirectional Scrolling**
- After jumping to old message:
  - Scroll DOWN manually → Loads progressively to present (NO auto-scroll)
  - Scroll UP → Loads older messages normally
  - Reach present → Auto-scroll resumes for new messages

**3. Recent Messages (Regression)**
- Click hash to recent message → NO loading indicator, immediate scroll
- Verify normal behavior unchanged

**4. Edge Cases**
- Non-existent message ID → Error handling, no infinite loading
- Deleted message → Graceful failure
- Rapid navigation → Last click wins, no conflicts
- Large channels/DM histories (10k+ messages) → Performance acceptable (<2s)

---

## Performance

**Message Loading**: 81 messages (40 + 1 + 40)
- Provides sufficient context
- Allows scrolling in both directions
- Not too many to cause memory issues

**React Query Cache**: Single page centered on target
- Replaces previous pages on hash navigation
- Prevents memory bloat
- Works with existing infinite scroll

**Typical Timing**:
- Best case: 100-300ms
- Average: 500ms-1s
- Worst case: 2-3s (slow device, large channel/DM history)

---

## Code References

**Modified Files**:
- `src/hooks/queries/messages/loadMessagesAround.ts` - New utility
- `src/hooks/business/channels/useChannelMessages.ts:33,155-156` - Added `fetchNextPage`, `hasNextPage` (Channels)
- `src/hooks/business/conversations/useDirectMessagesList.ts:14,36,113` - Added `hasNextPage` (Direct Messages)
- `src/components/space/Channel.tsx:139-140,292-336,838-841` - Handler + props (Channels)
- `src/components/direct/DirectMessage.tsx:75,465-507,722-723` - Handler + props (Direct Messages)
- `src/components/message/MessageList.tsx:45-46,95,121,303,340-344,380-395` - Props, flag, logic

**Key Functions**:
- `loadMessagesAround()` - Bidirectional loading utility
- `handleHashMessageNotFound()` - Channel handler
- `handleBottomStateChange()` - Forward pagination trigger
- `followOutput()` - Auto-scroll control

---

## Related Documentation

- `.agents/bugs/auto-jump-unread-virtuoso-scroll-conflict.md` - Why auto-jump failed (different from hash navigation)
- `.agents/docs/features/search-feature.md` - Search functionality
- `.agents/docs/features/messages/pinned-messages.md` - Pinned messages
- `.agents/docs/features/mention-notification-system.md` - Notifications

---

*Last updated: 2025-11-13*
*Verified: 2025-12-09 - File paths and architecture confirmed current*
