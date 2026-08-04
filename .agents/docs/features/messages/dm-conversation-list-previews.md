---
type: doc
title: DM Conversation List Previews
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-08-04
---

# DM Conversation List Previews

## Overview

Shows message previews and timestamps in the DM conversation list, similar to Signal/Telegram. Provides quick context about recent messages without opening the conversation.

## Implementation

### Display Format

```
[Avatar] Jennifer........................3:45 PM
         Hey, did you see the latest update?
         This is the second line of preview...
```

- **Line 1:** Avatar (44px) + Display Name + Timestamp (right-aligned)
- **Lines 2-3:** Message preview (up to 2 lines with ellipsis)

### Date Format

- Today: "3:45 PM"
- Yesterday: "Yesterday"
- Older: "11 Nov", "6 Dec"

### Colors

- **Normal state:** `text-muted` for preview/timestamp
- **Active state:** `bg-sidebar-active-accent` (accent color @ 20% opacity), `text-subtle` for preview/timestamp
- **Hover state:** `bg-sidebar-hover`

## Architecture

**Hybrid approach:** Store `lastMessageId` in DB, compute preview on-demand in UI

### Key Files

- `src/api/quorumApi.ts:84` - Added `lastMessageId` to Conversation type
- `src/db/messages.ts:657` - Track last message when saving
- `src/utils/messagePreview.ts` - Generate plain text previews
- `src/utils/dateFormatting.ts:49` - Compact time formatter
- `src/hooks/business/conversations/useConversationPreviews.ts` - React Query hook
- `src/components/direct/DirectMessageContact.tsx` - Two-line layout
- `src/components/direct/DirectMessageContactsList.tsx` - Integrate previews
- `src/styles/_colors.scss:51` - `--color-bg-sidebar-active-accent` variable

### Message Preview Logic

`generateMessagePreview()` returns an object: `{ text: string, icon?: string }`

**Shows:**
- Text messages: Markdown stripped, up to 100 chars
- Images: `{ text: "Photo", icon: "image" }` (renders with Icon component)
- Future: Videos (`video` icon), Attachments (`paperclip` icon) - commented out

**Hides:** System messages (edits, reactions, profile updates) - returns empty to fall back to previous content

**Special:** Deleted messages show `Message deleted` (no icon)

### What the query owns — and what it must never own

`useConversationPreviews` returns `Record<conversationId, { preview, previewIcon }>`
and **nothing else**. `withPreviews(conversations, previews)`, exported from the same
file, merges that payload onto the caller's live conversation rows at render time.
The rows win on every field they carry.

This split is load-bearing, not stylistic. The query key is
`conversationId:lastMessageId`, so it only moves when a message arrives. Anything
else copied into the cached value freezes there until that happens. The hook used
to return `{ ...conv, preview, previewIcon }` — a full copy of every row — and the
sidebar rendered the copy, which produced two separate bugs:

- reading a DM advances `lastReadTimestamp` without touching any message id, so the
  list kept rendering the pre-read snapshot and the unread dot never cleared;
- a QNS `primaryUsername` resolved after the query ran was dropped, and had to be
  re-attached by hand in the list component.

Regression guard:
`src/dev/tests/hooks/conversationPreviewsReadState.unit.test.tsx`.

## Performance

- **IndexedDB Query:** O(1) direct key lookup per conversation
- **Caching:** React Query with 30s staleTime, 5min gcTime
- **Batching:** Processes in chunks of 10 to avoid overwhelming IndexedDB
- **Optimization:** Stable query key prevents unnecessary refetches

**Performance Profile:**
- 50 conversations: ~50-100ms initial, 0ms cached
- 100 conversations: ~100-200ms initial, 0ms cached

## Cache Invalidation

`useInvalidateConversation` hook invalidates `['conversation-previews']` query key when:
- New message arrives
- Conversation updates

It exists for cases where the preview text itself changed under an unchanged
`lastMessageId` — an edit or a delete. It is **not** how read state, timestamps or
identity stay fresh; those are never cached here in the first place. Do not add
`['conversation-previews']` to a mutation just to refresh a conversation field. That
forces a re-read of N messages from IndexedDB and papers over a staleness that the
payload shape above already prevents.

## i18n Support

Uses Lingui macro syntax for automatic extraction:
- `t\`Photo\`` (with `image` icon)
- `t\`Message deleted\``
- `t\`Yesterday\``

Future translations ready:
- `t\`Video\`` (with `video` icon)
- `t\`Attachment\`` (with `paperclip` icon)

---

**Updated:** 2026-08-04
**Verified:** 2025-12-09 - File paths confirmed current

*Last updated: 2026-08-04*
