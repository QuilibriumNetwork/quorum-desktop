import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { fetchSpaceReplies } from './fetchSpaceReplies';

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
      try {
        const config = await messageDB.getUserConfig({ address: userAddress });
        const space = await messageDB.getSpace(spaceId);
        if (!space) return [];

        // Preserve the explicit channelIds contract: scope the space's channels
        // down to the channelIds the caller passed (may be a subset).
        const allowed = new Set(channelIds);
        const scoped = {
          ...space,
          groups: space.groups.map((g) => ({
            ...g,
            channels: g.channels.filter((c) => allowed.has(c.channelId)),
          })),
        };

        const rows = await fetchSpaceReplies(messageDB, scoped, userAddress, {
          enabled: enabled as boolean,
          config,
        });
        rows.sort((a, b) => b.message.createdDate - a.message.createdDate);
        return rows;
      } catch (error) {
        console.error('[AllReplies] Error fetching replies:', error);
        return [];
      }
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
