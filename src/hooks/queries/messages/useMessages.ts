import { useSuspenseInfiniteQuery } from '@tanstack/react-query';

import { buildMessagesFetcher } from './buildMessagesFetcher';
import { buildMessagesKey } from './buildMessagesKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useMessages = ({
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}) => {
  const { messageDB } = useMessageDB();

  return useSuspenseInfiniteQuery({
    initialPageParam: undefined,
    queryKey: buildMessagesKey({ spaceId, channelId, includeThreadReplies }),
    queryFn: buildMessagesFetcher({ messageDB, spaceId, channelId, includeThreadReplies }),
    networkMode: 'always', // This query uses IndexedDB, not network
    staleTime: 0, // Always re-fetch from IndexedDB on mount — local reads are fast
    gcTime: 10 * 60 * 1000, // 10 minutes - prevent cache eviction while offline
    getNextPageParam: (
      lastPage: unknown
    ):
      | {
          cursor: number | undefined;
          direction: 'forward' | 'backward' | undefined;
        }
      | undefined => {
      if ((lastPage as any).nextCursor) {
        return { cursor: (lastPage as any).nextCursor, direction: 'forward' };
      }
      return undefined;
    },
    getPreviousPageParam: (
      firstPage: unknown
    ):
      | {
          cursor: number | undefined;
          direction: 'forward' | 'backward' | undefined;
        }
      | undefined => {
      if ((firstPage as any).prevCursor) {
        return { cursor: (firstPage as any).prevCursor, direction: 'backward' };
      }
      return undefined;
    },
  });
};

export { useMessages };
