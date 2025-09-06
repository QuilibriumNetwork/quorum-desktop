import { useSuspenseInfiniteQuery } from '@tanstack/react-query';

import { buildMessagesFetcher } from './buildMessagesFetcher';
import { buildMessagesKey } from './buildMessagesKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useMessages = ({
  spaceId,
  channelId,
}: {
  spaceId: string;
  channelId: string;
}) => {
  const { messageDB } = useMessageDB();

  return useSuspenseInfiniteQuery({
    initialPageParam: undefined,
    queryKey: buildMessagesKey({ spaceId, channelId }),
    queryFn: buildMessagesFetcher({ messageDB, spaceId, channelId }),
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
