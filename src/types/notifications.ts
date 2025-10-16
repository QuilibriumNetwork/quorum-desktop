/**
 * Notification Settings Types
 *
 * Defines types for user-configurable notification preferences (mentions and replies).
 * Part of Phase 4: Mention Notification Settings & Reply Notification System
 *
 * @see .agents/tasks/mention-notification-settings-phase4.md
 * @see .agents/tasks/reply-notification-system.md
 * @see .agents/docs/features/mention-notification-system.md
 */

import { Message } from '../api/quorumApi';

/**
 * Types of notifications that can be enabled/disabled
 * - 'mention-you': Direct @user mentions
 * - 'mention-everyone': @everyone mentions
 * - 'mention-roles': @role mentions
 * - 'reply': Replies to user's messages
 */
export type NotificationTypeId = 'mention-you' | 'mention-everyone' | 'mention-roles' | 'reply';

/**
 * Per-space notification settings
 * Stored in IndexedDB user_config.notificationSettings[spaceId]
 */
export interface NotificationSettings {
  /** The space ID these settings apply to */
  spaceId: string;

  /** Array of enabled notification types (e.g., ['mention-you', 'mention-everyone', 'reply']) */
  enabledNotificationTypes: NotificationTypeId[];
}

/**
 * Option for the notification settings multiselect dropdown
 */
export interface NotificationSettingOption {
  value: NotificationTypeId;
  label: string;
  subtitle: string;
  disabled?: boolean;
}

/**
 * Reply notification type (for combining with mention notifications in UI)
 */
export interface ReplyNotification {
  message: Message;
  channelId: string;
  channelName: string;
  type: 'reply';
}
