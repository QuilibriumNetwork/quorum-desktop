import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface UseChannelUnreadCountsProps {
  spaceId: string;
  channelIds: string[];
}

/**
 * Hook to check for unread messages in channels
 *
 * Returns a map of channelId -> 1 (has unreads) or 0 (no unreads) for channels
 * where there are unread messages.
 * Only channels with unreads are included in the result.
 *
 * Uses the elegant DM approach: compares conversation.lastReadTimestamp with
 * conversation.timestamp (which is auto-updated on every message save).
 * This is O(1) per channel instead of O(n) cursor iteration.
 *
 * The hook:
 * 1. Gets conversation record for each channel
 * 2. Compares lastReadTimestamp < timestamp
 * 3. Returns binary indicator (1 for has unreads, 0 for no unreads)
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

          // Get conversation record (single O(1) lookup)
          const { conversation } = await messageDB.getConversation({
            conversationId,
          });

          if (!conversation) continue;

          // Simple timestamp comparison (DM approach)
          // conversation.timestamp = auto-updated on every message save
          // conversation.lastReadTimestamp = updated via useUpdateReadTime
          const lastReadTimestamp = conversation.lastReadTimestamp || 0;
          const lastMessageTimestamp = conversation.timestamp;

          const hasUnreads = lastReadTimestamp < lastMessageTimestamp;

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
