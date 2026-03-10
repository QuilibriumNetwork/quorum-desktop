---
type: task
title: "Thread root soft-delete fix and deleted message placeholder"
status: open
complexity: medium
ai_generated: true
created: 2026-03-10
updated: 2026-03-10
related_docs:
  - "docs/features/messages/thread-panel.md"
related_tasks:
  - "tasks/threaded-conversations.md"
---

# Thread Root Soft-Delete Fix and Deleted Message Placeholder

> **AI-Generated**: May contain errors. Verify before use.

**Files**:
- `src/hooks/business/messages/useMessageActions.ts:287-367` — local deletion logic
- `src/services/MessageService.ts:517-537` — existing deleteOrSoftDelete (DB path)
- `src/services/MessageService.ts:~1168-1192` — remove-message handler in addMessage() (cache path)
- `src/components/message/Message.tsx:~1306-1325` — React.memo comparator
- `src/components/message/Message.tsx` — deleted message placeholder rendering
- `src/components/thread/ThreadPanel.tsx:16-24` — header title rendering (getThreadTitle)

## What & Why

The local deletion path in `useMessageActions.ts` hard-deletes thread root messages, orphaning all thread replies with no way to rediscover them. Meanwhile, the remote deletion path in `MessageService.ts` (commit `9ef858ab`) already correctly soft-deletes thread roots in IndexedDB, preserving `threadMeta` so threads remain accessible. This creates an inconsistency: the deleting user loses the thread entirely, but remote peers keep it.

Additionally, the remote path has a second gap: the `addMessage()` handler that updates the React Query cache unconditionally filters out deleted messages, even those with `threadMeta`. So even the remote soft-delete is partially broken — the DB is correct but the UI removes the message from the feed until the next cache invalidation.

Thread titles remain derived at runtime from `rootMessage.content.text`. When a root is soft-deleted, the title correctly falls back to "Thread" — this is the intended privacy-respecting behavior. A future `customTitle` field in `ThreadMeta` (explicitly set by the user, broadcast with consent) will override this fallback without the privacy concerns of auto-extracted titles.

## Context

- **Existing pattern**: `MessageService.ts` already has a `deleteOrSoftDelete` helper that checks for `threadMeta` and preserves it during soft-delete — the local path needs to mirror this
- **Two code paths for remote deletion**: `processMessage()` soft-deletes correctly in IndexedDB, but `addMessage()` hard-removes from React Query cache — both need thread-awareness
- **Privacy decision**: Auto-extracted titles are NOT persisted or broadcast. Deleting a message deletes the title too. Future custom titles will use `ThreadMeta.customTitle` (user-consented broadcast)
- **Detection fragility**: `PostMessage.text` is typed as `string | string[]` — the soft-delete sentinel `text: ''` must be checked robustly

## Implementation

### Phase 1: Fix Local Soft-Delete

1. **Add threadMeta check to local deletion** (`src/hooks/business/messages/useMessageActions.ts`)
   - In the delete handler, before hard-deleting, check if `message.threadMeta` exists
   - If `threadMeta` exists:
     - In React Query cache: use `map()` (not `filter()`) to replace message content with `{ type: 'post', senderId: message.content.senderId, text: '' }`, preserve `threadMeta` — keep message in the feed
     - In IndexedDB: call `messageDB.saveMessage()` with the soft-deleted message (same pattern as `deleteOrSoftDelete` in MessageService.ts)
   - If no `threadMeta`: current hard-delete behavior unchanged (remove from cache + `messageDB.deleteMessage()`)
   - Reference: Mirror the `deleteOrSoftDelete` helper in `MessageService.ts:517-537`

2. **Fix remote deletion cache handler** (`src/services/MessageService.ts:~1168-1192`)
   - In the `addMessage()` handler for `remove-message`, before filtering the message out of the React Query cache, check if the target message has `threadMeta`
   - If `threadMeta` exists: use `map()` to replace message content with soft-deleted form (empty text, preserved `threadMeta`) instead of `filter()` removing it
   - If no `threadMeta`: current `filter()` behavior unchanged

### Phase 2: Render Deleted Message Placeholder

3. **Detect and render placeholder for soft-deleted root messages** (`src/components/message/Message.tsx`)
   - Detect condition inside the `contentData.type === 'post'` rendering block: check if text is empty AND `message.threadMeta` exists
   - Handle both `string` and `string[]` text types: `!content.text || (Array.isArray(content.text) && content.text.every(s => !s))`
   - Render an italicized, i18n-wrapped placeholder: `t`[Original message was deleted]``
   - ThreadIndicator continues to render below the placeholder (thread remains accessible)
   - The placeholder should use a muted/subtle text style consistent with system messages

4. **Add `threadMeta` to React.memo comparator** (`src/components/message/Message.tsx:~1306-1325`)
   - Add `JSON.stringify(prevProps.message.threadMeta) !== JSON.stringify(nextProps.message.threadMeta)` to the `shouldRerender` conditions
   - This ensures Message re-renders when threadMeta changes (e.g., during soft-delete transition)

## Thread Title Design (Context for Future Work)

Thread titles use a **split design** based on privacy:

| Title Type | Storage | Broadcast | Survives Root Deletion | When |
|---|---|---|---|---|
| Auto-extracted | None (runtime) | No | No — falls back to "Thread" | Current behavior |
| Custom (future) | `ThreadMeta.customTitle` | Yes | Yes — user explicitly published it | Future task |

**Title resolution order:**
1. `threadMeta.customTitle` — if author set one (future)
2. Derive from `rootMessage.content.text` — runtime extraction
3. `"Thread"` — fallback (soft-deleted root, empty message)

This respects user privacy: deleting a message deletes the auto-title. Custom titles are a separate deliberate publication.

## Verification

✅ **Local soft-delete preserves thread access**
   - Create a thread with replies → delete the root message → thread panel still opens via ThreadIndicator → all replies visible

✅ **Remote soft-delete preserves thread in UI**
   - Delete root message on one client → other client receives broadcast → message stays in feed with placeholder (no disappear-then-reappear on cache invalidation)

✅ **Placeholder renders correctly**
   - Soft-deleted root message shows italicized placeholder text, not blank space
   - ThreadIndicator still visible below placeholder
   - Placeholder text is localized (i18n wrapped)

✅ **Title falls back to "Thread" after deletion**
   - Create thread → delete root message → ThreadPanel header shows "Thread" (not stale title)

✅ **Non-thread message deletion unchanged**
   - Delete a regular message (no thread) → hard-deleted as before, removed from feed

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

## Definition of Done

- [x] Local deletion soft-deletes thread roots (mirrors MessageService)
- [x] Remote deletion cache handler preserves thread roots in React Query
- [x] Soft-deleted root messages render i18n placeholder text
- [x] `threadMeta` added to Message React.memo comparator
- [x] ThreadIndicator remains visible on soft-deleted messages
- [x] TypeScript passes
- [ ] Manual testing successful — all verification scenarios pass
- [ ] No console errors
- [x] thread-panel.md doc updated to reflect changes

---

_Created: 2026-03-10_
