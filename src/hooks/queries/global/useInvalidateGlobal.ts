import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildGlobalKey } from './buildGlobalKey';

const useInvalidateGlobal = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ address }: { address: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildGlobalKey({ address }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateGlobal };
