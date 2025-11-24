# Message Bookmarking Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent
> **Soft-review by human.**

**Status**: Pending
**Complexity**: High
**Created**: 2025-11-24
**Related**:
- `src/components/message/PinnedMessagesPanel.tsx`
- `src/components/notifications/NotificationPanel.tsx`
- `src/components/ui/DropdownPanel.tsx`
- `src/services/SyncService.ts`
- `.agents/docs/data-management-architecture-guide.md`

## What & Why

Users need the ability to privately save/bookmark important messages from both Spaces (Channels) and personal conversations (DirectMessages) for later reference. Unlike pinned messages (shared across all space members), bookmarks are **personal and private** to each user.

**Current State**: No bookmark functionality exists. Users must rely on pinned messages (shared, requires permissions) or external note-taking.

**Desired State**: Users can bookmark any message they can see, access all bookmarks from a **global panel** with filtering options, and sync bookmarks across devices when `allowSync` is enabled.

**Value**: Increases user productivity by providing a personal reference system for important information across all conversations.

---

## Solution: Global Bookmarks Panel

### Key Characteristics

| Aspect | Decision |
|--------|----------|
| **Scope** | Global (all spaces + DMs in one list) |
| **Filtering** | By source type: All \| Spaces \| DMs + per-space dropdown |
| **Storage** | Separate `bookmarks` IndexedDB store (user-private) |
| **UI Pattern** | Reuses `DropdownPanel` + `MobileDrawer` (like PinnedMessagesPanel) |
| **Performance** | Virtuoso for virtualized list rendering |
| **Sync** | Included in user data sync when `allowSync` is enabled |

### Icon Placement

```
Channel Header:
[# channel-name | Channel Topic] ... [Pin] [Notifications] [Members] [Search] | [Bookmark]

DirectMessage Header:
[Contact Name] ... [Gear] | [Bookmark]
```

- **Position**: LAST icon in the header row
- **Separator**: YES - add a `|` visual separator before the bookmark icon
- **Icon**: `bookmark` / `bookmark-filled` from Tabler Icons
- **Badge**: NO - do not show bookmark count on the icon

---

## Comparison: Bookmarks vs Pinned Messages

| | Pinned Messages | Bookmarks |
|---|--------|-----------|
| **Visibility** | Shared (all members see) | Private (only you) |
| **Permissions** | Requires role permission | Anyone can bookmark |
| **Scope** | Per-channel | Global with filtering |
| **Purpose** | Team reference | Personal notes |
| **Storage** | Message fields (`isPinned`, etc.) | Separate `bookmarks` store |
| **Sync** | Via space sync | Via user data sync (`allowSync`) |

---

## Implementation

### Phased Approach

| Phase | Scope | Priority |
|-------|-------|----------|
| **Phase 1** | Core Feature (local-only) | Phases 1-6 below |
| **Phase 2** | Sync Integration | Phase 7 below (after core validated) |

Implement local-only bookmarks first. Add sync after core functionality is tested and working.

---

### Phase 1: Data Layer

**Files to create/modify**:
- `src/db/bookmarks.ts` (NEW)
- `src/api/quorumApi.ts` (add Bookmark type)
- `src/db/messages.ts` (add bookmarks store to schema)

**Bookmark Type**:
```typescript
export type Bookmark = {
  bookmarkId: string;           // UUID
  messageId: string;            // Reference to original message
  spaceId?: string;             // For space messages (undefined for DMs)
  channelId?: string;           // For channel messages (undefined for DMs)
  conversationId?: string;      // For DM messages (undefined for channels)
  sourceType: 'channel' | 'dm';
  createdAt: number;            // Timestamp for sorting

  // Cached preview - avoids cross-context message resolution
  // Stored at bookmark creation time, acceptable if slightly stale
  cachedPreview: {
    senderAddress: string;      // For avatar/name lookup
    senderName: string;         // Display name at bookmark time
    textSnippet: string;        // First ~150 chars, markdown stripped
    messageDate: number;        // Original message timestamp
    sourceName: string;         // "Space Name > #channel" or "Contact Name"
  };

  // Future: notes?: string; tags?: string[];
};

// Configuration
const BOOKMARKS_CONFIG = {
  MAX_BOOKMARKS: 200,           // Maximum number of bookmarks per user
  PREVIEW_SNIPPET_LENGTH: 150,  // Character limit for cached text snippet
} as const;
```

**IndexedDB Schema** (simplified - 200 items is trivial to filter in memory):
```typescript
// Object store: 'bookmarks'
// keyPath: 'bookmarkId'
// Indices (minimal - add more only if profiling shows need):
//   'by_message': [messageId]              - Essential for O(1) isBookmarked check
//   'by_created': [createdAt]              - For chronological listing
// Note: Filtering by sourceType/space done in memory after loading all bookmarks
```

**CRUD Operations**:
- [ ] `addBookmark(bookmark: Bookmark): Promise<void>`
- [ ] `removeBookmark(bookmarkId: string): Promise<void>`
- [ ] `removeBookmarkByMessageId(messageId: string): Promise<void>`
- [ ] `getBookmarks(): Promise<Bookmark[]>`
- [ ] `getBookmarksBySourceType(sourceType: 'channel' | 'dm'): Promise<Bookmark[]>`
- [ ] `getBookmarksBySpace(spaceId: string): Promise<Bookmark[]>`
- [ ] `getBookmarkCount(): Promise<number>`
- [ ] `isBookmarked(messageId: string): Promise<boolean>`
- [ ] `getBookmarkByMessageId(messageId: string): Promise<Bookmark | undefined>`

---

### Phase 2: Business Logic Hook

**Files to create**:
- `src/hooks/business/bookmarks/useBookmarks.ts` (NEW)
- `src/hooks/business/bookmarks/index.ts` (NEW)

**Hook API**:
```typescript
export const useBookmarks = (userAddress: string) => {
  // Queries
  const bookmarks: Bookmark[];              // All bookmarks
  const bookmarkCount: number;              // Total count
  const isLoading: boolean;
  const error: Error | null;

  // Computed (for O(1) lookup in message rendering)
  const bookmarkedMessageIds: Set<string>;  // Memoized Set for fast lookup

  // Mutations (with limit enforcement and debounce)
  const addBookmark: (message: Message, sourceType: 'channel' | 'dm', context: BookmarkContext) => void;
  const removeBookmark: (bookmarkId: string) => void;
  const toggleBookmark: (message: Message, sourceType: 'channel' | 'dm', context: BookmarkContext) => void;
  const canAddBookmark: boolean;  // false if at MAX_BOOKMARKS (200) limit
  const isPending: (messageId: string) => boolean;  // Prevents rapid toggle race conditions

  // Helpers
  const isBookmarked: (messageId: string) => boolean;  // O(1) via Set

  // Filtering
  const filterBySourceType: (type: 'channel' | 'dm' | 'all') => Bookmark[];
  const filterBySpace: (spaceId: string) => Bookmark[];
};

type BookmarkContext = {
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
};
```

**React Query Integration**:
```typescript
// Query keys
['bookmarks', userAddress]           // All bookmarks
['bookmarkCount', userAddress]       // Count

// Mutations with optimistic updates
useMutation({
  mutationFn: addBookmarkToDB,
  onMutate: async (newBookmark) => {
    await queryClient.cancelQueries(['bookmarks', userAddress]);
    const previous = queryClient.getQueryData(['bookmarks', userAddress]);
    queryClient.setQueryData(['bookmarks', userAddress], old => [...old, newBookmark]);
    return { previous };
  },
  onError: (err, newBookmark, context) => {
    queryClient.setQueryData(['bookmarks', userAddress], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['bookmarks', userAddress]);
  },
});
```

**Debounce for Rapid Toggle Prevention**:
```typescript
// Prevent race conditions when user rapidly clicks bookmark button
const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());

const toggleBookmark = useCallback((message: Message, ...) => {
  if (pendingToggles.has(message.messageId)) return; // Ignore if pending

  setPendingToggles(prev => new Set(prev).add(message.messageId));

  mutation.mutate(/* ... */, {
    onSettled: () => {
      setPendingToggles(prev => {
        const next = new Set(prev);
        next.delete(message.messageId);
        return next;
      });
    }
  });
}, [pendingToggles, mutation]);

const isPending = useCallback(
  (messageId: string) => pendingToggles.has(messageId),
  [pendingToggles]
);
```

---

### Phase 3: UI Components

**Files to create**:
- `src/components/bookmarks/BookmarksPanel.tsx` (NEW)
- `src/components/bookmarks/BookmarkItem.tsx` (NEW)
- `src/components/bookmarks/index.ts` (NEW)
- ~~`src/components/bookmarks/BookmarkFilters.tsx`~~ - **REMOVED**: Inline filter logic directly in BookmarksPanel (~20 lines, not worth separate component)

**Reference patterns**:
- `src/components/message/PinnedMessagesPanel.tsx` - Panel structure
- `src/components/notifications/NotificationPanel.tsx` - Filter tabs pattern
- `src/components/ui/DropdownPanel.tsx` - Container component
- `src/components/search/SearchResults.tsx` - Results rendering

#### BookmarksPanel

```typescript
interface BookmarksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}
```

**Structure**:
```
┌─────────────────────────────────────┐
│ Bookmarks (123)              [X]    │  <- Header with count
├─────────────────────────────────────┤
│ [All] [Spaces ▼] [DMs]              │  <- Filter tabs
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ [Avatar] Sender • #channel      │ │  <- BookmarkItem
│ │ Message preview text here...    │ │
│ │ 2 hours ago            [Remove] │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ...more items (virtualized)     │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Empty state when no bookmarks       │
└─────────────────────────────────────┘
```

**Key Implementation Details**:
- [ ] Use `DropdownPanel` for desktop/mobile adaptation
- [ ] Use `VirtualizedList` (Virtuoso) for performance with many bookmarks
- [ ] Mobile: `MobileDrawer` via `isTouchDevice()` detection
- [ ] Filter state: `useState<'all' | 'spaces' | 'dms'>('all')`
- [ ] Space dropdown: Show list of spaces user has bookmarks from
- [ ] Empty state with helpful message
- [ ] Loading state during fetch

#### BookmarkItem

**Reference**: Follow `PinnedMessageItem` pattern from `PinnedMessagesPanel.tsx:52-130`

```typescript
interface BookmarkItemProps {
  bookmark: Bookmark;
  message: Message;          // Resolved message content
  sourceName: string;        // "Space Name > #channel" or "Contact Name"
  mapSenderToUser: (senderId: string) => any;
  onJumpToMessage: (messageId: string) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  stickers?: { [key: string]: Sticker };
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
}
```

**Layout** (matches PinnedMessageItem):
```
┌─────────────────────────────────────────────────────────────┐
│ 👤 Sender Name    📅 2 hours ago    [Jump →] [🗑 Remove]    │
├─────────────────────────────────────────────────────────────┤
│ 📍 Space Name > #channel-name                               │
├─────────────────────────────────────────────────────────────┤
│ Message preview text with markdown stripped, truncated      │
│ to character limit...                                       │
└─────────────────────────────────────────────────────────────┘
```

**Two Action Buttons** (like PinnedMessageItem):
```typescript
<FlexRow className={`message-actions items-center${isTouchDevice() ? ' always-visible' : ''}`}>
  {/* Jump button */}
  <Button
    type="secondary"
    onClick={() => onJumpToMessage(bookmark.messageId)}
    iconName="arrow-right"
    size="small"
    className="gap-1 mr-2"
  >
    {t`Jump`}
  </Button>

  {/* Remove bookmark button */}
  <Tooltip
    id={`remove-bookmark-${bookmark.bookmarkId}`}
    content={t`Remove bookmark`}
    place="top"
    showOnTouch={false}
  >
    <Button
      type="unstyled"
      onClick={() => onRemoveBookmark(bookmark.bookmarkId)}
      iconName="bookmark-off"  // or "trash"
      iconOnly={true}
      size="small"
      className="text-danger"
    />
  </Tooltip>
</FlexRow>
```

**Message Preview with Character Limit**:
- [ ] Use `MessagePreview` component (same as PinnedMessagesPanel)
- [ ] Use `processMarkdownText()` from `src/utils/markdownStripping.ts`
- [ ] Apply smart markdown stripping options:
  ```typescript
  processMarkdownText(messageText, {
    preserveLineBreaks: true,     // Keep paragraph structure
    preserveEmphasis: true,       // Keep bold/italic intent without syntax
    preserveHeaders: true,        // Keep header content without ### syntax
    removeFormatting: true,       // Remove markdown syntax
    truncateLength: 300,          // Character limit for preview (adjustable)
  });
  ```
- [ ] Character limit constant: `BOOKMARK_PREVIEW_CHAR_LIMIT = 300` (configurable)

**Features**:
- [ ] Reuse `MessagePreview` component with `hideHeader={true}`
- [ ] Source context line showing space/channel or DM contact name
- [ ] Relative timestamp via `formatMessageDate()`
- [ ] Two buttons: "Jump" (secondary) + "Remove" (danger icon-only)
- [ ] Buttons always visible on touch devices (`isTouchDevice()`)
- [ ] Handle deleted messages gracefully (show placeholder text)

---

### Phase 4: Message Action Integration

**Files to modify**:
- `src/components/message/MessageActions.tsx` - Desktop hover actions
- `src/components/message/MessageActionsDrawer.tsx` - Mobile touch drawer
- `src/components/message/Message.tsx` - Pass bookmark props

#### MessageActions (Desktop)

**Reference**: `src/components/message/MessageActions.tsx`

**Current action order**:
```
[❤️][👍][🔥][😊] | [Reply][Copy Link][Copy Message] | [Edit][History] | [Pin] [Delete]
```

**New order with Bookmark** (after Copy Message, before the `|` separator):
```
[❤️][👍][🔥][😊] | [Reply][Copy Link][Copy Message][Bookmark] | [Edit][History] | [Pin] [Delete]
```

**Props to add**:
```typescript
interface MessageActionsProps {
  // ... existing props
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}
```

**Add to tooltip switch** (in `getTooltipContent()`):
```typescript
case 'bookmark':
  return isBookmarked ? t`Remove bookmark` : t`Bookmark message`;
```

**Add bookmark button** (after Copy Message at line ~196, before the Edit/History separator):
```typescript
{/* Copy message */}
<div
  onClick={onCopyMessageText}
  onMouseEnter={() => setHoveredAction('copyMessage')}
  className="text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
>
  <Icon name="clipboard" size="sm" />
</div>

{/* Bookmark - always available, no permission check */}
{onToggleBookmark && (
  <div
    onClick={onToggleBookmark}
    onMouseEnter={() => setHoveredAction('bookmark')}
    className="ml-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
  >
    <Icon
      name={isBookmarked ? 'bookmark-filled' : 'bookmark'}
      size="sm"
      className={isBookmarked ? 'text-accent' : ''}
    />
  </div>
)}

{/* Edit/History section with separator */}
{(canUserEdit || canViewEditHistory) && (
  // ... existing code
)}
```

#### MessageActionsDrawer (Mobile)

**Reference**: `src/components/message/MessageActionsDrawer.tsx`

**Props to add**:
```typescript
export interface MessageActionsDrawerProps {
  // ... existing props
  isBookmarked?: boolean;
  onBookmark?: () => void;
}
```

**Add bookmark action** (position after "Copy message", before "Edit message"):
```typescript
{/* Current order in drawer:
   Reply → Copy message link → Copy message → [BOOKMARK HERE] → Edit → View edit history → Pin → Delete
*/}

<div onClick={handleCopyMessageText} className="mobile-drawer__action-item">
  <Icon name="clipboard" />
  <Text>{t`Copy message`}</Text>
</div>

{/* Bookmark action - always available, no permission check */}
{onBookmark && (
  <div
    onClick={handleBookmark}
    className="mobile-drawer__action-item"
  >
    <Icon name={isBookmarked ? "bookmark-filled" : "bookmark"} />
    <Text>{isBookmarked ? t`Remove bookmark` : t`Bookmark message`}</Text>
  </div>
)}

{canEdit && onEdit && (
  <div onClick={handleEdit} className="mobile-drawer__action-item">
    <Icon name="edit" />
    <Text>{t`Edit message`}</Text>
  </div>
)}
```

**Add handler**:
```typescript
const handleBookmark = () => {
  if (onBookmark) {
    onBookmark();
    onClose();
  }
};
```

#### Message.tsx Integration

**Pass bookmark props** from Message to both MessageActions and MessageActionsDrawer:
```typescript
// In Message component
const { isBookmarked, toggleBookmark } = useBookmarks(userAddress);

// Pass to MessageActions
<MessageActions
  // ... existing props
  isBookmarked={isBookmarked(message.messageId)}
  onToggleBookmark={() => toggleBookmark(message, sourceType, context)}
/>

// Pass to MessageActionsDrawer
<MessageActionsDrawer
  // ... existing props
  isBookmarked={isBookmarked(message.messageId)}
  onBookmark={() => toggleBookmark(message, sourceType, context)}
/>
```

**Note**: No permission check needed - all users can bookmark any visible message.

---

### Phase 5: Header Integration

> **Architecture Note**: Since bookmarks are GLOBAL (across all spaces and DMs), the panel shows the same data regardless of where it's opened. To avoid multiple panel instances, use a **singleton pattern via React Context** or **Portal to a single mount point**. Alternatively, manage open state at app level to ensure only one panel is open at a time.

**Files to modify**:
- `src/components/space/Channel.tsx` - Add bookmark icon after search icon
- `src/components/direct/DirectMessage.tsx` - Add bookmark icon after gear icon
- Consider: `src/components/context/BookmarksContext.tsx` (NEW) - For singleton panel state

**Channel Header Changes**:
```typescript
// After search icon (last position)

{/* Separator before bookmark */}
<div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5" />

{/* Bookmark icon - no badge */}
<Tooltip content={t`Bookmarks`}>
  <Button
    ref={bookmarkButtonRef}
    icon="bookmark"
    onClick={() => setIsBookmarksPanelOpen(true)}
  />
</Tooltip>

<BookmarksPanel
  isOpen={isBookmarksPanelOpen}
  onClose={() => setIsBookmarksPanelOpen(false)}
  anchorRef={bookmarkButtonRef}
/>
```

**DirectMessage Header Changes**:
```typescript
// After gear/settings icon (last position)

{/* Separator before bookmark */}
<div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5" />

{/* Bookmark icon - no badge */}
<Tooltip content={t`Bookmarks`}>
  <Button
    ref={bookmarkButtonRef}
    icon="bookmark"
    onClick={() => setIsBookmarksPanelOpen(true)}
  />
</Tooltip>

<BookmarksPanel
  isOpen={isBookmarksPanelOpen}
  onClose={() => setIsBookmarksPanelOpen(false)}
  anchorRef={bookmarkButtonRef}
/>
```

---

### Phase 6: Cross-Context Navigation

**Files to reference**:
- `src/hooks/business/messages/useMessageHighlight.ts`

**Navigation Logic** (with proper timing for cross-context navigation):
```typescript
const navigateToBookmark = async (bookmark: Bookmark) => {
  // 1. Close bookmarks panel first
  onClose();

  // 2. Determine if cross-context navigation needed
  const needsNavigation = bookmark.sourceType === 'channel'
    ? (currentSpaceId !== bookmark.spaceId || currentChannelId !== bookmark.channelId)
    : (currentConversationId !== bookmark.conversationId);

  if (needsNavigation) {
    // 3a. Cross-context: Use URL hash - let destination component handle highlight
    // This is more reliable than setTimeout
    if (bookmark.sourceType === 'channel') {
      navigate(`/spaces/${bookmark.spaceId}/channels/${bookmark.channelId}#msg-${bookmark.messageId}`);
    } else {
      navigate(`/dm/${bookmark.conversationId}#msg-${bookmark.messageId}`);
    }
    // Destination Channel/DirectMessage component reads hash and highlights on mount
  } else {
    // 3b. Same context: Highlight immediately
    highlightMessage(bookmark.messageId, {
      duration: 3000,
      variant: 'default',
      scrollBehavior: 'smooth',
      scrollBlock: 'center',
    });
  }
};
```

**Edge Cases to Handle**:
- [ ] Original message was deleted → Show "Message no longer available" in panel
- [ ] User no longer has access to space → Show "Space no longer accessible"
- [ ] Message in archived channel → Navigate anyway (if accessible)

---

### Phase 7: Sync Integration (Phase 2 - After Core Feature)

> **Note**: Sync is a separate phase. Implement local-only bookmarks first, add sync after core functionality is validated.

**Clarification**: Bookmarks sync via **UserConfig sync** (the `allowSync` privacy setting), NOT via `SyncService.ts` which handles space data between peers.

**Files to modify**:
- Wherever `UserConfig` sync is handled (NOT SyncService.ts)
- Look for where `allowSync` setting triggers data sync between user's devices

**Sync Behavior**:
When `allowSync` is enabled in Privacy settings:
- Bookmarks sync between the **same user's devices** (not between different users)
- Add `bookmarks` to the UserConfig sync payload

**Implementation Notes**:
```typescript
// In UserConfig sync structure
type SyncableUserData = {
  // Existing
  spaceIds: string[];
  spaceKeys: SpaceKey[];
  // New
  bookmarks?: Bookmark[];
  deletedBookmarkIds?: string[];  // For deletion sync (tombstones)
};
```

**Conflict Resolution** (merge-based, not "latest wins"):
```typescript
const mergeBookmarks = (local: Bookmark[], remote: Bookmark[]) => {
  const merged = new Map<string, Bookmark>();
  // Union of both sets - don't lose any bookmarks
  [...local, ...remote].forEach(b => {
    const existing = merged.get(b.bookmarkId);
    // Keep the one with latest createdAt if duplicate IDs
    if (!existing || b.createdAt > existing.createdAt) {
      merged.set(b.bookmarkId, b);
    }
  });
  return Array.from(merged.values());
};
```

- [ ] Add bookmarks to UserConfig sync payload when `allowSync === true`
- [ ] Implement merge-based conflict resolution (union of bookmarks)
- [ ] Track deleted bookmark IDs for deletion sync across devices
- [ ] Apply `deletedBookmarkIds` filter after merge to handle deletions

---

## Performance Optimizations

### 1. O(1) Bookmark Status Check

**Problem**: Checking `isBookmarked(messageId)` for every message in the list could be expensive.

**Solution**: Load all bookmark IDs into a memoized `Set` on mount:
```typescript
const bookmarkedMessageIds = useMemo(
  () => new Set(bookmarks.map(b => b.messageId)),
  [bookmarks]
);

const isBookmarked = useCallback(
  (messageId: string) => bookmarkedMessageIds.has(messageId),
  [bookmarkedMessageIds]
);
```

**Cost**: O(n) once on load, O(1) per message check.

### 2. Virtualized Bookmark List

**Problem**: Rendering 500+ bookmarks at once kills performance.

**Solution**: Use Virtuoso (already used in PinnedMessagesPanel):
```typescript
<Virtuoso
  data={filteredBookmarks}
  itemContent={(index, bookmark) => (
    <BookmarkItem key={bookmark.bookmarkId} bookmark={bookmark} ... />
  )}
  style={{ height: '100%' }}
/>
```

### 3. Lazy Message Resolution

**Problem**: Fetching full message content for all bookmarks is expensive.

**Solution**: Batch fetch with caching:
```typescript
// Messages are already cached by React Query
// When panel opens, batch fetch only messages not in cache
const unresolvedIds = bookmarks
  .filter(b => !queryClient.getQueryData(['message', b.messageId]))
  .map(b => b.messageId);

if (unresolvedIds.length > 0) {
  await batchGetMessages(unresolvedIds); // Single DB query
}
```

### 4. Indexed Database Queries

**Problem**: Filtering bookmarks by space/type could be slow.

**Solution**: Compound indices in IndexedDB:
```typescript
// Fast query: Get all bookmarks for a space, sorted by date
const index = store.index('by_space');
const range = IDBKeyRange.bound(
  [spaceId, 0],
  [spaceId, Date.now()]
);
```

### 5. Debounced Panel Open

**Problem**: Rapid open/close could trigger unnecessary queries.

**Solution**: Debounce or use `enabled` flag in React Query:
```typescript
useQuery({
  queryKey: ['bookmarks', userAddress],
  queryFn: fetchBookmarks,
  enabled: isPanelOpen, // Only fetch when panel is open
  staleTime: 30000,     // Cache for 30 seconds
});
```

### Performance Summary

| Operation | Complexity | Mitigation |
|-----------|------------|------------|
| isBookmarked check | O(1) | Memoized Set |
| Panel render | O(visible) | Virtuoso |
| Message resolution | O(uncached) | React Query cache |
| Filter by space | O(log n) | IndexedDB index |
| Add/remove bookmark | O(1) + invalidate | Optimistic updates |

---

## Verification

✅ **Bookmark functionality works**
   - Test: Bookmark message in Channel → appears in panel → remove → disappears

✅ **Bookmark from DM works**
   - Test: Bookmark DM message → appears in panel under DMs filter

✅ **Navigation works**
   - Test: Click bookmark → navigates to original message → highlights it

✅ **Cross-context navigation works**
   - Test: Bookmark in Space A → switch to Space B → open panel → click bookmark → returns to Space A

✅ **Filtering works**
   - Test: Toggle All/Spaces/DMs → list updates correctly
   - Test: Select specific space → only that space's bookmarks shown

✅ **Panel UI follows existing patterns**
   - Test: Opens as dropdown on desktop, MobileDrawer on touch devices
   - Test: Styling matches PinnedMessagesPanel/NotificationsPanel

✅ **Performance acceptable**
   - Test: Panel with 100+ bookmarks opens quickly (<500ms)
   - Test: No jank when scrolling bookmark list
   - Test: Message list doesn't slow down with bookmarks feature enabled

✅ **Sync works (when enabled)**
   - Test: Enable allowSync → bookmark message → sync to another device → bookmark appears

✅ **Edge cases handled**
   - Test: Bookmarked message deleted → shows appropriate message
   - Test: Left space with bookmarks → bookmarks remain but navigation shows error

✅ **TypeScript compiles**
   - Run: `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit"`

---

## Definition of Done

- [ ] Data layer complete (bookmarks store, types, CRUD, indices)
- [ ] `useBookmarks` hook with all operations and memoized Set
- [ ] `BookmarksPanel` with Virtuoso and filters
- [ ] `BookmarkItem` with preview, navigation, remove
- [ ] Message action integration (bookmark button on hover)
- [ ] Channel header integration (last position)
- [ ] DirectMessage header integration (last position)
- [ ] Cross-context navigation working
- [ ] Sync integration when `allowSync` is enabled
- [ ] TypeScript passes
- [ ] Manual testing on desktop
- [ ] Manual testing on mobile/touch devices
- [ ] Performance testing with 100+ bookmarks
- [ ] Edge cases handled (deleted messages, left spaces)
- [ ] No console errors

---

## Files Reference

**Existing patterns to follow**:
- `src/db/messages.ts` - IndexedDB patterns
- `src/hooks/business/messages/usePinnedMessages.ts` - Hook pattern
- `src/components/message/PinnedMessagesPanel.tsx:52-130` - PinnedMessageItem pattern (Jump + Remove buttons)
- `src/components/message/MessagePreview.tsx` - Message preview with markdown stripping
- `src/components/notifications/NotificationPanel.tsx` - Filter pattern
- `src/components/ui/DropdownPanel.tsx` - Container component
- `src/components/message/MessageActions.tsx` - Desktop action buttons
- `src/components/message/MessageActionsDrawer.tsx` - Mobile action drawer
- `src/hooks/business/messages/useMessageHighlight.ts` - Navigation
- `src/utils/markdownStripping.ts` - `processMarkdownText()` with `truncateLength` option
- `src/utils/formatMessageDate.ts` - Relative timestamp formatting
- `src/services/SyncService.ts` - Sync patterns
- `src/components/modals/UserSettingsModal/Privacy.tsx` - allowSync setting

**New files to create**:
- `src/db/bookmarks.ts`
- `src/hooks/business/bookmarks/useBookmarks.ts`
- `src/hooks/business/bookmarks/index.ts`
- `src/components/bookmarks/BookmarksPanel.tsx`
- `src/components/bookmarks/BookmarkItem.tsx`
- `src/components/bookmarks/index.ts`
- Consider: `src/components/context/BookmarksContext.tsx` (for singleton panel state)

---

## Design Decisions (Finalized)

| Decision | Answer |
|----------|--------|
| **Visual separator** | YES - `\|` separator before bookmark icon in headers |
| **Bookmark limit** | Max 200 bookmarks per user |
| **Badge on icon** | NO - no count badge on header icon |
| **Visual indicator on messages** | NO - only action in MessageActions/Drawer |
| **Position in MessageActions** | After "Copy message", before the `\|` separator |
| **Position in MessageActionsDrawer** | After "Copy message", before "Edit message" |

---

_Created: 2025-11-24_
_Updated: 2025-11-24_
