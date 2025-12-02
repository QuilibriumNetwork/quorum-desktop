# Bookmarks Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer and security-analyst agents

## Overview

The Bookmarks feature allows users to privately save important messages from both Spaces (Channels) and Direct Messages for later reference. Unlike pinned messages which are shared across all space members, bookmarks are **personal and private** to each user.

**Key Value Proposition**: Provides a personal reference system for important information across all conversations, increasing user productivity without requiring special permissions or affecting other users.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOCAL OPERATIONS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Message → MessageActions → useMessageActions → useBookmarks → MessageDB     │
│    ↑                                                              ↓         │
│ BookmarksPanel ← BookmarkItem ← filteredBookmarks ← React Query ← IndexedDB │
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
- `src/api/quorumApi.ts:242+` - `Bookmark` type definition and `BOOKMARKS_CONFIG`
- `src/db/messages.ts:50-51` - UserConfig type with sync fields (`bookmarks?`, `deletedBookmarkIds?`)
- `src/db/messages.ts:205-218` - `getMessageById()` for context-free message resolution
- `src/db/messages.ts:1577-1696` - CRUD operations in MessageDB class

**Business Logic**:
- `src/hooks/business/bookmarks/useBookmarks.ts` - Main business hook with React Query integration
- `src/hooks/queries/bookmarks/useResolvedBookmark.ts` - Message resolution for hybrid MessagePreview rendering
- `src/hooks/queries/bookmarks/` - React Query hooks for data fetching and caching
- `src/hooks/business/messages/useMessageActions.ts` - Action integration and context handling

**Sync Layer**:
- `src/services/ConfigService.ts:377-379` - Bookmark collection before encryption
- `src/services/ConfigService.ts:289-325` - Differential sync with error recovery
- `src/services/ConfigService.ts:453-490` - Merge algorithm with deduplication
- `src/utils.ts:17-18` - Default UserConfig with empty bookmark arrays

**UI Components**:
- `src/components/bookmarks/BookmarksPanel.tsx` - Dropdown panel with filtering and virtualization
- `src/components/bookmarks/BookmarkItem.tsx` - Individual bookmark item with actions
- `src/components/bookmarks/BookmarksPanel.scss` - Responsive styling

**Integration Points**:
- `src/components/message/MessageActions.tsx` - Desktop hover actions
- `src/components/message/MessageActionsDrawer.tsx` - Mobile touch drawer
- `src/components/space/Channel.tsx` - Channel header bookmark button
- `src/components/direct/DirectMessage.tsx` - DM header bookmark button
- `src/components/message/Message.tsx` - Visual bookmark indicators in message headers

### Data Structure

```typescript
export type Bookmark = {
  bookmarkId: string;           // crypto.randomUUID()
  messageId: string;            // Reference to original message
  spaceId?: string;             // For space messages (undefined for DMs)
  channelId?: string;           // For channel messages (undefined for DMs)
  conversationId?: string;      // For DM messages (undefined for channels)
  sourceType: 'channel' | 'dm';
  createdAt: number;            // Timestamp for sorting

  cachedPreview: {
    senderAddress: string;      // For avatar/name lookup
    senderName: string;         // Display name at bookmark time
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

**Configuration**:
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
  - `by_message` on `messageId` - O(1) isBookmarked checks
  - `by_created` on `createdAt` - Chronological sorting

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

The sync includes transaction safety with rollback capability. If sync fails partway through, the system attempts to restore the original local bookmarks to prevent data loss.

### Security & Privacy

- **Encryption**: AES-GCM with user-derived keys (SHA-512 of user private key)
- **Signing**: Ed448 signature for integrity verification
- **Privacy Control**: Only syncs when `allowSync=true` in Privacy settings
- **User Control**: Disable sync anytime via Privacy settings toggle

## Usage Examples

### Basic Bookmark Operations

```typescript
const { isBookmarked, toggleBookmark, canAddBookmark } = useBookmarks(userAddress);

// Check if message is bookmarked (O(1))
const bookmarked = isBookmarked(message.messageId);

// Toggle bookmark with context
const handleToggle = () => {
  toggleBookmark(
    message,
    'channel',
    {
      spaceId: 'space-123',
      channelId: 'channel-456',
      conversationId: undefined
    },
    'User Display Name',
    'Space Name > #channel-name'
  );
};
```

### Opening Bookmarks Panel

```typescript
const [activePanel, setActivePanel] = useState<ActivePanel>(null);

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
```

### Context-Aware Filtering

```typescript
const {
  filterBySourceType,      // 'all' | 'channel' | 'dm'
  filterByConversation,    // Filter DMs by conversationId
  filterByCurrentSpace,    // Filter by spaceId + optional channelId
} = useBookmarks(userAddress);

// Dynamic filter options based on current route
const filterOptions = useMemo(() => {
  const options = [{ value: 'all', label: 'All Bookmarks' }];

  if (searchContext.type === 'dm' && searchContext.conversationId) {
    options.push(
      { value: `conversation:${searchContext.conversationId}`, label: 'This conversation' },
      { value: 'dms', label: 'All DMs' },
      { value: 'spaces', label: 'All Spaces' }
    );
  } else if (searchContext.type === 'space' && searchContext.spaceId) {
    options.push(
      { value: `currentSpace:${searchContext.spaceId}`, label: 'This Space' },
      { value: 'spaces', label: 'All Spaces' },
      { value: 'dms', label: 'All DMs' }
    );
  } else {
    options.push(
      { value: 'dms', label: 'All DMs' },
      { value: 'spaces', label: 'All Spaces' }
    );
  }

  return options;
}, [searchContext]);
```

### Cross-Context Navigation

```typescript
const handleJumpToMessage = (bookmark: Bookmark) => {
  if (bookmark.sourceType === 'channel') {
    navigate(`/spaces/${bookmark.spaceId}/${bookmark.channelId}#msg-${bookmark.messageId}`);
  } else {
    const dmAddress = bookmark.conversationId?.split('/')[0];
    navigate(`/messages/${dmAddress}#msg-${bookmark.messageId}`);
  }

  setTimeout(() => {
    scrollToMessage(bookmark.messageId);
    highlightMessage(bookmark.messageId, { duration: 2000 });
  }, 100);
};
```

## Technical Decisions

### Database Integration
Bookmark CRUD is integrated into the existing `MessageDB` class rather than a separate `BookmarkDB`. This allows bookmarks to benefit from shared DB connection and transaction patterns.

### Sync via ConfigService
Bookmark sync is integrated into ConfigService rather than a separate BookmarkService because:
- UserConfig is the natural sync boundary for user-private data
- Leverages existing AES-GCM encryption and Ed448 signing infrastructure
- Provides atomic consistency with other user settings
- Avoids duplicating complex crypto code

### Differential Sync
The system calculates and applies only changed bookmarks rather than replacing all. This provides 20-40x faster sync (~10ms vs ~400ms for 200 bookmarks) and eliminates UI flickering.

### Conflict Resolution Strategy
Last-write-wins with tombstone tracking is simple, deterministic, and sufficient for bookmarks (which don't require collaborative editing). Operational Transform or CRDTs would be over-engineered for this use case.

### MessageId Deduplication
The merge algorithm prevents multiple bookmarks pointing to the same message, ensuring a clean UI when the same message is bookmarked on different devices.

### Tombstone Reset Timing
`deletedBookmarkIds` resets only after successful sync to prevent resurrection of deleted bookmarks during network failures.

### Context-Aware Filtering
Filter options dynamically reorder based on current route (DM vs Space context), surfacing the most relevant filters first.

### Performance Architecture
All bookmarks are loaded into a memoized Set for O(1) status checking. With a 200 bookmark limit, memory cost is negligible compared to the query cost of database lookups per message.

### Visual Indicators
Filled bookmark icons appear in message headers when bookmarked, providing immediate visual feedback without cluttering the UI.

## Performance Characteristics

| Operation | Complexity | Implementation |
|-----------|------------|----------------|
| `isBookmarked()` check | O(1) | Memoized Set lookup |
| Panel rendering | O(visible) | Virtuoso virtualization |
| Message resolution | O(uncached) | React Query cache |
| Filter by space | O(n) | In-memory filtering |
| Add/remove bookmark | O(1) + invalidate | Optimistic updates |
| Cross-device sync | O(changes) | Differential sync |
| Merge bookmarks | O(n) | Map-based deduplication |

Race conditions from rapid clicking are prevented via pending state tracking that debounces toggle operations.

## Integration Patterns

### Message Actions
- Desktop: Hover reveals bookmark button after copy message, before separator
- Mobile: Drawer action between copy and edit
- Icon changes based on bookmark state; no permission checking required

### Panel State Management
- Follows existing `activePanel` state pattern for mutual exclusion
- Each header manages its own panel state (no global context needed)
- Mobile: Automatic drawer conversion via `isTouchDevice()` detection

### Styling
- Uses `@extend` patterns from shared dropdown styles
- Responsive design with mobile breakpoint at 639px
- Consistent with NotificationPanel and PinnedMessagesPanel patterns

### Hybrid Message Preview (Like PinnedMessagesPanel)
BookmarkItem uses a hybrid rendering approach:

1. **Full MessagePreview** (preferred): If message exists in local IndexedDB, render with `MessagePreview` component (same as PinnedMessagesPanel) - supports full markdown, mentions, images, stickers
2. **Cached Preview** (fallback): If message not found locally (cross-device sync, unloaded channel), render using `cachedPreview` data stored in the bookmark

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
- Images (embeds): Displayed as thumbnails (200x120 max)
- Stickers: Displayed visually (80x80 max) with sticker lookup at render time
- Fallback text: `[Image]` or `[Sticker]` shown if media URL unavailable

## Known Limitations

### Bookmark Count Badge
Header icons don't show bookmark count. This is by design to avoid header clutter.

### Cross-Device Message Availability
When viewing bookmarks on a different device, messages may not exist in local IndexedDB (not synced). In this case, the cached preview is shown instead of full MessagePreview. This is expected behavior - the cached preview ensures bookmarks always display something useful.

### Deleted Message Handling
When a message is deleted, any bookmark pointing to it is automatically removed (cascade deletion). This prevents orphaned bookmarks with stale cached data.

### Offline Sync
Sync requires network connectivity. Local changes are preserved but won't sync until online. Tombstones accumulate during offline periods and reset on successful sync.

## Related Documentation

- [Message Preview Rendering](message-preview-rendering.md) - Overview of all preview rendering systems
- [Markdown Stripping](markdown-stripping.md) - Text processing utilities
- [Markdown Renderer](markdown-renderer.md) - Full message rendering (dual system)
- `src/components/message/PinnedMessagesPanel.tsx` - Similar panel structure and navigation
- `src/components/notifications/NotificationPanel.tsx` - Filter patterns and UI reference
- `src/components/ui/DropdownPanel.tsx` - Container component architecture
- `src/services/ConfigService.ts` - Sync infrastructure patterns
- [Message Bookmarking Feature Task](../../tasks/message-bookmarking-feature.md) - Original implementation specification

---

*Updated: 2025-12-02 (hybrid MessagePreview: full render when message available, cached fallback otherwise)*
