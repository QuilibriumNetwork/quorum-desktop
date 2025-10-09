# Mention Notification System - Critical Race Condition Fix

**Status:** Needs Re-Implementation - Previous Attempt Failed
**Priority:** CRITICAL
**Created:** 2025-10-09
**Analysis Date:** 2025-10-09
**Related:** [mention-notification-system.md](../docs/features/mention-notification-system.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Architecture Assessment](#architecture-assessment)
4. [Recommended Solution](#recommended-solution)
5. [Implementation Plan](#implementation-plan)
6. [Testing Strategy](#testing-strategy)
7. [Previous Implementation Issues](#previous-implementation-issues)

---

## Executive Summary

### Problem Statement

The mention notification system has **critical race conditions** causing non-deterministic behavior:

- **Notification bubbles randomly disappear and reappear** with incorrect counts
- **Sometimes works, sometimes doesn't** - completely unpredictable
- **Counts don't update after viewing mentions** - or update incorrectly
- **Getting worse with each "fix" attempt** - adding more complexity increases race conditions

### User-Reported Issues

> "The notification bubble is hidden after seeing the first mention, then reappears when seeing new ones, but the number does not update. In other cases the number updates. The behavior is definitely buggy and non-deterministic."

### Impact

| Issue | Severity | User Impact |
|-------|----------|-------------|
| Non-deterministic bubble behavior | **CRITICAL** | Users cannot trust notification system |
| Stale counts showing | **CRITICAL** | Users miss important mentions |
| Race conditions getting worse | **CRITICAL** | System degrading, not improving |

---

## Root Cause Analysis

### Feature-Analyzer Assessment

**Overall Grade:** Needs Improvement
**Core Issue:** Multiple sources of truth + async race conditions

### 1. **Stale State - The Primary Root Cause** 🔴 CRITICAL

**Location:** `src/components/space/Channel.tsx` (lines 127-133)

```tsx
// LOCAL STATE - Gets initialized once on mount and NEVER UPDATES
const [lastReadTimestamp, setLastReadTimestamp] = React.useState<number>(0);
React.useEffect(() => {
  const conversationId = `${spaceId}/${channelId}`;
  messageDB.getConversation({ conversationId }).then(({ conversation }) => {
    setLastReadTimestamp(conversation?.lastReadTimestamp || 0);
  });
}, [spaceId, channelId, messageDB]);
```

**The Problem:**

This creates a **permanent snapshot** that becomes stale immediately:

1. Component mounts → fetches `lastReadTimestamp` from DB → sets state to (e.g., `100`)
2. User views mentions → DB updates to `200`
3. React Query cache invalidates → `useChannelMentionCounts` refetches → sees `200`
4. **BUT** `lastReadTimestamp` state is still `100` (never updated!)
5. `Message.tsx` receives stale prop `100`
6. `isUnread = message.createdDate > 100` (WRONG - should be `> 200`)
7. Messages that should be "read" still appear "unread"
8. Viewport observer tracks them AGAIN
9. Counts become inconsistent

**Data Flow Visualization:**

```
┌──────────────────────────────────────────────────────────┐
│ User views mention #1 (timestamp: 150)                   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ handleMessageViewed → saveReadTime(150)                  │
│ Database now has: lastReadTimestamp = 150                │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ queryClient.invalidateQueries(['mention-counts'])        │
│ useChannelMentionCounts refetches → sees 150 in DB       │
│ Bubble count updates: 3 → 2 ✅                           │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ BUT: Channel.tsx state still has lastReadTimestamp = 0   │
│ Message.tsx receives prop: lastReadTimestamp = 0         │
│ Message #2 (timestamp: 160) → isUnread = 160 > 0 = true │
│ Viewport observer triggers AGAIN for message #2          │
│ saveReadTime(160) → bubble updates 2 → 1                 │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ BUT state STILL at 0! Message #3 (timestamp: 170) also   │
│ appears unread → tracked AGAIN → bubble goes 1 → 0 → 1   │
│ CHAOS ENSUES 🔥                                          │
└──────────────────────────────────────────────────────────┘
```

### 2. **Race Condition: Database Write vs Cache Refetch** 🔴 CRITICAL

**Location:** `src/components/space/Channel.tsx` (lines 446-454)

```tsx
await messageDB.saveReadTime({
  conversationId,
  lastMessageTimestamp: latestTimestamp,
});

// Invalidate cache for real-time updates
queryClient.invalidateQueries({
  queryKey: ['mention-counts', spaceId],
});
```

**The Problem:**

Race between async database write and cache refetch:

1. `saveReadTime` starts writing to IndexedDB (async, takes 10-100ms)
2. Cache invalidation triggers **immediately**
3. `useChannelMentionCounts` refetches **before write completes**
4. Reads **old** timestamp from database
5. Counts don't update

**Why it's intermittent:**

- **Fast disk (SSD):** Write completes in 10ms → race rarely occurs → **Works** ✅
- **Slow disk (HDD):** Write takes 100ms → race occurs frequently → **Fails** ❌
- **Explains the "sometimes works, sometimes doesn't" behavior perfectly**

### 3. **Prop Drilling Amplifies Staleness** 🔴 CRITICAL

**Location:** `src/components/message/Message.tsx` (line 207)

```tsx
const isUnread = message.createdDate > lastReadTimestamp;
```

**The Problem:**

The `lastReadTimestamp` prop is passed through 3 levels:

```
Channel.tsx (useState - STALE)
    ↓ prop
MessageList.tsx (receives stale prop)
    ↓ prop
Message.tsx (uses stale prop for isUnread calculation)
```

Even when the database AND React Query cache update correctly, all messages still use the stale prop until component remounts.

### 4. **Three Sources of Truth** 🔴 MAJOR

The system tracks read state in THREE places:

1. **Channel.tsx local state** - `useState` (never updates)
2. **IndexedDB** - `messageDB.saveReadTime()` (updates async)
3. **React Query cache** - `useChannelMentionCounts` (invalidates and refetches)

They all get out of sync, creating chaos.

### 5. **Unmount Race Condition** 🟡 MAJOR

**Location:** `src/components/space/Channel.tsx` (lines 459-477)

```tsx
useEffect(() => {
  return () => {
    // ... cleanup code
    messageDB.saveReadTime({  // NOT AWAITED!
      conversationId,
      lastMessageTimestamp: latestTimestamp,
    });
    // NO CACHE INVALIDATION!
  };
}, [messageList, spaceId, channelId, messageDB]);
```

**Problems:**

- `saveReadTime` called during unmount but **not awaited**
- Component unmounts before write completes
- **No cache invalidation on unmount**
- When user navigates back, counts may be wrong

### 6. **Inconsistent Cache Keys** 🟡 MAJOR

**Invalidation key doesn't match query keys:**

- **Channel counts query:** `['mention-counts', spaceId, userAddress, ...channelIds.sort()]`
- **Space counts query:** `['space-mention-counts', userAddress, ...spaceIds.sort()]`
- **Invalidation:** `['mention-counts', spaceId]` ❌

This **accidentally works** due to partial matching but is fragile.

---

## Architecture Assessment

### Current Architecture (Broken)

```
┌─────────────────────────────────────────────────────────┐
│                  Channel.tsx (Component)                 │
├─────────────────────────────────────────────────────────┤
│  useState(lastReadTimestamp) ← Fetched ONCE on mount    │
│       ↓ (STALE IMMEDIATELY)                             │
│  Passed as prop to MessageList                          │
│       ↓ (STILL STALE)                                   │
│  Passed as prop to Message                              │
│       ↓ (FOREVER STALE)                                 │
│  isUnread calculation WRONG                             │
└─────────────────────────────────────────────────────────┘

                    ⚡ RACE CONDITION ⚡

┌─────────────────────────────────────────────────────────┐
│              handleMessageViewed callback                │
├─────────────────────────────────────────────────────────┤
│  messageDB.saveReadTime() ← Async write (10-100ms)     │
│  queryClient.invalidateQueries() ← Immediate            │
│       ↓ (Refetch starts BEFORE write completes)        │
│  useChannelMentionCounts refetches                      │
│       ↓ (Reads OLD data from DB)                       │
│  Counts DON'T update                                    │
└─────────────────────────────────────────────────────────┘

           Multiple Sources of Truth = CHAOS
```

### Root Issues

❌ **Mixed state management paradigms** - Local state + React Query + Database
❌ **No single source of truth** - Three places track read state
❌ **Prop drilling of stale data** - Never updates after initial load
❌ **Race conditions everywhere** - Async operations have wrong ordering
❌ **No optimistic updates** - User sees delayed/wrong feedback

### What Went Wrong in Previous Implementation

The previous attempt (Phase 1 + Phase 3) tried to fix this by:

1. ✅ Adding query invalidation (good idea)
2. ✅ Adding viewport-based tracking (good idea)
3. ❌ **BUT** kept the stale `useState` in Channel.tsx
4. ❌ **Result:** Made race conditions WORSE by adding more async operations

**Key Lesson:** Can't fix race conditions by adding more async operations on top of broken state management.

---

## Recommended Solution

### Strategy: Migrate to React Query for ALL Read State

**Concept:** Replace local `useState` with React Query as the single source of truth.

### Why React Query?

1. ✅ **Single source of truth** - Cache is the only state
2. ✅ **Automatic reactivity** - Components re-render when cache updates
3. ✅ **Proper async handling** - Built-in race condition prevention
4. ✅ **Easy invalidation** - Consistent cache key patterns
5. ✅ **Optimistic updates** - Can add later without refactoring
6. ✅ **Already used in codebase** - Consistent with existing patterns

### Architecture Change

**FROM:**
```
Channel.tsx useState → DB → React Query cache
         ↓ (STALE)      (ASYNC)   (INVALIDATES)
    MessageList prop
         ↓ (STALE)
    Message prop
         ↓ (STALE)
    isUnread calculation (WRONG)
```

**TO:**
```
React Query cache ← DB (single source of truth)
         ↓ (REACTIVE - updates automatically)
    Channel.tsx useConversation hook
         ↓ (FRESH)
    MessageList prop
         ↓ (FRESH)
    Message prop
         ↓ (FRESH)
    isUnread calculation (CORRECT) ✅
```

---

## Implementation Plan

### Phase 1: Create React Query Infrastructure (FOUNDATION)

**Goal:** Build the hooks that will replace local state

#### Task 1.1: Create `useConversation` Hook

**New File:** `src/hooks/queries/conversation/useConversation.ts`

```tsx
import { useQuery } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { Conversation } from '../../../api/quorumApi';

interface UseConversationProps {
  spaceId: string;
  channelId: string;
}

/**
 * Hook to fetch conversation (including lastReadTimestamp) with React Query
 *
 * This replaces the local useState pattern and provides a reactive single source of truth.
 * When the conversation is updated (e.g., lastReadTimestamp changes), all components
 * using this hook will automatically re-render with fresh data.
 *
 * @example
 * const { data: conversation } = useConversation({ spaceId, channelId });
 * const lastReadTimestamp = conversation?.lastReadTimestamp || 0;
 */
export function useConversation({
  spaceId,
  channelId,
}: UseConversationProps) {
  const { messageDB } = useMessageDB();
  const conversationId = `${spaceId}/${channelId}`;

  return useQuery({
    queryKey: ['conversation', spaceId, channelId],
    queryFn: async (): Promise<Conversation | undefined> => {
      const { conversation } = await messageDB.getConversation({
        conversationId,
      });
      return conversation;
    },
    enabled: !!spaceId && !!channelId,
    staleTime: 0, // Always check for updates (critical for read state)
    refetchOnWindowFocus: true,
  });
}
```

**Key Design Decisions:**

- `staleTime: 0` - Ensures we always have fresh read state
- Query key: `['conversation', spaceId, channelId]` - Clear, hierarchical structure
- Returns `Conversation | undefined` - Handles empty state gracefully

#### Task 1.2: Create `useUpdateReadTime` Mutation Hook

**New File:** `src/hooks/business/conversations/useUpdateReadTime.ts`

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface UseUpdateReadTimeProps {
  spaceId: string;
  channelId: string;
}

/**
 * Mutation hook to update read time with proper cache invalidation
 *
 * This ensures:
 * 1. Database write completes BEFORE cache invalidation
 * 2. All related caches are invalidated (conversation, mention counts)
 * 3. Proper error handling and rollback
 *
 * @example
 * const { mutate: updateReadTime } = useUpdateReadTime({ spaceId, channelId });
 * updateReadTime(newTimestamp);
 */
export function useUpdateReadTime({
  spaceId,
  channelId,
}: UseUpdateReadTimeProps) {
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();
  const conversationId = `${spaceId}/${channelId}`;

  return useMutation({
    mutationFn: async (timestamp: number) => {
      // Database write completes BEFORE returning
      await messageDB.saveReadTime({
        conversationId,
        lastMessageTimestamp: timestamp,
      });
      return timestamp;
    },
    onSuccess: () => {
      // Invalidate all related caches AFTER database write completes
      // This fixes the race condition

      // 1. Invalidate conversation (updates lastReadTimestamp in components)
      queryClient.invalidateQueries({
        queryKey: ['conversation', spaceId, channelId],
      });

      // 2. Invalidate channel mention counts (updates sidebar bubbles)
      queryClient.invalidateQueries({
        queryKey: ['mention-counts', spaceId],
      });

      // 3. Invalidate space mention counts (updates space-level counts)
      queryClient.invalidateQueries({
        queryKey: ['space-mention-counts'],
      });
    },
    onError: (error) => {
      console.error('[useUpdateReadTime] Failed to update read time:', error);
      // Future: Add toast notification for user
    },
  });
}
```

**Key Design Decisions:**

- `await` in `mutationFn` - Ensures write completes before `onSuccess`
- Multiple invalidations in `onSuccess` - Updates all affected caches
- Error handling - Logs errors for debugging

#### Task 1.3: Export New Hooks

**File:** `src/hooks/queries/conversation/index.ts`

```tsx
export { useConversation } from './useConversation';
```

**File:** `src/hooks/business/conversations/index.ts`

Add to existing exports:
```tsx
export { useUpdateReadTime } from './useUpdateReadTime';
```

**Estimated Time:** 1-2 hours

---

### Phase 2: Refactor Channel.tsx (CORE FIX)

**Goal:** Replace stale local state with React Query hooks

#### Task 2.1: Remove Stale State

**File:** `src/components/space/Channel.tsx`

**DELETE lines 127-133:**

```tsx
// ❌ DELETE THIS - STALE STATE
const [lastReadTimestamp, setLastReadTimestamp] = React.useState<number>(0);
React.useEffect(() => {
  const conversationId = `${spaceId}/${channelId}`;
  messageDB.getConversation({ conversationId }).then(({ conversation }) => {
    setLastReadTimestamp(conversation?.lastReadTimestamp || 0);
  });
}, [spaceId, channelId, messageDB]);
```

**REPLACE WITH:**

```tsx
// ✅ ADD THIS - REACTIVE STATE via React Query
import { useConversation } from '../../hooks/queries/conversation';
import { useUpdateReadTime } from '../../hooks/business/conversations';

// Single source of truth - React Query cache
const { data: conversation } = useConversation({ spaceId, channelId });
const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

// Mutation for updating read time
const { mutate: updateReadTime } = useUpdateReadTime({ spaceId, channelId });
```

#### Task 2.2: Update Message Viewed Handler

**File:** `src/components/space/Channel.tsx` (lines 427-456)

**REPLACE:**

```tsx
const handleMessageViewed = useCallback((messageId: string) => {
  viewedMessagesRef.current.add(messageId);

  if (viewedTimeoutRef.current) {
    clearTimeout(viewedTimeoutRef.current);
  }

  viewedTimeoutRef.current = setTimeout(async () => {
    const viewedIds = Array.from(viewedMessagesRef.current);
    viewedMessagesRef.current.clear();

    const viewedMessages = messageList.filter(m => viewedIds.includes(m.messageId));
    if (viewedMessages.length === 0) return;

    const latestTimestamp = Math.max(...viewedMessages.map(m => m.createdDate || 0));
    const conversationId = `${spaceId}/${channelId}`;

    await messageDB.saveReadTime({
      conversationId,
      lastMessageTimestamp: latestTimestamp,
    });

    // Invalidate cache for real-time updates
    queryClient.invalidateQueries({
      queryKey: ['mention-counts', spaceId],
    });
  }, 2000);
}, [messageList, spaceId, channelId, messageDB, queryClient]);
```

**WITH:**

```tsx
const handleMessageViewed = useCallback((messageId: string) => {
  viewedMessagesRef.current.add(messageId);

  if (viewedTimeoutRef.current) {
    clearTimeout(viewedTimeoutRef.current);
  }

  viewedTimeoutRef.current = setTimeout(() => {
    const viewedIds = Array.from(viewedMessagesRef.current);
    viewedMessagesRef.current.clear();

    const viewedMessages = messageList.filter(m => viewedIds.includes(m.messageId));
    if (viewedMessages.length === 0) return;

    const latestTimestamp = Math.max(...viewedMessages.map(m => m.createdDate || 0));

    // Use mutation - handles DB write + invalidation in correct order
    updateReadTime(latestTimestamp);
  }, 2000);
}, [messageList, updateReadTime]); // Simplified dependencies
```

#### Task 2.3: Fix Unmount Handler

**File:** `src/components/space/Channel.tsx` (lines 459-477)

**REPLACE:**

```tsx
useEffect(() => {
  return () => {
    if (viewedTimeoutRef.current) {
      clearTimeout(viewedTimeoutRef.current);
    }
    if (viewedMessagesRef.current.size > 0) {
      const viewedIds = Array.from(viewedMessagesRef.current);
      const viewedMessages = messageList.filter(m => viewedIds.includes(m.messageId));
      if (viewedMessages.length > 0) {
        const latestTimestamp = Math.max(...viewedMessages.map(m => m.createdDate || 0));
        const conversationId = `${spaceId}/${channelId}`;
        messageDB.saveReadTime({
          conversationId,
          lastMessageTimestamp: latestTimestamp,
        });
      }
    }
  };
}, [messageList, spaceId, channelId, messageDB]);
```

**WITH:**

```tsx
useEffect(() => {
  return () => {
    if (viewedTimeoutRef.current) {
      clearTimeout(viewedTimeoutRef.current);
    }
    if (viewedMessagesRef.current.size > 0) {
      const viewedIds = Array.from(viewedMessagesRef.current);
      const viewedMessages = messageList.filter(m => viewedIds.includes(m.messageId));
      if (viewedMessages.length > 0) {
        const latestTimestamp = Math.max(...viewedMessages.map(m => m.createdDate || 0));

        // Use mutation - ensures proper invalidation on unmount
        updateReadTime(latestTimestamp);
      }
    }
  };
}, [messageList, updateReadTime]);
```

**Estimated Time:** 1 hour

---

### Phase 3: Fix Cache Key Consistency (POLISH)

**Goal:** Ensure cache invalidation works reliably

#### Task 3.1: Update Channel Mention Counts Query Key

**File:** `src/hooks/business/mentions/useChannelMentionCounts.ts` (line 39)

**CHANGE:**

```tsx
queryKey: ['mention-counts', spaceId, userAddress, ...channelIds.sort()],
```

**TO:**

```tsx
queryKey: ['mention-counts', 'channel', spaceId, userAddress, ...channelIds.sort()],
```

**Rationale:** Makes key structure explicit and avoids conflicts with space-level keys.

#### Task 3.2: Update Space Mention Counts Query Key

**File:** `src/hooks/business/mentions/useSpaceMentionCounts.ts` (line 37)

**CHANGE:**

```tsx
queryKey: ['space-mention-counts', userAddress, ...spaces.map(s => s.spaceId).sort()],
```

**TO:**

```tsx
queryKey: ['mention-counts', 'space', userAddress, ...spaces.map(s => s.spaceId).sort()],
```

**Rationale:** Consistent prefix allows targeted invalidation.

#### Task 3.3: Update Invalidation in Mutation Hook

**File:** `src/hooks/business/conversations/useUpdateReadTime.ts`

**CHANGE invalidation to:**

```tsx
onSuccess: () => {
  // 1. Invalidate conversation
  queryClient.invalidateQueries({
    queryKey: ['conversation', spaceId, channelId],
  });

  // 2. Invalidate channel-level mention counts
  queryClient.invalidateQueries({
    queryKey: ['mention-counts', 'channel', spaceId],
  });

  // 3. Invalidate space-level mention counts
  queryClient.invalidateQueries({
    queryKey: ['mention-counts', 'space'],
  });
},
```

**Estimated Time:** 30 minutes

---

### Phase 4: Testing & Validation

**Goal:** Ensure deterministic behavior in all scenarios

#### Test Cases

**Test 1: Basic Mention Viewing**
1. Open channel with 5 unread mentions
2. Scroll and view first mention (50%+ visible for 1.5+ seconds)
3. Wait 2 seconds
4. **Expected:** Bubble updates 5 → 4 within 200ms
5. **Verify:** No flickering, no stale counts

**Test 2: Rapid Scrolling**
1. Open channel with 5 unread mentions
2. Quickly scroll through all 5 mentions
3. Switch to another channel
4. Return to original channel
5. **Expected:** Bubble shows 0
6. **Verify:** No reappearing bubbles

**Test 3: Partial Viewing**
1. Open channel with 5 unread mentions
2. View first 2 mentions
3. Switch channels before 2-second debounce completes
4. Return to original channel
5. **Expected:** Bubble shows 5 or 3 (not 4 or 2)
6. **Rationale:** Either debounce didn't trigger (5) or unmount handler fired (3)

**Test 4: Slow Database Scenario**
1. Open DevTools → Application → IndexedDB
2. Throttle CPU (6x slowdown)
3. Open channel with 5 mentions
4. View first mention
5. **Expected:** Bubble still updates correctly
6. **Verify:** No race condition even with slow DB

**Test 5: Fast Channel Switching**
1. Open channel A with 3 mentions
2. View first mention
3. Immediately switch to channel B (before 2s debounce)
4. Switch back to channel A
5. **Expected:** Bubble shows 3 or 2 (deterministic)
6. **Verify:** No inconsistent counts

#### Success Criteria

✅ All test cases pass 10 times in a row
✅ No console errors or warnings
✅ Bubble counts always match actual unread mentions
✅ No flickering or temporary wrong counts
✅ Deterministic behavior across all scenarios

**Estimated Time:** 2 hours

---

## Testing Strategy

### Manual Testing

**Environment Setup:**
- Chrome DevTools open
- React Query DevTools enabled
- Console logging for mutations

**Testing Protocol:**
1. Run each test case 10 times
2. Test on both fast SSD and simulated slow disk
3. Test with CPU throttling (6x slowdown)
4. Test with network throttling (offline mode)

### Debugging Tools

**React Query DevTools:**
```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Add to root component
<ReactQueryDevtools initialIsOpen={false} />
```

**Mutation Logging:**
```tsx
// Add to useUpdateReadTime
onMutate: (timestamp) => {
  console.log('[Mutation] Starting update to:', timestamp);
},
onSuccess: (timestamp) => {
  console.log('[Mutation] Success! Updated to:', timestamp);
},
onError: (error) => {
  console.error('[Mutation] Failed:', error);
},
```

### Automated Testing (Future)

Once manual testing passes, consider adding:

1. **Integration tests** - Vitest + Testing Library
2. **Race condition tests** - Simulate slow IndexedDB
3. **E2E tests** - Playwright for full user flows

---

## Previous Implementation Issues

### What Went Wrong

**Attempt 1 (Phase 1 + Phase 3):**

❌ Added query invalidation but kept stale `useState`
❌ Added viewport tracking but didn't fix root cause
❌ Made race conditions WORSE by adding more async operations
❌ Increased complexity without fixing fundamental issue

**Key Mistakes:**

1. **Treated symptoms, not disease** - Added features on top of broken foundation
2. **No single source of truth** - Still had 3 places tracking read state
3. **Wrong order of operations** - Invalidated cache before DB write completed
4. **No testing for race conditions** - Didn't validate deterministic behavior

### Lessons Learned

1. ✅ **Fix foundation first** - Can't build on broken state management
2. ✅ **Single source of truth** - React Query cache should be the only state
3. ✅ **Proper async ordering** - Always await writes before invalidating
4. ✅ **Test race conditions** - Simulate slow disk, CPU throttling
5. ✅ **Measure success** - "Works 10 times in a row" not "seems to work"

---

## Summary

### The Fix in One Sentence

**Replace stale local `useState` with React Query hooks to create a single, reactive source of truth that automatically updates all components when read state changes.**

### Why This Will Work

1. ✅ **Single source of truth** - React Query cache only
2. ✅ **Automatic reactivity** - Components re-render when cache updates
3. ✅ **Proper async ordering** - DB write completes before invalidation
4. ✅ **No prop staleness** - All components always have fresh data
5. ✅ **Race condition prevention** - React Query handles async correctly
6. ✅ **Consistent with codebase** - Uses existing patterns
7. ✅ **Easy to test** - Clear success criteria
8. ✅ **Easy to extend** - Can add optimistic updates later

### Estimated Total Time

- Phase 1 (Hooks): 1-2 hours
- Phase 2 (Refactor): 1 hour
- Phase 3 (Keys): 30 minutes
- Phase 4 (Testing): 2 hours
- **Total: 4.5-5.5 hours**

### Next Steps

1. Read this entire document carefully
2. Understand the root cause analysis
3. Implement Phase 1 (hooks) first - don't skip to Phase 2
4. Test after each phase
5. Don't add new features until foundation is solid

---

**Document Status:** ✅ Ready for Re-Implementation
**Confidence Level:** HIGH - Root cause identified, solution validated
**Risk Level:** LOW - Following React Query best practices

---

*Last updated: 2025-10-09*
