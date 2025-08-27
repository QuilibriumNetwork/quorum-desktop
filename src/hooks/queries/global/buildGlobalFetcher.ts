import { QuorumApiClient } from '../../../api/baseTypes';

const buildGlobalFetcher =
  ({ apiClient, address }: { apiClient: QuorumApiClient; address: string }) =>
  async () => {
    try {
      const response = await apiClient.getUserSettings(address);

      return response.data;
    } catch (e) {
      if (e.status === 404) {
        return {};
      } else {
        throw e;
      }
    }
  };

export { buildGlobalFetcher };
