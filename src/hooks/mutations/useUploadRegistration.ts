import { useCallback } from 'react';
import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQuorumApiClient } from '../../components/context/QuorumApiContext';
import { useInvalidateRegistration } from '../queries';

export const useUploadRegistration = () => {
  const { apiClient } = useQuorumApiClient();
  const invalidateRegistration = useInvalidateRegistration();

  return useCallback(
    async ({
      address,
      registration,
    }: {
      address: string;
      registration: channel.UserRegistration;
    }) => {
      await apiClient.postUser(address, registration);

      invalidateRegistration({ address });
    },
    [apiClient, invalidateRegistration]
  );
};
