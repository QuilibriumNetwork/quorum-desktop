import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { Space } from '../../../api/quorumApi';

interface UseSpaceUnreadCountsProps {
  spaces: Space[];
}

// Early-exit threshold: Stop checking at first unread channel found
// (We only need boolean indicator - has unreads vs no unreads)
const BOOLEAN_THRESHOLD = 1;

/**
 * Hook to check for unread messages across entire spaces
 *
 * Returns a map of spaceId -> 1 (has unreads) or 0 (no unreads) for spaces
 * where there are unread messages in ANY channel within that space.
 * Only spaces with unreads are included in the result.
 *
 * The hook:
 * 1. For each space, gets all channel IDs from all groups
 * 2. For each channel, gets the last read timestamp
 * 3. Queries messages after that timestamp with early exit
 * 4. Returns binary indicator as soon as first unread channel is found
 *
 * Uses React Query with 90s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 *
 * This aggregates unread state across all channels in a space.
 */
export function useSpaceUnreadCounts({
  spaces,
}: UseSpaceUnreadCountsProps): Record<string, number> {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data } = useQuery({
    // Query key includes space IDs to invalidate when spaces change
    // Can be invalidated at space level ['unread-counts', 'space', spaceId] or
    // more broadly ['unread-counts', 'space'] for all spaces
    queryKey: [
      'unread-counts',
      'space',
      userAddress,
      ...spaces.map((s) => s.spaceId).sort(),
    ],
    queryFn: async () => {
      if (!userAddress) return {};

      const spaceCounts: Record<string, number> = {};

      try {
        // Process each space
        for (const space of spaces) {
          let spaceHasUnreads = false;

          // Get all channel IDs from all groups in this space
          const channelIds = space.groups.flatMap((group) =>
            group.channels.map((channel) => channel.channelId)
          );

          // Process each channel in the space with early exit
          for (const channelId of channelIds) {
            // Early exit: stop as soon as we find first unread channel
            if (spaceHasUnreads) {
              break; // Stop scanning remaining channels
            }

            const conversationId = `${space.spaceId}/${channelId}`;

            // Get conversation to find last read timestamp
            const { conversation } = await messageDB.getConversation({
              conversationId,
            });

            const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

            // Use optimized database method to check for unread messages
            // This is much more efficient than fetching and filtering messages
            const hasUnreads = await messageDB.hasUnreadMessages({
              spaceId: space.spaceId,
              channelId,
              afterTimestamp: lastReadTimestamp,
            });

            if (hasUnreads) {
              spaceHasUnreads = true;
              break; // Stop scanning channels - we found unreads in this space
            }
          }

          // Only include spaces with unreads (binary indicator)
          if (spaceHasUnreads) {
            spaceCounts[space.spaceId] = 1; // Binary: 1 = has unreads, 0 = no unreads
          }
        }
      } catch (error) {
        console.error(
          '[SpaceUnreadCounts] Error calculating unread counts:',
          error
        );
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
