import { useSuspenseQuery } from '@tanstack/react-query';

import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { buildGlobalFetcher } from './buildGlobalFetcher';
import { buildGlobalKey } from './buildGlobalKey';

const useGlobal = ({ address }: { address: string }) => {
  const { apiClient } = useQuorumApiClient();

  return useSuspenseQuery({
    queryKey: buildGlobalKey({ address }),
    queryFn: buildGlobalFetcher({ apiClient, address }),
    refetchOnMount: true,
  });
};

export { useGlobal };
