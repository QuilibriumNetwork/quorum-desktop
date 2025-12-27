import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isNotificationTypeEnabled } from '../../../utils/notificationSettingsUtils';
import type { Space } from '../../../api/quorumApi';

interface UseSpaceReplyCountsProps {
  spaces: Space[];
}

// Early-exit threshold: Stop counting after 10 replies
// (UI shows "9+" for counts > 9, so exact count beyond 10 is unnecessary)
const DISPLAY_THRESHOLD = 10;

/**
 * Hook to calculate unread reply counts for entire spaces
 *
 * Returns a map of spaceId -> total reply count across all channels in that space.
 * Only spaces with replies > 0 are included in the result.
 *
 * The hook:
 * 1. Checks if reply notifications are enabled for each space
 * 2. For each space, gets all channel IDs
 * 3. For each channel, gets the last read timestamp
 * 4. Queries messages after that timestamp where user received a reply
 * 5. Aggregates total replies per space
 *
 * Uses React Query with 90s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 */
export function useSpaceReplyCounts({
  spaces,
}: UseSpaceReplyCountsProps): Record<string, number> {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data } = useQuery({
    // Query key includes space IDs to invalidate when spaces change
    // Can be invalidated at space level ['reply-counts', 'space', spaceId] or
    // more broadly ['reply-counts', 'space'] for all spaces
    queryKey: [
      'reply-counts',
      'space',
      userAddress,
      ...spaces.map((s) => s.spaceId).sort(),
    ],
    queryFn: async () => {
      if (!userAddress) return {};

      const spaceCounts: Record<string, number> = {};

      try {
        // Load user's notification settings
        const config = await messageDB.getUserConfig({ address: userAddress });

        // Process each space
        for (const space of spaces) {
          // Check if reply notifications are enabled for this space
          const settings = config?.notificationSettings?.[space.spaceId];

          // Check if entire space is muted (takes precedence over individual settings)
          if (settings?.isMuted) {
            continue; // Space is muted - no notifications
          }

          if (!isNotificationTypeEnabled(settings, 'reply')) {
            continue; // Skip this space if reply notifications are disabled
          }

          let spaceTotal = 0;

          // Get all channel IDs from all groups in this space
          const channelIds = space.groups.flatMap((group) =>
            group.channels.map((channel) => channel.channelId)
          );

          // Process each channel in the space with early exit
          for (const channelId of channelIds) {
            // Early exit: no need to count beyond display threshold
            if (spaceTotal >= DISPLAY_THRESHOLD) {
              break; // Stop scanning remaining channels
            }

            const conversationId = `${space.spaceId}/${channelId}`;

            // Get conversation to find last read timestamp
            const { conversation } = await messageDB.getConversation({
              conversationId,
            });

            const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

            // Use optimized database query to get only unread replies
            const remainingLimit = DISPLAY_THRESHOLD - spaceTotal;
            const messages = await messageDB.getUnreadReplies({
              spaceId: space.spaceId,
              channelId,
              userAddress,
              afterTimestamp: lastReadTimestamp,
              limit: remainingLimit, // Only fetch what we need
            });

            // Add to space total
            spaceTotal += messages.length;

            // Early exit if we've hit the display threshold
            if (spaceTotal >= DISPLAY_THRESHOLD) {
              break; // Stop scanning channels
            }
          }

          // Only include spaces with replies
          if (spaceTotal > 0) {
            spaceCounts[space.spaceId] = spaceTotal;
          }
        }
      } catch (error) {
        console.error('[SpaceReplyCounts] Error calculating reply counts:', error);
        // Return empty counts on error - graceful degradation
        return {};
      }

      return spaceCounts;
    },
    enabled: !!userAddress && spaces.length > 0,
    staleTime: 90000, // 90 seconds (1.5 minutes) - reduces query frequency while maintaining reasonable UX
    refetchOnWindowFocus: true, // Immediate updates when user returns to app
  });

  return data || {};
}
