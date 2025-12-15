import { useQueryClient } from '@tanstack/react-query';
import { buildMutedUsersKey } from './buildMutedUsersKey';

const useInvalidateMutedUsers = () => {
  const queryClient = useQueryClient();

  return ({ spaceId }: { spaceId: string }) => {
    queryClient.invalidateQueries({
      queryKey: buildMutedUsersKey({ spaceId }),
    });
  };
};

export { useInvalidateMutedUsers };
