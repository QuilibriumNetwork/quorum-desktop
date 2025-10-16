/**
 * Notification Settings Utilities
 *
 * Helper functions for managing notification preferences (mentions and replies).
 * Part of Phase 4: Mention Notification Settings & Reply Notification System
 *
 * @see .agents/tasks/mention-notification-settings-phase4.md
 * @see .agents/tasks/reply-notification-system.md
 */

import type {
  NotificationSettings,
  NotificationTypeId,
} from '../types/notifications';

/**
 * Get default notification settings for a space
 * By default, all notification types are enabled (mentions and replies)
 *
 * @param spaceId - The space ID to create settings for
 * @returns Default settings with all notification types enabled
 */
export function getDefaultNotificationSettings(
  spaceId: string
): NotificationSettings {
  return {
    spaceId,
    enabledNotificationTypes: ['mention-you', 'mention-everyone', 'mention-roles', 'reply'],
  };
}

/**
 * Check if a specific notification type is enabled in settings
 *
 * @param settings - The notification settings
 * @param notificationType - The notification type to check
 * @returns true if the notification type is enabled
 */
export function isNotificationTypeEnabled(
  settings: NotificationSettings | undefined,
  notificationType: NotificationTypeId
): boolean {
  if (!settings) {
    // Default: all types enabled
    return true;
  }

  return settings.enabledNotificationTypes.includes(notificationType);
}

/**
 * Check if any notification types are enabled
 *
 * @param settings - The notification settings
 * @returns true if at least one notification type is enabled
 */
export function hasEnabledNotificationTypes(
  settings: NotificationSettings | undefined
): boolean {
  if (!settings) {
    // Default: all types enabled
    return true;
  }

  return settings.enabledNotificationTypes.length > 0;
}
