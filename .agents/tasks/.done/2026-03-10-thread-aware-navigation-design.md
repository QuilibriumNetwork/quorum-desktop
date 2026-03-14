---
type: task
title: "Thread-Aware Navigation for Bookmarks, Search & Pins"
status: pending
priority: high
created: 2026-03-10
tags: [threads, navigation, bookmarks, search, pins]
related_docs:
  - "docs/features/messages/thread-panel.md"
  - "docs/features/messages/bookmarks.md"
  - "docs/features/messages/pinned-messages.md"
---

# Thread-Aware Navigation for Bookmarks, Search & Pins

## Problem

Thread replies are hidden from the main channel feed (filtered at DB cursor, DB unread query, and React hook layers). When bookmarks, search results, or pinned messages point to a thread reply, the current hash-based navigation (`#msg-{messageId}`) navigates to the channel but the message isn't in the main feed — navigation silently fails.

## Design

### Approach: Compound URL Hash

Extend the existing hash navigation with a thread-aware variant. Instead of just `#msg-{messageId}`, thread replies use `#thread-{threadId}-msg-{messageId}`. Channel.tsx detects the compound hash, opens the thread panel, and the thread's MessageList scrolls to the target reply. Discord-style: only the thread panel scrolls, no main feed scroll.

### Hash Format & Parsing

**Current:** `#msg-{messageId}`
**New:** `#thread-{threadId}-msg-{messageId}` (for thread replies)

A `parseMessageHash(hash: string)` utility returns a discriminated union:

```ts
type HashTarget =
  | { type: 'message'; messageId: string }
  | { type: 'threadMessage'; threadId: string; messageId: string }
```

Non-thread hashes (`#msg-{id}`) work exactly as today — zero behavior change.

### Channel.tsx Hash Handler

When Channel.tsx detects a `threadMessage` hash:

1. Fetches the root message from DB (the message whose `threadMeta.threadId` matches the hash's `threadId`)
2. Calls `handleOpenThread(rootMessage)` to open the thread panel
3. Sets `targetMessageId` in ThreadContext for the thread's MessageList to scroll to

### ThreadContext Extension

Add `targetMessageId?: string` to ThreadContext state with a corresponding setter. Channel.tsx sets it when processing a thread hash. ThreadPanel's MessageList reads it, scrolls to + highlights the message, then clears it.

### Consumer Changes

**Bookmarks (`BookmarksPanel.tsx`):**
- Add `threadId?: string` to the `Bookmark` type
- `createBookmarkFromMessage()` captures `message.threadId` when present
- Navigation builds `#thread-{threadId}-msg-{messageId}` when `threadId` exists
- Existing bookmarks without `threadId` fall back to `#msg-{id}` (graceful degradation)

**Search (`useGlobalSearchNavigation.ts`):**
- `SearchResult.message` already contains `threadId` — no type changes
- Navigation checks `message.threadId` and builds compound hash when present

**Pins (`PinnedMessagesPanel.tsx`):**
- Full `Message` objects already contain `threadId` — no type changes
- Navigation checks `message.threadId` and builds compound hash when present

### Edge Cases

1. **Cross-space navigation** — Route change mounts new Space → Channel, Channel reads hash on mount. Works naturally.
2. **Different thread already open** — `handleOpenThread` replaces current thread. `targetMessageId` drives scroll in new thread.
3. **Same thread already open** — Skip re-open, just set `targetMessageId` for scroll + highlight.
4. **Root message not found in DB** — Can't open thread panel. Fallback: navigate to channel without opening thread (degraded, same as today).
5. **Direct URL paste in browser** — App loads, mounts Space → Channel, Channel processes hash on mount. Works naturally.
6. **Existing bookmarks without threadId** — Produce old `#msg-{id}` hash. Silent failure for thread replies (same as today). New bookmarks going forward capture `threadId`.

### Key Files

| File | Change |
|------|--------|
| New: `src/utils/parseMessageHash.ts` | Hash parsing utility |
| `src/components/space/Channel.tsx` | Extended hash handler for thread detection |
| `src/components/context/ThreadContext.tsx` | Add `targetMessageId` to state |
| `src/components/thread/ThreadPanel.tsx` | Read `targetMessageId`, scroll + highlight, clear |
| `src/api/quorumApi.ts` | Add `threadId?: string` to `Bookmark` type |
| `src/hooks/business/bookmarks/useBookmarks.ts` | Capture `threadId` in `createBookmarkFromMessage()` |
| `src/components/bookmarks/BookmarksPanel.tsx` | Build compound hash when `threadId` present |
| `src/hooks/business/search/useGlobalSearchNavigation.ts` | Build compound hash when `message.threadId` present |
| `src/components/message/PinnedMessagesPanel.tsx` | Build compound hash when `message.threadId` present |

### Out of Scope

- Mobile thread reply visibility (documented in thread-panel.md Future Work)
- Thread search inclusion (thread replies in global search results)
- Toast notification on missing root message
- Bookmark migration for existing bookmarks

---

_Created: 2026-03-10_
