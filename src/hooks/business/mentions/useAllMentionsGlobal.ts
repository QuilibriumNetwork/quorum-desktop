import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { getUserRoles } from '@quilibrium/quorum-shared';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { fetchSpaceMentions } from './fetchSpaceMentions';
import type { MentionNotification } from './useAllMentions';
import { GLOBAL_PER_CHANNEL_LIMIT } from '../notifications/constants';

interface Props {
  spaces: Space[];
  enabledTypes?: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
}

/**
 * Aggregate unread mentions across ALL spaces (global notification panel).
 * Loops every space, delegates per-space gating to `fetchSpaceMentions`, then
 * sorts the merged set newest-first. Each space's contribution is bounded by
 * `GLOBAL_PER_CHANNEL_LIMIT` to keep memory in check for heavy users; the
 * composition hook applies the final display cap.
 */
export function useAllMentionsGlobal({ spaces, enabledTypes }: Props) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['mention-notifications', 'global', userAddress, ...spaces.map((s) => s.spaceId).sort(), ...(enabledTypes?.slice().sort() || [])],
    queryFn: async () => {
      if (!userAddress) return [] as MentionNotification[];
      const config = await messageDB.getUserConfig({ address: userAddress });
      const all: MentionNotification[] = [];
      for (const space of spaces) {
        const userRoleIds = getUserRoles(userAddress, space).map((r) => r.roleId);
        const rows = await fetchSpaceMentions(messageDB, space, userAddress, {
          enabledTypes,
          userRoleIds,
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

  return { mentions: data || [], isLoading };
}
