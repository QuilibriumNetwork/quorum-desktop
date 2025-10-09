import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isMentioned } from '../../../utils/mentionUtils';
import type { Message, Space } from '../../../api/quorumApi';

interface UseSpaceMentionCountsProps {
  spaces: Space[];
}

/**
 * Hook to calculate unread mention counts for entire spaces
 *
 * Returns a map of spaceId -> total mention count across all channels in that space.
 * Only spaces with mentions > 0 are included in the result.
 *
 * The hook:
 * 1. For each space, gets all channel IDs
 * 2. For each channel, gets the last read timestamp
 * 3. Queries messages after that timestamp where user is mentioned
 * 4. Aggregates total mentions per space
 *
 * Uses React Query with 30s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 */
export function useSpaceMentionCounts({
  spaces,
}: UseSpaceMentionCountsProps): Record<string, number> {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data } = useQuery({
    // Query key includes space IDs to invalidate when spaces change
    // Can be invalidated at space level ['mention-counts', spaceId]
    queryKey: [
      'space-mention-counts',
      userAddress,
      ...spaces.map((s) => s.spaceId).sort(),
    ],
    queryFn: async () => {
      if (!userAddress) return {};

      const spaceCounts: Record<string, number> = {};

      try {
        // Process each space
        for (const space of spaces) {
          let spaceTotal = 0;

          // Get all channel IDs from all groups in this space
          const channelIds = space.groups.flatMap((group) =>
            group.channels.map((channel) => channel.channelId)
          );

          // Process each channel in the space
          for (const channelId of channelIds) {
            const conversationId = `${space.spaceId}/${channelId}`;

            // Get conversation to find last read timestamp
            const { conversation } = await messageDB.getConversation({
              conversationId,
            });

            const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

            // Get all messages after last read (up to 10k for safety)
            const { messages } = await messageDB.getMessages({
              spaceId: space.spaceId,
              channelId,
              limit: 10000, // Safety limit to prevent excessive memory usage
            });

            // Filter messages that:
            // 1. Were created after last read time
            // 2. Mention the current user
            const unreadMentions = messages.filter((message: Message) => {
              if (message.createdDate <= lastReadTimestamp) return false;
              return isMentioned(message, { userAddress });
            });

            spaceTotal += unreadMentions.length;
          }

          // Only include spaces with mentions
          if (spaceTotal > 0) {
            spaceCounts[space.spaceId] = spaceTotal;
          }
        }
      } catch (error) {
        console.error('[SpaceMentionCounts] Error calculating mention counts:', error);
        // Return empty counts on error - graceful degradation
        return {};
      }

      return spaceCounts;
    },
    enabled: !!userAddress && spaces.length > 0,
    staleTime: 30000, // 30 seconds - balance between performance and real-time updates
    refetchOnWindowFocus: true,
  });

  return data || {};
}
