# DM Unread Indicators - Exclude Current User's Messages

**Status**: 📋 Planned
**Priority**: Medium
**Type**: UX Enhancement
**Related**: [unread-message-indicators.md](../docs/features/unread-message-indicators.md)

---

## Problem

Currently, DM conversations can show as "unread" even when the only new messages are from the current user themselves. This happens because:

1. **conversation.timestamp** updates with EVERY message (including user's own messages)
2. **lastReadTimestamp** updates every 2 seconds based on visible messages
3. **Race condition window (~0-2 seconds):** Between sending a message and the next read-time update, the DM shows as "unread"

**Additional edge cases:**
- User sends a message and immediately navigates away (before 2-second interval)
- User sends a message from Device A, then views DM list on Device B → shows as "unread"
- Quick replies or automated messages

**Current behavior:**
```typescript
// DirectMessageContactsList.tsx:57
unread={(c.lastReadTimestamp ?? 0) < c.timestamp}

// useDirectMessageUnreadCount.ts:37-38
const isUnread = (conversation.lastReadTimestamp ?? 0) < conversation.timestamp;
```

This simple timestamp comparison doesn't distinguish between messages from the current user vs. the other party.

---

## Related Fix

We recently fixed the same issue for the **New Messages Separator** in DMs:
- Commit: `a129d925` - "fix: exclude own messages from DM unread count"
- File: `src/components/direct/DirectMessage.tsx:390-395, 437-442`
- Solution: Filter by `m.content.senderId !== currentUserId`

This ensures the separator only counts messages from the other party, providing better UX for 1-on-1 conversations.

---

## Proposed Solution (Option 2 - Recommended)

### Filter by `senderId` in unread logic

**Conceptual approach:**
Instead of simple timestamp comparison, check if there are unread messages **from someone else**.

**Implementation plan:**

### 1. Add Database Method (src/db/messages.ts)

```typescript
/**
 * Get the first unread message with sender information
 * Used for checking if there are unread messages from other users (not from self)
 */
async getFirstUnreadMessageWithSender({
  spaceId,
  channelId,
  afterTimestamp,
}: {
  spaceId: string;
  channelId: string;
  afterTimestamp: number;
}): Promise<{ messageId: string; timestamp: number; senderId: string } | null> {
  // Similar to getFirstUnreadMessage but also returns senderId
  // Uses existing 'by_conversation_time' index
  // Returns first unread message with sender info
}
```

### 2. Update useDirectMessageUnreadCount Hook

```typescript
// src/hooks/business/messages/useDirectMessageUnreadCount.ts

export function useDirectMessageUnreadCount(): number {
  const user = usePasskeysContext();
  const userAddress = user.currentPasskeyInfo?.address;
  const { data: conversations } = useConversations({ type: 'direct' });
  const { messageDB } = useMessageDB();

  const { data } = useQuery({
    queryKey: ['unread-counts', 'direct-messages', userAddress],
    queryFn: async () => {
      let unreadCount = 0;

      for (const conversation of conversationsList) {
        const lastReadTimestamp = conversation.lastReadTimestamp ?? 0;

        // Quick timestamp check first (optimization)
        if (lastReadTimestamp >= conversation.timestamp) {
          continue; // No unread messages at all
        }

        // Check if first unread message is from someone else
        const firstUnread = await messageDB.getFirstUnreadMessageWithSender({
          spaceId: conversation.address,
          channelId: conversation.address,
          afterTimestamp: lastReadTimestamp,
        });

        if (firstUnread && firstUnread.senderId !== userAddress) {
          unreadCount++;
        }
      }

      return unreadCount;
    },
    // ... rest of config
  });
}
```

### 3. Update DirectMessageContactsList Component

**Option A:** Create a hook for individual contact unread status:
```typescript
// src/hooks/business/messages/useDirectMessageContactUnread.ts
export function useDirectMessageContactUnread({
  conversationAddress,
  conversationTimestamp,
  lastReadTimestamp,
}): boolean {
  // Returns true only if first unread message is from other party
}
```

**Option B:** Compute unread status in parent and pass down as prop (simpler, but less granular caching)

---

## Alternative Solutions Considered

### Option 1: Immediate updateReadTime after sending message

**Pros:**
- Simple, minimal code change
- Fixes the race condition window

**Cons:**
- ❌ Doesn't fix cross-device scenario
- ❌ Band-aid solution - still updating read time for our own messages
- Adds extra database writes

### Option 3: Update conversation.timestamp only for received messages

**Pros:**
- Clean at data model level
- No filtering needed in UI layer

**Cons:**
- ❌ Major architectural change
- ❌ Breaks existing assumptions about conversation ordering (most recent activity)
- ❌ Could break other features depending on timestamp
- Much higher risk

---

## Why Option 2 is Best

1. **Conceptual correctness**: Matches the UX principle - "your own messages aren't new/unread to you"
2. **Consistency**: Same approach as the new messages separator fix
3. **Cross-device correctness**: Works properly even when messages are sent from different devices
4. **Low risk**: Minimal changes, doesn't affect data model or other features
5. **Performance**: Acceptable - only fetches first unread message (early exit), uses existing index

**Trade-offs:**
- Need to fetch message data (not just compare timestamps)
- Slightly more complex than simple timestamp comparison
- Additional database queries (but optimized with early exit)

---

## ⚠️ Important Notes

**BEFORE IMPLEMENTING:** We should analyze the current system more thoroughly to understand:

1. **Performance implications:**
   - How many DM conversations does a typical user have?
   - What's the impact of fetching first unread message for each conversation?
   - Can we batch these queries or optimize further?

2. **Edge cases:**
   - What happens with group DMs (if they exist or are planned)?
   - How does this interact with conversation sorting?
   - Are there other places that depend on the simple timestamp comparison?

3. **User experience:**
   - Is the current behavior actually causing user complaints?
   - What's the frequency of the race condition in real usage?
   - Could we solve this with a simpler approach (e.g., just Option 1 for local device)?

4. **Code complexity:**
   - Is the added complexity worth the UX improvement?
   - Are there simpler alternatives we haven't considered?
   - Should we handle individual contact indicators differently than the count?

**Recommendation:** Create a spike/investigation task first to:
- Measure the actual impact of the current behavior
- Profile performance with the proposed solution
- Review all code that depends on conversation timestamps
- Consider if a hybrid approach (Option 1 + 2) might be simpler

---

## Files to Modify

### Core Changes
- `src/db/messages.ts` - Add `getFirstUnreadMessageWithSender()` method
- `src/hooks/business/messages/useDirectMessageUnreadCount.ts` - Update to filter by sender
- `src/components/direct/DirectMessageContactsList.tsx` - Update unread prop logic

### Documentation
- `.agents/docs/features/unread-message-indicators.md` - Document sender filtering for DMs
- Add performance notes and edge case handling

---

## Testing Considerations

1. **Basic functionality:**
   - Send message in DM → should NOT show as unread
   - Receive message in DM → should show as unread
   - Read messages → unread indicator disappears

2. **Cross-device:**
   - Send from Device A → Device B should not show as unread
   - Receive on Device A → Device B should show as unread

3. **Performance:**
   - Test with 50+ DM conversations
   - Measure query time for unread calculation
   - Check cache invalidation works correctly

4. **Edge cases:**
   - Empty conversations
   - Conversations with only user's messages
   - Very old lastReadTimestamp values

---

## Related Documentation

- [New Messages Separator](../docs/features/messages/new-messages-separator.md) - Uses sender filtering (already implemented)
- [Unread Message Indicators](../docs/features/unread-message-indicators.md) - Current timestamp-based approach
- [Direct Message Unread Count Task](../tasks/.done/unify-unread-indicators-channels-dms.md) - Original unification task

---

*Created: 2025-11-13*
*Note: Analysis and planning phase - do not implement without further investigation*
