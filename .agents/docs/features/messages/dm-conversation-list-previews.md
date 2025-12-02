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

## i18n Support

Uses Lingui macro syntax for automatic extraction:
- `t\`Photo\`` (with `image` icon)
- `t\`Message deleted\``
- `t\`Yesterday\``

Future translations ready:
- `t\`Video\`` (with `video` icon)
- `t\`Attachment\`` (with `paperclip` icon)

---

**Updated:** 2025-01-14
