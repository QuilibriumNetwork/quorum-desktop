import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildConversationKey } from './buildConversationKey';

const useInvalidateConversation = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ conversationId }: { conversationId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildConversationKey({ conversationId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateConversation };
