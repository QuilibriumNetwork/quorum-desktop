import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface UseChannelUnreadCountsProps {
  spaceId: string;
  channelIds: string[];
}

// Early-exit threshold: Stop counting after 1 unread message
// (We only need boolean indicator - has unreads vs no unreads)
const BOOLEAN_THRESHOLD = 1;

/**
 * Hook to check for unread messages in channels
 *
 * Returns a map of channelId -> 1 (has unreads) or 0 (no unreads) for channels
 * where there are unread messages (messages newer than lastReadTimestamp).
 * Only channels with unreads are included in the result.
 *
 * The hook:
 * 1. Gets the last read timestamp for each channel from conversations
 * 2. Queries messages after that timestamp
 * 3. Returns binary indicator (1 for has unreads, 0 for no unreads)
 * 4. Uses early exit for performance - stops at first unread message found
 *
 * Uses React Query with 90s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 *
 * This is separate from the mention system and tracks general message read state.
 */
export function useChannelUnreadCounts({
  spaceId,
  channelIds,
}: UseChannelUnreadCountsProps): Record<string, number> {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data } = useQuery({
    // Query key includes all channelIds so it invalidates when channels change
    // Can be invalidated at space level ['unread-counts', 'channel', spaceId] or
    // more broadly ['unread-counts', 'channel'] for all channels
    queryKey: [
      'unread-counts',
      'channel',
      spaceId,
      userAddress,
      ...channelIds.sort(),
    ],
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

          // Use optimized database method to check for unread messages
          // This is much more efficient than fetching and filtering messages
          const hasUnreads = await messageDB.hasUnreadMessages({
            spaceId,
            channelId,
            afterTimestamp: lastReadTimestamp,
          });

          // Only include channels with unreads (binary indicator)
          if (hasUnreads) {
            counts[channelId] = 1; // Binary: 1 = has unreads, 0 = no unreads
          }
        }
      } catch (error) {
        console.error(
          '[ChannelUnreadCounts] Error calculating unread counts:',
          error
        );
        // Return empty counts on error - graceful degradation
        return {};
      }

      return counts;
    },
    enabled: !!userAddress && channelIds.length > 0,
    staleTime: 90000, // 90 seconds (1.5 minutes) - reduces query frequency while maintaining reasonable UX
    refetchOnWindowFocus: true, // Immediate updates when user returns to app
  });

  return data || {};
}
