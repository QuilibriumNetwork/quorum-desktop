---
type: bug
title: DM "Mark All as Read" Context Menu - UI Not Updating Immediately
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# DM "Mark All as Read" Context Menu - UI Not Updating Immediately

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When using the "Mark All as Read" option from the DM SpaceIcon context menu:
1. The NavMenu DM bubble indicator updates correctly (disappears)
2. The `DirectMessageContact` unread indicators (dot + bold text) do NOT update
3. A page refresh is required to see the updated read state in the contacts list

## Technical Analysis

### Data Flow Architecture

```
NavMenu.tsx
  └── useDirectMessageUnreadCount() → fetches from DB directly → works ✅

DirectMessageContactsList.tsx
  └── useConversationPolling()
       └── useConversations({ type: 'direct' })  → useSuspenseInfiniteQuery
            └── Returns { pages: [{ conversations: [...] }] }
                 └── Stored in React Query cache with key ['Conversations', 'direct']
       └── processedConversations = conversations.pages.flatMap(...)
            └── conversationsWithPreviews
                 └── enhancedConversations (useMemo)
                      └── filteredConversations (useMemo)
                           └── DirectMessageContact unread={...} ❌ NOT UPDATING
```

### Key Files Involved

1. **NavMenu.tsx** (`src/components/navbar/NavMenu.tsx`)
   - Contains `handleMarkAllDmsRead` function
   - Calls `messageDB.saveReadTime()` for each unread conversation
   - Attempts optimistic updates via `queryClient.setQueryData()`

2. **useDirectMessageUnreadCount.ts** (`src/hooks/business/messages/useDirectMessageUnreadCount.ts`)
   - Query key: `['unread-counts', 'direct-messages', userAddress]`
   - Now fetches directly from DB (was previously using conversations cache)
   - Works correctly after optimistic update

3. **useConversations.ts** (`src/hooks/queries/conversations/useConversations.ts`)
   - Uses `useSuspenseInfiniteQuery`
   - Query key: `['Conversations', 'direct']`
   - Returns paginated data: `{ pages: [...], pageParams: [...] }`

4. **useConversationPolling.ts** (`src/hooks/business/conversations/useConversationPolling.ts`)
   - Wraps `useConversations`
   - Processes data: `conversations.pages.flatMap(c => c.conversations)`
   - Polls every 2 seconds via `refetchConversations()`

5. **DirectMessageContactsList.tsx** (`src/components/direct/DirectMessageContactsList.tsx`)
   - Uses `useConversationPolling()` for conversation data
   - Passes `unread={(c.lastReadTimestamp ?? 0) < c.timestamp}` to each contact
   - Multiple `useMemo` layers derive the final displayed data

### Debugging Findings

#### Console Logs Show:
```
[DM Mark Read] setQueryData callback, oldData: {pages: Array(1), pageParams: Array(1)}
[DM Mark Read] New data: {pages: Array(1), pageParams: Array(1)}
```

The optimistic update IS being applied to the cache, but the component doesn't re-render.

#### IndexedDB Transaction Timing:
- `saveReadTime()` resolves on `request.onsuccess`
- But IndexedDB transactions commit asynchronously
- First query after save still returns stale data
- Second query (after ~50-100ms) returns correct data

#### React Query Cache Behavior:
- `setQueryData()` updates the cache correctly
- `useSuspenseInfiniteQuery` doesn't always trigger re-render on cache update
- `invalidateQueries({ refetchType: 'none' })` was tried but didn't help
- The 2-second polling in `useConversationPolling` eventually picks up the change

### Attempted Solutions (All Failed for DirectMessageContact)

1. **Cache Invalidation + Refetch**
   ```typescript
   await queryClient.refetchQueries({ queryKey: ['Conversations', 'direct'] });
   ```
   - First refetch returns stale data from IndexedDB
   - Second refetch returns correct data (too late)

2. **Delay Before Refetch**
   ```typescript
   await new Promise(resolve => setTimeout(resolve, 50));
   await queryClient.invalidateQueries({ queryKey: ['Conversations', 'direct'] });
   ```
   - Still returns stale data

3. **Optimistic Update with setQueryData**
   ```typescript
   queryClient.setQueryData(['Conversations', 'direct'], (oldData) => {
     // Update lastReadTimestamp for all conversations
     return { ...oldData, pages: updatedPages };
   });
   ```
   - Cache IS updated (confirmed via logs)
   - Component does NOT re-render

4. **Invalidate with refetchType: 'none'**
   ```typescript
   queryClient.invalidateQueries({
     queryKey: ['Conversations', 'direct'],
     refetchType: 'none',
   });
   ```
   - Should notify subscribers without refetching
   - Did not trigger re-render

## Root Cause

The issue is a combination of:

