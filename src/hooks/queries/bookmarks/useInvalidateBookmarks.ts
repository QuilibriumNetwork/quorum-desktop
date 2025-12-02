import { useQueryClient } from '@tanstack/react-query';
import { buildBookmarksKey } from './buildBookmarksKey';

const useInvalidateBookmarks = () => {
  const queryClient = useQueryClient();

  return ({ userAddress }: { userAddress: string }) => {
    queryClient.invalidateQueries({
      queryKey: buildBookmarksKey({ userAddress }),
    });
  };
};

export { useInvalidateBookmarks };