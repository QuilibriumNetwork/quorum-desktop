import { useSuspenseQuery } from '@tanstack/react-query';
import { buildConfigFetcher } from './buildConfigFetcher';
import { buildConfigKey } from './buildConfigKey';
import { useMessageDB } from '../../../components/context/MessageDB';

const useConfig = ({ userAddress }: { userAddress: string }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildConfigKey({ userAddress }),
    queryFn: buildConfigFetcher({ messageDB, userAddress }),
    refetchOnMount: true,
  });
};

export { useConfig };
