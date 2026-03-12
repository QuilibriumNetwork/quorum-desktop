---
type: doc
title: Thread Visibility on Mobile — Guidance for quorum-mobile
status: done
created: 2026-03-11
updated: 2026-03-11
---

# Thread Visibility on Mobile — Guidance for quorum-mobile

> **Note:** Based on a snapshot of `D:\GitHub\Quilibrium\quorum-mobile` which may be outdated. The current mobile repo is more up to date — verify all file paths and logic before implementing.

## Background

Thread replies in Quorum Desktop are filtered from the main message feed at multiple layers, because the desktop UI has a dedicated thread panel (Discord-style side panel) where they live. Mobile (`quorum-mobile`) is a completely separate repository. It has no thread panel.

**The problem:** Thread replies sent from desktop are completely invisible to mobile users. There is no fallback. A mobile user in a channel where desktop users are actively threading will see gaps in the conversation.

---

## Good News: Most of the Work Already Exists

From exploring the local snapshot of `quorum-mobile`, the reply-quote UI is already implemented for regular replies (`repliesToMessageId`). Thread replies (`isThreadReply` / `threadId`) just need to be plugged into the same pattern.

---

## Data Model (from quorum-shared types)

Thread reply fields are **top-level on `Message`** (not inside `message.content`):

| Field | Type | Meaning |
|---|---|---|
| `isThreadReply` | `boolean` | This message lives in a thread, not the main feed |
| `threadId` | `string` | ID of the thread root message (also equals the root's `messageId`) |

Thread replies have **no** `repliesToMessageId`. The model is completely flat — no nesting, all replies point directly to the root via `threadId`.

---

## Current State in quorum-mobile (snapshot)

### No `isThreadReply` or `threadId` filtering found

`mmkvAdapter.ts` — `getMessages()` at lines 69–99 — loads all messages with no `isThreadReply` filter. This means thread replies are **already arriving in the message list on mobile**. They're just not being rendered with any special UI — they appear as plain messages with no context about the thread they belong to.

### Reply-quote UI already exists

`components/Chat/MessagesList.tsx` (lines 442–464) already renders a reply indicator for messages with `isReply`:

```tsx
{item.isReply && item.replyToAuthor && item.replyToMessageId && (
  <TouchableOpacity
    style={styles.replyIndicator}
    onPress={() => {
      const index = invertedMessages.findIndex((m) => m.id === item.replyToMessageId);
      if (index !== -1) {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }
    }}
  >
    <Text style={styles.replyIndicatorText}>
      Replying to {item.replyToAuthor}
    </Text>
  </TouchableOpacity>
)}
```

### How DisplayMessage is populated for replies

`components/Chat/types.ts` (lines 293–302) converts a `Message` to a `DisplayMessage`:

```ts
if ('repliesToMessageId' in content && content.repliesToMessageId) {
  displayMessage.isReply = true;
  displayMessage.replyToMessageId = content.repliesToMessageId;
  if (message.replyMetadata?.parentAuthor) {
    const parentMember = members[message.replyMetadata.parentAuthor];
    displayMessage.replyToAuthor =
      parentMember?.display_name || parentMember?.name || formatAddressDisplay(message.replyMetadata.parentAuthor);
  }
}
```

The `DisplayMessage` type already has `isReply`, `replyToMessageId`, and `replyToAuthor` fields.

---

## What Needs to Change

### Step 1: Extend the message-to-display conversion (`types.ts`)

In the same block that handles `repliesToMessageId`, add handling for `isThreadReply`:

```ts
// Existing: handle regular reply-quotes
if ('repliesToMessageId' in content && content.repliesToMessageId) {
  displayMessage.isReply = true;
  displayMessage.replyToMessageId = content.repliesToMessageId;
  // ... author lookup
}

// New: handle thread replies — show root message as quote
if (message.isThreadReply && message.threadId) {
  displayMessage.isReply = true;
  displayMessage.replyToMessageId = message.threadId; // threadId IS the root message's messageId
  // Look up the root message author from members or the messages list
  // The root message itself is a normal message in the feed (no isThreadReply flag)
  // You may need to pass the root message or its author into this conversion function
}
```

**Key detail:** `message.threadId` is a top-level field on `Message`, NOT inside `message.content`. Don't look for it in `content`.

### Step 2: Populate `replyToAuthor` for thread replies

The existing regular-reply path uses `message.replyMetadata?.parentAuthor` to find the author. Thread replies don't have `replyMetadata` — so you need another approach:

- **Option A:** Look up the root message by `message.threadId` from the current message list (find the message where `messageId === message.threadId`), then get its `senderId` from `content`
- **Option B:** Use a generic label like "thread" as the author if lookup is complex, then improve later

### Step 3: Verify scroll-to works

The existing tap handler (`scrollToIndex`) finds the target by `item.replyToMessageId`. Since `replyToMessageId` will be set to `message.threadId` (the root's `messageId`), and the root message is a normal message already in the feed, this should work without changes.

**Edge case:** If the root message is not in the current message window (e.g., old thread with root scrolled far away), `findIndex` returns `-1` and `scrollToIndex` is not called. This is acceptable fallback behavior — same as existing reply-quote behavior.

---

## Files to Modify (based on snapshot)

| File | Change |
|---|---|
| `components/Chat/types.ts` | Extend message conversion to handle `isThreadReply` + `threadId` → `isReply` + `replyToMessageId` |
| `components/Chat/MessagesList.tsx` | Likely no change — existing reply indicator UI reused automatically once `DisplayMessage` is populated correctly |

**No storage changes needed** — `mmkvAdapter.ts` already passes all messages through without filtering `isThreadReply`.

---

## What Does NOT Need to Change

- Storage layer — no filtering to remove
- `useMessages` hook — already loads all messages including thread replies
- Thread panel — not needed; inline display is the fallback
- Thread creation / sending thread replies — mobile users don't need to start threads
- `quorum-shared` types — `isThreadReply` and `threadId` are already on `Message`

---

## Known Limitation

**Real-time arriving replies:** The `mmkvAdapter` stores and loads from MMKV synchronously. Newly arriving thread replies that come in over WebSocket while the channel is open may or may not trigger a re-render depending on how the mobile app handles live message updates. This is worth verifying but is a separate concern from the display fix above.

---

## Related Desktop Implementation

For reference, the desktop fix (branch `feat/message-threads` in `quorum-desktop`) required gating four filter points behind a `supportsThreadPanel` flag, then adding a root-message quote adapter in `Message.tsx`. Mobile doesn't need the filter changes (no filters exist) — only the display adapter equivalent (Step 1–2 above).

---

*Created: 2026-03-11*
