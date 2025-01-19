import { QuorumApiClient } from '../../../api/baseTypes';

const buildLocalizationFetcher =
  ({ apiClient, langId }: { apiClient: QuorumApiClient; langId: string }) =>
  async () => {
    const response = await apiClient.getLocalization(langId);

    return response;
  };

export { buildLocalizationFetcher };
