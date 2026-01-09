---
type: doc
title: Desktop Notifications Feature
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-04T00:00:00.000Z
---

# Desktop Notifications Feature

## Overview

The desktop notifications feature allows Quorum to notify users about new messages when the application is running in the background. This feature enhances user engagement by ensuring they don't miss important messages even when the app isn't actively focused.

## Architecture

### Core Components

1. **NotificationService** (`src/services/NotificationService.ts`)
   - Singleton service that manages all notification-related functionality
   - Handles browser permission requests and status checks
   - Provides methods for showing different types of notifications
   - Includes Safari compatibility handling (icons not supported)

2. **WebSocket Integration** (`src/components/context/WebsocketProvider.tsx`)
   - Coordinates notification display after message batch processing
   - Implements throttling to prevent notification spam (5-second cooldown)
   - Retrieves filtered notification count from NotificationService after processing

3. **MessageService Integration** (`src/services/MessageService.ts`)
   - Increments notification count for DM posts from other users
   - Increments notification count for space mentions and replies (based on user's per-space settings)
   - Filters out sync messages, reactions, edits, and own messages
   - Handles DM paths (Double Ratchet) and space paths (Triple Ratchet)

4. **User Settings UI** (`src/components/modals/UserSettingsModal.tsx`)
   - New "Notifications" settings category
   - Toggle switch to enable/disable desktop notifications
   - Handles permission requests and displays current status
   - Shows appropriate messages for unsupported browsers or blocked permissions

## Technical Implementation

### NotificationService Class

The `NotificationService` is implemented as a singleton to ensure consistent state management across the application.

#### Key Methods:

- `isNotificationSupported()`: Checks if the browser supports the Notification API
- `getPermissionStatus()`: Returns current permission status ('granted', 'denied', or 'default')
- `requestPermission()`: Requests notification permission from the user (must be triggered by user interaction)
- `showUnreadMessagesNotification(unreadCount)`: Shows a generic notification for new unread messages (legacy)
- `showContextualNotification(count, metadata)`: Shows a contextual notification with sender and type info
- `showNotification(options)`: Shows a custom notification with configurable options
- `shouldRequestPermission()`: Helper to check if permission should be requested
- `resetPendingNotificationCount()`: Resets the pending count and metadata at the start of each WebSocket batch
- `addPendingNotification(metadata)`: Called by MessageService for qualifying messages with context
- `getPendingNotificationData()`: Returns count and latest notification metadata for current batch

#### NotificationMetadata Type:

```typescript
type NotificationMetadata = {
  type: 'dm' | 'mention' | 'reply';
  senderName: string;
  spaceName?: string;
  mentionType?: 'user' | 'role' | 'everyone';
  roleName?: string;
};
```

#### Browser Compatibility:

- **Safari**: Special handling to exclude icon property (not supported)
- **iOS Safari**: Fixed in commit `ab1acbb` to allow icons to be set (though they may not display)
- **Permission API**: Uses both promise-based and callback-based approaches for broader compatibility

### WebSocket Integration

The WebSocket provider coordinates with NotificationService and MessageService to notify users of new messages:

1. **Batch Reset**: At the start of each WebSocket message batch, `resetPendingNotificationCount()` is called
2. **Message Processing**: MessageService processes each message and calls `incrementPendingNotificationCount()` for qualifying messages
3. **Notification Trigger**: After all messages are processed, the filtered count is retrieved and used to show notifications
4. **Throttling**: Notifications are throttled to one per 5 seconds to prevent spam
5. **Visibility Check**: Notifications only show when the app is in the background (handled by NotificationService)

### Message Filtering

The following messages trigger notifications:

**DM Messages:**
- DM posts from other users
- New posts only (reactions, edits excluded)
- Messages from others (your own messages from other devices don't trigger)

**Space Messages** (respects per-space settings):
- @you mentions (when `mention-you` enabled in Space Settings)
- @everyone mentions (when `mention-everyone` enabled)
- @role mentions (when `mention-roles` enabled and user has the role)
- Replies to your messages (when `reply` enabled)
- Muted spaces never trigger notifications

### User Interface

The User Settings modal includes a new "Notifications" category with:

- **Toggle Switch**: Enable/disable desktop notifications
- **Permission Handling**:
  - Automatically requests permission when user enables notifications
  - Shows appropriate messages for different permission states
  - Informs users how to change browser settings if needed
- **Browser Support Detection**: Displays warning if notifications aren't supported

## Usage Flow

1. **Initial State**: Notifications are disabled by default
2. **User Enables**: User navigates to Settings > Notifications and toggles the switch
3. **Permission Request**: Browser prompts user to allow/block notifications
4. **Notification Display**: When new messages arrive while app is backgrounded, a notification appears
5. **User Interaction**: Clicking the notification focuses the app window

## Notification Behavior

### Display Rules:

- Only show when document is not visible or doesn't have focus
- Auto-dismiss after 5 seconds
- Use consistent "quorum-unread-messages" tag to prevent duplicate notifications
- Click action focuses the app window

### Message Content:

- **Title**: "Quorum"
- **Body** (contextual based on message type):
  - DM: "New message from Alice"
  - @you mention: "Bob mentioned you in Space Name"
  - @everyone mention: "Bob mentioned @everyone in Space Name"
  - @role mention: "Bob mentioned @Admins in Space Name"
  - Reply: "Carol replied to your message in Space Name"
  - Multiple notifications: "5 new notifications"
- **Icon**: Quorum logo (`/quorumicon-blue.png`) - except on Safari
- **Fallbacks**: "Someone", "a space", "a role" when data is unavailable

## Internationalization

All user-facing strings use Lingui for proper localization:

- Notification permission messages
- Settings UI text
- Notification content

## Security Considerations

1. **Permission-based**: Requires explicit user permission
2. **Privacy-conscious**: Notifications include sender name and location, but never message content
3. **User control**: Can be disabled at any time through settings
4. **Browser security**: Leverages browser's built-in notification security model

## Future Enhancements

Potential improvements for the notification system:

1. ~~**Rich notifications**: Include sender name or message preview (with privacy settings)~~ ✅ Implemented
2. **Sound settings**: Allow users to configure notification sounds
3. **Per-conversation settings**: Enable/disable notifications for specific conversations
4. **Service Worker integration**: Persist notifications even when app is closed
5. **Notification actions**: Add quick reply or mark as read buttons
6. **Custom notification schedules**: Do not disturb hours
7. **Global notification categories**: Toggle DMs, mentions, and replies separately in User Settings
8. **Enhanced multi-notification display**: Show "5 new messages including mention from Bob" instead of generic count

## Testing Considerations

When testing the notification feature:

1. **Permission states**: Test all three permission states (granted, denied, default)
2. **Browser compatibility**: Test on Chrome, Firefox, Safari, and mobile browsers
3. **Background detection**: Ensure notifications only show when app is backgrounded
4. **Throttling**: Verify the 5-second cooldown between notifications
5. **User settings**: Confirm toggle state persists and reflects actual permission

## Known Limitations

1. **Safari**: Icon support is not available
2. **iOS**: Limited notification API support in mobile Safari
3. **Permission revocation**: Can't programmatically revoke permissions once granted
4. **Cross-origin**: Notifications require same-origin context

---

_Last updated: 2026-01-04_
_Verified: 2025-12-09 - File path corrected (NotificationService.ts)_
