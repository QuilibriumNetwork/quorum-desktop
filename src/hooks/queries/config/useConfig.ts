import { useSuspenseQuery } from '@tanstack/react-query';
import { buildConfigFetcher } from './buildConfigFetcher';
import { buildConfigKey } from './buildConfigKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useConfig = ({ userAddress }: { userAddress: string }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildConfigKey({ userAddress }),
    queryFn: buildConfigFetcher({ messageDB, userAddress }),
    refetchOnMount: true,
    networkMode: 'always', // This query uses IndexedDB, not network
  });
};

export { useConfig };
