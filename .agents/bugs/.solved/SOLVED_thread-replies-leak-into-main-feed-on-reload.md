---
type: bug
title: "Thread replies leak into main chat feed on page reload"
status: solved
priority: high
ai_generated: true
created: 2026-03-09
updated: 2026-03-09
related_tasks: [".agents/tasks/threaded-conversations.md"]
related_docs: [".agents/docs/features/messages/thread-panel.md"]
---

# Thread replies leak into main chat feed on page reload

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

1. **On page reload**: Thread replies briefly flash in the main channel feed, then most disappear after ~1 second. The **last reply persists** in the main feed and does not get filtered out.
2. **On sending new replies**: After the fixes applied in session 1, new replies correctly go only to the thread panel and NOT to the main feed. The reload issue persists.

**Branch**: `feat/message-threads`

## Root Cause — CONFIRMED (Session 2)

**Two functions in `Channel.tsx` bypass the `isThreadReply` filter:**

### Primary: `jumpToFirstUnread` (Channel.tsx:588-670)

The auto-scroll-to-first-unread feature runs on channel entry. The chain of failure:

1. **`getFirstUnreadMessage()` (`messages.ts:2020-2026`)** does NOT skip `isThreadReply` messages. It returns the first message after `lastReadTimestamp` — which can be a thread reply.
2. Since thread replies are correctly filtered from `messageList` by `getMessages()`, the thread reply is NOT in `messageList`, so `isAlreadyLoaded` is `false` (line 605).
3. **`loadMessagesAround()`** is called with the thread reply as the target. It fetches the target via `getMessage()` (no filter) and injects it directly into the results array (line 76).
4. The combined array (clean `getMessages()` results + the unfiltered target message) is set into the React Query cache via `setQueryData` at line 648.
5. **Result**: The thread reply appears in the main feed.

### Secondary: `useUpdateReadTime.ts:43` onSuccess

Calls `invalidateQueries` which triggers a re-fetch from `getMessages()` (which DOES filter correctly). This temporarily cleans the cache. But then `jumpToFirstUnread` may re-inject the thread reply.

### Why "last reply persists"

- The first refetch via `getMessages()` filters out thread replies → most disappear
- But `jumpToFirstUnread` runs after and re-injects the target thread reply → it persists
- The "last" reply persists because it's the most recent = the first unread = the `jumpToFirstUnread` target

### Evidence from console instrumentation

| Log point | Result |
|-----------|--------|
| `[getMessages] THREAD MSG in cursor` | All thread messages have `isThreadReply: true`, all `filtered: true` — IndexedDB filter works correctly |
| `[addMessage] HAS threadId` | Did NOT fire — `addMessage()` is not the leak |
| `[addMessage] BUG: thread message BYPASSED` | Did NOT fire — confirms `addMessage()` is not the path |
| `[ActionQueue:send] success handler` | Did NOT fire — ActionQueue is not involved on reload |
| `[useChannelMessages] THREAD MESSAGES IN MAIN FEED` | FIRED — confirmed thread message in React Query cache |
| Stack trace origin | `jumpToFirstUnread @ Channel.tsx:648` → `setQueryData` directly into messages cache |
| Secondary trigger | `useUpdateReadTime.ts:43` → `invalidateQueries` → refetch (this one actually cleans the cache) |

## Fix Required

Two changes needed:

### Fix 1: `getFirstUnreadMessage` must skip thread replies
**File**: `src/db/messages.ts:2020-2026`

Add `isThreadReply` check to cursor iteration:
```typescript
request.onsuccess = (event) => {
  const cursor = (event.target as IDBRequest).result;
  if (cursor) {
    const message = cursor.value as Message;
    // Skip thread replies — they shouldn't trigger unread navigation
    if (message.isThreadReply) {
      cursor.continue();
      return;
    }
    resolve({ messageId: message.messageId, timestamp: message.createdDate });
  } else {
    resolve(null);
  }
};
```

### Fix 2: `loadMessagesAround` should filter target message
**File**: `src/hooks/queries/messages/loadMessagesAround.ts:40-48,74-78`

The target message fetched via `getMessage()` bypasses the `getMessages()` filter. If the target has `isThreadReply`, it should be excluded or the function should fail gracefully.

### Fix 3 (defense-in-depth): `handleHashMessageNotFound` and `jumpToFirstUnread`
**File**: `src/components/space/Channel.tsx:548,648`

Both functions set raw `loadMessagesAround` results into the React Query cache via `setQueryData` without filtering. Consider filtering `isThreadReply` before calling `setQueryData`.

## Previously Applied Fixes (Session 1)

### 1. ThreadPanel: Show root message in thread list
**File**: `src/components/thread/ThreadPanel.tsx:106-110`
- Prepend root message to thread replies list
- **Status**: Working correctly

### 2. MessageService: Route optimistic thread replies to thread cache
**File**: `src/services/MessageService.ts:4189-4212`
- Thread replies update `['thread-messages', ...]` cache instead of main feed
- **Status**: Working for new sends

### 3. ActionQueueHandlers: Route thread reply success/failure to thread cache
**File**: `src/services/ActionQueueHandlers.ts:415-497` (success) and `518-551` (failure)
- Added `isThreadReply` guard routing to thread cache
- **Status**: Working correctly

## Investigated Paths (All Verified Correct)

| Path | File | Status |
|------|------|--------|
| **Optimistic send** | `MessageService.ts:4189` | ✅ Fixed (session 1) |
| **ActionQueue success** | `ActionQueueHandlers.ts:415-474` | ✅ Fixed (session 1) |
| **ActionQueue failure** | `ActionQueueHandlers.ts:518-529` | ✅ Fixed (session 1) |
| **Incoming message** | `MessageService.ts:1419` | ✅ Correct |
| **IndexedDB getMessages()** | `messages.ts:439` | ✅ Correct (filters isThreadReply) |
| **Server echo on reconnect** | `MessageService.ts:3962` | ✅ Correct (routes through addMessage) |
| **getFirstUnreadMessage()** | `messages.ts:2020` | ❌ **BUG** — does not skip thread replies |
| **loadMessagesAround()** | `loadMessagesAround.ts:40` | ❌ **BUG** — target message bypasses filter |
| **jumpToFirstUnread setQueryData** | `Channel.tsx:648` | ❌ **BUG** — injects unfiltered data into cache |

## Debug Instrumentation (to remove after fix)

Console logs added in this session:
- `src/db/messages.ts:440` — `[getMessages] THREAD MSG in cursor`
- `src/services/MessageService.ts:1420-1422` — `[addMessage] HAS threadId` + trace
- `src/services/MessageService.ts:1543-1546` — `[addMessage] BUG: thread message BYPASSED`
- `src/services/ActionQueueHandlers.ts:416` — `[ActionQueue:send] success handler`
- `src/hooks/business/channels/useChannelMessages.ts:69-72` — `[useChannelMessages] THREAD MESSAGES IN MAIN FEED`

---

_Created: 2026-03-09_
_Updated: 2026-03-09_
