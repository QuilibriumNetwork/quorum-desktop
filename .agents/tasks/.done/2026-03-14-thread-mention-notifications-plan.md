# Thread Mention Notifications — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make @mentions and reply notifications work inside threads — showing them in the Notification Panel, persisting until the user opens that thread, and navigating directly into the thread on click.

**Architecture:** Add a `thread_read_times` IndexedDB store (DB v11) for per-thread read tracking. Switch `useAllMentions` from `getMessages()` to `getUnreadMentions()` to include thread replies. Add thread-aware unread filtering to all 6 notification hooks. Add thread breadcrumb UI and fix navigation.

**Tech Stack:** React, TypeScript, IndexedDB, React Query, SCSS

**Spec:** `.agents/tasks/2026-03-14-thread-mention-notifications.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/db/messages.ts` | DB v11 migration + 4 new thread read time methods |
| `src/hooks/business/conversations/useUpdateThreadReadTime.ts` | **New.** Mutation hook for saving thread read time + cache invalidation |
| `src/hooks/business/mentions/useAllMentions.ts` | Switch to `getUnreadMentions()`, add thread-aware unread check |
| `src/hooks/business/mentions/useChannelMentionCounts.ts` | Add thread-aware unread check |
| `src/hooks/business/mentions/useSpaceMentionCounts.ts` | Add thread-aware unread check |
| `src/hooks/business/replies/useAllReplies.ts` | Add thread-aware unread check |
| `src/hooks/business/replies/useReplyNotificationCounts.ts` | Add thread-aware unread check |
| `src/hooks/business/replies/useSpaceReplyCounts.ts` | Add thread-aware unread check |
| `src/components/notifications/NotificationPanel.tsx` | Fix `handleNavigate` signature, thread-aware "Mark All as Read" |
| `src/components/notifications/NotificationItem.tsx` | Thread breadcrumb (`channel › Thread`) |
| `src/components/notifications/NotificationItem.scss` | Breadcrumb styling |
| `src/components/thread/ThreadPanel.tsx` | Save thread read time on 2s interval |
| `src/components/navbar/NavMenu.tsx` | Thread-aware "Mark All as Read" in space context menu |
| `src/hooks/index.ts` | Re-export new hook (if needed) |

---

## Chunk 1: Database Layer

### Task 1: DB Migration v11 — `thread_read_times` Store

**Files:**
- Modify: `src/db/messages.ts:144` (DB_VERSION), `src/db/messages.ts:282-287` (migration block)

- [ ] **Step 1: Bump DB_VERSION from 10 to 11**

In `src/db/messages.ts`, change line 144:

```typescript
private readonly DB_VERSION = 11;
```

- [ ] **Step 2: Add v11 migration block**

After the `if (event.oldVersion < 10)` block (line 287), add:

```typescript
if (event.oldVersion < 11) {
  const threadReadTimesStore = db.createObjectStore('thread_read_times', {
    keyPath: 'threadId',
  });
  threadReadTimesStore.createIndex('by_channel', ['spaceId', 'channelId']);
}
```

This follows the exact same pattern as the v10 `channel_threads` migration above it.

- [ ] **Step 3: Commit**

```bash
git add src/db/messages.ts
git commit -m "feat: add thread_read_times IndexedDB store (v11 migration)"
```

---

### Task 2: DB Methods — Thread Read Time CRUD

**Files:**
- Modify: `src/db/messages.ts` (add methods after the `deleteChannelThread` method, around line 680)

- [ ] **Step 1: Add `saveThreadReadTime` method**

```typescript
/**
 * Save or update thread read time.
 * Used when user opens a thread panel (2s delay) or marks all as read.
 */
async saveThreadReadTime({
  threadId,
  spaceId,
  channelId,
  lastReadTimestamp,
}: {
  threadId: string;
  spaceId: string;
  channelId: string;
  lastReadTimestamp: number;
}): Promise<void> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('thread_read_times', 'readwrite');
    const store = transaction.objectStore('thread_read_times');
    const request = store.put({ threadId, spaceId, channelId, lastReadTimestamp });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 2: Add `getThreadReadTime` method**

```typescript
/**
 * Get read time for a single thread.
 */
async getThreadReadTime(threadId: string): Promise<{ threadId: string; spaceId: string; channelId: string; lastReadTimestamp: number } | undefined> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('thread_read_times', 'readonly');
    const store = transaction.objectStore('thread_read_times');
    const request = store.get(threadId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 3: Add `getThreadReadTimesForChannel` method**

```typescript
/**
 * Get all thread read times for a channel.
 * Returns a map of threadId → lastReadTimestamp for efficient lookup.
 * Uses the by_channel compound index.
 */
async getThreadReadTimesForChannel({
  spaceId,
  channelId,
}: {
  spaceId: string;
  channelId: string;
}): Promise<Record<string, number>> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('thread_read_times', 'readonly');
    const store = transaction.objectStore('thread_read_times');
    const index = store.index('by_channel');
    const range = IDBKeyRange.only([spaceId, channelId]);
    const request = index.getAll(range);
    request.onsuccess = () => {
      const map: Record<string, number> = {};
      for (const entry of request.result) {
        map[entry.threadId] = entry.lastReadTimestamp;
      }
      resolve(map);
    };
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 4: Add `bulkSaveThreadReadTimes` method**

```typescript
/**
 * Save thread read times in bulk (for "Mark All as Read").
 * Uses a single transaction for efficiency.
 */
async bulkSaveThreadReadTimes(
  entries: Array<{ threadId: string; spaceId: string; channelId: string; lastReadTimestamp: number }>
): Promise<void> {
  if (entries.length === 0) return;
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('thread_read_times', 'readwrite');
    const store = transaction.objectStore('thread_read_times');
    for (const entry of entries) {
      store.put(entry);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/db/messages.ts
git commit -m "feat: add thread read time CRUD methods"
```

---

### Task 3: `useUpdateThreadReadTime` Mutation Hook

**Files:**
- Create: `src/hooks/business/conversations/useUpdateThreadReadTime.ts`

- [ ] **Step 1: Create the hook file**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface UseUpdateThreadReadTimeProps {
  spaceId: string;
}

/**
 * Mutation hook to update thread read time with proper cache invalidation.
 *
 * Saves thread read time to IndexedDB, then invalidates all notification
 * caches so counts and panels reflect the change.
 *
 * @example
 * const { mutate: updateThreadReadTime } = useUpdateThreadReadTime({ spaceId });
 * updateThreadReadTime({ threadId, channelId, timestamp: Date.now() });
 */
export function useUpdateThreadReadTime({ spaceId }: UseUpdateThreadReadTimeProps) {
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      channelId,
      timestamp,
    }: {
      threadId: string;
      channelId: string;
      timestamp: number;
    }) => {
      await messageDB.saveThreadReadTime({
        threadId,
        spaceId,
        channelId,
        lastReadTimestamp: timestamp,
      });
      return timestamp;
    },
    onSuccess: () => {
      // Invalidate all notification caches (same set as useUpdateReadTime)
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['mention-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['reply-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'space'] });
    },
    onError: (error) => {
      console.error('[useUpdateThreadReadTime] Failed to update thread read time:', error);
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/business/conversations/useUpdateThreadReadTime.ts
git commit -m "feat: add useUpdateThreadReadTime mutation hook"
```

---

## Chunk 2: Thread-Aware Notification Hooks

All 6 notification hooks need the same change: fetch thread read times for the channel, then for each message, check if it's a thread reply and compare against the thread read time instead of the channel read time.

The pattern is identical across all hooks. For each channel being processed:

```typescript
// Fetch thread read times for this channel (one DB call)
const threadReadTimes = await messageDB.getThreadReadTimesForChannel({ spaceId, channelId });

// Then for each message, determine if it's unread:
// If thread reply → check thread read time
// If regular message → check channel lastReadTimestamp (existing behavior)
```

### Task 4: `useAllMentions` — Switch to `getUnreadMentions()` + Thread-Aware Check

**Files:**
- Modify: `src/hooks/business/mentions/useAllMentions.ts`

- [ ] **Step 1: Replace `getMessages()` with `getUnreadMentions()`**

Replace the current message fetching block (lines 100-105):

```typescript
// Get all messages after last read (up to 10k for safety)
const { messages } = await messageDB.getMessages({
  spaceId,
  channelId,
  limit: 10000,
});
```

with:

```typescript
// Fetch thread read times for this channel
const threadReadTimes = await messageDB.getThreadReadTimesForChannel({
  spaceId,
  channelId,
});

// Use optimized query that returns messages with mentions
// (includes thread replies, unlike getMessages which filters them)
const messages = await messageDB.getUnreadMentions({
  spaceId,
  channelId,
  afterTimestamp: lastReadTimestamp,
  limit: 1000,
});
```

- [ ] **Step 2: Update the unread filter to be thread-aware**

Replace the unread mention filter block (lines 113-121):

```typescript
// Filter messages that mention the user and are unread
const unreadMentions = messages.filter((message: Message) => {
  if (message.createdDate <= lastReadTimestamp) return false;

  return isMentionedWithSettings(message, {
    userAddress,
    enabledTypes: typesToCheck,
    userRoles: userRoleIds,
  });
});
```

with:

```typescript
// Filter messages that mention the user and are unread
// Thread replies check against thread read time, not channel read time
const unreadMentions = messages.filter((message: Message) => {
  // Determine the effective read timestamp for this message
  if (message.isThreadReply && message.threadId) {
    const threadReadTime = threadReadTimes[message.threadId];
    // If thread has been read and message is older, skip it
    if (threadReadTime !== undefined && message.createdDate <= threadReadTime) {
      return false;
    }
    // If no thread read time exists, message is unread (fall through to mention check)
  } else {
    // Regular channel message — use channel read time (already filtered by afterTimestamp)
    if (message.createdDate <= lastReadTimestamp) return false;
  }

  return isMentionedWithSettings(message, {
    userAddress,
    enabledTypes: typesToCheck,
    userRoles: userRoleIds,
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/mentions/useAllMentions.ts
git commit -m "feat: useAllMentions includes thread reply mentions with thread-aware read tracking"
```

---

### Task 5: `useChannelMentionCounts` — Thread-Aware Unread Check

**Files:**
- Modify: `src/hooks/business/mentions/useChannelMentionCounts.ts`

- [ ] **Step 1: Add thread read time fetch before message processing**

After the `lastReadTimestamp` line (line 94), before the `getUnreadMentions` call (line 98), add:

```typescript
// Fetch thread read times for this channel
const threadReadTimes = await messageDB.getThreadReadTimesForChannel({
  spaceId,
  channelId,
});
```

- [ ] **Step 2: Add thread-aware check inside the message loop**

In the `for (const message of messages)` loop (lines 107-121), add the thread check before `isMentionedWithSettings`. Replace:

```typescript
for (const message of messages) {
  // Use settings-aware mention check with unified notification format
  if (isMentionedWithSettings(message, {
    userAddress,
    enabledTypes: mentionTypes,
    userRoles: userRoleIds,
  })) {
```

with:

```typescript
for (const message of messages) {
  // Thread replies: check against thread read time instead of channel read time
  if (message.isThreadReply && message.threadId) {
    const threadReadTime = threadReadTimes[message.threadId];
    if (threadReadTime !== undefined && message.createdDate <= threadReadTime) {
      continue; // Already read in thread
    }
  }

  // Use settings-aware mention check with unified notification format
  if (isMentionedWithSettings(message, {
    userAddress,
    enabledTypes: mentionTypes,
    userRoles: userRoleIds,
  })) {
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/mentions/useChannelMentionCounts.ts
git commit -m "feat: useChannelMentionCounts thread-aware unread check"
```

---

### Task 6: `useSpaceMentionCounts` — Thread-Aware Unread Check

**Files:**
- Modify: `src/hooks/business/mentions/useSpaceMentionCounts.ts`

This hook does its own independent DB queries (does NOT aggregate from channel hooks), so it needs the same thread-aware logic.

- [ ] **Step 1: Add thread read time fetch and thread-aware check**

After the `lastReadTimestamp` line (line 104), before `getUnreadMentions` (line 109), add:

```typescript
// Fetch thread read times for this channel
const threadReadTimes = await messageDB.getThreadReadTimesForChannel({
  spaceId: space.spaceId,
  channelId,
});
```

Then in the `for (const message of messages)` loop (line 117), add the thread check before `isMentionedWithSettings`:

```typescript
for (const message of messages) {
  // Thread replies: check against thread read time
  if (message.isThreadReply && message.threadId) {
    const threadReadTime = threadReadTimes[message.threadId];
    if (threadReadTime !== undefined && message.createdDate <= threadReadTime) {
      continue;
    }
  }

  if (isMentionedWithSettings(message, {
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/business/mentions/useSpaceMentionCounts.ts
git commit -m "feat: useSpaceMentionCounts thread-aware unread check"
```

---

### Task 7: `useAllReplies` — Thread-Aware Unread Check

**Files:**
- Modify: `src/hooks/business/replies/useAllReplies.ts`

- [ ] **Step 1: Add thread read time fetch**

After the `lastReadTimestamp` line (line 91), before `getUnreadReplies` (line 94), add:

```typescript
// Fetch thread read times for this channel
const threadReadTimes = await messageDB.getThreadReadTimesForChannel({
  spaceId,
  channelId,
});
```

- [ ] **Step 2: Filter out already-read thread replies**

After the `getUnreadReplies` call (line 100), filter the results before adding to `allReplies`. Replace the existing `messages.forEach` block (lines 108-115):

```typescript
messages.forEach((message) => {
  allReplies.push({
    message,
    channelId,
    channelName: channel?.channelName || 'Unknown Channel',
    type: 'reply',
  });
});
```

with:

```typescript
messages.forEach((message) => {
  // Thread replies: check against thread read time
  if (message.isThreadReply && message.threadId) {
    const threadReadTime = threadReadTimes[message.threadId];
    if (threadReadTime !== undefined && message.createdDate <= threadReadTime) {
      return; // Already read in thread, skip
    }
  }

  allReplies.push({
    message,
    channelId,
    channelName: channel?.channelName || 'Unknown Channel',
    type: 'reply',
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/replies/useAllReplies.ts
git commit -m "feat: useAllReplies thread-aware unread check"
```

---

### Task 8: `useReplyNotificationCounts` — Thread-Aware Unread Check

**Files:**
- Modify: `src/hooks/business/replies/useReplyNotificationCounts.ts`

- [ ] **Step 1: Add thread read time fetch and filter**

After the `lastReadTimestamp` line (line 85), add:

```typescript
// Fetch thread read times for this channel
const threadReadTimes = await messageDB.getThreadReadTimesForChannel({
  spaceId,
  channelId,
});
```

Then replace the count calculation (line 98):

```typescript
// Count replies (getUnreadReplies already filters by replyMetadata.parentAuthor)
const channelReplyCount = Math.min(messages.length, DISPLAY_THRESHOLD);
```

with:

```typescript
// Count replies, excluding those already read in threads
let channelReplyCount = 0;
for (const message of messages) {
  if (message.isThreadReply && message.threadId) {
    const threadReadTime = threadReadTimes[message.threadId];
    if (threadReadTime !== undefined && message.createdDate <= threadReadTime) {
      continue; // Already read in thread
    }
  }
  channelReplyCount++;
  if (channelReplyCount >= DISPLAY_THRESHOLD) break;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/business/replies/useReplyNotificationCounts.ts
git commit -m "feat: useReplyNotificationCounts thread-aware unread check"
```

---

### Task 9: `useSpaceReplyCounts` — Thread-Aware Unread Check

**Files:**
- Modify: `src/hooks/business/replies/useSpaceReplyCounts.ts`

- [ ] **Step 1: Add thread read time fetch and filter**

After `lastReadTimestamp` (line 92), add:

```typescript
// Fetch thread read times for this channel
const threadReadTimes = await messageDB.getThreadReadTimesForChannel({
  spaceId: space.spaceId,
  channelId,
});
```

Replace the simple length addition (line 105):

```typescript
// Add to space total
spaceTotal += messages.length;
```

with:

```typescript
// Add to space total, excluding thread replies already read
for (const message of messages) {
  if (message.isThreadReply && message.threadId) {
    const threadReadTime = threadReadTimes[message.threadId];
    if (threadReadTime !== undefined && message.createdDate <= threadReadTime) {
      continue;
    }
  }
  spaceTotal++;
  if (spaceTotal >= DISPLAY_THRESHOLD) break;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/business/replies/useSpaceReplyCounts.ts
git commit -m "feat: useSpaceReplyCounts thread-aware unread check"
```

---

## Chunk 3: UI Changes

### Task 10: `NotificationItem` — Thread Breadcrumb

**Files:**
- Modify: `src/components/notifications/NotificationItem.tsx:128-134`
- Modify: `src/components/notifications/NotificationItem.scss`

- [ ] **Step 1: Add thread breadcrumb to the notification header**

In `NotificationItem.tsx`, find the channel name section in the JSX (lines 129-131):

```tsx
<Flex className="notification-meta min-w-0">
  <Icon name="hashtag" className="notification-channel-icon flex-shrink-0" />
  <span className="notification-channel mr-2 truncate-channel-name flex-shrink min-w-0">{channelName}</span>
```

Replace with:

```tsx
<Flex className="notification-meta min-w-0">
  <Icon name="hashtag" className="notification-channel-icon flex-shrink-0" />
  <span className={`notification-channel ${isThread ? '' : 'mr-2'} truncate-channel-name flex-shrink min-w-0`}>{channelName}</span>
  {isThread && (
    <>
      <span className="notification-thread-chevron">›</span>
      <span className="notification-thread-label mr-2">{t`Thread`}</span>
    </>
  )}
```

- [ ] **Step 2: Add the `isThread` variable**

Above the JSX return, after the `notificationIcon` variable (around line 117), add:

```typescript
// Detect if this notification came from a thread
const isThread = !!(message.threadId || message.isThreadReply);
```

- [ ] **Step 3: Add breadcrumb styles to `NotificationItem.scss`**

Add at the end of the file:

```scss
.notification-thread-chevron {
  color: var(--text-3);
  font-size: $text-xs;
  margin: 0 $s-1;
  flex-shrink: 0;
}

.notification-thread-label {
  color: var(--text-3);
  font-size: $text-xs;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/notifications/NotificationItem.tsx src/components/notifications/NotificationItem.scss
git commit -m "feat: add thread breadcrumb indicator to notification items"
```

---

### Task 11: `NotificationPanel` — Fix Navigation + Thread-Aware Mark All as Read

**Files:**
- Modify: `src/components/notifications/NotificationPanel.tsx`

- [ ] **Step 1: Add import for `buildMessageHash`**

Add to the imports at the top of the file:

```typescript
import { buildMessageHash } from '../../utils/messageHashNavigation';
```

- [ ] **Step 2: Fix `handleNavigate` to accept `threadId`**

Replace the `handleNavigate` callback (lines 111-126):

```typescript
const handleNavigate = useCallback((spaceId: string, channelId: string, messageId: string) => {
  // Close the dropdown
  onClose();

  // Navigate with hash - MessageList handles scroll and Message detects hash for highlighting
  navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);

  // Clean up hash after highlight animation completes (8s matches CSS animation)
  setTimeout(() => {
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
  }, 8000);
}, [navigate, onClose]);
```

with:

```typescript
const handleNavigate = useCallback((spaceId: string, channelId: string, messageId: string, threadId?: string) => {
  onClose();

  // buildMessageHash returns #msg-{id} or #thread-{threadId}-msg-{id}
  const hash = buildMessageHash(messageId, threadId);
  navigate(`/spaces/${spaceId}/${channelId}${hash}`);

  // Clean up hash after highlight animation completes (8s matches CSS animation)
  setTimeout(() => {
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
  }, 8000);
}, [navigate, onClose]);
```

- [ ] **Step 3: Update `handleMarkAllRead` to save thread read times**

In the `handleMarkAllRead` callback (lines 129-165), after the existing channel read time loop (`for (const channelId of channelsWithNotifications)`) and before the cache invalidation block, add:

```typescript
// Also save thread read times for all threads in channels that have notifications.
// Uses getChannelThreads (same approach as NavMenu's handleMarkSpaceAsRead)
// to avoid depending on UI-filtered notification data.
const threadEntries: Array<{ threadId: string; spaceId: string; channelId: string; lastReadTimestamp: number }> = [];

for (const channelId of channelsWithNotifications) {
  const threads = await messageDB.getChannelThreads({ spaceId, channelId });
  for (const thread of threads) {
    threadEntries.push({
      threadId: thread.threadId,
      spaceId,
      channelId,
      lastReadTimestamp: now,
    });
  }
}

if (threadEntries.length > 0) {
  await messageDB.bulkSaveThreadReadTimes(threadEntries);
}
```

This uses `getChannelThreads` to discover all threads in affected channels, avoiding the problem of `mentions`/`replies` being filtered by the UI filter state (e.g., if "@everyone" is deselected, those thread mentions would be missed). The same approach is used in NavMenu's `handleMarkSpaceAsRead` (Task 13).

- [ ] **Step 4: Commit**

```bash
git add src/components/notifications/NotificationPanel.tsx
git commit -m "feat: thread-aware navigation and mark-all-as-read in NotificationPanel"
```

---

### Task 12: `ThreadPanel` — Save Thread Read Time on 2s Interval

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`

- [ ] **Step 1: Add imports**

Add to the imports at the top of the file:

```typescript
import { useUpdateThreadReadTime } from '../../hooks/business/conversations/useUpdateThreadReadTime';
```

- [ ] **Step 2: Add read tracking logic**

Inside the `ThreadPanel` component, after the `isClosed` / `canReopen` variables (around line 191), add the read tracking block. This mirrors the pattern from `Channel.tsx` (lines 1225-1262):

```typescript
// Thread read time tracking — same 2s interval pattern as Channel.tsx
const latestThreadTimestampRef = useRef<number>(0);
const lastSavedThreadTimestampRef = useRef<number>(0);

const { mutate: updateThreadReadTime } = useUpdateThreadReadTime({
  spaceId: channelProps?.spaceId || '',
});

// Track latest message timestamp
useEffect(() => {
  if (threadMessages.length > 0) {
    latestThreadTimestampRef.current = Math.max(
      ...threadMessages.map((msg) => msg.createdDate || 0)
    );
  }
}, [threadMessages]);

// Periodic save every 2 seconds
useEffect(() => {
  if (!threadId || !channelProps?.channelId) return;

  const intervalId = setInterval(() => {
    if (
      latestThreadTimestampRef.current > 0 &&
      latestThreadTimestampRef.current > lastSavedThreadTimestampRef.current
    ) {
      updateThreadReadTime({
        threadId,
        channelId: channelProps.channelId,
        timestamp: latestThreadTimestampRef.current,
      });
      lastSavedThreadTimestampRef.current = latestThreadTimestampRef.current;
    }
  }, 2000);

  return () => clearInterval(intervalId);
}, [threadId, channelProps?.channelId, updateThreadReadTime]);

// Save immediately when closing thread (component unmount or thread change)
useEffect(() => {
  const currentThreadId = threadId;
  const currentChannelId = channelProps?.channelId;

  return () => {
    if (
      currentThreadId &&
      currentChannelId &&
      latestThreadTimestampRef.current > lastSavedThreadTimestampRef.current
    ) {
      updateThreadReadTime({
        threadId: currentThreadId,
        channelId: currentChannelId,
        timestamp: latestThreadTimestampRef.current,
      });
    }
  };
}, [threadId, channelProps?.channelId, updateThreadReadTime]);
```

- [ ] **Step 3: Commit**

```bash
git add src/components/thread/ThreadPanel.tsx
git commit -m "feat: save thread read time on 2s interval in ThreadPanel"
```

---

### Task 13: `NavMenu` — Thread-Aware "Mark All as Read"

**Files:**
- Modify: `src/components/navbar/NavMenu.tsx`

- [ ] **Step 1: Update `handleMarkSpaceAsRead` to save thread read times**

In `handleMarkSpaceAsRead` (line 408), after the existing channel read time loop (lines 422-427) and before the cache invalidation block (line 430), add:

```typescript
// Also save thread read times for all threads in this space
// Fetch all thread read times we might need to update
for (const channelId of channelIds) {
  // Get all channel threads to find threadIds
  const threads = await messageDB.getChannelThreads({ spaceId, channelId });
  if (threads.length > 0) {
    await messageDB.bulkSaveThreadReadTimes(
      threads.map((thread) => ({
        threadId: thread.threadId,
        spaceId,
        channelId,
        lastReadTimestamp: now,
      }))
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/navbar/NavMenu.tsx
git commit -m "feat: thread-aware mark-all-as-read in space context menu"
```

---

## Chunk 4: Verification & Documentation

### Task 14: Manual Testing Checklist

- [ ] **Step 1: Verify thread mentions appear in NotificationPanel**

1. Open the app with two accounts (or use two windows)
2. In Account A, create a thread on a message in a channel
3. In Account B, open the same thread and type a message with `@AccountA`
4. In Account A, check the Notification Panel (bell icon) — the mention should appear with `channel › Thread` breadcrumb

- [ ] **Step 2: Verify thread mention notification persists when opening channel**

1. After receiving a thread mention (from step 1), navigate away from the channel
2. Navigate back to the channel — the mention notification should still be in the panel
3. The channel bubble count should still show the thread mention

- [ ] **Step 3: Verify thread mention clears when opening the thread**

1. Click the thread mention in the NotificationPanel — it should navigate to the thread and scroll to the message
2. Wait 2+ seconds in the thread
3. Close the notification panel and reopen — the mention should be gone
4. The channel bubble count should have decremented

- [ ] **Step 4: Verify "Mark All as Read" clears thread mentions**

1. Receive a new thread mention
2. Right-click the space icon → "Mark All as Read"
3. The thread mention should be cleared from the NotificationPanel

- [ ] **Step 5: Verify regular (non-thread) mentions still work**

1. Send a regular @mention in a channel (not in a thread)
2. Confirm it appears in the NotificationPanel as before (no `› Thread` breadcrumb)
3. Confirm clicking it navigates to the message in the channel (not a thread)

### Task 15: Update Documentation

**Files:**
- Modify: `.agents/docs/features/messages/thread-panel.md`
- Modify: `.agents/docs/features/mention-notification-system.md`

- [ ] **Step 1: Update thread-panel.md Known Limitations**

Remove "No thread notifications" from Known Limitations (line 363). Add a brief note about the implemented thread notification behavior in the main doc.

Update the Future Work section to remove the "Thread notifications" item (line 373) since basic thread mention notifications are now implemented. Keep the more advanced items (participation tracking, auto-follow, unread indicators per-thread) as future work if desired.

- [ ] **Step 2: Update mention-notification-system.md**

Add a "Thread Mentions" section documenting:
- Thread reply mentions appear in NotificationPanel with `channel › Thread` breadcrumb
- Per-thread read tracking via `thread_read_times` IndexedDB store
- Thread mentions persist until the thread is opened or "Mark All as Read" is used
- Navigation uses `#thread-{threadId}-msg-{messageId}` hash format

- [ ] **Step 3: Commit**

```bash
git add .agents/docs/features/messages/thread-panel.md .agents/docs/features/mention-notification-system.md
git commit -m "docs: update thread panel and notification docs for thread mention notifications"
```

---

_Created: 2026-03-14_
