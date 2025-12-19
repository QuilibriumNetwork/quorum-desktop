import { useQuery } from '@tanstack/react-query';

import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { buildRegistrationFetcher } from './buildRegistrationFetcher';
import { buildRegistrationKey } from './buildRegistrationKey';

/**
 * Non-suspense version of useRegistration for offline-resilient components.
 * Returns undefined when offline or when the API call fails, allowing
 * components to render with fallback data instead of suspending indefinitely.
 */
const useRegistrationOptional = ({ address }: { address: string }) => {
  const { apiClient } = useQuorumApiClient();

  return useQuery({
    queryKey: buildRegistrationKey({ address }),
    queryFn: buildRegistrationFetcher({ apiClient, address }),
    networkMode: 'always', // Allow query to run offline (will fail gracefully)
    staleTime: Infinity, // Don't refetch if we have data
    gcTime: Infinity, // Keep in cache forever
    retry: false, // Don't retry failed requests when offline
  });
};

export { useRegistrationOptional };
