---
type: bug
title: "Thread-Aware Navigation: Panel Doesn't Open and Message Not Highlighted"
status: open
priority: high
ai_generated: true
created: 2026-03-11
updated: 2026-03-11
related_tasks:
  - tasks/2026-03-10-thread-aware-navigation.md
related_docs:
  - docs/features/messages/thread-panel.md
---

# Thread-Aware Navigation: Panel Doesn't Open and Message Not Highlighted

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Summary

Three separate bugs prevented thread-aware navigation from working across bookmarks, search, and pinned messages. All three are fixed and confirmed working. Pending commit.

---

## Bug A: No highlight after scroll (bookmarks)

**Status: Fixed, confirmed ✓**

**Root cause:** `Message.tsx` calls `useMessageHighlight()` independently — each Message component has its own isolated hook instance. When `MessageList` called `highlightMessage(id)` on its own instance, the Message components never saw the state change. The only cross-component signal `Message.tsx` listens to is `location.hash === '#msg-{id}'`.

**Fix:**
- `src/components/message/MessageList.tsx` — When `highlightOnScroll=true`, set `window.location.hash = '#msg-{scrollToMessageId}'` instead of calling the internal `highlightMessage` hook
- `src/components/thread/ThreadPanel.tsx` — Passes `highlightOnScroll={true}` to MessageList

---

## Bug B: Search — thread panel never opens

**Status: Fixed, confirmed ✓**

**Root cause (two layers):**

1. `useSearchResultsState` typed `onNavigate` as `(spaceId, channelId, messageId)` — **no `threadId`**. The `threadId` was being dropped before it ever reached `buildMessageHash`.

2. `useSearchResultFormatting` was passing `message.threadId` but search returns the root message of a thread (not a reply). Root messages have `threadMeta.threadId`, not `threadId`. So `threadId` was always `undefined`.

**Fix:**
- `src/hooks/business/search/useSearchResultsState.ts` — Added `threadId?: string` to `onNavigate` signature and `handleNavigate`, so it flows through to `useGlobalSearchNavigation`
- `src/hooks/business/search/useSearchResultFormatting.ts` — Uses `message.threadId ?? message.threadMeta?.threadId` to handle both reply messages and root messages

---

## Bug C: Pinned messages — nothing happens on "Jump" click
## Also: Bookmarks same-channel — thread panel doesn't open

**Status: Fixed, confirmed ✓**

**Root cause:** Same-channel navigation. When already on the target channel, `react-router` doesn't remount `Channel` (keyed on `spaceId-channelId`), so `useEffect([spaceId, channelId])` never re-fires to parse the new thread hash. The click handler fired correctly and built the right URL — the hash just went unprocessed.

**Fix:**
- `src/components/space/Channel.tsx` — Added `useLocation` import, `const location = useLocation()`, and added `location.hash` to thread detection effect deps: `[spaceId, channelId, location.hash]`

---

## Files Changed (working tree, pending commit)

| File | Change |
|------|--------|
| `src/components/space/Channel.tsx` | `useLocation` + `location.hash` in thread detection effect deps |
| `src/components/message/MessageList.tsx` | `highlightOnScroll` sets `window.location.hash` instead of calling internal hook |
| `src/components/thread/ThreadPanel.tsx` | Passes `highlightOnScroll={true}` to MessageList |
| `src/hooks/business/search/useSearchResultsState.ts` | Added `threadId?` to `onNavigate` signature, passes through |
| `src/hooks/business/search/useSearchResultFormatting.ts` | Uses `message.threadId ?? message.threadMeta?.threadId` |

---

## Architecture Reference

Thread-aware navigation flow (all entry points, same-channel and cross-channel):

```
Entry point (BookmarksPanel / PinnedMessagesPanel / Search)
  → buildMessageHash(messageId, threadId)  // #thread-{threadId}-msg-{msgId}
  → navigate('/spaces/spaceId/channelId#thread-...-msg-...')

Cross-channel: Channel remounts (key changes: spaceId-channelId)
Same-channel:  location.hash changes → useEffect([spaceId, channelId, location.hash]) re-fires

  → parseMessageHash(window.location.hash) detects thread hash
  → messageDB.getMessageById(identifier) OR getRootMessageByThreadId()
  → setActiveThreadId(), setActivePanel('thread')
  → queueMicrotask: threadCtx.setThreadState({ targetMessageId: messageId })
  → ThreadPanel renders with scrollToMessageId={targetMessageId}
  → MessageList scrollToMessageId effect fires → scrollToMessage()
  → window.location.hash = '#msg-{id}' → Message self-highlights via location.hash check
```

---

## Key Files

| File | Relevance |
|------|-----------|
| `src/components/space/Channel.tsx:705-765` | Thread hash detection useEffect (deps: `[spaceId, channelId, location.hash]`) |
| `src/components/space/Channel.tsx:128-140` | State sync that preserves targetMessageId |
| `src/components/message/MessageList.tsx:441-476` | scrollToMessageId handler — sets `window.location.hash` for highlight |
| `src/components/thread/ThreadPanel.tsx:177-206` | MessageList render with scrollToMessageId + highlightOnScroll |
| `src/components/message/Message.tsx:295-307` | Hash-based highlight detection (`location.hash === '#msg-{id}'`) |
| `src/hooks/business/messages/useMessageHighlight.ts` | LOCAL state only — not shared across components |
| `src/hooks/business/search/useSearchResultsState.ts` | Middleware that must pass threadId through |
| `src/hooks/business/search/useSearchResultFormatting.ts` | Uses `threadMeta?.threadId ?? threadId` for root messages |
| `src/utils/messageHashNavigation.ts` | buildMessageHash / parseMessageHash utilities |

---

_Created: 2026-03-11_
_Updated: 2026-03-11_
