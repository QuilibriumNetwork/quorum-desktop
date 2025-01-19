import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildLocalizationKey } from './buildLocalizationKey';

const useInvalidateLocalization = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ langId }: { langId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildLocalizationKey({ langId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateLocalization };
