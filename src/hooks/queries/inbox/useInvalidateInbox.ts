import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildInboxKey } from './buildInboxKey';

const useInvalidateInbox = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ addresses }: { addresses: string[] }) => {
      return queryClient.invalidateQueries(
        {
          queryKey: buildInboxKey({ addresses }),
        },
        { cancelRefetch: true }
      );
    },
    [queryClient]
  );
};

export { useInvalidateInbox };
