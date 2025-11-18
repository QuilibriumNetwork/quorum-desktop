# Unified Notification System (Mentions + Replies)

## Overview

The Unified Notification System provides real-time visual feedback for mentions and replies. The system tracks unread notifications across devices, provides contextual highlighting, and allows per-space notification preferences.

### Supported Notification Types

- **@you mentions**: Direct user mentions (`@<address>`)
- **@everyone mentions**: Channel-wide mentions (permission-based)
- **@role mentions**: Role-based mentions (`@moderators`, `@admins`) with user role checking
- **#channel mentions**: Channel references (`#<channelId>`) with clickable navigation
- **Replies**: Notifications when someone replies to your messages

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
Message sent with @mention or @roleTag
    ↓
extractMentionsFromText() parses patterns
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
- `extractMentionsFromText(text, options)`: Parses `@<address>`, `@roleTag`, `@everyone`, `#<channelId>` patterns
- `isMentioned(message, options)`: Checks if user is mentioned
- `isMentionedWithSettings(message, options)`: Checks mention with user settings and role membership
  - Accepts: `['mention-you', 'mention-everyone', 'mention-roles']`
  - Filters mentions based on enabled notification types and user's roles
- `getMentionType(message, options)`: Returns mention type for UI

**`src/utils/channelUtils.ts`**
- `findChannelByName(channelName, channels)`: Locates channel by name (utility function)

**`src/utils/notificationSettingsUtils.ts`**
- `getDefaultNotificationSettings(spaceId)`: Returns default settings
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
- Includes user role IDs for role mention filtering
- Returns: `{ [channelId]: mentionCount }`

**`src/hooks/business/mentions/useSpaceMentionCounts.ts`**
- Space-level mention counts (aggregates across all channels)
- Used for space icon notification badges
- Implements early-exit at 10 mentions across all channels
- Uses `getUnreadMentions()` for efficient database-level filtering
- Includes user role lookup per space for role mention filtering
- Returns: `{ [spaceId]: mentionCount }`

**`src/hooks/business/mentions/useAllMentions.ts`**
- Fetches all unread mentions across all channels in a space
- Supports filtering by mention type: `['mention-you', 'mention-everyone', 'mention-roles']`
- Accepts `userRoleIds` for role mention filtering
- Returns: `{ mentions: MentionNotification[], isLoading }`
- Used by NotificationPanel

**`src/hooks/business/mentions/useMentionInput.ts`**
- Autocomplete hook for mention dropdown in message composer
- Supports user, role, and channel mentions via discriminated union (`MentionOption`)
- Separate dropdowns for `@` mentions (users/roles/@everyone) and `#` mentions (channels only)
- Filters and ranks suggestions based on query with channel limit of 25 results
- Returns: `{ filteredOptions, showDropdown, selectOption, handleKeyDown }`

**`src/hooks/business/mentions/useMentionNotificationSettings.ts`**
- Manages per-space notification preferences
- Loads saved settings from IndexedDB user config
- Returns: `{ selectedTypes, setSelectedTypes, saveSettings, isLoading }`
- Used by SpaceSettingsModal and NotificationPanel

**`src/hooks/business/replies/useReplyNotificationCounts.ts`**
- React Query hook to calculate unread reply counts per channel
- Query key: `['reply-counts', 'channel', spaceId, userAddress, ...channelIds]`
- Stale time: 90 seconds, refetches on window focus
- Implements early-exit at 10 replies (matches "9+" display threshold)
- Returns: `{ [channelId]: replyCount }`

**`src/hooks/business/replies/useAllReplies.ts`**
- Fetches all unread replies across all channels in a space
- Returns: `{ replies: ReplyNotification[], isLoading }`
- Used by NotificationPanel

**`src/hooks/business/messages/useMessageFormatting.ts`**
- Formats message content for display (token-based rendering)
- Processes user mentions, role mentions, @everyone, links, etc.
- Accepts `spaceRoles` for role mention validation and styling
- Returns styled mention tokens for Message component

**`src/hooks/business/mentions/useViewportMentionHighlight.ts`**
- Auto-highlights mentions when entering viewport
- Uses IntersectionObserver API (50% visibility threshold)
- Integrates with existing `useMessageHighlight()` system
- Duration: 6 seconds

**`src/hooks/business/conversations/useUpdateReadTime.ts`**
- React Query mutation for atomic read time updates
- DB write completes BEFORE cache invalidation (fixes race condition)
- Invalidates: conversation cache + mention count caches + reply count caches

### UI Components

**`src/components/message/MessageComposer.tsx`**
- Mention autocomplete dropdown with user, role, and channel suggestions
- Users format: `@<address>` (with brackets)
- Roles format: `@roleTag` (without brackets)
- Channels format: `#<channelId>` (hash prefix with ID in brackets)
- Displays role badges with colors and channel icons in dropdown
- Separate dropdowns for `@` and `#` triggers
- CSS: `MessageComposer.scss` includes role badge and channel styling

**`src/components/space/ChannelList.tsx`**
- Calls `useChannelMentionCounts({ spaceId, channelIds, userRoleIds })`
- Calculates user's role IDs using `getUserRoles()`
- Merges counts into channel data
- Passes to ChannelGroup → ChannelItem

**`src/components/space/ChannelItem.tsx`**
- Combines mention counts + reply counts for unified notification bubble
- Formula: `totalCount = mentionCount + replyCount`
- CSS class: `channel-mentions-bubble-you`
- Display: Shows combined count in accent-colored bubble

**`src/components/message/Message.tsx`**
- Receives `lastReadTimestamp` and `spaceRoles` props
- Passes `spaceRoles` to `useMessageFormatting()` for role mention styling
- Calculates `isUnread = message.createdDate > lastReadTimestamp`
- Passes to `useViewportMentionHighlight()`

**`src/components/message/MessageMarkdownRenderer.tsx`**
- Renders markdown-formatted messages
- Processes role mentions: `@roleTag` → styled span
- Processes channel mentions: `#<channelId>` → clickable span with navigation
- Only styles roles that exist in `message.mentions.roleIds`
- Only styles channels that exist in `message.mentions.channelIds`
- Accepts `roleMentions`, `channelMentions`, `spaceRoles`, and `spaceChannels` props
- CSS: `.message-name-mentions-you` for consistent styling across all mention types

**`src/components/space/Channel.tsx`**
- Uses `useConversation()` for lastReadTimestamp
- Calculates user's role IDs using `getUserRoles()`
- Passes `userRoleIds` to NotificationPanel
- Implements interval-based read time updates (2s)
- Renders notification bell icon with NotificationPanel

**`src/components/notifications/NotificationPanel.tsx`**
- Unified notification inbox panel (mentions + replies)
- Loads user's saved notification settings using `useMentionNotificationSettings()`
- Respects disabled notification types from Space Settings
- Fetches both `useAllMentions()` and `useAllReplies()`
- Combines and sorts by date (newest first)
- Multi-select filter by type: `['mention-you', 'mention-everyone', 'mention-roles', 'reply']`
- Mark all as read functionality
- Click-to-navigate using URL hash: `navigate(\`/spaces/${spaceId}/${channelId}#msg-${messageId}\`)`

**`src/components/notifications/NotificationItem.tsx`**
- Individual notification item display
- Supports mention and reply notifications
- Matches SearchResults layout (channel - author - date - message)
- Message truncation (200 chars max)
- Shows appropriate icon (mention vs reply)

**`src/components/modals/SpaceSettingsModal/Account.tsx`**
- Per-space notification preferences UI
- Multi-select for notification types: `@you`, `@everyone`, `@roles`, `Replies`
- Uses `useMentionNotificationSettings()` for load/save
- Saves to IndexedDB user config
- Syncs across devices

### Services

**`src/services/MessageService.ts`**
- Extracts mentions when creating messages
- Validates @everyone permission before extraction
- Passes `spaceRoles` to `extractMentionsFromText()` for role validation
- Populates `message.mentions.roleIds[]` for role mentions
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

---

## Role Mention System

### Overview

Role mentions allow users to notify all members of a role (e.g., `@moderators`, `@admins`) with a single mention.

### Format

- **User mentions**: `@<address>` (with angle brackets)
- **Role mentions**: `@roleTag` (without brackets, e.g., `@moderators`)
- **@everyone**: `@everyone` (special case, permission-based)

### Autocomplete

**Component**: `MessageComposer.tsx` + `useMentionInput.ts`

When typing `@`, the dropdown shows:
1. Matching users (with avatars)
2. Matching roles (with colored badges)

**Implementation**:
- Discriminated union type: `MentionOption = { type: 'user', data: User } | { type: 'role', data: Role }`
- Filters roles by `displayName` and `roleTag`
- Sorts by relevance (exact match > starts with > contains)
- Selection inserts appropriate format (`@<address>` or `@roleTag`)

### Extraction

**Function**: `extractMentionsFromText(text, { spaceRoles })`

Parses message text and extracts:
- User mentions: `/@<([^>]+)>/g` → `mentions.memberIds[]`
- Role mentions: `/@([a-zA-Z0-9_-]+)(?!\w)/g` → `mentions.roleIds[]`
- @everyone: `/@everyone\b/i` → `mentions.everyone = true`

**Validation**:
- Role tags are validated against `spaceRoles` array
- Only existing roles are extracted (prevents fake mentions)
- Code blocks are excluded from mention detection
- Case-insensitive matching for role tags

### Notification Filtering

**Function**: `isMentionedWithSettings(message, { userAddress, enabledTypes, userRoles })`

Checks if user should receive notification:
1. **@you mentions**: `message.mentions.memberIds` includes `userAddress`
2. **@everyone mentions**: `message.mentions.everyone === true`
3. **@role mentions**: `message.mentions.roleIds` overlaps with `userRoles`

User's roles are calculated using `getUserRoles(userAddress, space)` which:
- Checks space members for role assignments
- Returns array of role IDs user belongs to
- Cached per component for performance

### Rendering

**Web (Markdown)**: `MessageMarkdownRenderer.tsx`
- Processes `@roleTag` patterns in markdown text
- Validates against `message.mentions.roleIds` (only style if actually mentioned)
- Replaces with styled span: `<span class="message-name-mentions-you" title="{displayName}">@{roleTag}</span>`

**Web (Token-based)**: `useMessageFormatting.ts`
- Detects `@roleTag` pattern during text token processing
- Validates against `spaceRoles` and `message.mentions.roleIds`
- Returns mention token with same styling as user mentions

**CSS**: `.message-name-mentions-you` (shared with @everyone and @you)

### Notification Counts

**Channel Bubbles**: `useChannelMentionCounts.ts`
- Accepts `userRoleIds` parameter
- Passes to `isMentionedWithSettings()` for filtering
- Counts role mentions where user is a member

**Space Bubbles**: `useSpaceMentionCounts.ts`
- Calculates `userRoleIds` per space using `getUserRoles()`
- Aggregates role mention counts across all channels
- Updates space icon notification badge

### Settings

**UI**: `SpaceSettingsModal/Account.tsx`

Users can enable/disable role mention notifications per space:
- Toggle `@roles` option in notification settings
- Saved to IndexedDB: `user_config.notificationSettings[spaceId].enabledNotificationTypes`
- Respects setting in NotificationPanel filter and counts

### Permissions

**Note**: Role mentions have NO permission restrictions:
- Any user can mention any role
- All role members receive notifications (if enabled in settings)
- Deleted/invalid roles render as plain text (no styling)

### Edge Cases

- **Multiple roles**: User with multiple roles mentioned gets single notification per message
- **Deleted roles**: Role IDs in `mentions.roleIds` that don't exist in `space.roles` are ignored
- **Empty roles**: Roles with no members can be mentioned (0 notifications sent)
- **Code blocks**: `@roleTag` in code blocks doesn't trigger extraction
- **Self-mentions**: Users can mention their own roles (intentional)

---

## Channel Mention System

### Overview

Channel mentions allow users to reference channels within messages using `#<channelId>` syntax. These mentions are rendered as clickable links that navigate to the referenced channel.

### Format

- **Channel mentions**: `#<channelId>` (hash prefix with ID in brackets, e.g., `#<ch-abc123>`)
- **Navigation**: Clicking navigates to `/spaces/{spaceId}/{channelId}`

### Autocomplete

**Component**: `MessageComposer.tsx` + `useMentionInput.ts`

When typing `#`, the dropdown shows:
- Matching channels (with hashtag icons)
- Shows all channels immediately when `#` is typed (no minimum query length)
- Filtered by channel name as user types

**Implementation**:
- Separate dropdown from `@` mentions (different trigger character)
- Discriminated union type includes: `{ type: 'channel', data: Channel }`
- Filters channels by `channelName`
- Sorts by relevance (exact match > starts with > contains)
- Limited to 25 results for better UX
- Selection inserts `#<channelId>` format

### Extraction

**Function**: `extractMentionsFromText(text, { spaceChannels })`

Parses message text and extracts:
- Channel mentions: `/#<([^>]+)>/g` → `mentions.channelIds[]`

**Validation**:
- Channel IDs are validated against `spaceChannels` array by ID
- Only existing channels are extracted (prevents fake mentions)
- Code blocks are excluded from mention detection
- Exact ID matching for rename-safety

### Rendering

**Web (Markdown)**: `MessageMarkdownRenderer.tsx`
- Processes `#<channelId>` patterns in markdown text
- Validates against `message.mentions.channelIds` (only style if actually mentioned)
- Replaces with clickable span: `<span class="message-name-mentions-you" data-channel-id="{channelId}">#{channelName}</span>`
- Uses same CSS class as other mentions for consistency

**Web (Token-based)**: `useMessageFormatting.ts`
- Detects `#<channelId>` pattern during text token processing
- Validates against `spaceChannels` and `message.mentions.channelIds`
- Returns channel token with click handler for navigation

### Navigation

**Click Handler**: `onChannelClick(channelId: string)`
- Navigates to channel using React Router: `navigate(\`/spaces/${spaceId}/${channelId}\`)`
- Provides seamless channel-to-channel navigation from message content

### Storage

**Database**: `MessageService.ts`
- Channel mentions stored in `message.mentions.channelIds[]`
- Array of channel IDs that were mentioned in the message
- Used for validation during rendering (prevents styling fake mentions)

### Edge Cases

- **Deleted channels**: Channel IDs in `mentions.channelIds` that don't exist in space channels are ignored
- **Private channels**: All channels in space are mentionable (no permission restrictions)
- **Code blocks**: `#<channelId>` in code blocks doesn't trigger extraction
- **Cross-space channels**: Only channels within the same space can be mentioned

---

## @everyone Mentions

### Permission System

**Who can use @everyone**:
- Space owners (automatic)
- Users with `mention:everyone` role permission

**Permission files**:
- `src/utils/permissions.ts` - Space owners get permission automatically
- `src/api/quorumApi.ts` - `'mention:everyone'` added to Permission type
- `src/components/modals/SpaceSettingsModal/Roles.tsx` - UI for assigning permission

### Processing

**Extraction**:
```typescript
const canUseEveryone = hasPermission(
  currentPasskeyInfo.address,
  'mention:everyone',
  space,
  isSpaceOwner
);

mentions = extractMentionsFromText(messageText, {
  allowEveryone: canUseEveryone,
  spaceRoles
});
```

**Rendering**:
- Only styled if `message.mentions.everyone === true`
- Non-authorized users' @everyone appears as plain text

**Notification counting**:
- `isMentionedWithSettings()` checks `mentions.everyone` field
- All users receive notification if `'mention-everyone'` enabled in settings

### Edge Cases

- Code blocks: @everyone in code blocks ignored
- Case insensitive: @everyone, @Everyone, @EVERYONE work
- Permission denial: Unauthorized @everyone doesn't trigger notifications

---

## Key Design Decisions

### 1. Unified Notification Type System
**Format**: `'mention-you' | 'mention-everyone' | 'mention-roles' | 'reply'`
**Benefits**: Consistent API, UI filtering, per-space configuration, no format transformations

### 2. Separate Systems, Shared UI
**Separate**: Data models, queries, cache keys, hooks
**Shared**: NotificationPanel, NotificationItem, read tracking, highlighting
**Rationale**: Mentions are text-based, replies are relationship-based (semantic mismatch)

### 3. URL Hash Navigation
**Pattern**: `navigate(\`#msg-${messageId}\`)`
**Benefits**: Works reliably, consistent across scenarios, reuses existing scroll/highlight logic

### 4. Database-Level Filtering
**Implementation**: `getUnreadMentions()`, `getUnreadReplies()`
**Benefits**: Efficient IndexedDB cursor-based filtering, early-exit support

### 5. React Query Architecture
**Cache Keys**:
- Mentions: `['mention-counts', ...]` and `['mention-notifications', ...]`
- Replies: `['reply-counts', ...]` and `['reply-notifications', ...]`
**Benefits**: Independent invalidation, prevents race conditions, no coupling

### 6. Early-Exit Optimization
**Threshold**: Stop counting at 10 (UI shows "9+" beyond this)
**Benefits**: 3-5x performance improvement for channels with many notifications

### 7. Role Mention Format
**Decision**: `@roleTag` without brackets (vs `@<roleTag>`)
**Rationale**: Avoids autocomplete conflict with `@<address>` pattern
**Benefits**: Clear distinction, simpler parsing, better UX

### 8. Permission-Free Role Mentions
**Decision**: No permission check required to mention roles
**Rationale**: Notifications are informational, not permission-based
**Benefits**: Simpler implementation, matches user expectations

---

## Performance Characteristics

### Query Optimization
- Database-level filtering with IndexedDB cursors
- Early-exit at 10 notifications per type
- 90s stale time for counts, 30s for panel data
- Independent caching (mentions/replies don't invalidate each other)

### Expected Performance
- Small channels (<100 messages): <10ms
- Medium channels (1k messages): <50ms
- Large channels (10k messages): <100ms
- Multiple channels (20 with notifications): <200ms total

### Role Mention Performance
- User role lookup: O(n) where n = number of members (typically <1000)
- Role validation: O(m) where m = number of roles (typically <20)
- Cached per component to avoid repeated calculations

---

## Cross-Device Synchronization

**Status**: ✅ Supported via IndexedDB and SyncService

### How It Works

```
Device A: User views channel → lastReadTimestamp updated
    ↓
SyncService syncs to server
    ↓
Device B: Opens app → fetches latest state
    ↓
React Query refetches with synced timestamp
    ↓
Notifications update across devices
```

**Sync timing**:
- On app focus: `refetchOnWindowFocus: true`
- On app launch: Initial data load
- Background: 90s stale time + periodic sync

**Configuration**: `allowSync` flag in user config

---

## Troubleshooting

### Bubbles Not Appearing
- Check mention format (`@<address>` for users, `@roleTag` for roles)
- Verify message has `mentions.memberIds[]` or `mentions.roleIds[]` populated
- Check user's role membership for role mentions
- Verify notification type enabled in settings

### Bubbles Not Clearing
- Wait 2 seconds for debounce
- Check `lastReadTimestamp` in DB
- Verify query invalidation in React Query DevTools

### Performance Issues
- Use React Query DevTools to identify slow queries
- Check IndexedDB performance in browser tools
- Verify 90s stale time reducing query frequency

### Role Mentions Not Working
- Verify role exists in `space.roles[]`
- Check user has the role in space members
- Confirm `@roles` enabled in notification settings
- Check `message.mentions.roleIds[]` populated correctly

---

## File Reference

```
src/
├── utils/
│   ├── mentionUtils.ts                    # Mention detection/extraction
│   ├── channelUtils.ts                    # Channel lookup utilities
│   ├── notificationSettingsUtils.ts       # Settings helpers
│   └── permissions.ts                     # Role permission utilities
├── types/
│   └── notifications.ts                   # NotificationTypeId, NotificationSettings
├── hooks/
│   ├── business/
│   │   ├── mentions/
│   │   │   ├── useChannelMentionCounts.ts # Channel-level counts
│   │   │   ├── useSpaceMentionCounts.ts   # Space-level counts
│   │   │   ├── useAllMentions.ts          # Fetch all mentions
│   │   │   ├── useMentionInput.ts         # Autocomplete hook
│   │   │   ├── useMentionNotificationSettings.ts # Settings hook
│   │   ├── replies/
│   │   │   ├── useReplyNotificationCounts.ts # Reply counts
│   │   │   └── useAllReplies.ts           # Fetch all replies
│   │   ├── messages/
│   │   │   ├── useMessageFormatting.ts    # Token-based rendering
│   │   │   └── useViewportMentionHighlight.ts # Viewport trigger
│   │   └── conversations/
│   │       └── useUpdateReadTime.ts       # Read time mutation
│   └── queries/
│       └── conversation/
│           └── useConversation.ts         # Read time query
├── components/
│   ├── space/
│   │   ├── Channel.tsx                    # Read tracking + bell icon
│   │   ├── ChannelList.tsx                # Count integration
│   │   └── ChannelItem.tsx                # Combined bubble
│   ├── message/
│   │   ├── Message.tsx                    # Highlight trigger
│   │   ├── MessageComposer.tsx            # Mention autocomplete
│   │   ├── MessageList.tsx                # Hash detection
│   │   └── MessageMarkdownRenderer.tsx    # Markdown rendering
│   ├── notifications/
│   │   ├── NotificationPanel.tsx          # Unified panel
│   │   └── NotificationItem.tsx           # Individual item
│   └── modals/
│       └── SpaceSettingsModal/
│           └── Account.tsx                # Settings UI
├── services/
│   └── MessageService.ts                  # Extraction + metadata
└── db/
    └── messages.ts                        # Read time + queries
```

## Mention Interactivity

### CSS Architecture

Mentions use semantic CSS classes to control interactivity:

**Base styling**: `.message-name-mentions-you`
- Font weight, colors, padding, border radius

**Interactive mentions**: `.message-name-mentions-you.interactive`
- Pointer cursor, hover effects
- Used in: Regular message display, markdown rendering

**Non-interactive mentions**: `.message-name-mentions-you.non-interactive`
- Default cursor, no hover effects
- Used in: Preview contexts (delete/pin modals, pinned lists, notification panel)

### Implementation

All mention components use `tokenData.isInteractive` flag to determine CSS class:
- MessagePreview: Respects `disableMentionInteractivity` prop
- NotificationItem: Always non-interactive
- Message.tsx: Interactive when not in preview context
- MessageMarkdownRenderer: Always interactive

---

## Related Documentation

- **[Reply Notification System](../../tasks/.done/reply-notification-system.md)** - Reply implementation details
- **[Role Mention Notifications](../../tasks/.done/role-mention-notifications.md)** - Role mention implementation task
- **[Notification Settings](../../tasks/.done/mention-notification-settings-phase4.md)** - Per-space configuration
- **[Data Management Architecture](../data-management-architecture-guide.md)** - Sync service integration

---

*Last updated: 2025-11-18*
*Reviewed by Claude Code: 2025-11-18*
