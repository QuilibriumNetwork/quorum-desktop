import { logger } from '@quilibrium/quorum-shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Conversation } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { generateMessagePreview } from '../../../utils/messagePreview';

export function useConversationPreviews(conversations: Conversation[]) {
  const { messageDB } = useMessageDB();

  // Create a stable reference for the query key - only changes when lastMessageIds change
  const messageIdMap = useMemo(
    () => Object.fromEntries(conversations.map((c) => [c.conversationId, c.lastMessageId])),
    [conversations.map((c) => `${c.conversationId}:${c.lastMessageId}`).join(',')]
  );

  return useQuery({
    queryKey: ['conversation-previews', messageIdMap],
    queryFn: async () => {
      // Batch fetch all messages for better performance
      const previewPromises = conversations.map(async (conv) => {
        if (!conv.lastMessageId) return { ...conv, preview: '', previewIcon: undefined };

        try {
          // Extract spaceId and channelId from conversationId (format: "spaceId/channelId")
          const [spaceId, channelId] = conv.conversationId.split('/');

          const message = await messageDB.getMessage({
            spaceId,
            channelId,
            messageId: conv.lastMessageId,
          });

          const previewData = generateMessagePreview(message);
          return { ...conv, preview: previewData.text, previewIcon: previewData.icon };
        } catch (error) {
          logger.warn('Failed to load preview:', conv.conversationId, error);
          return { ...conv, preview: '', previewIcon: undefined };
        }
      });

      // Execute all queries in parallel with a limit to avoid overwhelming IndexedDB
      // Process in chunks of 10 to balance performance and avoid browser limits
      const results = [];
      for (let i = 0; i < previewPromises.length; i += 10) {
        const chunk = await Promise.all(previewPromises.slice(i, i + 10));
        results.push(...chunk);
      }
      return results;
    },
    enabled: conversations.length > 0 && !!messageDB,
    staleTime: 30000, // 30 seconds - prevents refetch on focus/mount
    gcTime: 300000, // 5 minutes - keep in cache longer for better performance
    refetchOnWindowFocus: false, // Prevent refetch when user switches tabs
  });
}
