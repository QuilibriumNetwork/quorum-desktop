import { QuorumApiClient } from '../../../api/baseTypes';

const buildRegistrationFetcher =
  ({ apiClient, address }: { apiClient: QuorumApiClient; address: string }) =>
  async () => {
    try {
      const response = await apiClient.getUser(address);

      return {
        registration: response.data,
        registered: true,
      };
    } catch (e) {
      if (e.status === 404) {
        return { registered: false };
      } else {
        throw e;
      }
    }
  };

export { buildRegistrationFetcher };
