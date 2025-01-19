import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildRegistrationKey } from './buildRegistrationKey';

const useInvalidateRegistration = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ address }: { address: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildRegistrationKey({ address }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateRegistration };
