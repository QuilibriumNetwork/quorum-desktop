import { useQuery } from '@tanstack/react-query';
import { buildMutedUsersFetcher } from './buildMutedUsersFetcher';
import { buildMutedUsersKey } from './buildMutedUsersKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useMutedUsers = ({ spaceId }: { spaceId: string }) => {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: buildMutedUsersKey({ spaceId }),
    queryFn: buildMutedUsersFetcher({ messageDB, spaceId }),
    staleTime: Infinity, // Mute state is invalidated manually when mute/unmute messages are received
    enabled: !!spaceId,
  });
};

export { useMutedUsers };
