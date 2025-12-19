import { useQuery } from '@tanstack/react-query';
import { buildBookmarksFetcher } from './buildBookmarksFetcher';
import { buildBookmarksKey } from './buildBookmarksKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useBookmarks = ({ userAddress }: { userAddress: string }) => {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: buildBookmarksKey({ userAddress }),
    queryFn: buildBookmarksFetcher({ messageDB }),
    staleTime: 30000, // Cache for 30 seconds
    networkMode: 'always', // This query uses IndexedDB, not network
  });
};

export { useBookmarks };