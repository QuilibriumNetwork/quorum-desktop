# Notification Indicators System

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Discord-style visual notification system providing feedback about unread content across the application. The system uses two types of indicators:

1. **Unread Dots/Toggles**: Visual markers showing unread messages exist (no count)
2. **Notification Bubbles**: Numbered badges showing mention + reply counts

These indicators appear on:
- **NavMenu**: Space icons, folder icons, DM icon
- **ChannelList**: Individual channel items
- **DirectMessageContactsList**: Individual DM contacts

---

## Architecture

### Indicator Types by Location

| Location | Unread Indicator | Notification Bubble |
|----------|------------------|---------------------|
| **Space Icon** | White toggle bar on left | Accent-colored count badge |
| **Folder Icon** | White toggle bar on left | Sum of space counts |
| **DM Icon** | White toggle bar on left | Unread conversation count |
| **Channel Item** | Dot next to icon | Combined mention+reply count |
| **DM Contact** | Bold name + dot | N/A |

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

### Space Icon (NavMenu)

**Files**: `src/components/navbar/SpaceIcon.tsx`, `NavMenu.tsx`

| Indicator | Data Source | Condition |
|-----------|-------------|-----------|
| Toggle bar | `spaceUnreadCounts[spaceId]` | Any channel has unread messages |
| Count bubble | `spaceMentionCounts + spaceReplyCounts` | Mentions or replies exist |

### Folder Icon (NavMenu)

**Files**: `src/components/navbar/FolderButton.tsx`, `FolderContainer.tsx`

| Indicator | Data Source | Condition |
|-----------|-------------|-----------|
| Toggle bar | `spaces.some(s => s.notifs > 0)` | Any space in folder has unreads |
| Count bubble | Sum of all `spaceMentionCounts` in folder | Any space has mentions/replies |

When folder is expanded, indicators hide (individual space icons show their own).

### DM Icon (NavMenu)

**File**: `src/components/navbar/NavMenu.tsx`

| Indicator | Data Source | Condition |
|-----------|-------------|-----------|
| Toggle bar | `dmUnreadCount > 0` | Any DM has unread messages |
| Count bubble | `useDirectMessageUnreadCount()` | Unread conversations exist |

**Context Menu**: Right-click (desktop) or long-press (touch) shows "Mark All as Read" when unread DMs exist.

### Channel Item (ChannelList)

**Files**: `src/components/space/ChannelItem.tsx`, `ChannelList.tsx`

| Indicator | Data Source | Condition |
|-----------|-------------|-----------|
| Unread dot | `unreadCounts[channelId]` | Channel has unread messages |
| Count bubble | `mentionCounts + replyCounts` | Mentions or replies exist |

### DM Contact (DirectMessageContactsList)

**Files**: `src/components/direct/DirectMessageContact.tsx`, `DirectMessageContactsList.tsx`

| Indicator | Data Source | Condition |
|-----------|-------------|-----------|
| Bold name + dot | `lastReadTimestamp < timestamp` | Unread messages exist |

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
['mention-counts', spaceId]
['mention-notifications', spaceId]
['unread-counts', 'channel', spaceId]
['unread-counts', 'space']

// For reply messages
['reply-counts', spaceId]
['reply-notifications', spaceId]

// For DM messages
['unread-counts', 'direct-messages']
```

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

## File Reference

```
src/
├── context/
│   └── DmReadStateContext.tsx              # DM bulk read state
├── hooks/
│   └── business/
│       ├── conversations/
│       │   └── useUpdateReadTime.ts        # Read time mutation + invalidation
│       ├── mentions/
│       │   ├── useChannelMentionCounts.ts  # Channel mention counts
│       │   └── useSpaceMentionCounts.ts    # Space mention counts
│       ├── replies/
│       │   ├── useReplyNotificationCounts.ts # Channel reply counts
│       │   └── useSpaceReplyCounts.ts      # Space reply counts
│       └── messages/
│           ├── useChannelUnreadCounts.ts   # Channel unread status
│           ├── useSpaceUnreadCounts.ts     # Space unread status
│           └── useDirectMessageUnreadCount.ts # DM unread count
├── components/
│   ├── navbar/
│   │   ├── SpaceIcon.tsx                   # Space icon with indicators
│   │   ├── FolderButton.tsx                # Folder icon with indicators
│   │   ├── FolderContainer.tsx             # Folder aggregation logic
│   │   └── NavMenu.tsx                     # Wires all NavMenu indicators
│   ├── space/
│   │   ├── ChannelList.tsx                 # Wires channel indicators
│   │   └── ChannelItem.tsx                 # Channel item with indicators
│   └── direct/
│       ├── DirectMessageContactsList.tsx   # DM list with indicators
│       └── DirectMessageContact.tsx        # DM contact with indicators
└── services/
    └── MessageService.ts                   # Cache invalidation on new messages
```

---

## Related Documentation

- [Mention Notification System](./mention-notification-system.md) - Mention detection, extraction, rendering
- [Channel/Space Mute System](./channel-space-mute-system.md) - Mute settings affect counts
- [Space Folders](./space-folders.md) - Folder aggregation behavior

---

*Updated: 2026-01-06*
