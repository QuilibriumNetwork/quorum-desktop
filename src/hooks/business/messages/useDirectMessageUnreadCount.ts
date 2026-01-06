import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig } from '../../queries/config';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useDmReadState } from '../../../context/DmReadStateContext';

/**
 * Hook to get total count of unread Direct Message conversations
 *
 * Returns the number of DM conversations that have unread messages.
 * This count is used for the NavMenu Direct Messages icon indicator.
 *
 * Uses the existing DM unread logic: (c.lastReadTimestamp ?? 0) < c.timestamp
 * where c.timestamp represents the last message timestamp in the conversation.
 *
 * Also considers the DmReadStateContext for immediate UI updates when
 * "mark all as read" is triggered.
 */
export function useDirectMessageUnreadCount(): number {
  const user = usePasskeysContext();
  const userAddress = user.currentPasskeyInfo?.address;
  const { data: config } = useConfig({ userAddress: userAddress || '' });
  const { messageDB } = useMessageDB();
  const { markAllReadTimestamp } = useDmReadState();

  // Create muted set for filtering
  const mutedSet = new Set(config?.mutedConversations || []);

  const { data } = useQuery({
    // Query key for DM unread count
    queryKey: ['unread-counts', 'direct-messages', userAddress],
    queryFn: async () => {
      if (!userAddress) return 0;

      try {
        // Fetch directly from DB to get fresh data
        const { conversations } = await messageDB.getConversations({ type: 'direct' });

        // Count conversations with unread messages using existing logic
        // This matches the logic used in DirectMessageContactsList.tsx
        // Excludes muted conversations from the count
        let unreadCount = 0;
        for (const conversation of conversations) {
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
    enabled: !!userAddress && !!messageDB,
    staleTime: 90000, // 90 seconds (1.5 minutes) - reduces query frequency while maintaining reasonable UX
    refetchOnWindowFocus: true, // Immediate updates when user returns to app
  });

  // If mark-all-read is active, return 0 immediately (context-based override)
  if (markAllReadTimestamp) {
    return 0;
  }

  return data || 0;
}
