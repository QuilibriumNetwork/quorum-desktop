# Thread-Aware Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable bookmarks, search results, and pinned messages to navigate directly into thread replies by opening the thread panel and scrolling to the target message.

**Architecture:** Extend the existing `#msg-{id}` hash navigation with a compound `#thread-{rootMessageId}-msg-{replyMessageId}` format. A shared `parseMessageHash()` utility parses both formats. Channel.tsx detects thread hashes, fetches the root message by ID, opens the thread panel, and passes a `targetMessageId` through ThreadContext. The thread's MessageList uses its existing `scrollToMessageId` prop to scroll and highlight the target reply. Consumers (bookmarks, search, pins) store/pass the root message ID alongside the thread reply's message ID to build the compound hash.

**Tech Stack:** React, React Router, IndexedDB, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/messageHashNavigation.ts` | **Create** | `parseMessageHash()` + `buildMessageHash()` utilities |
| `src/components/context/ThreadContext.tsx` | **Modify** | Add `targetMessageId` to ThreadState |
| `src/components/space/Channel.tsx` | **Modify** | Thread hash detection → fetch root message → open thread + set targetMessageId; preserve `targetMessageId` in existing state sync useEffect |
| `src/components/thread/ThreadPanel.tsx` | **Modify** | Pass `targetMessageId` as `scrollToMessageId` to MessageList, clear after processing |
| `src/api/quorumApi.ts` | **Modify** | Add `threadRootMessageId?: string` to Bookmark type |
| `src/hooks/business/bookmarks/useBookmarks.ts` | **Modify** | Capture thread root message ID in `createBookmarkFromMessage()` |
| `src/components/bookmarks/BookmarksPanel.tsx` | **Modify** | Build compound hash when bookmark has thread info |
| `src/hooks/business/search/useGlobalSearchNavigation.ts` | **Modify** | Accept + use thread root ID for compound hash |
| `src/hooks/business/search/useSearchResultFormatting.ts` | **Modify** | Pass thread info through `onNavigate` callback |
| `src/components/message/PinnedMessagesPanel.tsx` | **Modify** | Pass thread info to jump handler, build compound hash |

**Note:** No new DB query needed. The hash encodes the root message ID directly, so we can fetch it via the existing `getMessage()` / `getMessageById()`.

---

## Task 1: Hash Parsing & Building Utility

**Files:**
- Create: `src/utils/messageHashNavigation.ts`

- [ ] **Step 1: Create the utility file with types and functions**

```typescript
// src/utils/messageHashNavigation.ts

export type HashTarget =
  | { type: 'message'; messageId: string }
  | { type: 'threadMessage'; rootMessageId: string; messageId: string };

/**
 * Parse a URL hash into a structured navigation target.
 * Supports:
 *   #msg-{messageId}                              → message in main feed
 *   #thread-{rootMessageId}-msg-{messageId}       → message inside a thread
 *
 * The rootMessageId identifies the thread's root message (which has threadMeta).
 * The messageId identifies the specific reply to scroll to within the thread.
 */
export function parseMessageHash(hash: string): HashTarget | null {
  if (!hash || !hash.startsWith('#')) return null;

  // Thread message: #thread-{rootMessageId}-msg-{replyMessageId}
  const threadMatch = hash.match(/^#thread-(.+)-msg-(.+)$/);
  if (threadMatch) {
    return { type: 'threadMessage', rootMessageId: threadMatch[1], messageId: threadMatch[2] };
  }

  // Regular message: #msg-{messageId}
  const msgMatch = hash.match(/^#msg-(.+)$/);
  if (msgMatch) {
    return { type: 'message', messageId: msgMatch[1] };
  }

  return null;
}

/**
 * Build a URL hash for navigating to a message.
 * If rootMessageId is provided, builds a compound thread hash.
 */
export function buildMessageHash(messageId: string, rootMessageId?: string): string {
  if (rootMessageId) {
    return `#thread-${rootMessageId}-msg-${messageId}`;
  }
  return `#msg-${messageId}`;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors related to the new file

- [ ] **Step 3: Commit**

```bash
git add src/utils/messageHashNavigation.ts
git commit -m "feat: add hash parsing utility for thread-aware navigation"
```

---

## Task 2: Extend ThreadContext with `targetMessageId`

**Files:**
- Modify: `src/components/context/ThreadContext.tsx`

The thread panel needs to know which message to scroll to after opening. Add `targetMessageId` to the ThreadState so Channel.tsx can set it and ThreadPanel can consume it.

- [ ] **Step 1: Add `targetMessageId` to ThreadState interface (around line 36)**

Change:
```typescript
interface ThreadState {
  isOpen: boolean;
  threadId: string | null;
  rootMessage: MessageType | null;
  threadMessages: MessageType[];
  isLoading: boolean;
}
```

To:
```typescript
interface ThreadState {
  isOpen: boolean;
  threadId: string | null;
  rootMessage: MessageType | null;
  threadMessages: MessageType[];
  isLoading: boolean;
  targetMessageId: string | null;
}
```

- [ ] **Step 2: Add `targetMessageId` to default state (around line 69)**

Change:
```typescript
const defaultState: ThreadState = {
  isOpen: false,
  threadId: null,
  rootMessage: null,
  threadMessages: [],
  isLoading: false,
};
```

To:
```typescript
const defaultState: ThreadState = {
  isOpen: false,
  threadId: null,
  rootMessage: null,
  threadMessages: [],
  isLoading: false,
  targetMessageId: null,
};
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors (Channel.tsx already spreads ThreadState into the context, so the new field flows through automatically)

- [ ] **Step 4: Commit**

```bash
git add src/components/context/ThreadContext.tsx
git commit -m "feat: add targetMessageId to ThreadContext state"
```

---

## Task 3: Thread Panel Scroll-to-Message

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`

ThreadPanel's MessageList already accepts `scrollToMessageId` but ThreadPanel doesn't pass it. Wire up `targetMessageId` from ThreadContext.

- [ ] **Step 1: Read `targetMessageId` from thread context and pass to MessageList**

In ThreadPanel.tsx, the `useThreadContext()` hook already returns all ThreadState fields (via `...store.getThreadState()`). The `targetMessageId` field added in Task 2 is automatically available.

Find the MessageList render (around line 157) and add the `scrollToMessageId` prop:

Add after `alignToTop={true}` (line 183):
```tsx
            scrollToMessageId={targetMessageId ?? undefined}
```

- [ ] **Step 2: Add effect to clear targetMessageId after scroll processing**

Import `useThreadContextStore` at the top of ThreadPanel.tsx (it's exported from the same module as `useThreadContext`):
```typescript
import { useThreadContext, useThreadContextStore } from '../context/ThreadContext';
```

Add an effect after the existing hooks in ThreadPanel:

```typescript
  // Access store to clear targetMessageId after scroll processing
  const threadStore = useThreadContextStore();

  // Clear targetMessageId after thread messages load and scroll is triggered.
  // MessageList internally tracks "hasProcessedScrollTo" so it only scrolls once per value,
  // but we clear the context to keep state clean.
  useEffect(() => {
    if (targetMessageId && threadMessages.length > 0) {
      // Delay to let MessageList detect and process scrollToMessageId
      const timer = setTimeout(() => {
        const currentState = threadStore.getThreadState();
        if (currentState.targetMessageId) {
          threadStore.setThreadState({ ...currentState, targetMessageId: null });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [targetMessageId, threadMessages.length, threadStore]);
```

Note: 2000ms timeout (not 500ms) to handle cases where thread messages take time to load. This is safe because MessageList's internal `hasProcessedScrollTo` flag prevents double-scrolling regardless.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/thread/ThreadPanel.tsx
git commit -m "feat: wire thread panel scroll-to-message via targetMessageId"
```

---

## Task 4: Channel.tsx Thread Hash Detection

**Files:**
- Modify: `src/components/space/Channel.tsx`

This is the core orchestration: detect `#thread-{rootMessageId}-msg-{replyMessageId}` hashes, open the thread panel, and set `targetMessageId`.

**Critical:** Channel.tsx does NOT use `useLocation()` from React Router. The existing code reads `window.location.hash` directly (line 579). Navigation via `navigate()` causes a route change that remounts the Channel component, so reading `window.location.hash` on mount is sufficient.

- [ ] **Step 1: Import the hash utility**

Add to Channel.tsx imports:
```typescript
import { parseMessageHash } from '../../utils/messageHashNavigation';
```

- [ ] **Step 2: Update the hash detection in the unread-jump useEffect**

At line 579, the current check is:
```typescript
if (window.location.hash.startsWith('#msg-')) {
  return;
}
```

Update to also detect thread hashes:
```typescript
if (window.location.hash.startsWith('#msg-') || window.location.hash.startsWith('#thread-')) {
  return;
}
```

- [ ] **Step 3: Preserve `targetMessageId` in the existing thread state sync useEffect**

Find the existing useEffect that syncs thread state to the context (search for `setThreadState` in Channel.tsx — the effect that calls `threadCtx.setThreadState({...})`). It currently builds a new ThreadState object that does NOT include `targetMessageId`, which would overwrite and lose it every time `activePanel`, `threadMessages`, or `isLoadingThread` changes.

Change the `setThreadState` call from:
```typescript
threadCtx.setThreadState({
  isOpen: activePanel === 'thread',
  threadId: activeThreadId,
  rootMessage: activeThreadRootMessage,
  threadMessages,
  isLoading: isLoadingThread,
});
```

To:
```typescript
threadCtx.setThreadState({
  isOpen: activePanel === 'thread',
  threadId: activeThreadId,
  rootMessage: activeThreadRootMessage,
  threadMessages,
  isLoading: isLoadingThread,
  targetMessageId: threadCtx.getThreadState().targetMessageId ?? null,
});
```

This preserves `targetMessageId` across state syncs until ThreadPanel explicitly clears it.

- [ ] **Step 4: Add thread hash handling useEffect**

Add a new `useEffect` in Channel.tsx (after the existing hash-related logic, around line 574) that handles thread hashes. Since Channel.tsx doesn't use `useLocation()`, the effect runs on mount (when the component is mounted/remounted due to route navigation) and reads `window.location.hash` directly. The `spaceId` and `channelId` dependencies ensure it re-runs if those change.

```typescript
  // Handle thread hash navigation: #thread-{rootMessageId}-msg-{replyMessageId}
  useEffect(() => {
    const hash = window.location.hash;
    const parsed = parseMessageHash(hash);
    if (!parsed || parsed.type !== 'threadMessage') return;

    const { rootMessageId, messageId } = parsed;

    const openThreadFromHash = async () => {
      try {
        // Fetch the root message directly by ID
        const rootMessage = await messageDB.getMessageById(rootMessageId);

        if (!rootMessage || !rootMessage.threadMeta) {
          console.warn('Thread root message not found:', rootMessageId);
          history.replaceState(null, '', window.location.pathname + window.location.search);
          return;
        }

        const threadId = rootMessage.threadMeta.threadId;

        // Check if this thread is already open
        if (activeThreadId === threadId) {
          // Same thread — just set targetMessageId for scroll
          const store = threadContextStore;
          const currentState = store.getThreadState();
          store.setThreadState({ ...currentState, targetMessageId: messageId });
        } else {
          // Different thread or no thread open — open the thread panel
          setActiveThreadId(threadId);
          setActiveThreadRootMessage(rootMessage);
          setActivePanel('thread');

          // Set the target message for scroll-to in the thread panel.
          // Use a microtask delay to ensure the state setters above have been processed
          // by the existing state sync useEffect first.
          queueMicrotask(() => {
            const store = threadContextStore;
            const currentState = store.getThreadState();
            store.setThreadState({ ...currentState, targetMessageId: messageId });
          });
        }

        // Clean up hash after highlight animation
        setTimeout(() => {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }, 8000);
      } catch (error) {
        console.error('Failed to open thread from hash:', error);
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };

    openThreadFromHash();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, channelId]);
```

Note: `threadContextStore` is from the existing `useThreadContextStore()` call in Channel.tsx. `messageDB` is the existing DB instance. `setActiveThreadId`, `setActiveThreadRootMessage`, and `setActivePanel` are the same setters used by `handleOpenThread`. `activeThreadId` is the existing state variable.

The `queueMicrotask` ensures the state sync useEffect (from Step 3) runs with the new `activePanel`/`activeThreadId` before we set `targetMessageId`, preventing the sync from overwriting it with `null`. The sync effect preserves existing `targetMessageId` values (Step 3's change), so once set, it survives subsequent syncs.

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/space/Channel.tsx
git commit -m "feat: handle thread hash navigation in Channel component"
```

---

## Task 5: Bookmark Type + Creation

**Files:**
- Modify: `src/api/quorumApi.ts`
- Modify: `src/hooks/business/bookmarks/useBookmarks.ts`

Bookmarks need to store enough info to build the compound hash. Since the hash format is `#thread-{rootMessageId}-msg-{replyMessageId}`, we need the root message's ID. Thread replies don't directly store the root message ID, but we can derive it: when a message has `threadId` and `isThreadReply`, its thread was started on a root message. However, the simplest approach is to look up which root message started the thread. Actually, we don't have that mapping readily available at bookmark creation time.

**Alternative approach:** Store the `threadId` on the bookmark, and at navigation time, use `threadId` to look up the root message. Wait — that's the approach the reviewer said won't work because root messages aren't in the `by_thread` index.

**Better approach:** The message's `replyMetadata?.parentChannelId` won't help. Let's think about what data IS available on a thread reply: `threadId` and `isThreadReply`. The `threadId` is deterministic: `SHA-256(rootMessageId + ':thread')`. So we can't reverse it to get `rootMessageId`.

**Simplest correct approach:** At bookmark creation time, when the message is a thread reply, we need to find and store the root message ID. We can query `getThreadMessages()` — the root message is the first message in the thread (earliest `createdDate`). But wait, the reviewer said root messages aren't in the `by_thread` index either.

**Actually simplest:** Store both `threadId` on the bookmark, AND add a proper DB query to find the root. The reviewer was wrong about one thing: let me verify whether root messages are indexed under `by_thread`.

The `by_thread` index keys on `[spaceId, channelId, threadId, createdDate]`. Root messages get `threadMeta.threadId` set on them (in `MessageService.ts`), but do they get a top-level `threadId` field? Let me check — `MessageService.ts` line 861: `if (decryptedContent.threadId && !decryptedContent.isThreadReply) { decryptedContent.isThreadReply = true; }` — this sets `isThreadReply` on messages that have `threadId` but not the flag. The root message gets `threadMeta` but NOT `threadId` (only replies get `threadId`). So root messages are NOT in the `by_thread` index. The reviewer was correct.

**Final approach:** The Bookmark needs to store the root message ID directly. At bookmark creation time, we need to find it. Two options:
1. Pass `rootMessageId` into `createBookmarkFromMessage()` from the component that has thread context
2. Add a DB query to find the root message by threadId (scan all messages in the channel)

Option 1 is better. When bookmarking from within the ThreadPanel, the root message is available in `ThreadContext.rootMessage`. When bookmarking from the main feed, thread replies aren't shown there, so this case doesn't arise.

Actually, let me reconsider. Bookmarking happens via `useMessageActions` which is used by `Message.tsx`. In ThreadPanel, `Message.tsx` renders thread replies. The thread's `rootMessage` is available in `ThreadContext`. We need to pass it through.

This is getting complex. Let me simplify: **store `threadId` on the bookmark AND add a simple DB scan query for root message lookup at navigation time**. The scan checks all messages in the channel for `threadMeta.threadId === targetThreadId`. This is infrequent (only on bookmark/pin/search click) and channels have limited messages.

- [ ] **Step 1: Add `threadId` to Bookmark type**

In `src/api/quorumApi.ts`, find the Bookmark type (line 293) and add `threadId`:

After `sourceType: 'channel' | 'dm';` and `createdAt: number;`, add:
```typescript
  threadId?: string;              // Thread ID if bookmarked message is a thread reply
```

- [ ] **Step 2: Capture `threadId` in `createBookmarkFromMessage()`**

In `src/hooks/business/bookmarks/useBookmarks.ts`, find the return statement in `createBookmarkFromMessage()` (line 86) and add `threadId`:

After `createdAt: Date.now(),` add:
```typescript
      threadId: message.threadId,
```

This captures the `threadId` for thread replies. Regular messages don't have `threadId`, so it's `undefined`.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/api/quorumApi.ts src/hooks/business/bookmarks/useBookmarks.ts
git commit -m "feat: capture threadId when creating bookmarks for thread replies"
```

---

## Task 6: Add `getRootMessageByThreadId` DB Query

**Files:**
- Modify: `src/db/messages.ts`

We need to find the root message for a given `threadId` at navigation time. Root messages have `threadMeta.threadId` but NOT a top-level `threadId` field, so they're NOT in the `by_thread` index. We must scan messages in the channel. This is acceptable because it only runs on bookmark/pin/search click (user-initiated, infrequent).

- [ ] **Step 1: Add `getRootMessageByThreadId` method**

Add after `getThreadMessages()` (around line 523) in the `MessageDB` class:

```typescript
  /**
   * Find the root message for a thread by scanning channel messages.
   * Root messages have threadMeta.threadId but NOT a top-level threadId field,
   * so they are NOT in the by_thread index. This scans the by_conversation_time
   * index instead. Only called on user-initiated navigation (bookmark/pin/search click).
   */
  async getRootMessageByThreadId({
    spaceId,
    channelId,
    threadId,
  }: {
    spaceId: string;
    channelId: string;
    threadId: string;
  }): Promise<Message | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      const range = IDBKeyRange.bound(
        [spaceId, channelId, 0],
        [spaceId, channelId, Number.MAX_VALUE]
      );

      const request = index.openCursor(range, 'next');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const message = cursor.value as Message;
          if (message.threadMeta?.threadId === threadId) {
            resolve(message);
            return;
          }
          cursor.continue();
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/db/messages.ts
git commit -m "feat: add getRootMessageByThreadId query for thread navigation"
```

---

## Task 7: BookmarksPanel Thread-Aware Navigation

**Files:**
- Modify: `src/components/bookmarks/BookmarksPanel.tsx`

Bookmarks store `threadId` (from Task 5) but the hash format needs a `rootMessageId`. At navigation time, we need to look up the root message. However, to keep BookmarksPanel simple, we'll take a different approach: **use the threadId directly in the hash**, and have Channel.tsx's hash handler support both formats (rootMessageId lookup via `getMessageById` if it has `threadMeta`, OR `getRootMessageByThreadId` scan if it doesn't).

Actually, let me simplify further. Let's update the hash format to be flexible: `#thread-{identifier}-msg-{messageId}` where `identifier` can be either a root message ID or a thread ID. Channel.tsx tries `getMessageById(identifier)` first — if the result has `threadMeta`, it's a root message ID. If not found or no `threadMeta`, fall back to `getRootMessageByThreadId(identifier)`.

This means:
- Pins and search (which have full Message objects) can pass the root message ID directly if available, or threadId
- Bookmarks (which store threadId) pass threadId
- Channel.tsx handles both transparently

- [ ] **Step 1: Import `buildMessageHash`**

Add to imports:
```typescript
import { buildMessageHash } from '../../utils/messageHashNavigation';
```

- [ ] **Step 2: Update `handleJumpToMessage` to use compound hash**

Change (lines 109-130):
```typescript
  const handleJumpToMessage = useCallback((bookmark: Bookmark) => {
    onClose();

    if (bookmark.sourceType === 'channel') {
      navigate(`/spaces/${bookmark.spaceId}/${bookmark.channelId}#msg-${bookmark.messageId}`);
    } else {
      const dmAddress = bookmark.conversationId?.split('/')[0];
      navigate(`/messages/${dmAddress}#msg-${bookmark.messageId}`);
    }

    setTimeout(() => {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }, 8000);
  }, [navigate, onClose]);
```

To:
```typescript
  const handleJumpToMessage = useCallback((bookmark: Bookmark) => {
    onClose();

    const hash = buildMessageHash(bookmark.messageId, bookmark.threadId);

    if (bookmark.sourceType === 'channel') {
      navigate(`/spaces/${bookmark.spaceId}/${bookmark.channelId}${hash}`);
    } else {
      const dmAddress = bookmark.conversationId?.split('/')[0];
      navigate(`/messages/${dmAddress}${hash}`);
    }

    setTimeout(() => {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }, 8000);
  }, [navigate, onClose]);
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/bookmarks/BookmarksPanel.tsx
git commit -m "feat: bookmark navigation uses compound hash for thread replies"
```

---

## Task 8: Update Channel.tsx Hash Handler for Flexible Identifier

**Files:**
- Modify: `src/components/space/Channel.tsx`

Update the thread hash handler from Task 4 to support both root message IDs and thread IDs as the identifier in `#thread-{identifier}-msg-{messageId}`.

- [ ] **Step 1: Update the hash handler's root message lookup**

Replace the root message lookup in the `openThreadFromHash` async function (from Task 4 Step 4) with flexible resolution:

```typescript
    const openThreadFromHash = async () => {
      try {
        const { rootMessageId: identifier, messageId } = parsed;

        // Try to fetch as a direct message ID first (pins/search pass root message ID)
        let rootMessage = await messageDB.getMessageById(identifier);
        let threadId: string | undefined;

        if (rootMessage?.threadMeta) {
          // Found root message directly
          threadId = rootMessage.threadMeta.threadId;
        } else {
          // Identifier might be a threadId (bookmarks store threadId)
          rootMessage = await messageDB.getRootMessageByThreadId({
            spaceId,
            channelId,
            threadId: identifier,
          });
          threadId = identifier;
        }

        if (!rootMessage || !threadId) {
          console.warn('Thread not found for identifier:', identifier);
          history.replaceState(null, '', window.location.pathname + window.location.search);
          return;
        }

        // Check if this thread is already open
        if (activeThreadId === threadId) {
          const store = threadContextStore;
          const currentState = store.getThreadState();
          store.setThreadState({ ...currentState, targetMessageId: messageId });
        } else {
          setActiveThreadId(threadId);
          setActiveThreadRootMessage(rootMessage);
          setActivePanel('thread');

          queueMicrotask(() => {
            const store = threadContextStore;
            const currentState = store.getThreadState();
            store.setThreadState({ ...currentState, targetMessageId: messageId });
          });
        }

        setTimeout(() => {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }, 8000);
      } catch (error) {
        console.error('Failed to open thread from hash:', error);
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/space/Channel.tsx
git commit -m "feat: support both rootMessageId and threadId in thread hash"
```

---

## Task 9: Search Navigation Thread-Aware

**Files:**
- Modify: `src/hooks/business/search/useGlobalSearchNavigation.ts`
- Modify: `src/hooks/business/search/useSearchResultFormatting.ts`

Search results have the full `Message` object which contains `threadId`. We pass it through to `buildMessageHash`.

- [ ] **Step 1: Update `useGlobalSearchNavigation` to accept `threadId`**

Change the full file:

```typescript
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildMessageHash } from '../../../utils/messageHashNavigation';

export interface UseGlobalSearchNavigationReturn {
  handleNavigate: (
    spaceId: string,
    channelId: string,
    messageId: string,
    threadId?: string
  ) => void;
}

/**
 * Handles navigation logic for global search results.
 * Uses hash-based highlighting for cross-component communication.
 * Thread replies use compound hash: #thread-{threadId}-msg-{messageId}
 */
export const useGlobalSearchNavigation =
  (): UseGlobalSearchNavigationReturn => {
    const navigate = useNavigate();

    const handleNavigate = useCallback(
      (spaceId: string, channelId: string, messageId: string, threadId?: string) => {
        const isDM = spaceId === channelId;
        const hash = buildMessageHash(messageId, threadId);

        if (isDM) {
          navigate(`/messages/${spaceId}${hash}`);
        } else {
          navigate(`/spaces/${spaceId}/${channelId}${hash}`);
        }

        setTimeout(() => {
          history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        }, 8000);
      },
      [navigate]
    );

    return {
      handleNavigate,
    };
  };

// TODO: Create native version at useGlobalSearchNavigation.native.ts
```

- [ ] **Step 2: Update `useSearchResultFormatting` to pass `threadId`**

In `src/hooks/business/search/useSearchResultFormatting.ts`:

Update `UseSearchResultFormattingProps` interface (line 6) — add optional `threadId` to `onNavigate`:
```typescript
export interface UseSearchResultFormattingProps {
  message: Message;
  onNavigate: (spaceId: string, channelId: string, messageId: string, threadId?: string) => void;
  compactDate?: boolean;
}
```

Update `handleClick` callback (line 40) — pass `message.threadId`:
```typescript
  const handleClick = useCallback(() => {
    onNavigate(message.spaceId, message.channelId, message.messageId, message.threadId);
  }, [message.spaceId, message.channelId, message.messageId, message.threadId, onNavigate]);
```

- [ ] **Step 3: Update caller prop types**

Check `SearchResultItem.tsx`, `SearchResults.tsx`, and `NotificationItem.tsx` for `onNavigate` prop type declarations. If they explicitly type `onNavigate` as a 3-argument function, add the optional 4th `threadId` parameter:

```typescript
onNavigate: (spaceId: string, channelId: string, messageId: string, threadId?: string) => void;
```

TypeScript allows passing a 3-arg function where a 4-arg (with optional last) is expected, but explicit type annotations in prop interfaces should match for clarity.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/business/search/useGlobalSearchNavigation.ts src/hooks/business/search/useSearchResultFormatting.ts
git commit -m "feat: search navigation uses compound hash for thread replies"
```

If caller prop types were also updated:
```bash
git add src/components/search/SearchResultItem.tsx src/components/search/SearchResults.tsx src/components/notifications/NotificationItem.tsx
git commit --amend --no-edit
```

---

## Task 10: Pinned Messages Thread-Aware Navigation

**Files:**
- Modify: `src/components/message/PinnedMessagesPanel.tsx`

Pinned messages have the full `Message` object which contains `threadId`. Pass it through to `handleJumpToMessage`.

- [ ] **Step 1: Import `buildMessageHash`**

Add to imports:
```typescript
import { buildMessageHash } from '../../utils/messageHashNavigation';
```

- [ ] **Step 2: Update `PinnedMessageItem` to pass `threadId`**

Update `PinnedMessageItem` props type (line 38):
```typescript
  onJumpToMessage: (messageId: string, threadId?: string) => void;
```

Update the click handler in `PinnedMessageItem` (line 87):
```typescript
  onClick={() => onJumpToMessage(message.messageId, message.threadId)}
```

- [ ] **Step 3: Update `handleJumpToMessage` to build compound hash**

Change (lines 152-172):
```typescript
  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      onClose();

      const currentPath = window.location.pathname;
      navigate(`${currentPath}#msg-${messageId}`);

      setTimeout(() => {
        history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }, 8000);
    },
    [navigate, onClose]
  );
```

To:
```typescript
  const handleJumpToMessage = useCallback(
    (messageId: string, threadId?: string) => {
      onClose();

      const currentPath = window.location.pathname;
      const hash = buildMessageHash(messageId, threadId);
      navigate(`${currentPath}${hash}`);

      setTimeout(() => {
        history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }, 8000);
    },
    [navigate, onClose]
  );
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/message/PinnedMessagesPanel.tsx
git commit -m "feat: pinned messages navigation uses compound hash for thread replies"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `yarn lint`
Expected: No new errors

- [ ] **Step 3: Run build**

Run: `yarn build`
Expected: Build succeeds

- [ ] **Step 4: Manual testing checklist**

Test the following scenarios:
1. Bookmark a thread reply → click bookmark → thread opens, scrolls to reply
2. Pin a thread reply → click "Jump" in pins panel → thread opens, scrolls to reply
3. Search finds a thread reply → click result → thread opens, scrolls to reply
4. Bookmark a regular (non-thread) message → click bookmark → scrolls to message in main feed (unchanged behavior)
5. Navigate to `#thread-{id}-msg-{id}` URL directly in browser → thread opens
6. Cross-space: bookmark thread reply in Space A, navigate from Space B → correct space + thread opens
7. Same thread already open → scrolls to message without re-opening
8. Different thread open → replaces with correct thread
9. Existing bookmarks (without threadId) → still navigate to channel (graceful degradation)

---

_Created: 2026-03-10_
