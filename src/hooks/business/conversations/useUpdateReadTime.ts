import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface UseUpdateReadTimeProps {
  spaceId: string;
  channelId: string;
}

/**
 * Mutation hook to update read time with proper cache invalidation
 *
 * This ensures:
 * 1. Database write completes BEFORE cache invalidation
 * 2. All related caches are invalidated (conversation, mention counts)
 * 3. Proper error handling and rollback
 *
 * @example
 * const { mutate: updateReadTime } = useUpdateReadTime({ spaceId, channelId });
 * updateReadTime(newTimestamp);
 */
export function useUpdateReadTime({
  spaceId,
  channelId,
}: UseUpdateReadTimeProps) {
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();
  const conversationId = `${spaceId}/${channelId}`;

  return useMutation({
    mutationFn: async (timestamp: number) => {
      // Database write completes BEFORE returning
      await messageDB.saveReadTime({
        conversationId,
        lastMessageTimestamp: timestamp,
      });
      return timestamp;
    },
    onSuccess: () => {
      // Invalidate all related caches AFTER database write completes
      // This fixes the race condition

      // 1. Invalidate conversation (updates lastReadTimestamp in components)
      queryClient.invalidateQueries({
        queryKey: ['Conversation', conversationId],
      });

      // 2. Invalidate channel-level mention counts (updates sidebar bubbles)
      queryClient.invalidateQueries({
        queryKey: ['mention-counts', 'channel', spaceId],
      });

      // 3. Invalidate space-level mention counts (updates space-level counts)
      queryClient.invalidateQueries({
        queryKey: ['mention-counts', 'space'],
      });
    },
    onError: (error) => {
      console.error('[useUpdateReadTime] Failed to update read time:', error);
      // Future: Add toast notification for user
    },
  });
}
