import { useSuspenseQuery } from '@tanstack/react-query';
import { buildSpaceFetcher } from './buildSpaceFetcher';
import { buildSpaceKey } from './buildSpaceKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useSpace = ({ spaceId }: { spaceId: string }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildSpaceKey({ spaceId }),
    queryFn: buildSpaceFetcher({ messageDB, spaceId }),
    refetchOnMount: true,
  });
};

export { useSpace };
