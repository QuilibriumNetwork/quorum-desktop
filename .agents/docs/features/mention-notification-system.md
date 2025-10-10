# Mention Notification System

## Overview

The Mention Notification System provides real-time visual feedback when users are mentioned in messages. The system tracks unread mentions across devices and provides contextual highlighting.

### Planned Features

- @role mentions with user role checking

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
- `isMentionedWithSettings(message, options)`: Checks mention with user settings
- `getMentionType(message, options)`: Returns mention type for UI

### Hooks

**`src/hooks/business/mentions/useChannelMentionCounts.ts`**
- React Query hook to calculate unread mention counts
- Query key: `['mention-counts', 'channel', spaceId, userAddress, ...channelIds]`
- Stale time: 30 seconds (balances real-time vs performance)
- Returns: `{ [channelId]: mentionCount }`

**`src/hooks/business/mentions/useSpaceMentionCounts.ts`**
- Space-level mention counts (sum of all channels)
- Used for notification bell badge
- Returns: `{ totalMentions }`

**`src/hooks/business/mentions/useAllMentions.ts`**
- Fetches all unread mentions across all channels in a space
- Supports filtering by mention type (you, everyone, roles)
- Returns: `{ mentions: MentionNotification[], isLoading }`
- Used by notification inbox dropdown

**`src/hooks/business/mentions/useViewportMentionHighlight.ts`**
- Auto-highlights mentions when entering viewport
- Uses IntersectionObserver API (50% visibility threshold)
- Integrates with existing `useMessageHighlight()` system
- Duration: 6 seconds

**`src/hooks/business/conversations/useUpdateReadTime.ts`**
- React Query mutation for atomic read time updates
- DB write completes BEFORE cache invalidation (fixes race condition)
- Invalidates: conversation cache + mention count caches

**`src/hooks/queries/conversation/useConversation.ts`**
- Fetches conversation data including lastReadTimestamp
- Single source of truth for read state

### UI Components

**`src/components/space/ChannelList.tsx`**
- Calls `useChannelMentionCounts({ spaceId, channelIds })`
- Merges counts into channel data
- Passes to ChannelGroup → ChannelItem

**`src/components/space/ChannelItem.tsx`**
- Renders bubble when `mentionCount > 0`
- CSS class: `channel-mentions-bubble-you`
- Display: Shows count in accent-colored bubble

**`src/components/message/Message.tsx`**
- Receives `lastReadTimestamp` prop from MessageList
- Calculates `isUnread = message.createdDate > lastReadTimestamp`
- Passes to `useViewportMentionHighlight()`

**`src/components/space/Channel.tsx`**
- Uses `useConversation()` for lastReadTimestamp
- Implements interval-based read time updates (2s)
- Saves immediately on unmount
- Renders notification bell icon with dropdown

**`src/components/notifications/NotificationDropdown.tsx`**
- Main notification inbox dropdown panel
- Filter by mention type (multiselect)
- Mark all as read functionality
- Click-to-navigate with highlighting

**`src/components/notifications/NotificationItem.tsx`**
- Individual notification item display
- Matches SearchResults layout (channel - author - date - message)
- Message truncation (200 chars max)

### Services

**`src/services/MessageService.ts`** (lines 2161-2190, 586-593)
- Extracts mentions when creating messages
- Validates @everyone permission before extraction
- Invalidates mention counts when new mentions arrive

**`src/db/messages.ts`**
- Stores `lastReadTimestamp` in conversations table
- `saveReadTime()`: Updates timestamp
- `getConversation()`: Retrieves timestamp for count calculation

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

### 1. Reuse Existing Highlight System
**Decision**: Use `useMessageHighlight()` instead of creating new highlight logic
**Rationale**: Consistency with search/pinned messages, reuses CSS animations, single source of truth
**Trade-off**: Different duration (6s for mentions vs 2s for search) required adding duration parameter

### 2. Database-Based Read Tracking
**Decision**: Use existing `conversations.lastReadTimestamp` in IndexedDB
**Rationale**: Persists across restarts, works with DM read tracking, no new tables needed
**Trade-off**: Prop drilling through components (Channel → MessageList → Message)

### 3. JavaScript Filtering vs Database Query
**Decision**: Fetch all messages, filter in JavaScript
**Rationale**: Uses existing index efficiently, simpler implementation, 10k limit prevents runaway queries
**Trade-off**: Not optimal for channels with >1000 messages (acceptable for current use case)

### 4. React Query Architecture (2025-10-09 Improvement)
**Decision**: Use React Query for read state management instead of useState
**Rationale**: Single source of truth, automatic reactivity, proper cache invalidation ordering
**Impact**: Fixed race conditions with rapid messages, eliminated flickering bubbles

### 5. Channel-Level Read Tracking
**Decision**: Opening channel marks ALL messages as read (not viewport-based)
**Rationale**: App auto-scrolls to bottom, matches industry standard (Discord/Slack), simpler UX
**Trade-off**: User doesn't get granular "mark each mention as read" - acceptable for most use cases

---

## Integration Points

### Message Creation Flow
**File**: `src/services/MessageService.ts:2161-2190`
**How**: Extracts mentions before saving, populates `mentions.memberIds[]` or `mentions.everyone`

### Query Invalidation
**Files**: `MessageService.ts:586-593`, `Channel.tsx`
**Triggers**: New mention arrives → invalidate space-level counts; Read time saved → invalidate channel counts

### Highlight System
**Files**: `Message.tsx`, `useViewportMentionHighlight.ts`
**Integration**: Extends existing `useMessageHighlight()` infrastructure, reuses `.message-highlighted` CSS

---

## Known Limitations

### Performance
1. **Large channels**: Fetches up to 10k messages then filters (50-200ms for 1k+ messages)
2. **Many channels**: Calculates counts for all channels in space (200-400ms for 20 channels)
3. **Mitigation**: 30s stale time + React Query caching

### Functional
1. **Self-mentions**: Users get notifications when mentioning themselves (minor annoyance)
2. **Deleted messages**: Deleted before viewing still count (matches "mentions at time of viewing" philosophy)

### UX
1. **Highlight re-triggers**: Scrolling back to already-seen mention highlights it again (low priority)
2. **Channel-level tracking**: All mentions marked read when opening channel, not per-message (by design)

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
- **Background sync**: Periodic sync based on SyncService configuration

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
- Device B using stale cache (within 30s window)
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

**Symptoms**: Lag when switching channels

**Solutions**:
- Increase stale time to reduce query frequency
- Check number of channels (>20 may be slow)
- Use React Query DevTools to identify slow queries

**Future optimization**: Database-level filtering instead of JavaScript filtering

---

## File Reference

```
src/
├── utils/
│   └── mentionUtils.ts                    # Mention detection/extraction
├── hooks/
│   ├── business/
│   │   ├── mentions/
│   │   │   ├── useChannelMentionCounts.ts # Count calculation (channel-level)
│   │   │   ├── useSpaceMentionCounts.ts   # Count calculation (space-level)
│   │   │   ├── useAllMentions.ts          # Fetch all mentions for inbox
│   │   │   └── useViewportMentionHighlight.ts # Viewport trigger
│   │   └── conversations/
│   │       └── useUpdateReadTime.ts       # Read time mutation
│   └── queries/
│       └── conversation/
│           └── useConversation.ts         # Read time query
├── components/
│   ├── space/
│   │   ├── Channel.tsx                    # Read time tracking + bell icon
│   │   ├── ChannelList.tsx                # Count integration
│   │   └── ChannelItem.tsx                # Bubble rendering
│   ├── message/
│   │   ├── Message.tsx                    # Highlight trigger
│   │   ├── MessageList.tsx                # Prop passing
│   │   └── MessageMarkdownRenderer.tsx    # @everyone rendering (web)
│   └── notifications/
│       ├── NotificationDropdown.tsx       # Inbox dropdown
│       └── NotificationItem.tsx           # Individual notification
├── services/
│   └── MessageService.ts                  # Mention extraction
└── db/
    └── messages.ts                        # Read time storage
```

---

## Related Documentation

- **[Data Management Architecture](../data-management-architecture-guide.md)** - Sync service integration
- **[Cross-Platform Architecture](../cross-platform-repository-implementation.md)** - Primitive usage

---

## Notification Inbox UI

### Overview

The notification inbox provides a centralized view of all unread mentions across all channels in a space.

### Features

- **Bell icon**: Appears in channel header (left of users icon) when unread mentions exist
- **Visual indicator**: Red notification dot on bell icon
- **Dropdown panel**: Shows all unread mentions sorted by date (newest first)
- **Filtering**: Multiselect filter by mention type (you, everyone, roles)
- **Message preview**: Channel name, author, date, and truncated message (200 chars)
- **Navigation**: Click to jump to message with 6-second highlight
- **Mark all read**: Clear all notifications with one button
- **Auto-clear**: Notifications clear when viewing the channel

### Technical Details

**Query key**: `['mention-notifications', spaceId, userAddress, ...channelIds, ...enabledTypes]`
**Stale time**: 30 seconds (matches mention count system)
**Layout**: Reuses SearchResults patterns for consistency

See [notification-inbox-ui.md](../../tasks/.done/notification-inbox-ui.md) for full implementation details.

---

*Last updated: 2025-10-10*
