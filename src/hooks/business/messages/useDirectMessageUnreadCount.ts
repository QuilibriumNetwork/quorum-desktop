import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConversations } from '../../queries/conversations/useConversations';
import { useConfig } from '../../queries/config';

/**
 * Hook to get total count of unread Direct Message conversations
 *
 * Returns the number of DM conversations that have unread messages.
 * This count is used for the NavMenu Direct Messages icon indicator.
 *
 * Uses the existing DM unread logic: (c.lastReadTimestamp ?? 0) < c.timestamp
 * where c.timestamp represents the last message timestamp in the conversation.
 *
 * Uses React Query with 90s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 */
export function useDirectMessageUnreadCount(): number {
  const user = usePasskeysContext();
  const userAddress = user.currentPasskeyInfo?.address;
  const { data: conversations } = useConversations({ type: 'direct' });
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  // Create muted set for filtering
  const mutedSet = new Set(config?.mutedConversations || []);

  const { data } = useQuery({
    // Query key for DM unread count - include config dependency for mute changes
    queryKey: ['unread-counts', 'direct-messages', userAddress],
    queryFn: async () => {
      if (!userAddress) return 0;

      try {
        // Get all DM conversations from all pages
        const conversationsList =
          conversations?.pages?.flatMap((p: any) => p.conversations) || [];

        // Count conversations with unread messages using existing logic
        // This matches the logic used in DirectMessageContactsList.tsx
        // Excludes muted conversations from the count
        let unreadCount = 0;
        for (const conversation of conversationsList) {
          // Skip muted conversations
          if (mutedSet.has(conversation.conversationId)) continue;

          const isUnread =
            (conversation.lastReadTimestamp ?? 0) < conversation.timestamp;
          if (isUnread) {
            unreadCount++;
          }
        }

        return unreadCount;
      } catch (error) {
        console.error(
          '[DirectMessageUnreadCount] Error calculating unread count:',
          error
        );
        // Return 0 on error - graceful degradation
        return 0;
      }
    },
    enabled: !!userAddress && !!conversations,
    staleTime: 90000, // 90 seconds (1.5 minutes) - reduces query frequency while maintaining reasonable UX
    refetchOnWindowFocus: true, // Immediate updates when user returns to app
  });

  return data || 0;
}
