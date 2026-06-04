---
type: doc
title: Bookmarks Feature
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-06-04T00:00:00.000Z
---

# Bookmarks Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Bookmarks let users privately save messages from Spaces (Channels) and Direct Messages for later reference. Unlike pinned messages (shared across all space members), bookmarks are **personal and private** to each user and sync across that user's devices via the encrypted UserConfig channel.

## Surfaces

Two surfaces consume the same `useBookmarks` data layer:

| Surface | Component | Purpose | Filters |
|---------|-----------|---------|---------|
| **Global page** | `BookmarksPage` at `/bookmarks` | Full-area page reached from a dedicated NavRail item between Spaces and Discover. Shows every bookmark across the app, with text search and source-type filter. Renders each bookmark as a `BookmarkCard` with the original message body via `MessageMarkdownRenderer`. | Text search (sender, snippet, source) + `all` / `dm` / `channel` |
| **Context panel** | `BookmarksPanel` (chat-header dropdown) | Scoped to the current route — "what's bookmarked HERE". Title reads "N bookmarks here". Footer link `See all bookmarks →` navigates to `/bookmarks`. | No filter dropdown. Channel header uses `filterByCurrentSpace(spaceId)`; DM header uses `filterByConversation(conversationId)`. |

The chat-header bookmark icon is only rendered when the current context has at least one bookmark. When empty, users discover bookmarks via the NavRail entry.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOCAL OPERATIONS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Message → MessageActions → useMessageActions → useBookmarks → MessageDB     │
│    ↑                                                              ↓         │
│ BookmarksPage / BookmarksPanel ← BookmarkCard/Item ← React Query ← IndexedDB│
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CROSS-DEVICE SYNC                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ useBookmarks → removeBookmark → Track deletion → Update UserConfig          │
│                                                        ↓                    │
│ ConfigService.saveConfig() ← Collect bookmarks ← MessageDB.getBookmarks()   │
│        ↓                                                                    │
│ AES-GCM Encrypt → Ed448 Sign → POST /api/settings/{address}                 │
│        ↓                                                                    │
│ ConfigService.getConfig() → Decrypt → Verify → mergeBookmarks() → Apply     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

**Data Layer**:
- `@quilibrium/quorum-shared` — `Bookmark` type and `BOOKMARKS_CONFIG` constants
- `src/db/messages.ts` — UserConfig sync fields (`bookmarks?`, `deletedBookmarkIds?`) and `MessageDB` CRUD operations
- `src/db/messages.ts` — `getMessageById()` for context-free message resolution

**Business Logic**:
- `src/hooks/business/bookmarks/useBookmarks.ts` — main business hook with React Query integration
- `src/hooks/queries/bookmarks/useResolvedBookmark.ts` — message resolution for hybrid preview rendering
- `src/hooks/queries/bookmarks/` — React Query hooks for data fetching and caching
- `src/hooks/business/messages/useMessageActions.ts` — bookmark action handler, threads `senderIcon` through `mapSenderToUser`

**Sync Layer**:
- `src/services/ConfigService.ts` — bookmark collection, differential sync, and merge with deduplication
- `src/utils.ts` — default UserConfig with empty bookmark arrays

**UI Components**:
- `src/components/bookmarks/BookmarksPage.tsx` / `.scss` — global page with search and source filter
- `src/components/bookmarks/BookmarkCard.tsx` — full-message card used on the page; renders the message body via `MessageMarkdownRenderer`
- `src/components/bookmarks/BookmarksPanel.tsx` / `.scss` — context-scoped dropdown panel
- `src/components/bookmarks/BookmarkItem.tsx` — compact item used inside the panel (hybrid `MessagePreview` + cached fallback)

**Integration Points**:
- `src/components/shell/NavRail.tsx` — Bookmarks rail item (route `/bookmarks`)
- `src/components/shell/useSidebarMode.ts` — returns `'hidden'` for `/bookmarks` so the page spans the full main area
- `src/components/Router/Router.web.tsx` — `/bookmarks` route registration
- `src/components/message/MessageActions.tsx` — desktop hover bookmark toggle
- `src/components/message/MessageActionsDrawer.tsx` — mobile touch drawer toggle
- `src/components/space/Channel.tsx` — channel-scoped panel + header icon (conditional on `filterByCurrentSpace` count)
- `src/components/direct/DirectMessage.tsx` — DM-scoped panel + header icon (conditional on `filterByConversation` count)
- `src/components/message/Message.tsx` — visual bookmark indicators in message headers

### Data Structure

```typescript
export type Bookmark = {
  bookmarkId: string;           // crypto.randomUUID()
  messageId: string;            // Reference to original message
  threadId?: string;            // Set when the bookmarked message is a thread reply
  spaceId?: string;             // For space messages (undefined for DMs)
  channelId?: string;           // For channel messages (undefined for DMs)
  conversationId?: string;      // For DM messages (undefined for channels)
  sourceType: 'channel' | 'dm';
  createdAt: number;            // Timestamp for sorting

  cachedPreview: {
    senderName: string;         // Display name at bookmark time
    senderIcon?: string;        // Avatar URL captured at bookmark time (snapshot)
    textSnippet: string;        // First ~150 chars, plain text (empty for media-only)
    messageDate: number;        // Original message timestamp
    sourceName: string;         // "Space Name > #channel" or empty for DMs

    // Media content info for visual rendering
    contentType: 'text' | 'image' | 'sticker';
    imageUrl?: string;          // For embed messages (image URL)
    thumbnailUrl?: string;      // For embed messages (smaller preview)
    stickerId?: string;         // For sticker messages (resolve at render time)
  };
};
```

**Configuration** (`@quilibrium/quorum-shared`):
```typescript
const BOOKMARKS_CONFIG = {
  MAX_BOOKMARKS: 200,           // Maximum bookmarks per user
  PREVIEW_SNIPPET_LENGTH: 150,  // Character limit for cached text
} as const;
```

**UserConfig Sync Fields**:
```typescript
export type UserConfig = {
  // ... existing fields (spaceIds, spaceKeys, notificationSettings, etc.)
  bookmarks?: Bookmark[];           // User's bookmarks for cross-device sync
  deletedBookmarkIds?: string[];    // Tombstones for deletion sync
};
```

### Database Schema

**IndexedDB Object Store**: `bookmarks`
- **keyPath**: `bookmarkId`
- **Indices**:
  - `by_message` on `messageId` — O(1) `isBookmarked` checks
  - `by_created` on `createdAt` — chronological sorting

All bookmarks are loaded into memory with a memoized Set for O(1) lookup during message rendering.

## Cross-Device Sync

Bookmark sync leverages the existing **UserConfig sync infrastructure** used for spaceKeys and notificationSettings.

### Sync Flow

When `allowSync` is enabled in Privacy settings:
1. User creates/deletes bookmark locally
2. `ConfigService.saveConfig()` collects all bookmarks
3. AES-GCM encrypts UserConfig (including bookmarks)
4. Ed448 signs encrypted payload
5. POST `/api/settings/{address}` syncs to server

When user switches devices:
1. `ConfigService.getConfig()` fetches from server
2. Verifies Ed448 signature and decrypts AES-GCM
3. `mergeBookmarks()` combines local + remote using differential sync
4. Only changed bookmarks are updated in IndexedDB
5. Tombstones reset after successful sync

### Conflict Resolution

The merge algorithm uses **last-write-wins with tombstone tracking and messageId deduplication**:

```typescript
private mergeBookmarks(
  local: Bookmark[],
  remote: Bookmark[],
  deletedIds: string[]
): Bookmark[] {
  const bookmarkMap = new Map<string, Bookmark>();
  const messageIdToBookmarkId = new Map<string, string>();

  const addBookmark = (bookmark: Bookmark) => {
    if (deletedIds.includes(bookmark.bookmarkId)) return;

    const existingBookmarkId = messageIdToBookmarkId.get(bookmark.messageId);
    const existing = existingBookmarkId ? bookmarkMap.get(existingBookmarkId) : undefined;

    if (!existing || bookmark.createdAt > existing.createdAt) {
      if (existingBookmarkId) {
        bookmarkMap.delete(existingBookmarkId);
      }
      bookmarkMap.set(bookmark.bookmarkId, bookmark);
      messageIdToBookmarkId.set(bookmark.messageId, bookmark.bookmarkId);
    }
  };

  local.forEach(addBookmark);
  remote.forEach(addBookmark);

  return Array.from(bookmarkMap.values())
    .sort((a, b) => b.createdAt - a.createdAt);
}
```

### Deletion Tracking

When a bookmark is deleted, the deletion is tracked in `deletedBookmarkIds` for cross-device sync:

```typescript
// In removeBookmark mutation
mutationFn: async (bookmarkId: string) => {
  await messageDB.removeBookmark(bookmarkId);

  const config = await messageDB.getUserConfig({ address: userAddress });
  if (config) {
    config.deletedBookmarkIds = config.deletedBookmarkIds || [];
    config.deletedBookmarkIds.push(bookmarkId);
    await messageDB.saveUserConfig(config);
  }
}
```

### Differential Sync

Instead of replacing all bookmarks, the system calculates and applies only necessary changes:

```typescript
const localMap = new Map(localBookmarks.map(b => [b.bookmarkId, b]));
const mergedMap = new Map(mergedBookmarks.map(b => [b.bookmarkId, b]));

const toDelete = localBookmarks.filter(b => !mergedMap.has(b.bookmarkId));
const toAdd = mergedBookmarks.filter(b => !localMap.has(b.bookmarkId));
const toUpdate = mergedBookmarks.filter(b => {
  const existing = localMap.get(b.bookmarkId);
  return existing && existing.createdAt !== b.createdAt;
});

// Apply only necessary changes
for (const bookmark of toDelete) {
  await this.messageDB.removeBookmark(bookmark.bookmarkId);
}
for (const bookmark of [...toAdd, ...toUpdate]) {
  await this.messageDB.addBookmark(bookmark);
}
```

### Error Recovery

The sync includes transaction safety with rollback. If sync fails partway through, the system restores the original local bookmarks to prevent data loss.

### Security & Privacy

- **Encryption**: AES-GCM with user-derived keys (SHA-512 of user private key)
- **Signing**: Ed448 signature for integrity verification
- **Privacy Control**: Only syncs when `allowSync=true` in Privacy settings
- **User Control**: Disable sync anytime via Privacy settings toggle
- **Limit Enforcement**: 200 bookmark limit enforced with defense-in-depth (UI + database-layer atomic validation to prevent client-side bypass)

## Usage Examples

### Basic Bookmark Operations

```typescript
const { isBookmarked, toggleBookmark, canAddBookmark } = useBookmarks({ userAddress });

// Check if message is bookmarked (O(1))
const bookmarked = isBookmarked(message.messageId);

// Toggle bookmark with context (senderIcon is captured from mapSenderToUser)
toggleBookmark(
  message,
  'channel',
  { spaceId, channelId, conversationId: undefined },
  'User Display Name',
  'Space Name > #channel-name',
  senderIconUrl
);
```

### Opening the Context Panel

```typescript
const [activePanel, setActivePanel] = useState<ActivePanel>(null);
const { filterByCurrentSpace } = useBookmarks({ userAddress });
const contextCount = filterByCurrentSpace(spaceId).length;

{contextCount > 0 && (
  <>
    <Button
      onClick={() => setActivePanel('bookmarks')}
      iconName="bookmark"
      iconOnly
    />
    <BookmarksPanel
      isOpen={activePanel === 'bookmarks'}
      onClose={() => setActivePanel(null)}
      userAddress={userAddress}
    />
  </>
)}
```

### Page-Level Filtering

`BookmarksPage` exposes a single source-type filter and a text search:

```typescript
const { filterBySourceType } = useBookmarks({ userAddress });

// 'all' | 'channel' | 'dm'
const base = filterBySourceType(sourceFilter);

const filtered = base.filter(({ cachedPreview }) =>
  cachedPreview.senderName?.toLowerCase().includes(query) ||
  cachedPreview.textSnippet?.toLowerCase().includes(query) ||
  cachedPreview.sourceName?.toLowerCase().includes(query)
);
```

### Cross-Context Navigation (Thread-Aware)

Navigation uses hash-based highlighting via `buildMessageHash`, which produces a compound hash when the bookmarked message lives in a thread:

```typescript
import { buildMessageHash } from '../../utils/messageHashNavigation';

const handleJumpToMessage = (bookmark: Bookmark) => {
  const hash = buildMessageHash(bookmark.messageId, bookmark.threadId);

  if (bookmark.sourceType === 'channel') {
    navigate(`/spaces/${bookmark.spaceId}/${bookmark.channelId}${hash}`);
  } else {
    const dmAddress = bookmark.conversationId?.split('/')[0];
    navigate(`/messages/${dmAddress}${hash}`);
  }

  // Clean up hash after highlight animation completes (8s matches CSS animation)
  setTimeout(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, 8000);
};
```

For thread replies the hash format is `#thread-{threadId}-msg-{messageId}`; the destination Channel opens the thread panel and scrolls to the reply. See [thread-panel.md](thread-panel.md) and [message-highlight-system.md](message-highlight-system.md).

## Technical Decisions

### Database Integration
Bookmark CRUD lives in `MessageDB` rather than a separate `BookmarkDB`, sharing the DB connection and transaction patterns.

### Sync via ConfigService
Bookmark sync is integrated into ConfigService rather than a separate BookmarkService:
- UserConfig is the natural sync boundary for user-private data
- Reuses AES-GCM encryption and Ed448 signing
- Atomic consistency with other user settings
- Avoids duplicating crypto code

### Differential Sync
The system applies only changed bookmarks rather than replacing all, providing faster sync and no UI flickering.

### Conflict Resolution Strategy
Last-write-wins with tombstone tracking is deterministic and sufficient for bookmarks. CRDTs would be over-engineered.

### MessageId Deduplication
The merge prevents multiple bookmarks pointing to the same message, ensuring a clean UI when the same message is bookmarked on different devices.

### Tombstone Reset Timing
`deletedBookmarkIds` resets only after successful sync to prevent resurrection of deleted bookmarks during network failures.

### Two-Surface Split
The page handles the global view (search + cross-source filter). The panel handles the in-context view (no filter dropdown, scoped to the current space or DM). This avoids two surfaces offering the same filters and keeps the chat header uncluttered.

### Sender Icon Snapshot
The sender avatar URL is captured at bookmark time and stored in `cachedPreview.senderIcon`, so cards render the real avatar even when the original message isn't in local IndexedDB. Bookmarks created before this field existed fall back to the default avatar.

### Performance Architecture
All bookmarks are loaded into a memoized Set for O(1) status checking. With a 200 bookmark limit, memory cost is negligible.

### Visual Indicators
Filled bookmark icons appear in message headers when bookmarked.

## Performance Characteristics

| Operation | Complexity | Implementation |
|-----------|------------|----------------|
| `isBookmarked()` check | O(1) | Memoized Set lookup |
| Panel rendering | O(visible) | Virtuoso virtualization |
| Page rendering | O(n) | Direct map (no virtualization) |
| Message resolution | O(uncached) | React Query cache |
| Filter by space | O(n) | In-memory filtering |
| Add/remove bookmark | O(1) + invalidate | Optimistic updates |
| Cross-device sync | O(changes) | Differential sync |
| Merge bookmarks | O(n) | Map-based deduplication |

Race conditions from rapid clicking are prevented via pending state tracking that debounces toggle operations.

## Integration Patterns

### Message Actions
- Desktop: hover reveals bookmark button after copy message, before separator
- Mobile: drawer action between copy and edit
- Icon changes based on bookmark state; no permission checking required

### Panel State Management
- Follows existing `activePanel` state pattern for mutual exclusion
- Each header manages its own panel state (no global context needed)
- Mobile: automatic drawer conversion via `isTouchDevice()` detection
- Header icon and panel are mounted only when the current context has at least one bookmark

### Page Rendering
- `BookmarksPage` uses `BookmarkCard`, which renders the original message body in full via `MessageMarkdownRenderer` (no truncation), with sender avatar, name, timestamp, and a source line (`#channel > Space Name` or DM counterpart).
- When the original message is not in local IndexedDB (cross-device sync), the card falls back to the bookmark's cached preview snippet.

### Hybrid Message Preview (Panel)
`BookmarkItem` uses a hybrid rendering approach inside the panel:

1. **Full `MessagePreview`** (preferred): if the message exists in local IndexedDB, render with `MessagePreview` (same component used by `PinnedMessagesPanel`) — supports markdown, mentions, images, stickers.
2. **Cached Preview** (fallback): if the message is not found locally, render using `cachedPreview` stored in the bookmark.

Resolution flow:
```
useResolvedBookmark(bookmark) → messageDB.getMessageById(messageId)
    ↓
┌─────────────────────────────────────────┐
│ Message found in local IndexedDB?       │
├────────────┬────────────────────────────┤
│    YES     │           NO               │
│    ↓       │           ↓                │
│ MessagePreview        │ CachedPreview   │
│ (full render)         │ (fallback)      │
└────────────┴────────────────────────────┘
```

### Media Content Support (Cached Fallback)
When using cached preview fallback:
- Images (embeds): displayed as thumbnails
- Stickers: displayed visually with sticker lookup at render time
- Fallback text: `[Image]` or `[Sticker]` shown if the media URL is unavailable

### Styling
- `BookmarksPage.scss` defines the page chrome and extends `.bookmarks-panel` selectors to also scope under `.bookmarks-page`, so shared item styling applies in both surfaces without duplication.
- The panel uses `@extend` patterns from shared dropdown styles and the mobile breakpoint at 639px.
- Consistent with `NotificationPanel` and `PinnedMessagesPanel` patterns.

## Known Limitations

### Bookmark Count Badge
The header icon doesn't show a bookmark count.

### Cross-Device Message Availability
When viewing bookmarks on a different device, messages may not exist in local IndexedDB. Cached preview (and `senderIcon` snapshot) ensure bookmarks always display something useful.

### Deleted Message Handling
When a message is deleted, any bookmark pointing to it is automatically removed (cascade deletion).

### Offline Sync
Sync requires network connectivity. Local changes are preserved but won't sync until online. Tombstones accumulate during offline periods and reset on successful sync.

## Related Documentation

- [Message Preview Rendering](message-preview-rendering.md) — overview of all preview rendering systems
- [Markdown Stripping](markdown-stripping.md) — text processing utilities
- [Markdown Renderer](markdown-renderer.md) — full message rendering (used by `BookmarkCard`)
- [Message Highlight System](message-highlight-system.md) — hash-based jump-and-highlight flow
- [Thread Panel](thread-panel.md) — thread-aware navigation
- `src/components/message/PinnedMessagesPanel.tsx` — similar panel structure
- `src/components/notifications/NotificationPanel.tsx` — filter and UI reference
- `src/components/ui/DropdownPanel.tsx` — shared panel container
- `src/services/ConfigService.ts` — sync infrastructure

---

*Last updated: 2026-06-04*
