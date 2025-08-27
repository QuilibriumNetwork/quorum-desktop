import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { buildSpaceMembersKey } from './buildSpaceMembersKey';

const useInvalidateSpaceMembers = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ spaceId }: { spaceId: string }) => {
      return queryClient.invalidateQueries({
        queryKey: buildSpaceMembersKey({ spaceId }),
      });
    },
    [queryClient]
  );
};

export { useInvalidateSpaceMembers };
