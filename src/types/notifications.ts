/**
 * Mention Notification Settings Types
 *
 * Defines types for user-configurable mention notification preferences.
 * Part of Phase 4: Mention Notification Settings
 *
 * @see .agents/tasks/mention-notification-settings-phase4.md
 * @see .agents/docs/features/mention-notification-system.md
 */

/**
 * Types of mentions that can trigger notifications
 */
export type MentionTypeId = 'you' | 'everyone' | 'roles';

/**
 * Per-space mention notification settings
 * Stored in IndexedDB user_config.mentionSettings[spaceId]
 */
export interface MentionNotificationSettings {
  /** The space ID these settings apply to */
  spaceId: string;

  /** Array of enabled mention types (e.g., ['you', 'everyone', 'roles']) */
  enabledMentionTypes: MentionTypeId[];
}

/**
 * Option for the mention settings multiselect dropdown
 */
export interface MentionSettingOption {
  value: MentionTypeId;
  label: string;
  subtitle: string;
  disabled?: boolean;
}
