import { useCallback } from 'react';
import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQuorumApiClient } from '../../components/context/QuorumApiContext';
import { useInvalidateRegistration } from '../queries/registration/useInvalidateRegistration';

export const useUploadRegistration = () => {
  const { apiClient } = useQuorumApiClient();
  const invalidateRegistration = useInvalidateRegistration();

  return useCallback(
    async ({
      address,
      registration,
      timeout,
    }: {
      address: string;
      registration: channel.UserRegistration;
      /**
       * Override the client's default. Callers that are about to tear the page
       * down need the request aborted at their own deadline rather than left
       * in flight for a reload to cancel.
       */
      timeout?: number;
    }) => {
      await apiClient.postUser(address, registration, { timeout });

      invalidateRegistration({ address });
    },
    [apiClient, invalidateRegistration]
  );
};
