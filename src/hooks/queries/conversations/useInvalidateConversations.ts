import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildConversationsKey } from './buildConversationsKey';

const useInvalidateConversations = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ type }: { type: 'direct' | 'group' }) => {
      return queryClient.invalidateQueries({
        queryKey: buildConversationsKey({ type }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateConversations };
