# Mobile Thread Reply Visibility — Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Branch:** feat/message-threads

---

## Problem

Thread replies are filtered from the main message feed at four layers in quorum-desktop. Since the mobile hub will not have a thread panel for the foreseeable future, thread replies are completely invisible to mobile users — no fallback, no inline display, no way to view them. This is a data loss risk.

---

## Goal

Make thread replies visible to mobile users by surfacing them inline in the main message feed, using the existing reply preview (quote) component to provide context about the thread root.

---

## Scope

- **In scope:** quorum-desktop only (web + Electron + React Native via shared code). The platform flag approach means mobile naturally benefits when it consumes the same code.
- **In scope:** Persisted messages loaded from IndexedDB and the in-memory React Query cache.
- **Out of scope:** Real-time routing of newly arriving thread replies in `MessageService.ts` (see Known Limitations).
- **Out of scope:** Migrating thread types to `quorum-shared`, mobile thread panel implementation.

---

## Design

### 1. Platform Capability Flag

Add `supportsThreadPanel` to `platformFeatures` in both platform files:

**`src/utils/platform.ts`** (web + Electron):
```ts
supportsThreadPanel: !isMobile(),
```

**`src/utils/platform.native.ts`** (React Native):
```ts
supportsThreadPanel: false,
```

Both files have their own `platformFeatures` object resolved via module aliasing. Both must be updated — adding to only one leaves the other with `undefined`, which would be silently falsy but untestable and fragile.

- `true` on desktop/Electron — behavior unchanged.
- `false` on mobile — thread reply filters become no-ops, replies flow into the main feed.

### 2. Filter Point Guards

Four existing filter points each get a one-line guard:

**`getMessages()`** (`src/db/messages.ts` ~line 439):
```ts
if (platformFeatures.supportsThreadPanel && cursor.value.isThreadReply) {
  cursor.continue();
  return;
}
```

**`getFirstUnreadMessage()`** (`src/db/messages.ts` ~line 2065):
```ts
if (platformFeatures.supportsThreadPanel && message.isThreadReply) {
  cursor.continue();
  return;
}
```

**`useChannelMessages`** (`src/hooks/business/channels/useChannelMessages.ts` ~line 74):
```ts
if (platformFeatures.supportsThreadPanel && msg.isThreadReply) return false;
```

**`loadMessagesAround`** (`src/hooks/queries/messages/loadMessagesAround.ts` ~line 78):
```ts
...((!platformFeatures.supportsThreadPanel || !targetMessage.isThreadReply) ? [targetMessage] : []),
```

This fourth point is critical: it is hit when the user taps a quote preview that navigates to a message not currently in the visible window. Without this guard, the tap target would be silently dropped, leaving the user scrolled to empty space.

On desktop the flag is `true`, so all four conditions are identical to today. On mobile the flag is `false`, all four filters are skipped.

### 3. Reply Preview Adapter in Message.tsx

The existing reply preview renders a quote when a message has `repliesToMessageId` inside `message.content`. Thread replies don't have that field — they have `threadId` as a **top-level field on `Message`** (not inside `message.content`).

A small adapter is added in `src/components/message/Message.tsx`:

**Existing flow:**
```
message.content.repliesToMessageId
  → messageList.find(m => m.messageId === message.content.repliesToMessageId)
  → render quote
```

**Extended flow (mobile only — `isThreadReply && !platformFeatures.supportsThreadPanel`):**
```
message.threadId   ← top-level field, NOT message.content.threadId
  → messageList.find(m => m.messageId === message.threadId)
  → render same quote component
```

The lookup for thread replies is: `messageList.find(m => m.messageId === message.threadId)`.

The same quote rendering component is reused. No new UI component needed.

**Tap behavior:** The click handler follows the existing pattern — navigate to `#msg-{foundMessage.messageId}` and scroll to it. Because `threadId` equals the root message's `messageId`, the navigation target is `#msg-{threadId}`. The implementer should use `foundMessage.messageId` (following the existing pattern), not hardcode `threadId` in the URL.

### 4. Edge Cases

| Scenario | Behavior |
|---|---|
| Root message not in local list | Existing "deleted" fallback: shows `[Original message was deleted]` |
| Thread root is soft-deleted | Same fallback — consistent with regular replies |
| Unread counts on mobile | Thread replies count toward unread (correct — user should know message exists) |
| Network requests | None — lookup is purely from in-memory message list |
| Future: mobile gets thread panel | Set `supportsThreadPanel: true` in `platform.native.ts`. Filter behavior restores. Adapter code path becomes unreachable and can be cleaned up. |

---

## Known Limitations

**Real-time message routing:** When a new thread reply arrives via WebSocket/sync, `MessageService.ts` routes it to the `['thread-messages', ...]` query cache and returns early — bypassing main feed invalidation. This routing branch is not changed by this spec. As a result, thread replies that arrive while the app is open will not appear in the mobile main feed until the user navigates away and back (triggering a fresh `getMessages()` DB read). This is a known limitation; fixing the real-time path is a follow-up task.

---

## Files Changed

| File | Change |
|---|---|
| `src/utils/platform.ts` | Add `supportsThreadPanel: !isMobile()` to `platformFeatures` |
| `src/utils/platform.native.ts` | Add `supportsThreadPanel: false` to `platformFeatures` |
| `src/db/messages.ts` | Guard `isThreadReply` filter in `getMessages()` and `getFirstUnreadMessage()` |
| `src/hooks/business/channels/useChannelMessages.ts` | Guard `isThreadReply` filter |
| `src/hooks/queries/messages/loadMessagesAround.ts` | Guard `isThreadReply` exclusion on `targetMessage` |
| `src/components/message/Message.tsx` | Add `threadId` lookup path in reply preview adapter (mobile only) |

---

## Non-Goals

- No new UI components
- No changes to quorum-mobile codebase directly
- No migration of thread types to quorum-shared (separate future task)
- No changes to how threads work on desktop
- No fix for real-time thread reply routing (separate follow-up)

---

*Created: 2026-03-11*
