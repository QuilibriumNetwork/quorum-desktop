import { QuorumApiClient } from '../../../api/baseTypes';

const buildChannelFetcher =
  ({
    apiClient,
    spaceId,
    channelId,
  }: {
    apiClient: QuorumApiClient;
    spaceId: string;
    channelId: string;
  }) =>
  async () => {
    // const response = await apiClient.getChannel({spaceId, channelId});

    return []; //response.data;
  };

export { buildChannelFetcher };
