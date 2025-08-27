import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildMessagesKey } from './buildMessagesKey';

const useInvalidateMessages = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ spaceId, channelId }: { spaceId: string; channelId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildMessagesKey({ spaceId, channelId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateMessages };
