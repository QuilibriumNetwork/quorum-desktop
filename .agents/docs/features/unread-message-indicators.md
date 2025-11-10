# Unread Message Visual Indicators

**Status**: ✅ Implemented  
**Priority**: High  
**Type**: UI Feature

## Overview

Discord-style unread message indicators that show when there are new messages (not just mentions) in spaces, channels, and direct messages. The system uses colored dot indicators to provide visual feedback about unread content without showing specific counts.

## Visual Implementation

- **Space Icons**: Colored dot (`--accent`) appears when ANY channel in the space has unread messages
- **Channel Names**: Colored dot (`--surface-10`) appears next to channel icon when channel has unread messages
- **Direct Messages**: Colored dot (`--accent`) appears on NavMenu DM icon when any DM conversation has unreads

## Technical Architecture

### Hooks (Boolean-Only Logic)

- `useChannelUnreadCounts()` - Checks for unread messages per channel (returns 1 or 0)
- `useSpaceUnreadCounts()` - Aggregates unread status across all channels in spaces
- `useDirectMessageUnreadCount()` - Counts unread DM conversations for NavMenu

**Key Performance Feature**: Early-exit optimization stops immediately when finding the first unread message (no counting required).

### Database Method

- `MessageDB.hasUnreadMessages()` - Optimized boolean check using IndexedDB cursors with immediate exit

### UI Integration

- **NavMenu**: Space icons and DM icon show dots when unreads exist
- **ChannelList**: Channel items show dots positioned to the left of channel icons
- **Responsive Design**: Proper positioning across mobile (≤480px), tablet (481-767px), and desktop (≥768px)

## Files Modified/Created

### New Hook Files

```
src/hooks/business/messages/useChannelUnreadCounts.ts
src/hooks/business/messages/useSpaceUnreadCounts.ts
src/hooks/business/messages/useDirectMessageUnreadCount.ts
```

### Modified Files

```
src/db/messages.ts                                    # Added hasUnreadMessages() method
src/components/navbar/NavMenu.tsx                     # Wire space + DM unread counts
src/components/space/ChannelList.tsx                  # Wire channel unread counts
src/components/space/ChannelItem.tsx                  # Add dot positioning
src/hooks/business/conversations/useUpdateReadTime.ts # Add cache invalidation
src/services/MessageService.ts                        # Add cache invalidation
src/hooks/business/messages/index.ts                  # Export new hooks
```

### Styling Files

```
src/components/navbar/SpaceIcon.scss                  # Space/DM dot styling + responsive
src/components/space/ChannelGroup.scss                # Channel dot styling
```

## Cache Invalidation Strategy

**Automatic Updates**:

- **When reading channels**: `useUpdateReadTime` invalidates unread caches → dots disappear
- **When new messages arrive**: `MessageService` invalidates unread caches → dots appear
- **React Query**: 90-second stale time with window focus refetch

**Cache Keys**:

```
['unread-counts', 'channel', spaceId, userAddress, ...channelIds]
['unread-counts', 'space', userAddress, ...spaceIds]
['unread-counts', 'direct-messages', userAddress]
```

## Integration with Existing Systems

- **Independent from mention system**: Separate cache keys, no conflicts
- **Additive changes**: No breaking changes to existing notification infrastructure
- **Cross-platform**: Works identically on web, desktop, and mobile
- **Mobile-responsive**: Proper positioning on all screen sizes

## Color Specifications

- **Space Icons & DM**: `var(--accent)` - Higher prominence for space-level indicators
- **Channel Items**: `var(--surface-10)` - Subtle indication for channel-level indicators

## Performance Characteristics

- **Early Exit**: Stops at first unread message found (no counting overhead)
- **Optimized Queries**: Uses IndexedDB cursors efficiently
- **Boolean Logic**: Only tracks read/unread state, not counts
- **Smart Caching**: Minimizes database queries while maintaining real-time feel

---

**Related Documentation**:

- [Mention Notification System](./mention-notification-system.md)
- [Cross-Platform Components Guide](../cross-platform-components-guide.md)

_Created: 2025-11-10_
