---
type: bug
title: 'Bug: Auto-jump to First Unread Breaks Initial Message Sync'
status: archived
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Bug: Auto-jump to First Unread Breaks Initial Message Sync

**Status:** 🔴 Critical - Affects core messaging functionality
**Created:** 2025-11-11
**Commit Range:** `e617d63f` (working) → `a63f609f` (broken)

---

## Summary

When User B enters a channel where User A has posted multiple messages in a row, User B only sees the first message initially. On each refresh, one additional message appears, requiring multiple refreshes to see all messages. This regression was introduced by the auto-jump-to-first-unread feature implementation.

---

## Reproduction Steps

1. **Setup:** User A posts multiple messages in a channel (e.g., 5 messages in a row)
2. **Action:** User B opens/enters that channel for the first time
3. **Expected:** User B should see all messages from User A
4. **Actual:** User B only sees the first message
5. **Workaround:** Each refresh loads one more message until all are visible

---

## Root Cause Analysis

The bug is in `buildMessagesFetcher.ts` where we determine the initial cursor for loading messages:

```typescript
// buildMessagesFetcher.ts:64-70
if (!cursor) {
  effectiveCursor = await determineInitialCursor({
    messageDB,
    spaceId,
    channelId,
  });
}
```

### The Problem Flow

1. **Initial Load:** When User B first enters the channel:
   - `lastReadTimestamp = 0` (never read before)
   - `getFirstUnreadMessage()` returns the FIRST message from User A
   - We set `cursor = firstUnread.timestamp + 1`

2. **Wrong Behavior:** In `getMessages()` (lines 256-278 in `messages.ts`):

   ```typescript
   if (!cursor) {
     // Initial load - get latest messages (✅ this works)
     range = IDBKeyRange.bound(
       [spaceId, channelId, 0],
       [spaceId, channelId, Number.MAX_VALUE]
     );
   } else {
     // Get messages older than cursor (❌ this is triggered!)
     range = IDBKeyRange.bound(
       [spaceId, channelId, 0],
       [spaceId, channelId, cursor],
       false,
       true // exclude the cursor value itself
     );
   }
   ```

3. **The Issue:**
   - Because `cursor` is now set (to `firstUnread.timestamp + 1`), we take the `else` branch
   - This gets messages OLDER than the cursor (backward direction)
   - With `limit = 100`, we get UP TO 100 messages older than the first unread
   - But if there are NO messages older (User A's first message IS the first), we get an empty or partial result
   - The cursor logic is designed for PAGINATION, not for JUMPING to a specific point

4. **Why Refresh Helps:**
   - After the first load, React Query caches the initial message
   - On refresh, the query re-runs with a different state
   - Eventually, through pagination or state changes, more messages load

---

## Technical Details

### Key Files Affected

- `src/hooks/queries/messages/buildMessagesFetcher.ts:62-70`
- `src/db/messages.ts:233-324` (`getMessages` method)
- `src/db/messages.ts:1520-1573` (`getFirstUnreadMessage` method - NEW)

### Why It Worked at e617d63f

At the older commit, there was NO auto-jump logic. The fetcher always started with:

```typescript
cursor: cursor?.cursor; // undefined on initial load
```

This triggered the "Initial load - get latest messages" path in `getMessages()`, which correctly loads the most recent 100 messages.

### The Conceptual Flaw

The auto-jump feature assumes we can "jump" to a timestamp and load messages around it. However, `getMessages()` is designed as a **unidirectional paginator**:

- **No cursor:** Load from the end (latest messages), go backward
- **With cursor + backward:** Load messages OLDER than cursor
- **With cursor + forward:** Load messages NEWER than cursor

There's no mode for "load messages AROUND this cursor" which is what auto-jump needs.

---

## Proposed Solutions

### Option 1: Load in Two Phases (Recommended)

When jumping to first unread:

1. Load messages NEWER than firstUnread (forward direction)
2. Also load messages OLDER than firstUnread (backward direction)
3. Combine both sets

```typescript
// Pseudo-code
if (jumpingToUnread) {
  const newer = await getMessages({
    cursor: firstUnread.timestamp,
    direction: 'forward',
  });
  const older = await getMessages({
    cursor: firstUnread.timestamp,
    direction: 'backward',
  });
  return { messages: [...older.messages, ...newer.messages] };
}
```

### Option 2: Change Initial Direction

When jumping to first unread, load in FORWARD direction from that point:

```typescript
async function determineInitialCursor() {
  // ... existing logic ...
  return firstUnread
    ? {
        cursor: firstUnread.timestamp,
        direction: 'forward' as const,
      }
    : null;
}
```

Then in the fetcher, use this direction for initial load.

### Option 3: Extend getMessages API

Add a new mode to `getMessages()` for "center loading":

```typescript
getMessages({
  cursor,
  direction: 'center', // NEW: load around this point
  limit: 100, // 50 before, 50 after
});
```

This would require modifying the core `getMessages` implementation in `messages.ts`.

---

## Impact Assessment

- **Severity:** Critical - breaks basic message viewing
- **Affected Users:** Any user viewing a channel with unread messages
- **Data Loss:** No data loss, but poor UX
- **Performance:** No performance impact beyond the bug itself

---

## Testing Notes

To test the fix:

1. Reset User B's read state for a channel (or use incognito)
2. Have User A post 5+ messages rapidly
3. User B opens the channel
4. Verify ALL messages from User A are visible immediately
5. Test with various scenarios:
   - First time entering a channel
   - Returning to a channel with unreads
   - Channel with hash navigation (#msg-xxx)
   - Channel with no unreads

---

## Related Code

**Commits in question:**

- `e617d63f`: Add XSS prevention (working state)
- `a63f609f`: WIP: Auto-jump to first unread (broken state)

**Key methods:**

- `buildMessagesFetcher` (src/hooks/queries/messages/buildMessagesFetcher.ts)
- `determineInitialCursor` (same file, NEW)
- `getMessages` (src/db/messages.ts:233)
- `getFirstUnreadMessage` (src/db/messages.ts:1520, NEW)

---

## Questions for Discussion

1. **What is the desired behavior?** When jumping to first unread:
   - Should we show messages AROUND the unread (context)?
   - Or start FROM the unread and load newer messages?
   - Or load ALL messages up to the unread?

2. **How does this interact with pagination?**
   - After jumping, how should "load more" behave?
   - Should we load older messages or just newer ones?

3. **Mobile considerations:**
   - Does this affect mobile differently?
   - Is the pagination logic the same on React Native?

---

## Temporary Workaround

Disable the auto-jump feature by reverting the changes in `buildMessagesFetcher.ts`:

```typescript
const buildMessagesFetcher = ({ messageDB, spaceId, channelId }) =>
  wrapPaginatedFetcher(async ({ pageParam: cursor }) => {
    const response = await messageDB.getMessages({
      spaceId,
      channelId,
      cursor: cursor?.cursor, // Restore original behavior
      direction: cursor?.direction,
    });
    return response;
  });
```

---

**Next Steps:**

1. Decide on desired UX behavior (see questions above)
2. Choose implementation approach (Option 1, 2, or 3)
3. Implement fix with comprehensive tests
4. Test across different scenarios (see Testing Notes)
