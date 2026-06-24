import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { Message } from '@quilibrium/quorum-shared';
import { fetchSpaceMentions } from './fetchSpaceMentions';

export interface MentionNotification {
  message: Message;
  channelId: string;
  channelName: string;
  mentionType: 'you' | 'everyone' | 'roles';
  spaceId?: string;
  spaceName?: string;
}

interface UseAllMentionsProps {
  spaceId: string;
  channelIds: string[];
  enabledTypes?: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
  userRoleIds?: string[];
}

/**
 * Hook to fetch all unread mentions across all channels in a space
 *
 * Returns array of MentionNotification objects sorted by date (newest first)
 * Respects user's mention notification settings for the space
 *
 * @example
 * const { mentions, isLoading } = useAllMentions({
 *   spaceId,
 *   channelIds,
 *   enabledTypes: ['mention-you', 'mention-everyone'] // Optional filter (unified format)
 * });
 */
export function useAllMentions({
  spaceId,
  channelIds,
  enabledTypes,
  userRoleIds = [],
}: UseAllMentionsProps) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['mention-notifications', spaceId, userAddress, ...channelIds.sort(), ...(enabledTypes?.sort() || [])],
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

        const rows = await fetchSpaceMentions(messageDB, scoped, userAddress, {
          enabledTypes,
          userRoleIds,
          config,
        });
        rows.sort((a, b) => b.message.createdDate - a.message.createdDate);
        return rows;
      } catch (error) {
        console.error('[AllMentions] Error fetching mentions:', error);
        return [];
      }
    },
    enabled: !!userAddress && channelIds.length > 0,
    staleTime: 30000, // 30 seconds - matches useChannelMentionCounts
    refetchOnWindowFocus: true,
  });

  return {
    mentions: data || [],
    isLoading,
  };
}
