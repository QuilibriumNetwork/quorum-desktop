/**
 * Notification type re-exports from @quilibrium/quorum-shared.
 *
 * Per-space notification preferences live on UserConfig.notificationSettings
 * and sync across devices. DM and channel mute live on separate UserConfig
 * fields (mutedConversations, mutedChannels) and are handled outside this
 * type set — see the channel-space-mute and mute-conversation feature docs.
 *
 * @see .agents/docs/features/mention-notification-system.md
 * @see .agents/docs/features/channel-space-mute-system.md
 */

export type {
  SpaceNotificationTypeId,
  SpaceNotificationSettings,
  SpaceNotificationSettingOption,
  ReplyNotification,
} from '@quilibrium/quorum-shared';
