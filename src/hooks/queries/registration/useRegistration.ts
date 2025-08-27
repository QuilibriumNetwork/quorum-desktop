import { useSuspenseQuery } from '@tanstack/react-query';

import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { buildRegistrationFetcher } from './buildRegistrationFetcher';
import { buildRegistrationKey } from './buildRegistrationKey';

const useRegistration = ({ address }: { address: string }) => {
  const { apiClient } = useQuorumApiClient();

  return useSuspenseQuery({
    queryKey: buildRegistrationKey({ address }),
    queryFn: buildRegistrationFetcher({ apiClient, address }),
    refetchOnMount: true,
  });
};

export { useRegistration };
