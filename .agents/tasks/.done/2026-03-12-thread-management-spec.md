---
type: spec
title: "Thread Management: Close, Auto-Close, and Remove"
status: draft
ai_generated: true
created: 2026-03-12
updated: 2026-03-12
related_docs:
  - "docs/features/messages/thread-panel.md"
  - "docs/features/modals.md"
  - "docs/features/action-queue.md"
  - "docs/features/mute-user-system.md"
---

# Thread Management: Close, Auto-Close, and Remove

> **AI-Generated**: May contain errors. Verify before use.

## Overview

Adds three capabilities to the existing thread system:

1. **Close/Reopen** — Thread author or moderators can close a thread (no new replies) and reopen it
2. **Auto-close** — Preset duration after last activity; check-on-read pattern (like mute expiry)
3. **Remove thread** — Thread author can remove a thread if it contains no replies from other users

These features are managed through a new Thread Settings Modal, accessed via a cog icon in the ThreadPanel header.

## Features

### Close / Reopen Thread

- Thread author or users with `message:delete` permission can close or reopen a thread
- Closed threads remain viewable — the MessageComposer is replaced with a notice: "This thread has been closed"
- Below the notice, users who can reopen (author or moderators) see a "Reopen" link
- ThreadIndicator on root messages shows a subtle closed state (e.g., lock icon or muted text)
- If a thread is open when a peer broadcasts `close`, the composer swaps to the closed notice without jarring transitions

### Auto-Close

- Thread author or moderators can set an auto-close duration from presets: Never (default), 1 hour, 24 hours, 3 days, 1 week
- Uses **check-on-read** pattern (same as mute expiry in `isUserMuted()`): no background timer; the deadline is evaluated when the thread is opened
- When someone opens an expired thread: `lastActivityAt + autoCloseAfter <= Date.now()` → thread renders as closed, opener broadcasts a `close` action so peers also see it
- `lastActivityAt` is updated whenever a new reply is added (both send and receive paths)
- Two users opening an expired thread simultaneously is handled by idempotency — the second `close` broadcast is a no-op since `isClosed` is already `true`

### Remove Thread

- **Author only** — only the thread creator can remove a thread
- **Condition**: no replies from other users. The author may have any number of their own replies — those are bulk-cleaned on removal
- Full condition check: `rootMessage.senderId === currentUserAddress` AND `threadMeta.createdBy === currentUserAddress` AND zero messages where `senderId !== currentUserAddress` (queried via `getThreadMessages()`)
- **Remove action**: strips `threadMeta` from root message, peers independently clean up the author's replies from their own IndexedDB via the `by_thread` index
- Single `remove` broadcast — peers receiving it query `by_thread` index and delete all messages where `senderId === threadAuthor`. No individual `RemoveMessage` broadcasts needed
- If the ThreadPanel is open when a peer broadcasts `remove`, the panel detects `rootMessage.threadMeta` becoming undefined and auto-closes

## Data Model

### ThreadMeta Changes (`src/api/quorumApi.ts`)

Existing fields unchanged. New optional fields:

```typescript
export type ThreadMeta = {
  threadId: string;
  createdBy: string;
  customTitle?: string;
  // New fields:
  isClosed?: boolean;          // Thread is closed (no new replies)
  closedBy?: string;           // Address of who closed it
  autoCloseAfter?: number;     // Duration in ms (preset-derived)
  lastActivityAt?: number;     // Timestamp of last reply, used for auto-close check
};
```

### ThreadMessage Action Extension

Existing actions: `'create' | 'updateTitle'`. New actions:

```typescript
action: 'create' | 'updateTitle' | 'close' | 'reopen' | 'updateSettings' | 'remove';
```

| Action | Purpose |
|--------|---------|
| `close` | Sets `isClosed: true`, `closedBy` on root message's threadMeta |
| `reopen` | Sets `isClosed: false`, clears `closedBy` |
| `updateSettings` | Updates `autoCloseAfter` on threadMeta. "Never" = field deleted (not `0` or `undefined` value) |
| `remove` | Strips `threadMeta` from root message, signals peers to clean up replies |

## Architecture

### Action Queue Integration

All new actions use `submitChannelMessage()` which already routes through the `send-channel-message` action queue handler for space messages. No new action queue handler types needed. The actions automatically get:

- Optimistic UI updates (handled locally via `setActiveThreadRootMessage`)
- Action queue persistence and offline support
- Triple Ratchet encryption
- Retry with exponential backoff

The `remove` action's cleanup (deleting orphaned replies from IndexedDB) happens on the **receiving side** in `processMessage`/`addMessage`, not in the action queue handler. The queue handler just encrypts and sends the broadcast.

### Send Path (Channel.tsx)

New handlers following the existing `handleUpdateThreadTitle` pattern:

