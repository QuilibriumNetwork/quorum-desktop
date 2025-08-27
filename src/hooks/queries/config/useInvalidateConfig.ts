import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildConfigKey } from './buildConfigKey';

const useInvalidateConfig = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ userAddress }: { userAddress: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildConfigKey({ userAddress }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateConfig };
