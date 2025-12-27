# Channel and Space Mute System

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The Channel and Space Mute System provides users with granular control over notifications at both the channel and space level. Users can mute individual channels to suppress notifications while keeping them visible (with reduced opacity), or mute entire spaces to disable all notifications from that space. The system integrates with the existing notification infrastructure (mentions and replies) and persists preferences across sessions and devices via the Action Queue pattern.

## Architecture

### Data Model

Mute settings are stored in the `UserConfig` type within IndexedDB:

**File**: [messages.ts](src/db/messages.ts)

```typescript
export type UserConfig = {
  address: string;
  spaceIds: string[];
  // ... other fields ...

  // Channel mute settings: maps spaceId to array of muted channelIds
  mutedChannels?: {
    [spaceId: string]: string[];
  };

  // Global UI preference for showing muted channels (default: true = visible with 50% opacity)
  showMutedChannels?: boolean;

  // Per-space notification settings (includes space-level muting)
  notificationSettings?: {
    [spaceId: string]: NotificationSettings;
  };
};
```

**Space-level muting** uses the `isMuted` field in `NotificationSettings`:

**File**: [notifications.ts](src/types/notifications.ts)

```typescript
export interface NotificationSettings {
  spaceId: string;
  enabledNotificationTypes: NotificationTypeId[];
  isMuted?: boolean;  // When true, suppresses ALL notifications for this space
}
```

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Main Hook | [useChannelMute.ts](src/hooks/business/channels/useChannelMute.ts) | Provides mute/unmute functions and state |
| Utility Functions | [channelUtils.ts](src/utils/channelUtils.ts) | Helper functions for mute checking |
| Channel Item UI | [ChannelItem.tsx](src/components/space/ChannelItem.tsx) | Context menu for channel muting |
| Space Context Menu | [NavMenu.tsx](src/components/navbar/NavMenu.tsx) | Space-level mute toggle |
| Account Settings | [Account.tsx](src/components/modals/SpaceSettingsModal/Account.tsx) | Settings toggles for mute preferences |
| CSS Styling | [ChannelGroup.scss](src/components/space/ChannelGroup.scss) | Visual treatment for muted channels |

## Core Hook: useChannelMute

**File**: [useChannelMute.ts](src/hooks/business/channels/useChannelMute.ts)

The `useChannelMute` hook provides all mute-related functionality:

```typescript
interface UseChannelMuteReturn {
  // Channel-level muting
  isChannelMuted: (channelId: string) => boolean;
  getMutedChannelIds: () => string[];
  muteChannel: (channelId: string) => Promise<void>;
  unmuteChannel: (channelId: string) => Promise<void>;
  toggleMute: (channelId: string) => Promise<void>;

  // UI preference
  showMutedChannels: boolean;
  toggleShowMutedChannels: () => Promise<void>;

  // Space-level muting
  isSpaceMuted: boolean;
  muteSpace: () => Promise<void>;
  unmuteSpace: () => Promise<void>;
  toggleSpaceMute: () => Promise<void>;
}
```

### Implementation Details

- Uses **Action Queue Service** for offline support and crash recovery
- **Optimistically updates** React Query cache for instant UI feedback
- **Invalidates notification queries** upon mute/unmute for immediate count updates
- Uses dedup key pattern: `config:${userAddress}` to collapse rapid toggles
- Persists to IndexedDB via `actionQueueService.enqueue('save-user-config', ...)`

### Usage Example

```typescript
const {
  isChannelMuted,
  toggleMute,
  isSpaceMuted,
  toggleSpaceMute,
  showMutedChannels,
  toggleShowMutedChannels,
} = useChannelMute({ spaceId });

// Check if channel is muted
if (isChannelMuted('channel-123')) {
  // Channel is muted
}

// Toggle channel mute
await toggleMute('channel-123');

// Toggle entire space mute
await toggleSpaceMute();
```

## Utility Functions

**File**: [channelUtils.ts](src/utils/channelUtils.ts)

```typescript
/**
 * Check if a channel is muted for a specific space
 */
export function isChannelMuted(
  spaceId: string,
  channelId: string,
  mutedChannels?: UserConfig['mutedChannels']
): boolean;

/**
 * Get all muted channel IDs for a specific space
 */
export function getMutedChannelsForSpace(
  spaceId: string,
  mutedChannels?: UserConfig['mutedChannels']
): string[];
```

## Notification Integration

All notification hooks check for muted channels and spaces, skipping them to suppress notifications.

### Space-Level Mute Check (O(1) Early Return)

All hooks perform an early check for space-level muting:

```typescript
// Check if entire space is muted (takes precedence over individual settings)
if (settings?.isMuted) {
  return {}; // or [] for arrays - Space is muted - no notifications
}
```

### Channel-Level Mute Filtering

After the space check, hooks filter out individually muted channels:

```typescript
// Get muted channels to exclude from counts
const mutedChannelIds = getMutedChannelsForSpace(spaceId, config?.mutedChannels);

// Process each channel (excluding muted ones)
for (const channelId of channelIds) {
  if (mutedChannelIds.includes(channelId)) {
    continue; // Skip muted channels
  }
  // ... process notifications for this channel ...
}
```

### Affected Hooks

| Hook | File | Returns | Stale Time |
|------|------|---------|------------|
| useChannelMentionCounts | [useChannelMentionCounts.ts](src/hooks/business/mentions/useChannelMentionCounts.ts) | `Record<string, number>` | 90s |
| useReplyNotificationCounts | [useReplyNotificationCounts.ts](src/hooks/business/replies/useReplyNotificationCounts.ts) | `Record<string, number>` | 30s |
| useAllMentions | [useAllMentions.ts](src/hooks/business/mentions/useAllMentions.ts) | `MentionNotification[]` | 30s |
| useAllReplies | [useAllReplies.ts](src/hooks/business/replies/useAllReplies.ts) | `ReplyNotification[]` | 30s |
| useSpaceMentionCounts | [useSpaceMentionCounts.ts](src/hooks/business/mentions/useSpaceMentionCounts.ts) | `Record<string, number>` | 90s |
| useSpaceReplyCounts | [useSpaceReplyCounts.ts](src/hooks/business/replies/useSpaceReplyCounts.ts) | `Record<string, number>` | 90s |

## UI Integration

### Channel Context Menu

**File**: [ChannelItem.tsx](src/components/space/ChannelItem.tsx)

Right-click or long-press on a channel opens a context menu with mute options:

```typescript
// Build context menu items
contextMenuItems.push({
  id: 'toggle-mute',
  icon: isMuted ? 'bell' : 'bell-off',
  label: isMuted ? t`Unmute Channel` : t`Mute Channel`,
  onClick: async () => {
    if (onToggleMute) {
      await onToggleMute(channel.channelId);
    }
  },
});
```

- Available to all users (not just space owners)
- Icon toggles: `bell` (muted, click to unmute) ↔ `bell-off` (unmuted, click to mute)

### Space Context Menu

**File**: [NavMenu.tsx](src/components/navbar/NavMenu.tsx)

Right-click on a space icon shows space-level options:

```typescript
const items: MenuItem[] = [
  {
    id: 'account',
    icon: 'user',
    label: t`My Account`,
    onClick: () => openSpaceEditor(spaceContextMenu.spaceId!, 'account'),
  },
  {
    id: 'toggle-muted-channels',
    icon: showMutedChannels ? 'eye-off' : 'eye',
    label: showMutedChannels ? t`Hide Muted Channels` : t`Show Muted Channels`,
    onClick: () => toggleShowMutedChannels(),
  },
  {
    id: 'toggle-space-mute',
    icon: isSpaceMuted ? 'bell' : 'bell-off',
    label: isSpaceMuted ? t`Unmute Space` : t`Mute Space`,
    onClick: () => toggleSpaceMute(),
  },
];

// Separator before owner/leave options
if (spaceContextMenu.isOwner) {
  items.push(
    { id: 'settings', icon: 'settings', label: t`Space Settings`, separator: true, ... },
    { id: 'invites', icon: 'user-plus', label: t`Invite Members`, ... },
    { id: 'roles', icon: 'shield', label: t`Manage Roles`, ... }
  );
} else {
  items.push({
    id: 'leave', icon: 'logout', label: t`Leave Space`, danger: true, separator: true, ...
  });
}
```

### Account Settings

**File**: [Account.tsx](src/components/modals/SpaceSettingsModal/Account.tsx)

The Account tab in Space Settings provides toggles for mute preferences:

```tsx
{/* Notifications Section */}
<div className="text-subtitle-2">
  <Trans>Notifications</Trans>
</div>

{/* Notification type selector */}
<Select
  value={selectedMentionTypes}
  onChange={setSelectedMentionTypes}
  multiple={true}
  options={[
    { value: 'mention-you', label: t`@you` },
    { value: 'mention-everyone', label: t`@everyone` },
    { value: 'mention-roles', label: t`@roles` },
    { value: 'reply', label: t`Replies` },
  ]}
/>

{/* Mute this Space toggle */}
<FlexRow className="items-center justify-between pt-4">
  <div className="text-label-strong">
    <Trans>Mute this Space</Trans>
  </div>
  <Switch
    value={isSpaceMuted}
    onChange={toggleSpaceMute}
    accessibilityLabel={t`Mute all notifications from this space`}
  />
</FlexRow>

{/* Hide muted channels toggle */}
<FlexRow className="items-center justify-between pt-4">
  <div className="text-label-strong">
    <Trans>Hide muted channels</Trans>
  </div>
  <Switch
    value={!showMutedChannels}
    onChange={handleShowMutedToggle}
    accessibilityLabel={t`Hide muted channels in list`}
  />
</FlexRow>
```

## Visual Treatment

**File**: [ChannelGroup.scss](src/components/space/ChannelGroup.scss)

Muted channels display at 50% opacity when visible:

```scss
.channel-item-muted {
  opacity: 0.5;
}
```

Applied conditionally in ChannelItem:

```typescript
const mutedClassName = isMuted ? 'channel-item-muted' : '';
```

### Visibility Behavior

| `showMutedChannels` | Muted Channel Behavior |
|---------------------|------------------------|
| `true` (default) | Displayed at 50% opacity |
| `false` | Hidden from channel list |

## Data Flow

1. **User mutes channel** via ChannelItem context menu
2. **useChannelMute.muteChannel()** is called
3. Action is queued: `actionQueueService.enqueue('save-user-config', ...)`
4. React Query cache updated optimistically
5. Notification queries invalidated:
   - `['mention-counts', 'channel', spaceId]`
   - `['reply-counts', 'channel', spaceId]`
   - `['mention-notifications', spaceId]`
   - `['reply-notifications', spaceId]`
6. Config saved to IndexedDB (with offline support)
7. Syncs across devices via existing sync mechanism

## Mute Hierarchy

The mute system follows a clear precedence:

1. **Space mute** (`notificationSettings[spaceId].isMuted`) - Highest priority
   - When enabled, ALL channels in the space are muted
   - New channels added to a muted space are automatically muted
   - O(1) check at the start of all notification hooks

2. **Channel mute** (`mutedChannels[spaceId][]`) - Per-channel override
   - Individual channels can be muted/unmuted independently
   - When space is unmuted, individual channel preferences are preserved

## Technical Decisions

### Action Queue Pattern
Uses the same offline-first pattern as folder operations for crash recovery and eventual consistency. Config saves are queued with dedup keys to prevent duplicate writes during rapid toggling.

### Optimistic Updates
React Query cache is updated immediately for instant UI feedback, while the actual persistence happens asynchronously in the background.

### Early Exit Optimization
Space-level mute checks happen first (O(1)) to avoid unnecessary channel iteration when the entire space is muted. Notification hooks also use early-exit thresholds (10 items) since UI shows "9+" for counts > 9.

### Separation of Concerns
- `isMuted` in `NotificationSettings` represents **user intent** to mute a space
- `mutedChannels` represents **individual channel preferences**
- `showMutedChannels` is a **UI preference** for visibility

## Known Limitations

- **No per-space showMutedChannels**: The hide/show preference is global, not per-space
- **No notification history**: When a channel is unmuted, previous notifications don't reappear
- **Sync conflicts**: Uses last-write-wins; rapid muting on multiple devices may cause brief inconsistencies

## Related Documentation

- [Mention Notification System](mention-notification-system.md)
- [Reply Notification System](reply-notification-system.md)
- [Config Sync System](../config-sync-system.md)

---

*Updated: 2025-12-27*
