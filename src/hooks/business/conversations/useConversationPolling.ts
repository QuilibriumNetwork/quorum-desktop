import { useEffect } from 'react';
import { useConversations } from '../../queries/conversations/useConversations';

/**
 * Custom hook for managing conversation polling and data processing
 * Handles periodic conversation updates and data transformation
 */
export function useConversationPolling() {
  const { 
    data: conversations, 
    refetch: refetchConversations 
  } = useConversations({ type: 'direct' });

  // Set up periodic polling for conversation updates
  useEffect(() => {
    const pollInterval = setInterval(() => {
      refetchConversations({ cancelRefetch: true });
    }, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [refetchConversations]);

  // Process and sort conversations data
  const processedConversations = [
    ...conversations.pages.flatMap((c: any) => c.conversations),
  ]
    .filter((c) => c)
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    conversations: processedConversations,
    refetchConversations,
  };
}