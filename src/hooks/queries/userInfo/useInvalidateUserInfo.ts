import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildUserInfoKey } from './buildUserInfoKey';

const useInvalidateUserInfo = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ address }: { address: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildUserInfoKey({ address }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateUserInfo };
