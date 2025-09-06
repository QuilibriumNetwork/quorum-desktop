import { useSuspenseInfiniteQuery } from '@tanstack/react-query';

import { buildConversationsFetcher } from './buildConversationsFetcher';
import { buildConversationsKey } from './buildConversationsKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useConversations = ({ type }: { type: 'direct' | 'group' }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseInfiniteQuery({
    initialPageParam: undefined,
    queryKey: buildConversationsKey({ type }),
    queryFn: buildConversationsFetcher({ messageDB, type }),
    getNextPageParam: (lastPage: unknown): number | undefined => {
      if ((lastPage as any).nextCursor) {
        return (lastPage as any).nextCursor;
      }
      return undefined;
    },
    getPreviousPageParam: (firstPage: unknown): number | undefined => {
      if ((firstPage as any).prevCursor) {
        return (firstPage as any).prevCursor;
      }
      return undefined;
    },
  });
};

export { useConversations };
