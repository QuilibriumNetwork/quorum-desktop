# Desktop Notifications Feature

## Overview

The desktop notifications feature allows Quorum to notify users about new messages when the application is running in the background. This feature enhances user engagement by ensuring they don't miss important messages even when the app isn't actively focused.

## Architecture

### Core Components

1. **NotificationService** (`src/services/notificationService.ts`)
   - Singleton service that manages all notification-related functionality
   - Handles browser permission requests and status checks
   - Provides methods for showing different types of notifications
   - Includes Safari compatibility handling (icons not supported)

2. **WebSocket Integration** (`src/components/context/WebsocketProvider.tsx`)
   - Automatically shows notifications when new messages arrive
   - Implements throttling to prevent notification spam (5-second cooldown)
   - Only triggers notifications when messages are actually processed

3. **User Settings UI** (`src/components/modals/UserSettingsModal.tsx`)
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
- `showUnreadMessagesNotification(unreadCount)`: Shows a notification for new unread messages
- `showNotification(options)`: Shows a custom notification with configurable options
- `shouldRequestPermission()`: Helper to check if permission should be requested

#### Browser Compatibility:

- **Safari**: Special handling to exclude icon property (not supported)
- **iOS Safari**: Fixed in commit `ab1acbb` to allow icons to be set (though they may not display)
- **Permission API**: Uses both promise-based and callback-based approaches for broader compatibility

### WebSocket Integration

The WebSocket provider integrates with the notification service to automatically notify users of new messages:

1. **Message Processing**: When new messages are received and processed, the total count is tracked
2. **Throttling**: Notifications are throttled to one per 5 seconds to prevent spam
3. **Visibility Check**: Notifications only show when the app is in the background (handled by NotificationService)

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
- **Body**: 
  - Single message: "You have a new unread message"
  - Multiple messages: "You have new unread messages"
- **Icon**: Quorum logo (`/quorumicon-blue.png`) - except on Safari

## Internationalization

All user-facing strings use Lingui for proper localization:
- Notification permission messages
- Settings UI text
- Notification content

## Security Considerations

1. **Permission-based**: Requires explicit user permission
2. **No sensitive data**: Notifications don't include message content, only count
3. **User control**: Can be disabled at any time through settings
4. **Browser security**: Leverages browser's built-in notification security model

## Future Enhancements

Potential improvements for the notification system:

1. **Rich notifications**: Include sender name or message preview (with privacy settings)
2. **Sound settings**: Allow users to configure notification sounds
3. **Per-conversation settings**: Enable/disable notifications for specific conversations
4. **Service Worker integration**: Persist notifications even when app is closed
5. **Notification actions**: Add quick reply or mark as read buttons
6. **Custom notification schedules**: Do not disturb hours

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

*Last updated: 2025-07-23*