1. **useSuspenseInfiniteQuery behavior**: This query type may not trigger re-renders when cache is updated via `setQueryData()` in the same way regular queries do.

2. **Multiple derived state layers**: The data flows through multiple `useMemo` transformations:
   - `useConversations` → `useConversationPolling` → `conversationsWithPreviews` → `enhancedConversations` → `filteredConversations`
   - Each layer may have stale closure references

3. **IndexedDB async transaction commit**: The DB transaction commits asynchronously, so immediate reads after writes return stale data.

4. **Polling masks the issue**: The 2-second polling interval in `useConversationPolling` eventually updates the UI, making the issue intermittent in testing.

## Potential Solutions

### Option A: Force Component Re-render
Trigger a state change that forces the entire `DirectMessageContactsList` to re-render with fresh data.

### Option B: Use React Query's `onSuccess` Callback
Instead of optimistic updates, wait for the mutations to complete and use `onSuccess` to invalidate.

### Option C: Lift State Up
Create a React Context that holds the "marked as read" state, update it immediately, and use it in `DirectMessageContact` to override the query-derived unread state.

### Option D: Direct Subscription Pattern
Have `DirectMessageContactsList` subscribe to a "mark all read" event and immediately update its local state.

### Option E: Fix useSuspenseInfiniteQuery Re-render
Research why `useSuspenseInfiniteQuery` doesn't re-render on `setQueryData` and find the correct pattern for infinite queries.

### Option F: Remove Suspense Query
Convert `useConversations` to use regular `useInfiniteQuery` instead of `useSuspenseInfiniteQuery`, which may have better cache update reactivity.

## Files to Modify

- `src/components/navbar/NavMenu.tsx:279-324` - Current handler implementation
- `src/hooks/queries/conversations/useConversations.ts` - Query configuration
- `src/hooks/business/conversations/useConversationPolling.ts` - Data processing
- `src/components/direct/DirectMessageContactsList.tsx:395-410` - Unread prop derivation

## Related Code

### Current handleMarkAllDmsRead (NavMenu.tsx)
```typescript
const handleMarkAllDmsRead = React.useCallback(async () => {
  const now = Date.now();
  const { conversations } = await messageDB.getConversations({ type: 'direct' });

  // Optimistic updates (work for NavMenu, not for DirectMessageContact)
  queryClient.setQueryData(['unread-counts', 'direct-messages', user.currentPasskeyInfo?.address], 0);
  queryClient.setQueryData(['Conversations', 'direct'], (oldData) => {
    // ... update lastReadTimestamp
  });

  // Save to DB
  for (const conv of conversations) {
    if ((conv.lastReadTimestamp ?? 0) < conv.timestamp) {
      await messageDB.saveReadTime({
        conversationId: conv.conversationId,
        lastMessageTimestamp: now,
      });
    }
  }
}, [messageDB, queryClient, user.currentPasskeyInfo?.address]);
```

### Unread Prop in DirectMessageContactsList.tsx
```typescript
<DirectMessageContact
  unread={(c.lastReadTimestamp ?? 0) < c.timestamp && !mutedSet.has(c.conversationId)}
  // ...
/>
```

## Solution Implemented

**Option C: Lift State Up with React Context** was implemented.

### New Files Created
- `src/context/DmReadStateContext.tsx` - Context that holds `markAllReadTimestamp`

### Files Modified
1. **App.tsx** - Added `DmReadStateProvider` to component tree
2. **NavMenu.tsx** - Simplified `handleMarkAllDmsRead` to call `markAllAsRead()` from context
3. **DirectMessageContactsList.tsx** - Uses `markAllReadTimestamp` to override unread calculation
4. **useDirectMessageUnreadCount.ts** - Returns 0 when `markAllReadTimestamp` is set

### How It Works
1. When user clicks "Mark All as Read", `markAllAsRead()` sets `markAllReadTimestamp` to current time
2. Both `DirectMessageContactsList` and `useDirectMessageUnreadCount` check this timestamp
3. If `markAllReadTimestamp` exists, conversations with `lastReadTimestamp < markAllReadTimestamp` are considered read
4. UI updates immediately via React's state-driven re-render
5. DB writes happen in background; the 2-second polling eventually syncs the cached data

### Why This Works
- Context state changes trigger immediate re-renders in all consuming components
- No dependency on React Query cache update behavior with `useSuspenseInfiniteQuery`
- Simple, idiomatic React pattern that works alongside existing caching

## Prevention

- When implementing optimistic updates with `useSuspenseInfiniteQuery`, test that `setQueryData` actually triggers re-renders
- Consider using React Context for immediate UI updates when cache-based optimistic updates fail
- Add integration tests for cache update → UI update flows

---


_Solved: 2026-01-06_
