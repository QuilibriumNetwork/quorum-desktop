import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isNotificationTypeEnabled } from '../../../utils/notificationSettingsUtils';

interface UseReplyNotificationCountsProps {
  spaceId: string;
  channelIds: string[];
}

// Early-exit threshold: Stop counting after 10 replies per channel
// (UI shows "9+" for counts > 9, so exact count beyond 10 is unnecessary)
const DISPLAY_THRESHOLD = 10;

/**
 * Hook to calculate unread reply notification counts for channels in a space
 *
 * Returns a map of channelId -> replyCount for channels where the user has unread replies.
 * Only channels with replies > 0 are included in the result.
 *
 * The hook:
 * 1. Loads user's notification settings for this space
 * 2. Checks if reply notifications are enabled
 * 3. Gets the last read timestamp for each channel
 * 4. Queries messages after that timestamp
 * 5. Filters messages where the user is replied to (via replyMetadata)
 * 6. Returns count per channel
 *
 * Uses React Query with 30s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 *
 * @see .agents/tasks/reply-notification-system.md
 */
export function useReplyNotificationCounts({
  spaceId,
  channelIds,
}: UseReplyNotificationCountsProps): Record<string, number> {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data } = useQuery({
    // Note: Query key includes all channelIds so it invalidates when channels change
    // Can be invalidated at space level ['reply-counts', 'channel', spaceId] or
    // more broadly ['reply-counts', 'channel'] for all channels
    queryKey: ['reply-counts', 'channel', spaceId, userAddress, ...channelIds.sort()],
    queryFn: async () => {
      if (!userAddress) return {};

      const counts: Record<string, number> = {};

      try {
        // Load user's notification settings for this space
        const config = await messageDB.getUserConfig({ address: userAddress });
        const settings = config?.notificationSettings?.[spaceId];

        // Check if reply notifications are enabled
        if (!isNotificationTypeEnabled(settings, 'reply')) {
          return {}; // User has disabled reply notifications
        }

        // Process each channel
        for (const channelId of channelIds) {
          const conversationId = `${spaceId}/${channelId}`;

          // Get conversation to find last read timestamp
          const { conversation } = await messageDB.getConversation({
            conversationId,
          });

          const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

          // Use optimized database query to get only unread replies
          // This is much faster than fetching all messages
          const messages = await messageDB.getUnreadReplies({
            spaceId,
            channelId,
            userAddress,
            afterTimestamp: lastReadTimestamp,
            limit: DISPLAY_THRESHOLD, // Only fetch what we need for display
          });

          // Count replies (getUnreadReplies already filters by replyMetadata.parentAuthor)
          const channelReplyCount = Math.min(messages.length, DISPLAY_THRESHOLD);

          // Only include channels with replies
          if (channelReplyCount > 0) {
            counts[channelId] = channelReplyCount;
          }
        }
      } catch (error) {
        console.error('[ReplyCounts] Error calculating reply counts:', error);
        // Return empty counts on error - graceful degradation
        return {};
      }

      return counts;
    },
    enabled: !!userAddress && channelIds.length > 0,
    staleTime: 30000, // 30 seconds - matches mention system for consistency
    refetchOnWindowFocus: true, // Immediate updates when user returns to app
  });

  return data || {};
}
