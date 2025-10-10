/**
 * Mention Notification Settings Utilities
 *
 * Helper functions for managing mention notification preferences.
 * Part of Phase 4: Mention Notification Settings
 *
 * @see .agents/tasks/mention-notification-settings-phase4.md
 */

import type {
  MentionNotificationSettings,
  MentionTypeId,
} from '../types/notifications';

/**
 * Get default mention notification settings for a space
 * By default, all mention types are enabled
 *
 * @param spaceId - The space ID to create settings for
 * @returns Default settings with all mention types enabled
 */
export function getDefaultMentionSettings(
  spaceId: string
): MentionNotificationSettings {
  return {
    spaceId,
    enabledMentionTypes: ['you', 'everyone', 'roles'],
  };
}

/**
 * Check if a specific mention type is enabled in settings
 *
 * @param settings - The mention notification settings
 * @param mentionType - The mention type to check
 * @returns true if the mention type is enabled
 */
export function isMentionTypeEnabled(
  settings: MentionNotificationSettings | undefined,
  mentionType: MentionTypeId
): boolean {
  if (!settings) {
    // Default: all types enabled
    return true;
  }

  return settings.enabledMentionTypes.includes(mentionType);
}

/**
 * Check if any mention types are enabled
 *
 * @param settings - The mention notification settings
 * @returns true if at least one mention type is enabled
 */
export function hasEnabledMentionTypes(
  settings: MentionNotificationSettings | undefined
): boolean {
  if (!settings) {
    // Default: all types enabled
    return true;
  }

  return settings.enabledMentionTypes.length > 0;
}
