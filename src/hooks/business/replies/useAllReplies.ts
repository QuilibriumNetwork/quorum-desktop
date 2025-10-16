import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isNotificationTypeEnabled } from '../../../utils/notificationSettingsUtils';
import type { ReplyNotification } from '../../../types/notifications';

interface UseAllRepliesProps {
  spaceId: string;
  channelIds: string[];
}

/**
 * Hook to fetch all unread replies across all channels in a space
 *
 * Returns array of ReplyNotification objects sorted by date (newest first)
 * Respects user's notification settings for the space (reply notifications must be enabled)
 *
 * @example
 * const { replies, isLoading } = useAllReplies({
 *   spaceId,
 *   channelIds
 * });
 *
 * @see .agents/tasks/reply-notification-system.md
 */
export function useAllReplies({
  spaceId,
  channelIds,
}: UseAllRepliesProps) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['reply-notifications', spaceId, userAddress, ...channelIds.sort()],
    queryFn: async () => {
      if (!userAddress) return [];

      const allReplies: ReplyNotification[] = [];

      try {
        // Load user's notification settings for this space
        const config = await messageDB.getUserConfig({ address: userAddress });
        const settings = config?.notificationSettings?.[spaceId];

        // Check if reply notifications are enabled
        if (!isNotificationTypeEnabled(settings, 'reply')) {
          return []; // User has disabled reply notifications
        }

        // Get space data to access channel names
        const space = await messageDB.getSpace(spaceId);

        // Process each channel
        for (const channelId of channelIds) {
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