| Handler | Builds | Broadcasts |
|---------|--------|------------|
| `handleSetThreadClosed(threadId, true)` | `{...threadMeta, isClosed: true, closedBy: address}` | `action: 'close'` |
| `handleSetThreadClosed(threadId, false)` | `{...threadMeta, isClosed: false}` + clears `closedBy` | `action: 'reopen'` |
| `handleUpdateThreadSettings(threadId, autoCloseAfter)` | `{...threadMeta, autoCloseAfter}` | `action: 'updateSettings'` |
| `handleRemoveThread(threadId)` | Broadcasts with `{threadId, createdBy}` in payload | `action: 'remove'` |

> **Naming note:** The existing `closeThread` in `ThreadActions` means "close the thread panel UI" (set `activePanel` to null). The new `handleSetThreadClosed` is deliberately named differently to avoid confusion. In `ThreadActions`, the new method is `setThreadClosed` (not `closeThread`).

Each handler also calls `setActiveThreadRootMessage()` for immediate local display update (stale snapshot pattern from thread-panel doc).

### Receive Path (MessageService.ts)

Both `processMessage` (IndexedDB) and `addMessage` (React Query cache) handle new actions:

**Auth checks:**
- `close` / `reopen` / `updateSettings`: sender is thread author (`threadMeta.createdBy`) OR sender has `message:delete` permission (client-enforced, same as mute)
- `remove`: sender is thread author AND root message sender (stricter — moderators cannot remove threads)

**Processing:**
- `close`: spread-merge `isClosed: true, closedBy: senderId` into root message's `threadMeta`
- `reopen`: spread-merge `isClosed: false`, delete `closedBy` from `threadMeta`
- `updateSettings`: spread-merge `autoCloseAfter` into `threadMeta`
- `remove`: the broadcast payload includes `threadMeta: { threadId, createdBy }` so peers can identify the thread and author. Strip `threadMeta` from root message entirely; query `by_thread` index for all messages with that `threadId` and delete them all (by definition, all replies are the author's own since the remove condition requires no other users' replies); invalidate channel messages React Query cache

### Auto-Close Check (Channel.tsx)

On thread open (in the existing `handleOpenThread` flow), after resolving the root message:

```
if (threadMeta.autoCloseAfter && threadMeta.lastActivityAt) {
  if (threadMeta.lastActivityAt + threadMeta.autoCloseAfter <= Date.now()) {
    // Thread has expired — broadcast close and render as closed
    handleSetThreadClosed(threadId, true);
  }
}
```

### lastActivityAt Updates

**Initialization:** `lastActivityAt` is set to `Date.now()` during thread creation (the `create` action) and when `autoCloseAfter` is first set via `updateSettings`. Without initialization, a thread with `autoCloseAfter` but no replies would have `lastActivityAt === undefined`, causing the auto-close check to skip.

**Ongoing updates:** When a new thread reply is added:
- **Send path** (`submitChannelMessage` for thread replies): update `lastActivityAt` on root message's `threadMeta` in IndexedDB and React Query cache
- **Receive path** (`processMessage`/`addMessage` for thread replies): same update

**Stale snapshot note:** `lastActivityAt` updates do NOT need to call `setActiveThreadRootMessage` — the auto-close check in `handleOpenThread` reads the root message fresh from the DB/cache, not from the stale snapshot.

### ThreadContext Changes

New actions exposed through `ThreadActions`:

```typescript
interface ThreadActions {
  openThread: (message: MessageType) => void;
  closeThread: () => void;
  submitMessage: (message: string | object, inReplyTo?: string) => Promise<void>;
  submitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;
  updateTitle: (...) => Promise<void>;
  // New:
  setThreadClosed: (threadId: string, close: boolean) => Promise<void>;
  updateThreadSettings: (threadId: string, autoCloseAfter: number | undefined) => Promise<void>;
  removeThread: (threadId: string) => Promise<void>;
}
```

These are set via `useEffect → setThreadActions()` in Channel.tsx, following the existing pattern.

## UI Design

### Thread Settings Modal (`ThreadSettingsModal.tsx`)

**Modal system**: ModalProvider (not Layout-Level). Follows the guidance from modals.md — settings-style modal triggered from ThreadPanel header, similar to ConversationSettingsModal.

**Registration:**
1. Add state to `useModalState.ts`: `threadSettings: { isOpen: boolean; threadId: string; rootMessage: MessageType; }`
2. Add to `ModalProvider.tsx`: render `ThreadSettingsModal` when open
3. Access via `useModals()`: `openThreadSettings(threadId, rootMessage)`

**Layout** (`Modal size="small"`, title: "Thread Settings"):

```
Container
  ├── Auto-close section
  │   ├── Label: "Auto-close after"
  │   ├── Select dropdown with presets:
  │   │   Never (default), 1 hour, 24 hours, 3 days, 1 week
  │   └── text-small text-subtle: "Thread will close when inactive for this duration"
  │
  ├── Spacer (border) — same as ConversationSettingsModal pattern
  │
  ├── Close/Reopen section
  │   └── Button type="subtle" fullWidth
  │       Text: "Close Thread" or "Reopen Thread" (toggles based on isClosed)
  │
  ├── Spacer (border) — only renders if thread author
  │
  └── Remove Thread section — only renders if thread author
      ├── Button type="danger"
      │   - enabled: double-click confirm pattern (5s revert, from Danger.tsx/FolderEditorModal)
      │   - disabled={true} when thread has replies from other users
      └── text-small note when disabled:
          "Threads with replies from other users cannot be removed"
```

**Patterns reused:**
- Modal structure: ConversationSettingsModal (Container, Spacer with border separators)
- Double-click confirm: Danger.tsx / FolderEditorModal (`deleteConfirmationStep` state, `setTimeout` 5s revert)
- Select/dropdown for presets: existing Select primitive

### Cog Icon in ThreadPanel Header

- Position: right side of header, between title area and existing close button
- Renders only when `isThreadAuthor || hasMessageDeletePermission`
- Uses `<Icon name="settings" size="sm" />` inside a `<Button>` styled like the existing close button (unstyled, circular hover state matching `.thread-panel__close` pattern)
- onClick: `openThreadSettings(threadId, rootMessage)` from `useModals()`

### Closed Thread State in ThreadPanel

When `threadMeta.isClosed === true`:
- MessageComposer area replaced with centered notice: `text-body text-subtle` "This thread has been closed"
- Below the notice, if user can reopen (author or `message:delete` permission): a "Reopen" text link
- Rest of the panel (header, messages) remains unchanged — thread is read-only but viewable

### ThreadIndicator Changes

ThreadIndicator on root messages in the main feed shows a subtle visual cue when thread is closed. Implementation detail to be refined during development (e.g., muted reply count text, small lock icon, or both).

## Permission Model

| Action | Who | Check |
|--------|-----|-------|
| Close thread | Author or moderators | `threadMeta.createdBy === sender` OR `message:delete` permission |
| Reopen thread | Author or moderators | Same as close |
| Set auto-close | Author or moderators | Same as close |
| Remove thread | Author only | `threadMeta.createdBy === sender` AND `rootMessage.senderId === sender` AND no other users' replies |
| View settings modal | Author or moderators | Cog icon visibility gate |

Permission checks are **client-enforced** on the receiving side (same as mute). Each client independently validates the sender's authority.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Thread open when peer closes | Composer swaps to closed notice, no jarring transition |
| Thread open when peer removes | Panel detects `threadMeta` gone, auto-closes panel |
| Two users auto-close simultaneously | Idempotent — second `close` broadcast is no-op |
| Remove with orphaned replies | All thread replies deleted via `by_thread` index on receive side; single broadcast. By definition all replies are author's own (remove condition enforced) |
| Manual close on thread with auto-close set | Manual close takes precedence; on reopen, auto-close timer effectively resets (uses `lastActivityAt`) |
| Set auto-close on already-closed thread | Allowed independently — the setting is stored but only takes effect on next reopen (auto-close check runs on thread open) |
| User submits message while peer closes thread | Defense-in-depth: `handleSubmitThreadMessage` checks `isClosed` on the root message before sending. If closed, submission is silently rejected |
| Remove broadcast in-flight while reply sent | Defense-in-depth: orphaned replies (if any slip through) are invisible (filtered from main feed by 3-layer defense) and can be cleaned up by future background process using `by_thread` index |

## Scope & Migration Notes

- All type changes are in `src/api/quorumApi.ts` — the same file planned for future migration to `quorum-shared`
- New fields on `ThreadMeta` and new actions on `ThreadMessage` extend existing types with no new files
- Auto-close logic lives in Channel.tsx (desktop-only, won't migrate to shared)
- No new action queue handler types — uses existing `send-channel-message` path
- No DB schema changes — `by_thread` index (added in DB v9) already supports all needed queries

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/api/quorumApi.ts` | Add fields to `ThreadMeta`, extend `ThreadMessage.action` union |
| `src/components/space/Channel.tsx` | New handlers, auto-close check on thread open, `lastActivityAt` updates, new ThreadContext actions |
| `src/services/MessageService.ts` | Handle new actions in `processMessage` + `addMessage` |
| `src/components/thread/ThreadPanel.tsx` | Cog icon, closed state composer replacement, reopen link |
| `src/components/thread/ThreadPanel.scss` | Styles for cog icon, closed notice |
| `src/components/thread/ThreadIndicator.tsx` | Closed state visual cue |
| `src/components/modals/ThreadSettingsModal.tsx` | **New file** — modal component |
| `src/hooks/business/ui/useModalState.ts` | Add `threadSettings` state |
| `src/components/context/ModalProvider.tsx` | Render ThreadSettingsModal |
| `src/components/context/ThreadContext.tsx` | Add new actions to `ThreadActions` interface |

## Related Documentation

- [Thread Panel](../docs/features/messages/thread-panel.md) — Full thread architecture
- [Modal System](../docs/features/modals.md) — Two-system modal architecture
- [Action Queue](../docs/features/action-queue.md) — Queue integration for space messages
- [Mute User System](../docs/features/mute-user-system.md) — Check-on-read pattern reference

---

_Created: 2026-03-12_
_Updated: 2026-03-12 (spec review fixes: permission name correction, naming collision resolution, lastActivityAt initialization, remove payload clarification, submit guard, auto-close semantics)_
