# Unified Notification System (Mentions + Replies)

## Overview

The Unified Notification System provides real-time visual feedback for both mentions and replies. The system tracks unread notifications across devices, provides contextual highlighting, and allows users to configure notification preferences per space.

### Supported Notification Types

- **@you mentions**: Direct user mentions (`@<address>`)
- **@everyone mentions**: Mentions all users in the channel (permission-based)
- **Replies**: When someone replies to your message
- **@role mentions** (Planned): Role-based mentions with user role checking

### Key Design

The system uses a **unified notification type format** (`'mention-you'`, `'mention-everyone'`, `'mention-roles'`, `'reply'`) that allows mentions and replies to be:
- Displayed together in a single notification panel
- Filtered independently by type
- Configured per-space in user settings
- Counted separately but displayed in combined channel badges

**Architecture**: Mentions and replies are **separate systems** (different data models, queries, and cache keys) that **share UI components** (NotificationPanel, NotificationItem) for a unified user experience.

---

## Architecture

### High-Level Flow

```
Message sent with @mention
    ↓
extractMentionsFromText() parses @<address> format
    ↓
MessageService saves message with mentions field
    ↓
React Query invalidates mention-counts cache
    ↓
useChannelMentionCounts() recalculates counts
    ↓
ChannelList renders bubbles with counts
```

### Read Tracking Flow

```
User opens channel
    ↓
useConversation() fetches lastReadTimestamp (React Query)
    ↓
Interval (2s) checks if new content to mark as read
    ↓
useUpdateReadTime() saves to DB, then invalidates cache
    ↓
React Query refetches → bubble updates automatically
```

**Key Design**: Channel-level read tracking (opening channel marks all messages as read). This matches industry standard (Discord, Slack) where apps auto-scroll to bottom.

### Message Highlighting Flow

```
Mentioned message enters viewport (50% visible)
    ↓
useViewportMentionHighlight() detects via IntersectionObserver
    ↓
Check: isMentioned && isUnread (createdDate > lastRead)?
    ↓
highlightMessage(messageId, { duration: 6000 })
    ↓
Message gets .message-highlighted CSS class
    ↓
Flash-highlight animation (yellow fade, 6s)
```

---

## Core Components

### Utilities

**`src/utils/mentionUtils.ts`**
- `extractMentionsFromText(text, options)`: Parses @<address>, @everyone patterns
- `isMentioned(message, options)`: Checks if user is mentioned
- `isMentionedWithSettings(message, options)`: Checks mention with user settings (unified format)
  - Accepts: `['mention-you', 'mention-everyone', 'mention-roles']`
  - Filters mentions based on enabled notification types
- `getMentionType(message, options)`: Returns mention type for UI

**`src/utils/notificationSettingsUtils.ts`**
- `getDefaultNotificationSettings(spaceId)`: Returns default settings for a space
  - Default: `['mention-you', 'mention-everyone', 'mention-roles', 'reply']` (all enabled)
- `saveNotificationSettings()`: Persists settings to IndexedDB user config
- `getNotificationSettings()`: Retrieves settings for a space

### Hooks

**`src/hooks/business/mentions/useChannelMentionCounts.ts`**
- React Query hook to calculate unread mention counts per channel
- Query key: `['mention-counts', 'channel', spaceId, userAddress, ...channelIds]`
- Stale time: 90 seconds, refetches on window focus
- Implements early-exit at 10 mentions (matches "9+" display threshold)
- Uses `getUnreadMentions()` for efficient database-level filtering
- Respects user's notification settings (filters by enabled types)
- Uses unified format: filters types starting with `'mention-'`
- Returns: `{ [channelId]: mentionCount }`

**`src/hooks/business/mentions/useSpaceMentionCounts.ts`**
- Space-level mention counts (aggregates across all channels)
- Used for space icon notification badges
- Implements early-exit at 10 mentions across all channels
- Uses `getUnreadMentions()` for efficient database-level filtering
- Returns: `{ [spaceId]: mentionCount }`

**`src/hooks/business/mentions/useAllMentions.ts`**
- Fetches all unread mentions across all channels in a space
- Supports filtering by mention type using unified format: `['mention-you', 'mention-everyone', 'mention-roles']`
- Returns: `{ mentions: MentionNotification[], isLoading }`
- Used by NotificationPanel

**`src/hooks/business/replies/useReplyNotificationCounts.ts`**
- React Query hook to calculate unread reply counts per channel
- Query key: `['reply-counts', 'channel', spaceId, userAddress, ...channelIds]`
- Stale time: 90 seconds, refetches on window focus
- Implements early-exit at 10 replies (matches "9+" display threshold)
- Uses `getUnreadReplies()` for efficient database-level filtering
- Returns: `{ [channelId]: replyCount }`

**`src/hooks/business/replies/useAllReplies.ts`**
- Fetches all unread replies across all channels in a space
- Query key: `['reply-notifications', spaceId, userAddress, ...channelIds]`
- Returns: `{ replies: ReplyNotification[], isLoading }`
- Used by NotificationPanel

**`src/hooks/business/mentions/useViewportMentionHighlight.ts`**
- Auto-highlights mentions when entering viewport
- Uses IntersectionObserver API (50% visibility threshold)
- Integrates with existing `useMessageHighlight()` system
- Duration: 6 seconds

**`src/hooks/business/conversations/useUpdateReadTime.ts`**
- React Query mutation for atomic read time updates
- DB write completes BEFORE cache invalidation (fixes race condition)
- Invalidates: conversation cache + mention count caches + reply count caches

**`src/hooks/queries/conversation/useConversation.ts`**
- Fetches conversation data including lastReadTimestamp
- Single source of truth for read state

### UI Components

**`src/components/space/ChannelList.tsx`**
- Calls `useChannelMentionCounts({ spaceId, channelIds })`
- Merges counts into channel data
- Passes to ChannelGroup → ChannelItem

**`src/components/space/ChannelItem.tsx`**
- Combines mention counts + reply counts for unified notification bubble
- Formula: `totalCount = mentionCount + replyCount`
- CSS class: `channel-mentions-bubble-you`
- Display: Shows combined count in accent-colored bubble

**`src/components/message/Message.tsx`**
- Receives `lastReadTimestamp` prop from MessageList
- Calculates `isUnread = message.createdDate > lastReadTimestamp`
- Passes to `useViewportMentionHighlight()`

**`src/components/space/Channel.tsx`**
- Uses `useConversation()` for lastReadTimestamp
- Implements interval-based read time updates (2s)
- Saves immediately on unmount
- Renders notification bell icon with NotificationPanel

**`src/components/notifications/NotificationPanel.tsx`**
- Unified notification inbox panel (mentions + replies)
- Fetches both `useAllMentions()` and `useAllReplies()`
- Combines and sorts by date (newest first)
- Multi-select filter by type: `['mention-you', 'mention-everyone', 'mention-roles', 'reply']`
- Mark all as read functionality
- Click-to-navigate using URL hash: `navigate(\`/spaces/${spaceId}/${channelId}#msg-${messageId}\`)`
- Navigation works for same-channel and cross-channel consistently

**`src/components/notifications/NotificationItem.tsx`**
- Individual notification item display
- Supports both mention and reply notifications
- Matches SearchResults layout (channel - author - date - message)
- Message truncation (200 chars max)
- Shows appropriate icon (mention vs reply)

### Services

**`src/services/MessageService.ts`** (lines 2161-2190, 586-593)
- Extracts mentions when creating messages
- Validates @everyone permission before extraction
- Populates `replyMetadata` when creating reply (stores parent author and channel)
- Invalidates both mention and reply counts when new notifications arrive

**`src/db/messages.ts`**
- Stores `lastReadTimestamp` in conversations table
- `saveReadTime()`: Updates timestamp
- `getConversation()`: Retrieves timestamp for count calculation
- `getUnreadMentions()`: Efficient query for mention counting
  - Fetches only messages after lastReadTimestamp with mentions
  - Database-level filtering using IndexedDB cursors
  - Supports limit parameter for early-exit optimization
- `getUnreadReplies()`: Efficient query for reply counting
  - Fetches only messages where `replyMetadata.parentAuthor === userAddress`
  - Same performance optimizations as getUnreadMentions

---

## @everyone Mentions Implementation

### Permission System

**Who can use @everyone**:
- Space owners (automatic)
- Users with `mention:everyone` role permission (assigned via Space Settings → Roles)

**Permission files**:
- `src/utils/permissions.ts` - Space owners get permission automatically
- `src/api/quorumApi.ts` - `'mention:everyone'` added to Permission type
- `src/components/modals/SpaceSettingsModal/Roles.tsx` - UI for assigning permission

### Mention Processing

**Extraction with permission check**:
```typescript
// In MessageService.submitChannelMessage()
const canUseEveryone = hasPermission(
  currentPasskeyInfo.address,
  'mention:everyone',
  space,
  isSpaceOwner
);

mentions = extractMentionsFromText(messageText, {
  allowEveryone: canUseEveryone
});
```

**Rendering**:
- **Web**: `MessageMarkdownRenderer.tsx` - Conditionally styles @everyone based on `message.mentions.everyone`
- **Mobile**: `useMessageFormatting.ts` - Returns mention token only if permission granted

**Notification counting**:
- `useChannelMentionCounts` checks both personal mentions and @everyone
- Uses `isMentioned(message, { userAddress, checkEveryone: true })`

### Edge Cases Handled

- **Code blocks**: @everyone inside code blocks doesn't trigger notifications
- **Case insensitive**: @everyone, @Everyone, @EVERYONE all work
- **Punctuation**: @everyone! @everyone, @everyone. correctly recognized
- **Permission denial**: Non-authorized users' @everyone appears as plain text, no notifications

---

## Key Design Decisions

### 1. Unified Notification Type System
**Decision**: Use single type system (`NotificationTypeId`) for mentions and replies
**Format**: `'mention-you' | 'mention-everyone' | 'mention-roles' | 'reply'`
**Rationale**:
- Allows filtering by type in UI (multiselect)
- Enables per-space configuration of enabled types
- Clear distinction between mention types and reply type (prefix-based)
**Benefits**: Consistent API across hooks and components, no format transformations needed

### 2. Separate Systems, Shared UI
**Decision**: Mentions and replies are separate systems that share UI components
**Architecture**:
- **Separate**: Data models, database queries, React Query cache keys, hooks
- **Shared**: NotificationPanel, NotificationItem, read tracking, highlighting
**Rationale**:
- Mentions are TEXT-BASED (`@user` parsing)
- Replies are RELATIONSHIP-BASED (parent-child messages via `replyMetadata`)
- Semantic mismatch means shared data layer would couple unrelated concerns
**Benefits**: Independent caching (no unnecessary invalidations), cleaner separation of concerns

### 3. URL Hash Navigation for All Notifications
**Decision**: Always use URL hash (`navigate(\`#msg-${messageId}\`)`) for notification navigation
**Applies to**: Both mentions and replies, same-channel and cross-channel
**Rationale**:
- MessageList already detects hash and scrolls to message
- Message component applies `.message-highlighted` class when hash matches
- Works reliably after channel mount (no timing issues)
- Consistent behavior across all navigation scenarios
**Benefits**: 90% less code, simpler logic, no cross-channel bugs

### 4. Reuse Existing Highlight System
**Decision**: Use `useMessageHighlight()` instead of creating new highlight logic
**Rationale**: Consistency with search/pinned messages, reuses CSS animations, single source of truth
**Trade-off**: Different duration (6s for mentions vs 2s for search) required adding duration parameter

### 5. Database-Based Read Tracking
**Decision**: Use existing `conversations.lastReadTimestamp` in IndexedDB
**Rationale**: Persists across restarts, works with DM read tracking, no new tables needed
**Trade-off**: Prop drilling through components (Channel → MessageList → Message)

### 6. Database-Level Filtering
**Decision**: Use dedicated database methods (`getUnreadMentions`, `getUnreadReplies`) for efficient querying
**Rationale**: Fetches only relevant messages after lastReadTimestamp, reducing memory and CPU usage
**Implementation**: IndexedDB cursor-based filtering with early-exit support
**Trade-off**: Slightly more complex than simple getAll(), but significantly faster for large channels

### 7. React Query Architecture
**Decision**: Use React Query for read state management with independent cache keys
**Cache Keys**:
- Mentions: `['mention-counts', ...]` and `['mention-notifications', ...]`
- Replies: `['reply-counts', ...]` and `['reply-notifications', ...]`
**Rationale**: Single source of truth, automatic reactivity, proper cache invalidation ordering, no coupling
**Benefits**: Prevents race conditions with rapid messages, eliminates flickering bubbles, independent invalidation

### 8. Early-Exit Optimization
**Decision**: Stop counting at 10 (display threshold) for both mentions and replies
**Rationale**: UI shows "9+" for counts > 9, so exact counts beyond 10 are unnecessary
**Implementation**: Both count hooks exit early once threshold reached
**Benefits**: 3-5x performance improvement for channels with many notifications

### 9. Channel-Level Read Tracking
**Decision**: Opening channel marks ALL messages as read (not viewport-based)
**Rationale**: App auto-scrolls to bottom, matches industry standard (Discord/Slack), simpler UX
**Trade-off**: User doesn't get granular "mark each notification as read" - acceptable for most use cases

---

## Integration Points

### Message Creation Flow
**File**: `src/services/MessageService.ts:2161-2190`
**Mentions**: Extracts mentions before saving, populates `mentions.memberIds[]` or `mentions.everyone`
**Replies**: Populates `replyMetadata` with `{ parentAuthor, parentChannelId }` when reply is created

### Query Invalidation
**Files**: `MessageService.ts:586-593`, `Channel.tsx`, `useUpdateReadTime.ts`
**Triggers**:
- New mention arrives → invalidate mention counts (`['mention-counts', 'channel', spaceId]`)
- New reply arrives → invalidate reply counts (`['reply-counts', 'channel', spaceId]`)
- Read time saved → invalidate both mention and reply counts
- Mark all as read → invalidate all notification caches

### Highlight System
**Files**: `Message.tsx`, `useViewportMentionHighlight.ts`, `NotificationPanel.tsx`
**Integration**: Extends existing `useMessageHighlight()` infrastructure, reuses `.message-highlighted` CSS
**Navigation**: NotificationPanel uses URL hash for consistent highlighting across all notification types

---

## Known Limitations

### Performance
The system is optimized for typical use cases:
- Database-level filtering reduces unnecessary data fetching
- Early-exit at 10 notifications (mentions + replies) prevents over-counting
- 90s stale time reduces query frequency
- Typical performance: <200ms for 20 channels with notifications

**Note**: Channels with >10k messages may still experience some delay. Future optimization: Add dedicated notification indices to IndexedDB schema.

### Functional
1. **Self-mentions**: Users get notifications when mentioning themselves (minor annoyance)
2. **Self-replies**: Users do NOT get notifications when replying to their own messages (by design, filtered in `replyMetadata` population)
3. **Deleted messages**: Messages deleted before viewing still count (matches "notifications at time of viewing" philosophy)

### UX
1. **Highlight re-triggers**: Scrolling back to already-seen notification highlights it again (low priority)
2. **Channel-level tracking**: All notifications marked read when opening channel, not per-message (by design)
3. **Combined counts**: Channel badge shows total (mentions + replies), not separated by type

---

## Cross-Device Synchronization

**Status**: ✅ Supported via IndexedDB and SyncService

### How It Works

Read states sync across devices through the app's data synchronization:

```
Device A: User views channel → lastReadTimestamp updated in IndexedDB
    ↓
SyncService syncs to server
    ↓
Device B: Opens app → fetches latest lastReadTimestamp from server
    ↓
React Query refetches mention counts with synced timestamp
    ↓
Already-read mentions filtered out → bubble counts update correctly
```

**Sync timing**:
- **On app focus**: React Query refetches with `refetchOnWindowFocus: true`
- **On app launch**: Initial data load fetches latest server state
- **Manual refresh**: User-triggered sync pulls fresh data
- **Background sync**: Every 90 seconds (stale time) + periodic sync based on SyncService configuration

**Eventual consistency**:
- ⚠️ Not instantaneous (requires network round-trip)
- ⚠️ UI updates on next data fetch, not real-time
- ✅ Once synced, all devices show same state
- ✅ Offline resilient (queued changes sync when online)

**Configuration**:
- `allowSync` flag in user config controls cross-device sync
- Stored in IndexedDB `user_config` object store

### Troubleshooting Sync Issues

**Problem**: Notifications cleared on Device A still show on Device B

**Debug steps**:
1. Check `allowSync` enabled: `messageDB.getUserConfig({ address })`
2. Verify network connectivity
3. Check React Query DevTools for stale data
4. Manually refetch: focus window or navigate between spaces
5. Check console for sync errors

**Common causes**:
- `allowSync: false` in user config
- Network issues preventing sync
- Device B using stale cache (within 90s window)
- App backgrounded (needs focus to trigger refetch)

---

## Troubleshooting

### Bubbles Not Appearing

**Symptoms**: User mentioned but no bubble shows

**Common causes**:
- Mention format wrong (needs `@<address>` not `@address`)
- Old messages sent before feature implemented
- User already viewed channel after mention sent

**Debug**: Check console for `[MentionCounts] Error`, verify message has `mentions.memberIds[]` populated

### Bubbles Not Clearing

**Symptoms**: Bubble persists after viewing channel

**Common causes**:
- Debounce delay (wait 2 seconds after viewing)
- React Query cache not invalidating
- User scrolled but didn't wait for debounce

**Debug**: Check `lastReadTimestamp` in DB, verify query invalidation in Network tab, check React Query DevTools

### Performance Issues

**Symptoms**: Lag when switching channels or viewing mention counts

**Common causes**:
- Very large channels (>10k messages)
- Slow IndexedDB performance (check browser DevTools)
- Network latency affecting sync

**Solutions**:
- Use React Query DevTools to identify slow queries
- Check IndexedDB performance in browser Performance tab
- Verify stale time is set to 90s (should reduce query frequency)
- Consider clearing old messages from channels with excessive history

---

## File Reference

```
src/
├── utils/
│   ├── mentionUtils.ts                    # Mention detection/extraction (unified format)
│   └── notificationSettingsUtils.ts       # Notification settings helpers
├── types/
│   └── notifications.ts                   # NotificationTypeId, NotificationSettings
├── hooks/
│   ├── business/
│   │   ├── mentions/
│   │   │   ├── useChannelMentionCounts.ts # Mention count calculation (channel-level)
│   │   │   ├── useSpaceMentionCounts.ts   # Mention count calculation (space-level)
│   │   │   ├── useAllMentions.ts          # Fetch all mentions for panel
│   │   │   └── useViewportMentionHighlight.ts # Viewport trigger
│   │   ├── replies/
│   │   │   ├── useReplyNotificationCounts.ts # Reply count calculation (channel-level)
│   │   │   └── useAllReplies.ts           # Fetch all replies for panel
│   │   └── conversations/
│   │       └── useUpdateReadTime.ts       # Read time mutation (invalidates both)
│   └── queries/
│       └── conversation/
│           └── useConversation.ts         # Read time query
├── components/
│   ├── space/
│   │   ├── Channel.tsx                    # Read time tracking + notification bell
│   │   ├── ChannelList.tsx                # Mention count integration
│   │   └── ChannelItem.tsx                # Combined notification bubble (mentions + replies)
│   ├── message/
│   │   ├── Message.tsx                    # Highlight trigger
│   │   ├── MessageList.tsx                # Hash detection + scrolling
│   │   └── MessageMarkdownRenderer.tsx    # @everyone rendering (web)
│   ├── notifications/
│   │   ├── NotificationPanel.tsx          # Unified panel (mentions + replies)
│   │   └── NotificationItem.tsx           # Individual notification
│   └── modals/
│       └── SpaceSettingsModal/
│           └── Account.tsx                # Notification settings UI
├── services/
│   └── MessageService.ts                  # Mention extraction + reply metadata
└── db/
    └── messages.ts                        # Read time + getUnreadMentions/Replies
```

---

## Related Documentation

- **[Reply Notification System](../../tasks/.done/reply-notification-system.md)** - Reply implementation details
- **[Data Management Architecture](../data-management-architecture-guide.md)** - Sync service integration
- **[Cross-Platform Architecture](../cross-platform-repository-implementation.md)** - Primitive usage
- **[Notification Settings](../../tasks/.done/mention-notification-settings-phase4.md)** - Per-space notification configuration

---

## Notification Panel UI

### Overview

The NotificationPanel provides a centralized view of all unread notifications (mentions and replies) across all channels in a space.

### Features

- **Bell icon**: Appears in channel header (left of users icon) when unread notifications exist
- **Visual indicator**: Red notification dot on bell icon shows count
- **Unified panel**: Displays both mentions and replies sorted by date (newest first)
- **Filtering**: Multi-select filter by type:
  - `@you` (mention-you)
  - `@everyone` (mention-everyone)
  - `@roles` (mention-roles) - planned
  - `Replies` (reply)
- **Message preview**: Channel name, author, date, and truncated message (200 chars)
- **Navigation**: Click to jump to message with 6-second highlight
  - Uses URL hash: `navigate(\`/spaces/${spaceId}/${channelId}#msg-${messageId}\`)`
  - Works for same-channel and cross-channel consistently
- **Mark all read**: Clear all notifications with one button
- **Auto-clear**: Notifications clear when viewing the channel (2s debounce)

### Technical Details

**Component**: `src/components/notifications/NotificationPanel.tsx`
**Query keys**:
- Mentions: `['mention-notifications', spaceId, userAddress, ...channelIds, ...enabledTypes]`
- Replies: `['reply-notifications', spaceId, userAddress, ...channelIds]`
**Stale time**: 30 seconds (useAllMentions), 30 seconds (useAllReplies)
**Layout**: Reuses SearchResults patterns for consistency

### Implementation Notes

- Fetches mentions and replies independently using separate hooks
- Combines and sorts by `message.createdDate` (newest first)
- Filter changes are instant (controlled by React state)
- At least one filter must be selected (prevents empty state)
- Closing panel after navigation ensures clean UX

See [reply-notification-system.md](../../tasks/reply-notification-system.md) for reply implementation details.

---

## Performance Characteristics

The unified notification system is designed for efficiency:

### Query Optimization
- **Database-level filtering**:
  - `getUnreadMentions()` fetches only messages with mentions after lastReadTimestamp
  - `getUnreadReplies()` fetches only messages with replies to user after lastReadTimestamp
  - Both use IndexedDB cursors for efficient filtering
- **Early-exit logic**: Stops counting at 10 notifications per type (matches "9+" display threshold)
- **Efficient caching**:
  - Count hooks: 90s stale time with window focus refetch
  - Notification hooks: 30s stale time for fresher data in panel
- **Independent caching**: Mention and reply queries don't invalidate each other

### Expected Performance
- Small channels (<100 messages): <10ms per type
- Medium channels (1k messages): <50ms per type
- Large channels (10k messages): <100ms per type
- Multiple channels (20 with notifications): <200ms total for both types

### Implementation Details
- `DISPLAY_THRESHOLD = 10` constant in all count hooks
- Database methods: `messages.ts:1307-1379` (mentions), `messages.ts` (replies)
- Early-exit logic in:
  - `useChannelMentionCounts.ts:95-100`
  - `useReplyNotificationCounts.ts:95-100`
  - `useSpaceMentionCounts.ts:65-97`

### Optimization Strategy
1. **Query at database level** (not in-memory filtering)
2. **Exit early** once display threshold reached
3. **Cache independently** to avoid coupled invalidations
4. **Fetch only what's needed** (limit parameter support)

See [mention-counts-performance-optimization.md](../../tasks/.done/mention-counts-performance-optimization.md) for details.

---

*Last updated: 2025-10-16*
