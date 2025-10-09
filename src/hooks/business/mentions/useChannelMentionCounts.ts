import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isMentioned } from '../../../utils/mentionUtils';
import type { Message } from '../../../api/quorumApi';

interface UseChannelMentionCountsProps {
  spaceId: string;
  channelIds: string[];
}

/**
 * Hook to calculate unread mention counts for channels in a space
 *
 * Returns a map of channelId -> mentionCount for channels where the user has unread mentions.
 * Only channels with mentions > 0 are included in the result.
 *
 * The hook:
 * 1. Gets the last read timestamp for each channel
 * 2. Queries messages after that timestamp
 * 3. Filters messages where the user is mentioned
 * 4. Returns count per channel
 *
 * Uses React Query with 30s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 */
export function useChannelMentionCounts({
  spaceId,
  channelIds,
}: UseChannelMentionCountsProps): Record<string, number> {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data } = useQuery({
    // Note: Query key includes all channelIds so it invalidates when channels change
    // Can be invalidated at space level ['mention-counts', 'channel', spaceId] or
    // more broadly ['mention-counts', 'channel'] for all channels
    queryKey: ['mention-counts', 'channel', spaceId, userAddress, ...channelIds.sort()],
    queryFn: async () => {
      if (!userAddress) return {};

      const counts: Record<string, number> = {};

      try {
        // Process each channel
        for (const channelId of channelIds) {
          const conversationId = `${spaceId}/${channelId}`;

          // Get conversation to find last read timestamp
          const { conversation } = await messageDB.getConversation({
            conversationId,
          });

          const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

          // Get all messages after last read (up to 10k for safety)
          const { messages } = await messageDB.getMessages({
            spaceId,
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

          // Only include channels with mentions
          if (unreadMentions.length > 0) {
            counts[channelId] = unreadMentions.length;
          }
        }
      } catch (error) {
        console.error('[MentionCounts] Error calculating mention counts:', error);
        // Return empty counts on error - graceful degradation
        return {};
      }

      return counts;
    },
    enabled: !!userAddress && channelIds.length > 0,
    staleTime: 30000, // 30 seconds - balance between performance and real-time updates
    refetchOnWindowFocus: true,
  });

  return data || {};
}
