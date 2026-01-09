---
type: doc
title: Mute Conversation System
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Mute Conversation System

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The DM conversation mute feature allows users to mute individual direct message conversations. When muted, conversations:
- Don't show unread indicators (blue dot)
- Don't count toward the NavMenu DM badge
- Don't trigger desktop notifications

This is useful for low-priority contacts, noisy conversations, or bot accounts where users want to keep the conversation but don't need immediate alerts.

## Architecture

### Data Storage

Muted conversations are stored in the `UserConfig` type in IndexedDB:

```typescript
// src/db/messages.ts
type UserConfig = {
  // ... other fields
  mutedConversations?: string[];  // Array of conversationId strings
};
```

The `conversationId` format is `address/address` (counterparty wallet address repeated), matching the existing `favoriteDMs` pattern.

### Core Hook

The `useDMMute` hook ([src/hooks/business/dm/useDMMute.ts](src/hooks/business/dm/useDMMute.ts)) provides the mute API:

```typescript
const {
  muted,           // string[] - array of muted conversation IDs
  mutedSet,        // Set<string> - for O(1) lookup
  isMuted,         // (conversationId: string) => boolean
  muteConversation,    // async (conversationId: string) => void
  unmuteConversation,  // async (conversationId: string) => void
  toggleMute       // async (conversationId: string) => void
} = useDMMute();
```

The hook follows the exact same pattern as `useDMFavorites`:
- Optimistic UI updates via `queryClient.setQueryData`
- Action Queue integration via `save-user-config` action type
- Dedup key pattern: `config:${userAddress}`
- Cache invalidation for immediate badge updates

### Integration Points

1. **Context Menu** ([DirectMessageContactsList.tsx](src/components/direct/DirectMessageContactsList.tsx))
   - "Mute Conversation" / "Unmute Conversation" option
   - Bell icon toggles between `bell` (unmute) and `bell-off` (mute)

2. **Settings Modal** ([ConversationSettingsModal.tsx](src/components/modals/ConversationSettingsModal.tsx))
   - Switch toggle for mute status
   - Tooltip explains the effect of muting

3. **Unread Indicators** ([DirectMessageContactsList.tsx](src/components/direct/DirectMessageContactsList.tsx))
   - Visual unread dot suppressed for muted conversations
   - `unread` prop excludes muted: `!mutedSet.has(c.conversationId)`

4. **NavMenu Badge** ([useDirectMessageUnreadCount.ts](src/hooks/business/messages/useDirectMessageUnreadCount.ts))
   - Muted conversations excluded from unread count
   - Cache invalidation ensures immediate updates on mute/unmute

5. **Desktop Notifications** ([NotificationService.ts](src/services/NotificationService.ts), [MessageService.ts](src/services/MessageService.ts))
   - NotificationService maintains `mutedConversations` Set
   - MessageService checks before incrementing notification count
   - React layer syncs via `useMutedConversationsSync` hook in Layout

6. **Filter System** ([DirectMessageContactsList.tsx](src/components/direct/DirectMessageContactsList.tsx))
   - "Muted" filter option in DM list
   - Filter only appears when muted conversations exist
   - Auto-resets to "All" when last muted conversation is unmuted

## Data Flow

### Muting a Conversation

```
User clicks "Mute" in context menu
    │
    ├─► useDMMute.toggleMute(conversationId)
    │
    ├─► Optimistic update: queryClient.setQueryData (instant UI)
    │
    ├─► Cache invalidation: invalidateQueries(['unread-counts', ...])
    │
    └─► Action Queue: enqueue('save-user-config', {...})
            │
            └─► Background: Config saved to IndexedDB + synced to server
```

### Notification Filtering

```
WebSocket receives DM message
    │
    ├─► MessageService.addMessage()
    │
    ├─► Check: notificationService.isConversationMuted(conversationId)
    │
    └─► If not muted: incrementPendingNotificationCount()
```

### Config Sync to NotificationService

```
Layout component mounts
    │
    └─► useMutedConversationsSync() hook
            │
            ├─► useConfig() subscribes to config changes
            │
            └─► useEffect: notificationService.setMutedConversations(Set)
```

## Filter System

The DM list filter system conditionally shows filters based on data availability:

| Filter | Shown When |
|--------|------------|
| All | Always |
| Favorites | At least one favorite exists |
| Unknown | At least one unknown contact exists |
| Muted | At least one muted conversation exists |

If no filters are available (no favorites, no unknown, no muted), the filter dropdown is hidden entirely.

When a filter's data becomes empty while that filter is active (e.g., unmuting the last muted conversation while "Muted" filter is selected), the filter auto-resets to "All".

## Offline Support

Mute operations work offline via Action Queue:

1. User mutes conversation while offline
2. Optimistic update shows immediate UI change
3. Action queued to IndexedDB (`save-user-config`)
4. When online, action processed and synced to server
5. Dedup key collapses rapid toggles to final state

## Related Features

- **Channel Mute** ([useChannelMute.ts](src/hooks/business/channels/useChannelMute.ts)) - Similar concept for space channels
- **DM Favorites** ([useDMFavorites.ts](src/hooks/business/dm/useDMFavorites.ts)) - Pattern reference for implementation
- **Desktop Notifications** ([desktop-notifications.md](.agents/docs/features/desktop-notifications.md)) - Notification system overview
- **Action Queue** ([action-queue.md](.agents/docs/features/action-queue.md)) - Offline support mechanism

## Technical Decisions

### Why NotificationService Instead of MessageService Dependencies?

The notification filtering is implemented in NotificationService rather than passed through MessageService dependencies because:
1. NotificationService is a singleton already managing notification state
2. Avoids complex dependency injection changes
3. React layer can easily sync config changes to the service
4. Clean separation: MessageService asks "should I notify?", NotificationService knows the answer

### Why No Visual Indicator (Opacity)?

Unlike channel mute which shows muted channels at 60% opacity, muted DM conversations have no visual distinction. This was a deliberate choice to keep the UI clean - users can use the "Muted" filter to find muted conversations when needed.

---
