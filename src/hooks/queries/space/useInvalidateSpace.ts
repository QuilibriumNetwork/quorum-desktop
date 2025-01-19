import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildSpaceKey } from './buildSpaceKey';

const useInvalidateSpace = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ spaceId }: { spaceId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildSpaceKey({ spaceId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateSpace };
