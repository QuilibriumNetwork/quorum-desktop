import { useQuery } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';

export function useThreadMessages({
  spaceId,
  channelId,
  threadId,
  enabled = true,
}: {
  spaceId: string;
  channelId: string;
  threadId: string | null;
  enabled?: boolean;
}) {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: ['thread-messages', spaceId, channelId, threadId],
    queryFn: async () => {
      if (!threadId)
        return { messages: [], replyCount: 0, lastReplyAt: null, lastReplyBy: null };
      return messageDB.getThreadMessages({ spaceId, channelId, threadId });
    },
    enabled: enabled && !!threadId,
    networkMode: 'always',
    staleTime: 30 * 1000,
  });
}

export function useThreadStats({
  spaceId,
  channelId,
  threadId,
  enabled = true,
}: {
  spaceId: string;
  channelId: string;
  threadId: string | null;
  enabled?: boolean;
}) {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: ['thread-stats', spaceId, channelId, threadId],
    queryFn: async () => {
      if (!threadId) return { replyCount: 0, lastReplyAt: null, lastReplyBy: null };
      return messageDB.getThreadStats({ spaceId, channelId, threadId });
    },
    enabled: enabled && !!threadId,
    networkMode: 'always',
    staleTime: 30 * 1000,
  });
}
