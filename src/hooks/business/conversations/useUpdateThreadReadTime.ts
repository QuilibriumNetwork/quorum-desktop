import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface UseUpdateThreadReadTimeProps {
  spaceId: string;
}

/**
 * Mutation hook to update thread read time with proper cache invalidation.
 *
 * Saves thread read time to IndexedDB, then invalidates all notification
 * caches so counts and panels reflect the change.
 *
 * @example
 * const { mutate: updateThreadReadTime } = useUpdateThreadReadTime({ spaceId });
 * updateThreadReadTime({ threadId, channelId, timestamp: Date.now() });
 */
export function useUpdateThreadReadTime({ spaceId }: UseUpdateThreadReadTimeProps) {
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      channelId,
      timestamp,
    }: {
      threadId: string;
      channelId: string;
      timestamp: number;
    }) => {
      await messageDB.saveThreadReadTime({
        threadId,
        spaceId,
        channelId,
        lastReadTimestamp: timestamp,
      });
      return timestamp;
    },
    onSuccess: () => {
      // Invalidate all notification caches (same set as useUpdateReadTime)
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['mention-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['reply-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'space'] });
    },
    onError: (error) => {
      console.error('[useUpdateThreadReadTime] Failed to update thread read time:', error);
    },
  });
}
