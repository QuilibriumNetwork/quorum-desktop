import { useQuery } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { ChannelThread } from '@quilibrium/quorum-shared';

export function useChannelThreads({
  spaceId,
  channelId,
  enabled = true,
}: {
  spaceId: string;
  channelId: string;
  enabled?: boolean;
}) {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: ['channel-threads', spaceId, channelId],
    queryFn: async (): Promise<ChannelThread[]> => {
      const threads = await messageDB.getChannelThreads({ spaceId, channelId });
      return [...threads].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    },
    enabled,
    networkMode: 'always',
    staleTime: 30 * 1000,
  });
}
