import { useSuspenseQuery } from '@tanstack/react-query';

import { buildSpaceMembersFetcher } from './buildSpaceMembersFetcher';
import { buildSpaceMembersKey } from './buildSpaceMembersKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useSpaceMembers = ({ spaceId }: { spaceId: string }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildSpaceMembersKey({ spaceId }),
    queryFn: buildSpaceMembersFetcher({ spaceId, messageDB }),
    refetchOnMount: true,
    networkMode: 'always', // This query uses IndexedDB, not network
  });
};

export { useSpaceMembers };
