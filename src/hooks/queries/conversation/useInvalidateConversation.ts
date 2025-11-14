import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildConversationKey } from './buildConversationKey';

const useInvalidateConversation = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ conversationId }: { conversationId: string }) => {
      // Invalidate conversation data
      queryClient.invalidateQueries({
        queryKey: buildConversationKey({ conversationId }),
      });
      // Invalidate conversation previews to refresh message previews
      queryClient.invalidateQueries({
        queryKey: ['conversation-previews'],
      });
    },
    [queryClient]
  );
};

export { useInvalidateConversation };
