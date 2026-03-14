import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildMessagesKeyPrefix } from './buildMessagesKey';

const useInvalidateMessages = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ spaceId, channelId }: { spaceId: string; channelId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildMessagesKeyPrefix({ spaceId, channelId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateMessages };
