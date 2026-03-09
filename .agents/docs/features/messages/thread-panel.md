---
type: doc
title: "Thread Panel (Discord-Style Layout)"
status: done
ai_generated: true
created: 2026-03-09
updated: 2026-03-09
related_docs:
  - "docs/features/messages/pinned-messages.md"
  - "docs/features/dropdown-panels.md"
  - "docs/features/responsive-layout.md"
  - "docs/styling-guidelines.md"
related_tasks:
  - "tasks/threaded-conversations.md"
  - "tasks/2025-03-09-thread-panel-discord-layout.md"
---

# Thread Panel (Discord-Style Layout)

> **AI-Generated**: May contain errors. Verify before use.

## Overview

The Thread Panel provides threaded conversations within Space channels, rendered as a Discord-style sidebar column alongside the main chat area. When a user opens a thread, the panel appears as a sibling element to the Channel component at the Space layout level, preserving the full width of the main chat area. The panel supports drag-to-resize with localStorage persistence.

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
| `src/components/thread/ThreadPanel.tsx` | Panel component with resize handle |
| `src/components/thread/ThreadPanel.scss` | Panel styles, borders, resize handle |
| `src/components/space/Space.tsx` | ThreadProvider wrapper, ThreadPanel sibling rendering |
| `src/components/space/Space.scss` | Container background, channel list borders/radius |
| `src/components/space/Channel.tsx` | Context store population via useEffects |
| `src/components/space/Channel.scss` | `.thread-open` border-radius rule |
| `src/styles/_chat.scss` | External layout borders (top, left, right) |
| `src/styles/_colors.scss` | `--color-border-muted` semantic variable |

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

Channel.tsx owns all thread state (`activePanel`, `activeThreadId`, `activeThreadRootMessage`) and business logic (`handleOpenThread`, `handleSubmitThreadMessage`, `handleSubmitThreadSticker`). The `useThreadMessages` React Query hook is called in Channel and its results flow through the context to ThreadPanel.

## Visual Design

### Layout & Gap

The `space-container` has `background-color: var(--color-bg-app)` — the darkest background tier. ThreadPanel uses `margin-left: $s-2` (8px), creating a visible gap that exposes the dark app background, visually separating the main chat area from the thread sidebar.

**Background color hierarchy:**
- `--color-bg-app` — darkest, visible in the 8px gap
- `--color-bg-sidebar` — channel list sidebar
- `--color-bg-chat` — main chat area and thread panel

### Border Radius

When a thread is open, `Channel.tsx` adds the `.thread-open` class to the `chat-container` div. This triggers:
- **Chat area**: `border-top-right-radius: $rounded-xl` (top-right corner rounds to visually separate from thread)
- **Thread panel**: `border-top-left-radius: $rounded-xl` (top-left corner rounds to match)
- **Channel list**: `border-top-left-radius: $rounded-xl` on desktop (matches `main-content`'s rounded corner)

### Border System

Borders use a theme-aware system with a muted variant for dark mode:

**Light theme** (`--color-border-subtle` = `var(--surface-4)`):
- Channel list sidebar: `border-top` on desktop
- Chat container: `border-top` + `border-left` on desktop; `border-right` when thread open
- Thread panel: `border-top` + `border-left`

**Dark theme** (`--color-border-muted` = `var(--surface-3)`):
- Channel list sidebar: `border-top` + `border-left` (muted) on desktop
- Chat container: `border-top` (muted) on desktop; no `border-left`; `border-right` (muted) when thread open
- Thread panel: `border-top` + `border-left` (muted)

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

### Close Button

The close button uses a modal-style circular design (`border-radius: $rounded-full`) with subtle background color transitions on hover. It renders an `<Icon name="close" size="md" />` inside an unstyled `<Button>`.

### Header

Discord-style header with:
- **Title:** First ~50 characters of the root message text, truncated at word boundary with ellipsis
- **Subtitle:** "Started by **Username**" showing thread creator
- **Close button:** Right-aligned circular button

## Thread Data Model

### Types (`src/api/quorumApi.ts`)

- **`ThreadMeta`** — Set on root messages: `{ threadId: string, createdBy: string }`
- **`ThreadMessage`** — Broadcast content: `{ type: 'thread', senderId, targetMessageId, action: 'create', threadMeta }`
- **Message fields:** `threadMeta?` (root messages), `threadId?` (reply messages), `isThreadReply?` (filtering sentinel)

### Database (`src/db/messages.ts`)

- **Schema:** DB version 9 adds `by_thread` compound index: `[spaceId, channelId, threadId, createdDate]`
- **`getThreadMessages()`** — Returns all messages in a thread plus derived stats (replyCount, lastReplyAt, lastReplyBy)
- **`getThreadStats()`** — Lightweight count + last reply info for ThreadIndicator
- **Main feed filtering:** Thread replies (`isThreadReply: true`) are filtered at three layers:
  1. **DB cursor** — `getMessages()` skips `isThreadReply` during cursor iteration
  2. **DB unread query** — `getFirstUnreadMessage()` skips `isThreadReply` so thread replies don't trigger unread navigation to the main feed
  3. **React layer** — `useChannelMessages()` filters `isThreadReply` as defense-in-depth against any code path that sets raw data into the React Query cache (e.g., `loadMessagesAround` via `setQueryData`)
- **`loadMessagesAround()`** — Excludes thread replies from the target message injection (target fetched via `getMessage()` bypasses cursor filtering)

### Hooks (`src/hooks/business/threads/`)

- **`useThreadMessages()`** — React Query hook for thread messages with 30s staleTime
- **`useThreadStats()`** — React Query hook for thread statistics (used by ThreadIndicator)

### Thread Discovery

- **ThreadIndicator** (`src/components/thread/ThreadIndicator.tsx`) — Inline component on root messages showing reply count and last reply time
- **MessageActions** — Thread button in hover toolbar (right after Reply icon)
- **MessageActionsMenu** — "Start Thread" / "View Thread" in right-click context menu
- **Root message deletion** — Soft-delete preserves `threadMeta` so the thread remains accessible; root shows "[deleted message]" placeholder

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

## Known Limitations

- **Space channels only** — Thread feature is not available in DM conversations
- **No thread notifications** — No participation tracking, auto-follow, or unread indicators per-thread
- **No ThreadsList panel** — No browsable list of all threads in a channel
- **No permission gating** — Anyone who can post in the channel can create threads; no `thread:create` permission
- **No thread search** — Thread replies are not included in global search results
- **Desktop only** — Resize handle uses mouse events; no touch support for mobile drag-to-resize
- **No auto-archive** — Threads remain open indefinitely; no `autoArchiveDuration` mechanism

## Future Work

These items are planned but not yet implemented:

- **Thread notifications** — Participation tracking, auto-follow, unread indicators per-thread. Store thread follows in a separate IndexedDB store (NOT UserConfig due to unbounded growth). Separate task.
- **ThreadsList & channel header button** — Browsable list of all threads in a channel, accessible from the channel header.
- **Migrate thread types to `quorum-shared`** — Move types and hooks to the shared package for cross-platform (mobile) compatibility.
- **Auto-archive** — Add `isArchived` and `autoArchiveDuration` to ThreadMeta for automatic thread archival.
- **Close/delete threads** — Author and moderators can close threads (read-only) or delete them entirely.
- **Permission gating** — Add `thread:create` permission to role system for per-role thread creation control.
- **"Also send to channel"** — Option to post a thread reply to the main feed simultaneously (Slack-style behavior).
- **Thread search** — Include thread replies in global search results.
- **DM threading** — Extend threads to direct message conversations.
- **Thread titles** — Optional user-set titles on threads (low priority; root message text provides context).
- **Extract ThreadService** — If MessageService grows further, extract thread handling to a dedicated service class.
- **Mobile resize** — Touch-based drag-to-resize for the thread panel on mobile/tablet.

## Related Documentation

- [Pinned Messages](pinned-messages.md) — Similar broadcast pattern for cross-client sync
- [Dropdown Panels](../dropdown-panels.md) — Panel UI patterns (ThreadPanel uses a full sidebar instead)
- [Responsive Layout](../responsive-layout.md) — Mobile layout considerations
- [Threaded Conversations Task](../../tasks/threaded-conversations.md) — Original implementation task with full dependency chain

---

_Created: 2026-03-09_
_Updated: 2026-03-09 (added 3-layer feed filtering documentation)_
