import { useSuspenseQuery } from '@tanstack/react-query';
import { buildSpaceFetcher } from './buildSpaceFetcher';
import { buildSpaceKey } from './buildSpaceKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useSpace = ({ spaceId, enabled = true }: { spaceId: string; enabled?: boolean }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildSpaceKey({ spaceId }),
    queryFn: enabled ? buildSpaceFetcher({ messageDB, spaceId }) : () => null,
    refetchOnMount: true,
    networkMode: 'always', // This query uses IndexedDB, not network
  });
};

export { useSpace };
