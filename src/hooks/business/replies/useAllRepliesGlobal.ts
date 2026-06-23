import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { fetchSpaceReplies } from './fetchSpaceReplies';
import type { ReplyNotification } from '../../../types/notifications';
import { GLOBAL_PER_CHANNEL_LIMIT } from '../notifications/constants';

interface Props {
  spaces: Space[];
  enabled: boolean;
}

/**
 * Aggregate unread replies across ALL spaces (global notification panel).
 * Loops every space, delegates per-space gating to `fetchSpaceReplies`, then
 * sorts the merged set newest-first. Each space's contribution is bounded by
 * `GLOBAL_PER_CHANNEL_LIMIT`; the composition hook applies the final display cap.
 */
export function useAllRepliesGlobal({ spaces, enabled }: Props) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['reply-notifications', 'global', userAddress, ...spaces.map((s) => s.spaceId).sort(), enabled],
    queryFn: async () => {
      if (!userAddress) return [] as (ReplyNotification & { spaceId: string; spaceName: string })[];
      const config = await messageDB.getUserConfig({ address: userAddress });
      const all: (ReplyNotification & { spaceId: string; spaceName: string })[] = [];
      for (const space of spaces) {
        const rows = await fetchSpaceReplies(messageDB, space, userAddress, {
          enabled,
          config,
          perChannelLimit: GLOBAL_PER_CHANNEL_LIMIT,
        });
        all.push(...rows);
      }
      all.sort((a, b) => b.message.createdDate - a.message.createdDate);
      return all;
    },
    enabled: !!userAddress && spaces.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  return { replies: data || [], isLoading };
}
