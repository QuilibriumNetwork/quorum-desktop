import { useSuspenseQuery } from '@tanstack/react-query';
import { buildSpaceOwnerFetcher } from './buildSpaceOwnerFetcher';
import { buildSpaceOwnerKey } from './buildSpaceOwnerKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useSpaceOwner = ({ spaceId }: { spaceId: string }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildSpaceOwnerKey({ spaceId }),
    queryFn: buildSpaceOwnerFetcher({ messageDB, spaceId }),
    refetchOnMount: true,
  });
};

export { useSpaceOwner };
