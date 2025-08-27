import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildEncryptionStatesKey } from './buildEncryptionStatesKey';

const useInvalidateEncryptionStates = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ conversationId }: { conversationId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildEncryptionStatesKey({ conversationId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateEncryptionStates };
