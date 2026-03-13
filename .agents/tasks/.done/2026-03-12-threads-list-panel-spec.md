---
type: spec
title: "Threads List Panel"
status: ready
ai_generated: true
created: 2026-03-12
related_docs:
  - "docs/features/messages/thread-panel.md"
  - "docs/quorum-shared-architecture.md"
related_tasks:
  - "tasks/threaded-conversations.md"
  - "tasks/2025-03-09-thread-panel-layout.md"
---

# Threads List Panel — Design Spec

## Overview

A `DropdownPanel`-based sidebar that lists all threads in the currently visited channel, grouped by participation and activity (Discord-style). Accessible via a new "Threads" button in the channel header. Includes in-header search, grouped sections, and a placeholder "Create Thread" button for future use.

**Scope:** Space channels only. Current channel only (not space-wide). Phase 1 — no thread creation flow.

---

## Data Layer

### New IndexedDB Store: `channel_threads`

A dedicated thread registry store added at DB version 10. Each entry represents one thread root per channel.

```typescript
interface ChannelThread {
  threadId: string;          // Primary key
  spaceId: string;
  channelId: string;
  rootMessageId: string;
  createdBy: string;         // senderId of thread creator
  createdAt: number;         // Unix timestamp ms
  lastActivityAt: number;    // Updated on each reply
  replyCount: number;        // Updated on each reply
  isClosed: boolean;
  customTitle?: string;      // Mirrors threadMeta.customTitle
  titleSnapshot?: string;    // First 100 chars of root message text, markdown stripped. Written at create time. customTitle takes display precedence.
  hasParticipated: boolean;  // true if the local user has sent a reply in this thread
}
```

**Index:** `by_channel` on `[spaceId, channelId]` — O(1) indexed lookup for all threads in a channel.

### DB Version Upgrade

DB version bumps from 9 → 10. The `onupgradeneeded` handler in `src/db/messages.ts` must include an `if (oldVersion < 10)` block that creates the `channel_threads` object store with `threadId` as keyPath and adds the `by_channel` compound index on `[spaceId, channelId]`. No data migration is needed (threads not yet on production), but the upgrade block is required so the store is created for all users upgrading from v9.

### Write Paths in `MessageService`

All write paths hook into existing `ThreadMessage` processing:

| Event | Action |
|-------|--------|
| `action='create'` | Insert new `ChannelThread` entry. `titleSnapshot`: strip markdown from root message text, take first 100 chars. `hasParticipated`: set to `true` if `threadMsg.senderId === MessageService`'s local user identity (see "Current User Identity" below). |
| Thread reply arrives (`isThreadReply`) | Increment `replyCount`, update `lastActivityAt`. Set `hasParticipated=true` if `senderId` matches local user identity. |
| `action='updateSettings'` | Update `customTitle`, `isClosed` fields. |
| `action='close'` | Set `isClosed=true`. |
| `action='reopen'` | Set `isClosed=false`. |
| Thread deleted | Remove entry from store. Also call `queryClient.invalidateQueries(['channel-threads', spaceId, channelId])` so the panel list refreshes immediately. |

#### Current User Identity in `MessageService`

`MessageService` already has access to the local user's sender identity — it uses it for auth checks in `submitChannelMessage` (comparing `senderId` against `targetMessage.threadMeta.createdBy`). Use the same identity field for the `hasParticipated` comparison. The implementer should locate the existing pattern in `MessageService` for this check and reuse it here; no new identity injection is needed.

### New DB Method

```typescript
messageDB.getChannelThreads({
  spaceId: string,
  channelId: string
}): Promise<ChannelThread[]>
```

Uses the `by_channel` index. Returns all threads for the channel, unsorted (sorting happens in the hook/component).

### `quorum-shared` Migration Notes

When threads are migrated to cross-platform support:
- `ChannelThread` type → `quorum-shared/types`
- `getChannelThreads` method signature → `StorageAdapter` interface
- `useChannelThreads` hook → `quorum-shared/hooks`. **Before migration**, the hook must be refactored to call through the `StorageAdapter` interface (i.e. `storage.getChannelThreads(...)`) rather than calling `messageDB` directly. The current desktop-only implementation calls `messageDB` directly, which is fine for now.
- IndexedDB implementation stays in `IndexedDBAdapter` (desktop-specific)
- Mobile would implement its own storage backend for the same interface

---

## React Layer

### New Hook: `useChannelThreads`

**Location:** `src/hooks/business/threads/useChannelThreads.ts`

```typescript
useChannelThreads({ spaceId, channelId, enabled? })
// Query key: ['channel-threads', spaceId, channelId]
// staleTime: 30s
// networkMode: 'always'
// queryFn: messageDB.getChannelThreads({ spaceId, channelId })
// Returns: ChannelThread[] sorted by lastActivityAt desc
```

Mirrors the `useThreadMessages` and `useThreadStats` hook pattern. No pagination — full list returned (thread count per channel is expected to be small).

### Grouping Logic

Computed via `useMemo` inside `ThreadsListPanel`. Discord's 7-day threshold:

| Group | Condition |
|-------|-----------|
| **Joined Threads** | `hasParticipated === true` |
| **Other Active Threads** | `hasParticipated === false` AND `lastActivityAt > now - 7days` |
| **Older Threads** | `lastActivityAt <= now - 7days` |

- Groups only render if non-empty.
- Within each group: sorted by `lastActivityAt` desc.
- When search query is active: grouping is hidden, flat list filtered by title match (case-insensitive, in-memory, matches against resolved display title), sorted by `lastActivityAt` desc.

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ThreadsListPanel` | `src/components/thread/ThreadsListPanel.tsx` | Panel wrapper, grouping logic, search state |
| `ThreadListItem` | `src/components/thread/ThreadListItem.tsx` | Single clickable thread row |
| `ThreadsListPanel.scss` | `src/components/thread/ThreadsListPanel.scss` | Panel-specific styles |

### `ThreadsListPanel`

`DropdownPanel` does not have a native header slot — its header is rendered internally from the `title` string only. To achieve the custom header layout (title + search input + create button on one row), add a `headerContent?: React.ReactNode` prop to `DropdownPanel`. When `headerContent` is provided, it replaces the default title text in the header row, while the close button continues to render on the right. The `ThreadsListPanel` passes its custom header content via this prop.

```typescript
<DropdownPanel
  isOpen={isOpen}
  onClose={onClose}
  position="absolute"
  positionStyle="right-aligned"
  showCloseButton={true}
  className="threads-list-panel"
  headerContent={
    <>
      <span className="threads-panel__title">Threads</span>
      <input
        className="threads-panel__search"
        placeholder="Search threads…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />
      <Button
        type="unstyled"
        icon="plus"
        disabled
        tooltip="Coming soon"
        className="threads-panel__create-btn"
      />
    </>
  }
>
  {/* body content */}
</DropdownPanel>
```

Search state (`searchQuery`) is local to `ThreadsListPanel`, reset to `''` in a `useEffect` when `isOpen` changes to `false`.

**Body layout:**

Desktop — Virtuoso list with interleaved section header items:
```typescript
<Virtuoso
  data={groupedOrFilteredItems}  // Array of { type: 'header', label } | { type: 'thread', thread: ChannelThread }
  itemContent={(_, item) => item.type === 'header'
    ? <SectionHeader label={item.label} />
    : <ThreadListItem thread={item.thread} onOpen={handleOpen} />
  }
/>
```

Mobile — `mobile-drawer__item-list`:
```typescript
<div className="mobile-drawer__item-list">
  {groupedOrFilteredItems.map(item =>
    item.type === 'header'
      ? <SectionHeader key={item.label} label={item.label} />
      : <div key={item.thread.threadId} className="mobile-drawer__item-box mobile-drawer__item-box--interactive">
          <ThreadListItem thread={item.thread} onOpen={handleOpen} />
        </div>
  )}
</div>
```

**Empty state** (no threads in channel, no search query):
- Icon + "No threads yet" + hint "Start a thread from any message"
- Same structure as `PinnedMessagesPanel` empty state

**No results state** (search query active, no matches):
- Icon + "No threads match your search"

### `ThreadListItem`

Entire row is clickable. On click:
1. Fetch the root message: `messageDB.getMessage({ messageId: thread.rootMessageId })` — direct O(1) keyPath lookup, no scan.
2. Call `openThread(rootMessage)` from `ThreadContext` actions (which accepts a full `MessageType`). This sets `activePanel('thread')` in Channel and opens `ThreadPanel`.
3. Call `onClose()` to dismiss the threads list panel.

If the root message is not found (deleted), show a toast error and do nothing.

**Layout:**
```
┌──────────────────────────────────────────────┐
│ 🔒 Thread Title truncated to one line...     │
│ Started by Name · 3 replies · 2h ago         │
└──────────────────────────────────────────────┘
```

- Lock icon (`isClosed === true`) — prepended to title
- **Title resolution** (in order): `customTitle` → `titleSnapshot` → `"Thread"` fallback
- Meta line: creator display name (resolved from `mapSenderToUser`) · reply count · `lastActivityAt` relative time (use existing `formatRelativeTime` from `@quilibrium/quorum-shared`)
- Hover style: follow search results panel item hover pattern (`SearchResultItem` hover styles in `SearchResults.scss`)
- Cursor: pointer

### Channel Header Integration

**Location:** `src/components/space/Channel.tsx`

Add `'threads'` to the `ActivePanel` union:
```typescript
type ActivePanel = 'pinned' | 'threads' | 'notifications' | 'bookmarks' | 'search' | 'thread' | null;
```

**Button position:** After pinned posts button, before notifications button.

```typescript
<Button
  type="unstyled"
  icon="threads"  // or closest available icon (e.g. messages-square)
  iconSize={headerIconSize}
  iconVariant={activePanel === 'threads' ? 'filled' : 'outline'}
  className={`header-icon-button ${activePanel === 'threads' ? 'active' : ''}`}
  onClick={() => setActivePanel(p => p === 'threads' ? null : 'threads')}
  tooltip="Threads"
/>
```

Button always visible (not conditional on thread count).

Render `<ThreadsListPanel>` in the Channel return alongside other panels:
```typescript
<ThreadsListPanel
  isOpen={activePanel === 'threads'}
  onClose={() => setActivePanel(null)}
  spaceId={spaceId}
  channelId={channelId}
  mapSenderToUser={mapSenderToUser}
/>
```

#### Interaction with Active Thread Panel

`activePanel` already includes `'thread'` in its union (set when `handleOpenThread` is called). Since `ThreadPanel` renders at `Space.tsx` level but its visibility is controlled by `activePanel === 'thread'` inside Channel, opening the threads list panel (`activePanel = 'threads'`) will implicitly close the `ThreadPanel` (since `activePanel` can only hold one value). This is intentional and acceptable — the user is navigating away from a specific thread to browse the list.

---

## Visual Design

### Panel Header
Single row inside `DropdownPanel` header area: title text left, search input center (flex-grow), create button right, close button far right.
Search input: compact, placeholder "Search threads…", same style as space members search input.
Create button: icon-only (`plus`), disabled/greyed, tooltip "Coming soon".

### Thread List Item
- Title: bold, truncated (single line, `text-overflow: ellipsis`)
- Lock icon: inline before title, `isClosed` only
- Meta row: muted color (`--text-muted`), same typography as pinned message meta rows
- Hover: elevated background — follow `SearchResultItem` hover styles from `SearchResults.scss`
- Cursor: pointer
- Padding: matches `mobile-drawer__item-box` (10px)
- Border-radius: `rounded-lg` (8px)

### Section Headers
Uppercase, small, muted — matches Discord section label style. Consistent with other grouped list headers in the app (e.g. notification date dividers).

### Empty / No-Results States
Matches `PinnedMessagesPanel` empty state: centered icon + primary message + hint text.

---

## File Inventory

### New Files
| File | Purpose |
|------|---------|
| `src/components/thread/ThreadsListPanel.tsx` | Panel component |
| `src/components/thread/ThreadsListPanel.scss` | Panel styles |
| `src/components/thread/ThreadListItem.tsx` | Thread row component |
| `src/hooks/business/threads/useChannelThreads.ts` | React Query hook |

### Modified Files
| File | Change |
|------|--------|
| `src/db/messages.ts` | Add `channel_threads` store (DB v10, `if (oldVersion < 10)` upgrade block), `by_channel` index, `getChannelThreads()` method |
| `src/services/MessageService.ts` | Write/update `channel_threads` entries on thread lifecycle events; invalidate `['channel-threads', ...]` on thread deletion |
| `src/components/space/Channel.tsx` | Add Threads button to header, render `ThreadsListPanel`, add `'threads'` to `ActivePanel` union |
| `src/components/ui/DropdownPanel.tsx` | Add `headerContent?: React.ReactNode` prop |
| `src/api/quorumApi.ts` | Add `ChannelThread` type |

---

## Known Limitations & Deferred Work

- **Create Thread** — Button is a placeholder. Creating a thread from scratch requires a title-entry UI flow. Deferred to Phase 2.
- **Search** — In-memory only, filters by title/titleSnapshot. No full-text search across thread content.
- **`hasParticipated` accuracy** — Only tracks replies sent after this feature ships. Not backfilled (irrelevant since threads aren't on production yet).
- **Stale list on deletion** — `useChannelThreads` has 30s staleTime. `MessageService` invalidates the query on thread deletion so the list refreshes promptly. Other stale scenarios (e.g. another user creating a thread) refresh at next staleTime expiry or on panel reopen.
- **Phase 2 ideas** — Thread notifications/unread indicators per thread, full-text thread search, thread creation from scratch flow.

---

*Created: 2026-03-12*
*Updated: 2026-03-12 — Fixed 8 issues from spec review: openThread signature, DropdownPanel header slot, titleSnapshot in canonical interface, hasParticipated identity source, threads/thread panel interaction, query invalidation on deletion, DB v10 upgrade block, quorum-shared migration accuracy*
