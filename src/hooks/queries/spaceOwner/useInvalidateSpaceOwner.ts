import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildSpaceOwnerKey } from './buildSpaceOwnerKey';

const useInvalidateSpaceOwner = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ spaceId }: { spaceId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildSpaceOwnerKey({ spaceId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateSpaceOwner };
