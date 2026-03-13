---
type: doc
title: "Thread Panel"
status: done
ai_generated: true
created: 2026-03-09
updated: 2026-03-13
related_docs:
  - "docs/features/messages/pinned-messages.md"
  - "docs/features/dropdown-panels.md"
  - "docs/features/responsive-layout.md"
  - "docs/styling-guidelines.md"
related_tasks:
  - "tasks/threaded-conversations.md"
  - "tasks/2025-03-09-thread-panel-layout.md"
---

# Thread Panel

> **AI-Generated**: May contain errors. Verify before use.

## Overview

The Thread Panel provides threaded conversations within Space channels, rendered as a sidebar column alongside the main chat area. When a user opens a thread, the panel appears as a sibling element to the Channel component at the Space layout level, preserving the full width of the main chat area. The panel supports drag-to-resize with localStorage persistence.

**Key Characteristics:**
- Flat threading model: replies to root message only, no nested threads
- Thread replies are hidden from the main channel feed
- Full `MessageList` + `MessageComposer` reuse for identical UX to main chat
- Resizable panel width (300px min, 50vw max, 400px default)
- Deterministic thread IDs via `SHA-256(targetMessageId + ':thread')`
- Space channels only (no DM threading)

## Architecture

### Component Hierarchy

```
<ThreadProvider>                           ← wraps entire Space
  <div class="space-container">            ← flex row
    <div class="space-container-channels"> ← channel list sidebar
      <ChannelList />
    </div>
    <Channel />                            ← main chat (adds .thread-open class when active)
    <ThreadPanel />                        ← thread sidebar (sibling, not nested)
  </div>
</ThreadProvider>
```

The ThreadPanel renders at the `Space.tsx` level as a flex sibling of `Channel`, not inside it. This is the key architectural difference from the initial implementation where ThreadPanel was nested within Channel. The sibling layout means the main chat area width remains unchanged when the thread opens — only the overall flex container accommodates the additional panel.

### Key Files

| File | Purpose |
|------|---------|
| `src/components/context/ThreadContext.tsx` | Ref-based store with dual-hook API |
| `src/components/context/ThreadSettingsModalProvider.tsx` | `openThreadSettings()` hook + modal registration |
| `src/components/thread/ThreadPanel.tsx` | Panel component with resize handle |
| `src/components/thread/ThreadPanel.scss` | Panel styles, borders, resize handle |
| `src/components/modals/ThreadSettingsModal.tsx` | Thread settings modal (title, auto-close, close toggle, delete) |
| `src/components/space/Space.tsx` | ThreadProvider wrapper, ThreadPanel sibling rendering |
| `src/components/space/Space.scss` | Container background, channel list borders/radius |
| `src/components/space/Channel.tsx` | Context store population via useEffects |
| `src/components/space/Channel.scss` | `.thread-open` border-radius rule |
| `src/styles/_chat.scss` | External layout borders (top, left, right) |
| `src/styles/_colors.scss` | `--color-border-muted` semantic variable |
| `src/styles/_components.scss` | Shared `.header-icon-button` class used by thread panel icons |
| `src/components/thread/ThreadsListPanel.tsx` | Channel threads list panel (search, grouping, open) |
| `src/components/thread/ThreadsListPanel.scss` | Styles for threads list panel, items, empty states |
| `src/components/thread/ThreadListItem.tsx` | Single thread row (title, meta, lock icon) |
| `src/services/channelThreadHelpers.ts` | Pure helpers: `buildChannelThreadFromCreate`, `updateChannelThreadOnReply` |
| `src/hooks/business/threads/useChannelThreads.ts` | React Query hook for channel thread list |

### ThreadContext — Ref-Based Store Pattern

The ThreadContext uses a ref-based store instead of `useState` to prevent infinite re-render loops. The problem: if the provider used `useState`, calling setters would re-render the provider, which re-renders Channel (a child), which fires useEffects that call setters again — an infinite loop.

**Solution:** All state lives in `useRef` objects. Setters mutate refs directly and notify subscribers via a listener set. The context value itself is also a ref, so the provider never re-renders.

```
ThreadProvider
  ├── stateRef      (ThreadState)
  ├── actionsRef    (ThreadActions)
  ├── channelPropsRef (ThreadChannelProps)
  └── listenersRef  (Set<() => void>)
```

**Dual-hook API:**

- **`useThreadContextStore()`** — Non-subscribing. Returns the raw store object with getters/setters. Used by `Channel.tsx` to push data without triggering its own re-renders. Channel calls `setThreadState()`, `setThreadActions()`, and `setChannelProps()` from three separate `useEffect` hooks.

- **`useThreadContext()`** — Subscribing. Returns a flattened snapshot of state + actions + channelProps. Internally uses `useReducer` as a forceRender mechanism, subscribing to the store's listener set. Used by `ThreadPanel.tsx` to consume data and re-render when it changes.

### Data Flow

```
Channel.tsx                          ThreadPanel.tsx
    │                                      │
    ├─ useThreadContextStore()             ├─ useThreadContext()
    │  (non-subscribing)                   │  (subscribing via forceRender)
    │                                      │
    ├─ useEffect → setThreadState()  ───►  ├─ reads: isOpen, threadId, rootMessage,
    │   (isOpen, threadId, rootMessage,    │         threadMessages, isLoading
    │    threadMessages, isLoading)         │
    │                                      │
    ├─ useEffect → setThreadActions() ──►  ├─ reads: openThread, closeThread,
    │   (openThread, closeThread,          │         submitMessage, submitSticker
    │    submitMessage, submitSticker)      │
    │                                      │
    └─ useEffect → setChannelProps() ───►  └─ reads: channelProps (members, roles,
        (spaceId, channelId, members,             stickers, permissions, etc.)
         roles, stickers, permissions...)
```

Channel.tsx owns all thread state (`activePanel`, `activeThreadId`, `activeThreadRootMessage`) and business logic (`handleOpenThread`, `handleSubmitThreadMessage`, `handleSubmitThreadSticker`, `handleUpdateThreadTitle`). The `useThreadMessages` React Query hook is called in Channel and its results flow through the context to ThreadPanel.

**Stale snapshot pitfall:** `activeThreadRootMessage` is a React state variable set once when a thread opens and not derived from any query. Any mutation to the root message (e.g., title update) must explicitly call `setActiveThreadRootMessage` — otherwise the displayed root message in ThreadPanel stays stale even after the DB and React Query cache are updated. The `invalidateQueries` call for `thread-messages` only refreshes the replies list, not this snapshot.

## Visual Design

### Layout & Gap

The `space-container` has `background-color: var(--color-bg-app)` — the darkest background tier and `position: relative` to anchor the thread panel overlay on small screens. On desktop, ThreadPanel uses `margin-left: $s-2` (8px), creating a visible gap that exposes the dark app background, visually separating the main chat area from the thread sidebar.

**Background color hierarchy:**
- `--color-bg-app` — darkest, visible in the 8px gap (desktop only)
- `--color-bg-sidebar` — channel list sidebar
- `--color-bg-chat` — main chat area and thread panel

### Responsive Behavior

The thread panel adapts to screen size following the same patterns as the chat-container:

- **Desktop (≥1024px):** Side-by-side panel with 8px gap, resize handle, top + left borders
- **Below MD (≤768px):** Full-width absolute overlay (`position: absolute; inset: 0`) covering the main chat area. Resize handle hidden, margin removed, inline width overridden with `!important`. The `.thread-open` top-right radius on chat-container is also disabled since the thread covers it entirely.
- **Below XS (≤480px):** Same as above, plus `border-top-left-radius` removed (matches chat-container phone pattern)

### Border Radius

When a thread is open, `Channel.tsx` adds the `.thread-open` class to the `chat-container` div. On desktop and above MD (≥768px), this triggers:
- **Chat area**: `border-top-right-radius: $rounded-xl` (top-right corner rounds to visually separate from thread)
- **Thread panel**: `border-top-left-radius: $rounded-xl` (top-left corner rounds to match)
- **Channel list**: `border-top-left-radius: $rounded-xl` on desktop (matches `main-content`'s rounded corner)

Below MD, the `.thread-open` radius is not applied since the thread panel is a full-width overlay.

### Border System

Borders use a theme-aware system with a muted variant for dark mode. **All thread panel borders are desktop-only (≥1024px)**, matching the chat-container pattern from `_chat.scss`:

**Light theme** (`--color-border-subtle` = `var(--surface-4)`):
- Channel list sidebar: `border-top` on desktop
- Chat container: `border-top` + `border-left` on desktop; `border-right` when thread open
- Thread panel: `border-top` + `border-left` on desktop

**Dark theme** (`--color-border-muted` = `var(--surface-3)`):
- Channel list sidebar: `border-top` + `border-left` (muted) on desktop
- Chat container: `border-top` (muted) on desktop; no `border-left`; `border-right` (muted) when thread open
- Thread panel: `border-top` + `border-left` (muted) on desktop

The `--color-border-muted` semantic variable was added to `_colors.scss` specifically for these external layout borders, sitting below `--color-border-subtle` in the border color scale:
```
--color-border-muted:    var(--surface-3)  ← layout borders (dark mode)
--color-border-subtle:   var(--surface-4)  ← layout borders (light mode)
--color-border-default:  var(--surface-5)  ← general UI borders
--color-border-strong:   var(--surface-6)  ← emphasis borders
--color-border-stronger: var(--surface-7)  ← high-contrast borders
```

### Resize Handle

A 4px-wide invisible handle is positioned on the left edge of the thread panel (`left: -2px`). On hover or drag, it highlights with `var(--text-link)` color. The resize uses `mousedown`/`mousemove`/`mouseup` events on the document to track drag distance.

- **Minimum width:** 300px
- **Maximum width:** 50vw
- **Default width:** 400px
- **Persistence:** `localStorage` key `thread-panel-width`
- **Drag direction:** Dragging left increases width, dragging right decreases it

### Header

Header layout:
- **Title:** Derived at runtime via `getThreadTitle()` in `ThreadPanel.tsx`. Resolution order: (1) `threadMeta.customTitle` if set, (2) first 100 chars of root message text (markdown stripped), (3) `"Thread"` fallback (used when root is soft-deleted or empty). Auto-extracted titles are NOT persisted or broadcast. Custom titles survive root deletion since they live in `threadMeta`. The title is **read-only** in the panel header — editing is done via the Thread Settings Modal.
- **Subtitle:** "Started by **Username**" showing thread creator
- **Settings icon (cog):** Visible only to thread managers (author or users with `message:delete` permission). Opens the Thread Settings Modal. Uses the shared `header-icon-button` class with a bottom-anchored tooltip ("Thread settings"). Hidden for non-managers.
- **Close icon (X):** Closes the thread panel. Also uses `header-icon-button`. Both icons use `iconSize="lg"` to match the main channel header icons.
- **Alignment:** Header uses `align-items: flex-start` so icons align to the top of the header area (title + subtitle make the content taller than a single-line header).

## Thread Management

### Thread Settings Modal (`ThreadSettingsModal.tsx`)

Opened via the cog icon in the panel header. Accessible to thread managers (author or users with `message:delete` permission).

**Features:**
- **Title editing** (author only) — Freetext input, 100-char limit, XSS validation via `validateNameForXSS`. Saves via `updateTitle` → `handleUpdateThreadTitle` in Channel.tsx → `submitChannelMessage` broadcast (same flow as inline title editing previously was). Save button disabled if title has XSS content or no changes.
- **Auto-close** — Select preset (Never / 1h / 24h / 3 days / 1 week). Stored as `autoCloseAfter` ms in `ThreadMeta`. "Never" = field omitted.
- **Close thread toggle** — Marks thread as `isClosed`. Closed threads are read-only for all users.
- **Delete thread** — Author-only, two-click confirm. Only shown if thread has no replies from other users. Removes all thread replies from IndexedDB, removes `channel_threads` registry entry, and handles root message based on ownership: hard-deletes if author owns root or root was soft-deleted; strips `threadMeta` otherwise (keeping the other user's message intact).

**Auth:** Modal only renders if `canManage` is true. Server-side auth in `MessageService` requires only that the sender is the thread creator (`createdBy`). The old `isRootSender` requirement was removed — the thread creator can always delete their thread even if the root message belongs to another user. When the root message is missing from DB (already hard-deleted), authorization falls back to the `channel_threads` registry which independently stores `createdBy`.

**Provider:** `ThreadSettingsModalProvider` wraps the Space and exposes `useThreadSettingsModal()` → `openThreadSettings(props)`. ThreadPanel calls this from the cog button click handler.

## Thread Data Model

### Types (`src/api/quorumApi.ts`)

- **`ThreadMeta`** — Set on root messages: `{ threadId, createdBy, customTitle?, isClosed?, closedBy?, autoCloseAfter?, lastActivityAt? }`
- **`ThreadMessage`** — Broadcast content: `{ type: 'thread', senderId, targetMessageId, action: 'create' | 'updateTitle' | 'close' | 'reopen' | 'updateSettings' | 'remove', threadMeta }`
- **`ChannelThread`** — Denormalized thread summary for the threads list panel: `{ threadId, spaceId, channelId, rootMessageId, createdBy, createdAt, lastActivityAt, replyCount, isClosed, customTitle?, titleSnapshot?, hasParticipated }`
- **Message fields:** `threadMeta?` (root messages), `threadId?` (reply messages), `isThreadReply?` (filtering sentinel)

### Database (`src/db/messages.ts`)

- **Schema:** DB version 9 adds `by_thread` compound index: `[spaceId, channelId, threadId, createdDate]`. DB version 10 adds `channel_threads` object store (keyPath: `threadId`) with `by_channel` compound index on `[spaceId, channelId]`
- **`getThreadMessages()`** — Returns all messages in a thread plus derived stats (replyCount, lastReplyAt, lastReplyBy)
- **`getThreadStats()`** — Lightweight count + last reply info for ThreadIndicator
- **`saveChannelThread()`** — Upserts a `ChannelThread` entry (used by `MessageService` on thread create/reply/settings events)
- **`getChannelThreads()`** — Returns all threads for a channel via `by_channel` index (`IDBKeyRange.only([spaceId, channelId])`)
- **`deleteChannelThread()`** — Removes a `ChannelThread` entry by `threadId` (used on thread removal)
- **Main feed filtering:** Thread replies (`isThreadReply: true`) are filtered at three layers:
  1. **DB cursor** — `getMessages()` skips `isThreadReply` during cursor iteration
  2. **DB unread query** — `getFirstUnreadMessage()` skips `isThreadReply` so thread replies don't trigger unread navigation to the main feed
  3. **React layer** — `useChannelMessages()` filters `isThreadReply` as defense-in-depth against any code path that sets raw data into the React Query cache (e.g., `loadMessagesAround` via `setQueryData`)
- **`loadMessagesAround()`** — Excludes thread replies from the target message injection (target fetched via `getMessage()` bypasses cursor filtering)

### Hooks (`src/hooks/business/threads/`)

- **`useThreadMessages()`** — React Query hook for thread messages with 30s staleTime
- **`useThreadStats()`** — React Query hook for thread statistics (used by ThreadIndicator)
- **`useChannelThreads()`** — React Query hook (`['channel-threads', spaceId, channelId]`) returning all threads for a channel sorted by `lastActivityAt` descending. 30s staleTime, `networkMode: 'always'`. Invalidated by `MessageService.addMessage()` on thread lifecycle events

### Thread Discovery

- **ThreadIndicator** (`src/components/thread/ThreadIndicator.tsx`) — Inline component on root messages showing reply count and last reply time
- **MessageActions** — Thread button in hover toolbar (right after Reply icon)
- **MessageActionsMenu** — "Start Thread" / "View Thread" in right-click context menu
- **ThreadsListPanel** (`src/components/thread/ThreadsListPanel.tsx`) — Channel-scoped panel listing all threads, accessible via a "Threads" button (icon: `messages`) in the channel header (`Channel.tsx`). Uses `DropdownPanel` with custom `headerContent`. Groups threads into three sections: **Joined Threads** (user has participated), **Other Active Threads** (activity within 7 days), **Older Threads**. Includes in-memory search filtering by title (case-insensitive). Clicking a thread fetches the root message via `messageDB.getMessageById()` and opens it via `openThread()` from ThreadContext. The panel toggle uses `activePanel === 'threads'` on Channel's `ActivePanel` union type (which now includes `'threads'`)
- **Root message deletion** — Soft-delete preserves `threadMeta` so the thread remains accessible; root shows italicized "[Original message was deleted]" placeholder (i18n). Both local and remote deletion paths handle this: local via `useMessageActions.ts` (map + `messageDB.updateMessage`), remote via `MessageService.ts` `processMessage()` (IndexedDB soft-delete) and `addMessage()` (React Query cache map instead of filter)
- **Thread deletion with deleted root** — When a thread is deleted and its root message was already soft-deleted (empty text), the root is hard-deleted from IndexedDB (not just stripped of `threadMeta`). This prevents ghost messages (avatar + username with no content) that would appear if `threadMeta` were stripped from a soft-deleted message — the "[Original message was deleted]" placeholder depends on `threadMeta` being present

## Thread Title Editing

Title editing was moved from inline panel header interaction to the Thread Settings Modal. The title in the panel header is now always read-only.

### updateTitle Broadcast Flow

```
ThreadSettingsModal: Save button
  → handleSave() → updateTitle(messageId, threadMeta, newTitle)  ← from ThreadContext actions
  → handleUpdateThreadTitle() in Channel.tsx
      → builds updatedMeta: { threadId, createdBy, customTitle }
      → submitChannelMessage(..., { type:'thread', action:'updateTitle', threadMeta: updatedMeta })
          → MessageService.submitChannelMessage (send path)
              → idempotency guard: gated to action==='create' only (updateTitle passes through)
              → auth check: senderId must === targetMessage.threadMeta.createdBy
              → saves updatedTarget to IndexedDB (spread-merge: {...existing.threadMeta, ...updatedMeta})
              → updates main channel React Query cache (spread-merge)
              → invalidates ['thread-messages', ...] query
              → broadcasts encrypted message to space
      → setActiveThreadRootMessage(prev => {...prev, threadMeta: {...prev.threadMeta, ...updatedMeta}})
          ← local sender: updates stale snapshot so ThreadPanel re-renders immediately

Peers (via addMessage):
  → auth check: senderId must === targetMessage.threadMeta.createdBy
  → updates main channel React Query cache (spread-merge)
  → invalidates ['thread-messages', ...] query
```

The local sender path and the peer path are separate. The `addMessage` path handles incoming broadcasts; `setActiveThreadRootMessage` handles the sender's own immediate display update since the sender's broadcast doesn't loop back through `addMessage`.

## Thread-Aware Navigation

Bookmarks, search results, and pinned messages can navigate directly into a thread reply — opening the thread panel and scrolling to the target message. This uses a compound URL hash format.

### Hash Format

```
#thread-{threadId}-msg-{messageId}    ← thread reply (opens thread panel + scrolls)
#msg-{messageId}                      ← regular message (scrolls in main feed)
```

`buildMessageHash(messageId, threadId?)` and `parseMessageHash(hash)` in `src/utils/messageHashNavigation.ts` handle encoding/decoding.

### Navigation Flow

```
Entry point (BookmarksPanel / PinnedMessagesPanel / Search)
  → buildMessageHash(messageId, threadId)  // #thread-{threadId}-msg-{msgId}
  → navigate('/spaces/spaceId/channelId#thread-...-msg-...')

Cross-channel: Channel remounts (key: spaceId-channelId)
Same-channel:  location.hash changes → useEffect([spaceId, channelId, location.hash]) re-fires

  → parseMessageHash(window.location.hash) detects thread hash
  → messageDB.getMessageById(identifier) OR getRootMessageByThreadId()
  → setActiveThreadId(), setActivePanel('thread')
  → queueMicrotask: threadCtx.setThreadState({ targetMessageId: messageId })
  → ThreadPanel renders with scrollToMessageId={targetMessageId}
  → MessageList scrollToMessageId effect fires → scrollToMessage()
  → window.location.hash = '#msg-{id}' → Message self-highlights via location.hash check
```

### Critical Pattern: Hash-Based Cross-Component Highlighting

`Message.tsx` calls `useMessageHighlight()` independently — each instance is **isolated**. Calling `highlightMessage()` from a `MessageList` hook instance has no effect on Message components rendered elsewhere in the tree.

The only cross-component highlight signal that works is `location.hash === '#msg-{id}'`. When a component needs to trigger highlighting on a Message it doesn't directly control, it must set `window.location.hash = '#msg-{id}'` — not call any hook method.

This applies to:
- `MessageList.tsx` when `highlightOnScroll={true}` — sets `window.location.hash` after scrolling
- Any future component that needs to highlight a specific Message

### Same-Channel Navigation

React Router doesn't remount `Channel` when navigating to the same channel (the component key `spaceId-channelId` doesn't change). To ensure thread hash changes are processed even when already on the target channel, `Channel.tsx` includes `location.hash` in the thread detection effect's dependency array:

```typescript
useEffect(() => {
  // parse window.location.hash, open thread, set targetMessageId
}, [spaceId, channelId, location.hash]);
```

Without `location.hash` in deps, clicking "Jump" in PinnedMessagesPanel or navigating from a bookmark while already on the target channel would do nothing.

### threadId Propagation in Search

Search returns root messages (the message that started a thread), not replies. Root messages have `threadMeta.threadId`, not a top-level `threadId`. When building the hash for search navigation:

```typescript
const threadId = message.threadId ?? message.threadMeta?.threadId;
```

`message.threadId` handles reply messages; `message.threadMeta?.threadId` handles root messages. Both cases use the same hash format — Channel.tsx resolves the root message from the threadId via `getRootMessageByThreadId()`.

The `threadId` must flow through the entire search chain without being dropped:
- `useSearchResultFormatting.ts` → `onNavigate(spaceId, channelId, messageId, threadId)`
- `useSearchResultsState.ts` → `handleNavigate(spaceId, channelId, messageId, threadId?)` (must include the 4th param)
- `useGlobalSearchNavigation.ts` → `buildMessageHash(messageId, threadId)`

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Panel placement | Space.tsx sibling | Main chat width stays unchanged when thread opens |
| Context pattern | Ref-based store | Prevents infinite re-render loops from useState + child useEffects |
| Dual-hook API | Store vs subscribing | Channel pushes data without re-rendering; ThreadPanel subscribes and re-renders |
| Thread ID | SHA-256 deterministic | Race-safe: two users creating a thread on the same message produce the same ID |
| Feed filtering | 3-layer defense-in-depth | DB cursor + DB unread query + React hook filter; avoids breaking existing `by_conversation_time` compound index |
| Panel rendering | Full MessageList + Composer | Identical UX to main chat with no feature disparity |
| Resize persistence | localStorage | Simple, synchronous, no server dependency |
| Dark mode borders | `--color-border-muted` | More subtle external layout borders without affecting general UI borders |
| Cross-component highlight | URL hash | `useMessageHighlight()` is isolated per instance; `window.location.hash = '#msg-{id}'` is the only cross-component signal Message.tsx responds to |
| Same-channel hash re-detection | `location.hash` in effect deps | React Router doesn't remount Channel on same-channel navigation; hash dep ensures the thread detection effect re-fires |
| Thread removal cache strategy | `removeQueries` + `setQueryData` (not `invalidateQueries`) | `invalidateQueries` triggers a DB refetch that races against the persistent handler's cleanup — the refetch restores deleted data into the cache, undoing the optimistic removal. Direct cache manipulation avoids this race |
| Thread deletion auth | Thread creator only (no `isRootSender` check) | Thread creator may start threads on other users' messages; requiring root authorship blocked deletion in this common case. Root message ownership only affects whether the root is hard-deleted or just stripped of `threadMeta` |

## Known Limitations

- **Space channels only** — Thread feature is not available in DM conversations
- **No thread notifications** — No participation tracking, auto-follow, or unread indicators per-thread
- **No permission gating** — Anyone who can post in the channel can create threads; no `thread:create` permission
- **No thread search** — Thread replies are not included in global search results
- **Resize desktop only** — Resize handle uses mouse events and is hidden below MD; no touch support for drag-to-resize
- **Thread replies invisible on mobile** — Thread replies are filtered from the main feed at three layers (DB cursor in `getMessages()`, DB unread in `getFirstUnreadMessage()`, React hook in `useChannelMessages()`). Since mobile won't have a thread panel initially, thread replies are completely hidden for mobile users with no way to view them. Needs a platform-aware flag so replies stay in the main feed on platforms without thread panel support.
- **Thread-aware navigation for new bookmarks only** — Existing bookmarks created before this feature was added don't store a `threadId`, so they fall back to `#msg-{id}` navigation and silently fail to open the thread panel. New bookmarks capture `threadId` at creation time. No migration path for legacy bookmarks.

## Future Work

These items are planned but not yet implemented:

- **Thread notifications** — Participation tracking, auto-follow, unread indicators per-thread. Store thread follows in a separate IndexedDB store (NOT UserConfig due to unbounded growth). Separate task.
- **Migrate thread types to `quorum-shared`** — Move types and hooks to the shared package for cross-platform (mobile) compatibility.
- **Permission gating** — Add `thread:create` permission to role system for per-role thread creation control.
- **"Also send to channel"** — Option to post a thread reply to the main feed simultaneously.
- **Thread search** — Include thread replies in global search results.
- **Extract ThreadService** — If MessageService grows further, extract thread handling to a dedicated service class.
- **Mobile thread reply visibility** — Add a platform-aware flag to the three `isThreadReply` filter points (DB cursor, DB unread query, React hook). On platforms without thread panel support (mobile), skip the filter so thread replies appear inline in the main feed as regular messages.
- **Bookmark migration** — Existing bookmarks don't store `threadId`, so clicking them won't open the thread panel for thread replies. A migration could backfill `threadId` by scanning messages at read time, but the impact is limited to bookmarks created before this feature shipped.

## Related Documentation

- [Pinned Messages](pinned-messages.md) — Similar broadcast pattern for cross-client sync
- [Dropdown Panels](../dropdown-panels.md) — Panel UI patterns (ThreadPanel uses a full sidebar instead)
- [Responsive Layout](../responsive-layout.md) — Mobile layout considerations
- [Threaded Conversations Task](../../tasks/threaded-conversations.md) — Original implementation task with full dependency chain

---

_Created: 2026-03-09_
_Updated: 2026-03-13 (thread deletion fixes: relaxed auth to thread-creator-only, handle deleted root messages via channel_threads fallback, hard-delete soft-deleted roots on thread removal to prevent ghost messages, optimistic cache update in handleRemoveThread, use removeQueries/setQueryData instead of invalidateQueries to avoid refetch race; added getChannelThread DB method)_
_Previously: 2026-03-12 (thread management: added Thread Settings Modal section, close/reopen/auto-close/remove actions, updated types, header description, title editing flow, known limitations, future work; removed Discord references)_
