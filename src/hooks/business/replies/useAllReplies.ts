import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isNotificationTypeEnabled } from '../../../utils/notificationSettingsUtils';
import { getMutedChannelsForSpace } from '../../../utils/channelUtils';
import type { ReplyNotification } from '../../../types/notifications';

interface UseAllRepliesProps {
  spaceId: string;
  channelIds: string[];
  enabled?: boolean; // Optional: override for UI filter state
}

/**
 * Hook to fetch all unread replies across all channels in a space
 *
 * Returns array of ReplyNotification objects sorted by date (newest first)
 * Respects user's notification settings for the space (reply notifications must be enabled)
 *
 * @example
 * // Use persistent settings (default behavior)
 * const { replies, isLoading } = useAllReplies({
 *   spaceId,
 *   channelIds
 * });
 *
 * // Override with UI filter state
 * const { replies, isLoading } = useAllReplies({
 *   spaceId,
 *   channelIds,
 *   enabled: selectedTypes.includes('reply')
 * });
 *
 * @see .agents/tasks/reply-notification-system.md
 */
export function useAllReplies({
  spaceId,
  channelIds,
  enabled,
}: UseAllRepliesProps) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['reply-notifications', spaceId, userAddress, ...channelIds.sort(), enabled],
    queryFn: async () => {
      if (!userAddress) return [];

      const allReplies: ReplyNotification[] = [];

      try {
        // Load user's notification settings for this space
        const config = await messageDB.getUserConfig({ address: userAddress });
        const settings = config?.notificationSettings?.[spaceId];

        // Check if entire space is muted (takes precedence over individual settings)
        if (settings?.isMuted) {
          return []; // Space is muted - no notifications
        }

        // Check if reply notifications are enabled
        // If enabled parameter provided from UI, use it; otherwise check persistent settings
        const shouldFetchReplies = enabled !== undefined
          ? enabled
          : isNotificationTypeEnabled(settings, 'reply');

        if (!shouldFetchReplies) {
          return []; // User has disabled reply notifications (either in UI or persistent settings)
        }

        // Get muted channels to exclude from notifications
        const mutedChannelIds = getMutedChannelsForSpace(spaceId, config?.mutedChannels);

        // Get space data to access channel names
        const space = await messageDB.getSpace(spaceId);

        // Process each channel (excluding muted ones)
        for (const channelId of channelIds) {
          // Skip muted channels - they shouldn't show in notification panel
          if (mutedChannelIds.includes(channelId)) {
            continue;
          }
          const conversationId = `${spaceId}/${channelId}`;

          // Get conversation to find last read timestamp
          const { conversation } = await messageDB.getConversation({
            conversationId,
          });

          const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

          // Use optimized database query to get unread replies
          const messages = await messageDB.getUnreadReplies({
            spaceId,
            channelId,
            userAddress,
            afterTimestamp: lastReadTimestamp,
            limit: 1000, // Reasonable limit for notification panel
          });

          // Get channel name from space data
          const channel = space?.groups
            ?.flatMap(g => g.channels)
            ?.find(c => c.channelId === channelId);

          // Add to results with metadata
          messages.forEach((message) => {
            allReplies.push({
              message,
              channelId,
              channelName: channel?.channelName || 'Unknown Channel',
              type: 'reply',
            });
          });
        }

        // Sort by date (newest first)
        allReplies.sort((a, b) => b.message.createdDate - a.message.createdDate);
      } catch (error) {
        console.error('[AllReplies] Error fetching replies:', error);
        return [];
      }

      return allReplies;
    },
    enabled: !!userAddress && channelIds.length > 0,
    staleTime: 30000, // 30 seconds - matches mention system
    refetchOnWindowFocus: true,
  });

  return {
    replies: data || [],
    isLoading,
  };
}
