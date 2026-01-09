---
type: doc
title: Message Preview Rendering
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Message Preview Rendering

## Overview

This document describes the **preview rendering systems** used across panels and search results. These systems are distinct from the full `Message.tsx` rendering and are optimized for displaying message content in compact, read-only contexts.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FULL MESSAGE RENDERING                               │
│                         (Chat View - Message.tsx)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Message.tsx ──► ENABLE_MARKDOWN && shouldUseMarkdown()?                    │
│                        │                                                    │
│              ┌─────────┴─────────┐                                          │
│              │ YES               │ NO                                       │
│              ▼                   ▼                                          │
│   MessageMarkdownRenderer    Token-based Fallback                           │
│   (full markdown support)    (plain text + special tokens)                  │
│                                                                             │
│   See: markdown-renderer.md (Dual Rendering Architecture)                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      PREVIEW RENDERING SYSTEMS                              │
│                    (Panels, Search, Notifications)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ RICH PREVIEWS (MessagePreview Component)                            │   │
│  │ Consumers: BookmarksPanel, PinnedMessagesPanel                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Raw Message Text                                                   │   │
│  │       │                                                             │   │
│  │       ▼                                                             │   │
│  │  processMarkdownText() ─────► Smart Stripping                       │   │
│  │  (markdown-stripping.ts)      - Removes markdown syntax             │   │
│  │                               - Preserves structure/line breaks     │   │
│  │                               - Keeps mentions intact               │   │
│  │       │                                                             │   │
│  │       ▼                                                             │   │
│  │  renderPreviewTextWithSpecialTokens() ──► Token Processing          │   │
│  │  (MessagePreview.tsx)                     - Smart tokenization      │   │
│  │                                           - Mention rendering       │   │
│  │                                           - Link rendering          │   │
│  │                                           - YouTube previews        │   │
│  │       │                                                             │   │
│  │       ▼                                                             │   │
│  │  React Components (styled spans, links, embeds)                     │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PLAIN TEXT PREVIEWS                                                 │   │
│  │ Consumers: SearchResultItem, DM conversation list                   │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Raw Message Text                                                   │   │
│  │       │                                                             │   │
│  │       ▼                                                             │   │
│  │  stripMarkdownAndMentions() ──► Dumb Stripping                      │   │
│  │  (markdown-stripping.ts)        - Removes ALL formatting            │   │
│  │                                 - Removes mentions                  │   │
│  │                                 - Collapses whitespace              │   │
│  │       │                                                             │   │
│  │       ▼                                                             │   │
│  │  Plain text string (rendered as-is)                                 │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CACHED PREVIEWS (Bookmark Fallback)                                 │   │
│  │ Used when: Message not in local IndexedDB (cross-device sync)       │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Bookmark.cachedPreview ──► Pre-computed at bookmark time           │   │
│  │       │                     - textSnippet (plain text)              │   │
│  │       │                     - imageUrl/thumbnailUrl                 │   │
│  │       │                     - stickerId                             │   │
│  │       ▼                                                             │   │
│  │  BookmarkItem renders based on contentType                          │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Systems Comparison

| System | Component | Stripping Mode | Interactive | Use Case |
|--------|-----------|----------------|-------------|----------|
| Full Message | `Message.tsx` | None (full render) | Yes | Chat view |
| Rich Preview | `MessagePreview` | Smart | Limited | Panels (Bookmarks, Pinned) |
| Plain Preview | Direct stripping | Dumb | No | Search results, DM list |
| Cached Preview | `BookmarkItem` | Pre-computed | No | Cross-device bookmarks |

## MessagePreview Component

**Location**: `src/components/message/MessagePreview.tsx`

The central component for rendering message previews in panels. Provides a rich but compact representation of messages.

### Processing Pipeline

```typescript
// 1. Smart markdown stripping (removes syntax, keeps structure)
const smartProcessedText = processMarkdownText(fullText, {
  preserveLineBreaks: true,     // Keep paragraph structure
  preserveEmphasis: true,       // Keep bold/italic intent
  preserveHeaders: true,        // Keep header content
  removeFormatting: true,       // Remove markdown syntax
  removeStructure: false,       // Preserve line breaks
});

// 2. Token processing (renders mentions, links, etc.)
const processedContent = renderPreviewTextWithSpecialTokens(
  smartProcessedText,
  formatting,
  messageId,
  disableMentionInteractivity,
  onChannelClick
);
```

### Smart Tokenization

The token processor uses regex-based smart tokenization to preserve mention patterns with spaces in display names:

```typescript
// Matches: @[Display Name]<address> or #[Channel Name]<channelId>
const mentionPattern = /(@(?:\[[^\]]+\])?<[^>]+>|#(?:\[[^\]]+\])?<[^>]+>)/g;
```

This prevents `#[General Chat]<channelId>` from being split into separate tokens.

### Supported Content Types

| Type | Rendering |
|------|-----------|
| `post` | Smart-stripped text with token processing |
| `embed` | Image thumbnail (200x150 max) or YouTube preview |
| `sticker` | Sticker image (120x120 max) |

### Props

```typescript
interface MessagePreviewProps {
  message: MessageType;
  mapSenderToUser?: (senderId: string) => any;
  stickers?: { [key: string]: Sticker };
  showBackground?: boolean;        // Default: true
  hideHeader?: boolean;            // Default: false
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
  disableMentionInteractivity?: boolean;  // Default: false
}
```

## Consumers

### PinnedMessagesPanel

**Location**: `src/components/message/PinnedMessagesPanel.tsx`

Uses `MessagePreview` directly with full message objects (always available locally since pinned messages are per-channel).

```typescript
<MessagePreview
  message={message}
  mapSenderToUser={mapSenderToUser}
  stickers={stickers}
  showBackground={false}
  hideHeader={true}
  spaceRoles={spaceRoles}
  spaceChannels={spaceChannels}
  onChannelClick={onChannelClick}
  disableMentionInteractivity={true}
/>
```

### BookmarksPanel / BookmarkItem

**Location**: `src/components/bookmarks/BookmarkItem.tsx`

Uses **hybrid rendering**: `MessagePreview` when message exists locally, cached preview fallback otherwise.

```typescript
// Try to resolve message from local IndexedDB
const { data: resolvedMessage } = useResolvedBookmark(bookmark, true);

// Render with MessagePreview if available, else cached fallback
if (resolvedMessage && mapSenderToUser) {
  return <MessagePreview message={resolvedMessage} ... />;
}
return renderCachedPreview();  // Uses bookmark.cachedPreview
```

**Why hybrid?** Bookmarks are cross-context (can bookmark messages from any space/DM). When viewing bookmarks on a different device or for unloaded channels, the message may not exist in local IndexedDB.

### SearchResultItem

**Location**: `src/components/search/SearchResultItem.tsx`

Uses **dumb stripping** for plain text display (no interactive elements needed in search results).

```typescript
import { stripMarkdownAndMentions } from '../../utils/markdownStripping';

const cleanSnippet = stripMarkdownAndMentions(contextualSnippet);
// Renders as plain text
```

### DM Conversation Previews

**Location**: `src/components/direct/DirectMessageContactsList.tsx`

Uses simple text extraction for conversation list previews (last message snippet).

## Relationship to Other Systems

### markdown-renderer.md
Documents the **full message rendering** dual system in `Message.tsx`. MessagePreview is a separate, lighter system for preview contexts.

**Key difference**:
- `MessageMarkdownRenderer`: Full markdown parsing with react-markdown
- `MessagePreview`: Smart stripping + custom token processing (no markdown library at render time)

### markdown-stripping.md
Documents the **stripping utilities** that MessagePreview uses. The utilities provide the text processing layer; MessagePreview adds the React rendering layer on top.

**Processing chain**:
```
markdown-stripping.ts (processMarkdownText)
         ↓
MessagePreview.tsx (renderPreviewTextWithSpecialTokens)
         ↓
React components (spans, links, embeds)
```

### bookmarks.md
Documents the **bookmarks feature** including the hybrid MessagePreview approach for cross-device scenarios.

## Key Files

| File | Purpose |
|------|---------|
| `src/components/message/MessagePreview.tsx` | Core preview component |
| `src/utils/markdownStripping.ts` | Text processing utilities |
| `src/components/message/PinnedMessagesPanel.tsx` | Pinned messages consumer |
| `src/components/bookmarks/BookmarkItem.tsx` | Bookmarks consumer (hybrid) |
| `src/components/search/SearchResultItem.tsx` | Search consumer (plain text) |
| `src/hooks/queries/bookmarks/useResolvedBookmark.ts` | Message resolution for bookmarks |

## Performance Characteristics

| Operation | Cost |
|-----------|------|
| Smart stripping | ~0.1-1ms per message |
| Token processing | ~0.1ms per message |
| Full markdown render | ~5-50ms per message |

MessagePreview is **20-100x faster** than full markdown rendering, making it suitable for virtualized lists with many items.

## When to Use What

| Scenario | System | Why |
|----------|--------|-----|
| Chat messages | `Message.tsx` + `MessageMarkdownRenderer` | Full interactivity, markdown support |
| Pinned/Bookmarked messages | `MessagePreview` | Rich preview, compact, fast |
| Search results | `stripMarkdownAndMentions()` | Plain text sufficient, fastest |
| Cross-device bookmarks | Cached preview fallback | Message may not exist locally |
| DM list previews | Simple text extraction | Just need last message snippet |

---


*Verified: 2025-12-09 - File paths confirmed current*
