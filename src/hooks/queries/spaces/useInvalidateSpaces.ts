import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildSpacesKey } from './buildSpacesKey';

const useInvalidateSpaces = () => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: buildSpacesKey({}),
    });
  }, [queryClient]);
};

export { useInvalidateSpaces };
