---
type: doc
title: Notification Indicators System
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-06T00:00:00.000Z
---

# Notification Indicators System

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Discord-style visual notification system providing feedback about unread content across the application. The system uses two types of indicators:

1. **Unread Dots/Toggles**: Visual markers showing unread messages exist (no count)
2. **Notification Bubbles**: Numbered badges showing mention + reply counts

These indicators appear on:
- **NavRail** (top-level shell rail): the Messages item carries a small DM unread dot
- **SpacesSidebar**: every space row, every folder header, and every nested space-in-folder row
- **ChannelList**: individual channel items inside a space
- **DirectMessageContactsList**: individual DM contacts

---

## Architecture

### Indicator Types by Location

| Location | Unread | Mention bubble |
|----------|--------|----------------|
| NavRail "Messages" | `.icon-unread-dot` | — |
| Spaces row (expanded) | `.spaces-sidebar__row-badge` | `space-icon-mention-bubble` |
| Spaces row (strip) | `space-icon-toggle--unread` | `space-icon-mention-bubble` |
| Folder header (collapsed) | `space-icon-toggle--unread` | `folder-button-mention-bubble` |
| Channel item | `.icon-unread-dot` | `.icon-mention-bubble` |
| DM row | `.icon-unread-dot` + bold name | — |
| DM strip | `.direct-messages-strip-unread-dot` | — |

Shared dot/bubble visuals (`.icon-unread-dot`, `.icon-mention-bubble`) live in [_components.scss](src/styles/_components.scss). The avatar wrapper must be `position: relative` for the dot's negative-left offset to anchor.

### Data Flow

```
New message arrives
    ↓
MessageService.ts saves message + invalidates caches
    ↓
React Query refetches counts
    ↓
Components re-render with updated indicators
```

```
User reads channel/DM (stays 2+ seconds)
    ↓
useUpdateReadTime mutation saves lastReadTimestamp
    ↓
Cache invalidation triggers refetch
    ↓
Components re-render, indicators disappear
```

### Core Data Model

Both channels and DMs use timestamp-based unread detection:

- `conversation.timestamp` - Auto-updated on every message save
- `conversation.lastReadTimestamp` - Updated when user reads content
- **Unread check**: `(lastReadTimestamp ?? 0) < timestamp`

This provides O(1) unread status per conversation.

---

## Key Components

### Spaces Sidebar Row

[SpacesSidebar.tsx](src/components/space/SpacesSidebar.tsx) merges mention + reply counts into `spaceMentionPlusReplyCounts` and passes the per-space subset to each row.

| Indicator | Data | Condition |
|-----------|------|-----------|
| `.spaces-sidebar__row-badge` (expanded) | `spaceUnreadCounts[spaceId]` | Any unread (`99+` above 99) |
| `space-icon-toggle--unread` (strip) | same | same |
| `space-icon-mention-bubble` | `spaceMentionPlusReplyCounts[spaceId]` | Mention/reply exists |
| `muted-badge` | `mutedSpacesSet.has(spaceId)` | Space muted |

Right-click opens [useSpaceContextMenu](src/hooks/business/spaces/useSpaceContextMenu.tsx); "Mark All as Read" appears when the row was flagged `hasNotifications`.

### Spaces Sidebar Folder Header

In [SpacesSidebarFolder.tsx](src/components/space/SpacesSidebarFolder.tsx), `hasUnread = spaces.some(...)` and `folderMentionCount = sum(spaceMentionCounts[child])` drive the folder tile's dot and mention bubble. Both suppressed when `isExpanded` (nested rows surface their own).

### NavRail DM Dot

[NavRail.tsx](src/components/shell/NavRail.tsx) renders `.icon-unread-dot` on the Messages item when [useDirectMessageUnreadCount](src/hooks/business/messages/useDirectMessageUnreadCount.ts) returns > 0.

### Channel Item (ChannelList)

**Files**: `src/components/space/ChannelItem.tsx`, `ChannelList.tsx`

| Indicator | Data Source | Condition |
|-----------|-------------|-----------|
| Unread dot | `unreadCounts[channelId]` | Channel has unread messages |
| Count bubble | `mentionCounts + replyCounts` | Mentions or replies exist |

### DM Contact (DirectMessageContactsList)

In [DirectMessageContact.tsx](src/components/direct/DirectMessageContact.tsx) the avatar carries `.icon-unread-dot` when `unread && !muted`, plus `.dm-muted-badge` when muted. The collapsed strip uses `.direct-messages-strip-unread-dot` on the same condition.

---

## Hooks Reference

### Count Hooks

| Hook | Purpose | Query Key |
|------|---------|-----------|
| `useChannelUnreadCounts` | Per-channel unread status | `['unread-counts', 'channel', spaceId, ...]` |
| `useSpaceUnreadCounts` | Per-space unread status | `['unread-counts', 'space', ...]` |
| `useDirectMessageUnreadCount` | Total DM unread count | `['unread-counts', 'direct-messages', ...]` |
| `useChannelMentionCounts` | Per-channel mention counts | `['mention-counts', 'channel', spaceId, ...]` |
| `useSpaceMentionCounts` | Per-space mention counts | `['mention-counts', 'space', ...]` |
| `useReplyNotificationCounts` | Per-channel reply counts | `['reply-counts', 'channel', spaceId, ...]` |
| `useSpaceReplyCounts` | Per-space reply counts | `['reply-counts', 'space', ...]` |

### Update Hook

| Hook | Purpose | Invalidates |
|------|---------|-------------|
| `useUpdateReadTime` | Save read timestamp + invalidate caches | All related count caches |

---

## Cache Invalidation

### When Reading Content (Indicators Decrease)

**File**: `src/hooks/business/conversations/useUpdateReadTime.ts`

After user stays in channel/DM for 2+ seconds:

```typescript
// Invalidation order in onSuccess:
1. ['Conversation', conversationId]
2. ['mention-counts', 'channel', spaceId]
3. ['mention-counts', 'space']
4. ['reply-counts', 'channel', spaceId]
5. ['reply-counts', 'space']
6. ['unread-counts', 'channel', spaceId]
7. ['unread-counts', 'space']
8. ['unread-counts', 'direct-messages']
9. ['Conversations', 'direct'] (DMs only)
```

### When New Messages Arrive (Indicators Increase)

**File**: `src/services/MessageService.ts`

```typescript
// For messages with mentions
['mention-counts', 'space']           // Space-level (SpaceIcon bubble)
['mention-counts', 'channel', spaceId] // Channel-level (ChannelList bubble)
['mention-notifications', spaceId]
['unread-counts', 'channel', spaceId]
['unread-counts', 'space']

// For reply messages
['reply-counts', 'space']              // Space-level (SpaceIcon bubble)
['reply-counts', 'channel', spaceId]   // Channel-level (ChannelList bubble)
['reply-notifications', spaceId]

// For DM messages
['unread-counts', 'direct-messages']
```

### Space "Mark All as Read" (Context Menu)

**File**: [useSpaceContextMenu.tsx](src/hooks/business/spaces/useSpaceContextMenu.tsx) (`handleMarkSpaceAsRead`)

When "Mark All as Read" is selected from a Space Icon context menu:

1. Gets all channel IDs from the space's groups
2. Saves `lastReadTimestamp` for each channel via `messageDB.saveReadTime()`
3. Invalidates caches:
   - Space-level: `['mention-counts', 'space']`, `['reply-counts', 'space']`, `['unread-counts', 'space']`
   - Channel-level: `['mention-counts', 'channel', spaceId]`, `['reply-counts', 'channel', spaceId]`, `['unread-counts', 'channel', spaceId]`
   - NotificationPanel: `['mention-notifications', spaceId]`, `['reply-notifications', spaceId]`
   - Conversations: `['conversation']`

This ensures SpaceIcon indicators, ChannelList indicators, and NotificationPanel all update correctly.

### NotificationPanel "Mark All as Read"

**File**: `src/components/notifications/NotificationPanel.tsx` (`handleMarkAllRead`)

When "Mark All as Read" button is clicked in NotificationPanel:

1. Gets channels that have notifications from current list
2. Saves `lastReadTimestamp` for each channel via `messageDB.saveReadTime()`
3. Invalidates caches (same pattern as Space context menu):
   - Space-level: `['mention-counts', 'space']`, `['reply-counts', 'space']`, `['unread-counts', 'space']`
   - Channel-level: `['mention-counts', 'channel', spaceId]`, `['reply-counts', 'channel', spaceId]`, `['unread-counts', 'channel', spaceId]`
   - NotificationPanel: `['mention-notifications', spaceId]`, `['reply-notifications', spaceId]`
   - Conversations: `['conversation']`

### DM "Mark All as Read" Context

**File**: `src/context/DmReadStateContext.tsx`

For immediate UI updates when marking all DMs as read, a React Context provides state-driven re-renders:

- `markAllReadTimestamp`: Timestamp when bulk mark-as-read was triggered
- `markAllAsRead()`: Sets timestamp, triggers immediate UI update
- Components check this timestamp to override unread calculation

---

## React Query Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| Stale Time | 90 seconds | Balance freshness with performance |
| Refetch on Window Focus | Yes | Update when user returns to app |
| Early Exit | 10 notifications | UI shows "9+" beyond this |

---

## Technical Decisions

### Timestamp-Based Unread Detection
**Decision**: Use `lastReadTimestamp < conversation.timestamp` instead of iterating messages
**Rationale**: O(1) comparison vs O(n) cursor iteration, ~90% complexity reduction

### Separate Cache Keys for Mentions vs Replies
**Decision**: Independent query keys for mentions and replies
**Rationale**: Allows independent invalidation, prevents race conditions

### React Context for DM Bulk Operations
**Decision**: Use `DmReadStateContext` for "Mark All as Read" instead of pure cache invalidation
**Rationale**: `useSuspenseInfiniteQuery` doesn't reliably re-render on `setQueryData`

### 2-Second Reading Delay
**Decision**: Wait 2 seconds before marking content as read
**Rationale**: Prevents false positives when quickly scrolling through channels

---

## Related Documentation

- [Mention Notification System](./mention-notification-system.md) - Mention detection, extraction, rendering
- [Channel/Space Mute System](./channel-space-mute-system.md) - Mute settings affect counts
- [Space Folders](./space-folders.md) - Folder aggregation behavior

---

*Last updated: 2026-06-04*
