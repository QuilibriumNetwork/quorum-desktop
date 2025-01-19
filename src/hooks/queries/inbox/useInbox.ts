import { useSuspenseQuery } from '@tanstack/react-query';

import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { buildInboxFetcher } from './buildInboxFetcher';
import { buildInboxKey } from './buildInboxKey';

const useInbox = ({ addresses }: { addresses: string[] }) => {
  const { apiClient } = useQuorumApiClient();

  return useSuspenseQuery({
    queryKey: buildInboxKey({ addresses }),
    queryFn: buildInboxFetcher({ apiClient, addresses }),
    refetchOnMount: true,
  });
};

export { useInbox };
