import { useConversations } from '../../queries/conversations/useConversations';

/**
 * Custom hook for managing conversations data and display logic
 * Handles data fetching and processing for empty direct message screen
 */
export const useConversationsData = () => {
  const { data: conversations, ...rest } = useConversations({ type: 'direct' });

  // Process conversations for display logic
  const conversationsList = conversations?.pages?.flatMap((p: any) => p.conversations) || [];
  const hasConversations = conversationsList.length > 0;

  return {
    conversations,
    conversationsList,
    hasConversations,
    ...rest,
  };
};