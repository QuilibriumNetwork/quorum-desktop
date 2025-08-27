import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildChannelKey } from './buildChannelKey';

const useInvalidateChannel = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ spaceId, channelId }: { spaceId: string; channelId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildChannelKey({ spaceId, channelId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateChannel };
