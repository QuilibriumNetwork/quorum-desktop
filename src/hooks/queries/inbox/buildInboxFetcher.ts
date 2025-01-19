import { QuorumApiClient } from '../../../api/baseTypes';
import { SealedMessage } from '../../../channel/channel';

const buildInboxFetcher =
  ({
    apiClient,
    addresses,
  }: {
    apiClient: QuorumApiClient;
    addresses: string[];
  }) =>
  async () => {
    try {
      const response = (
        await Promise.all(addresses.map((a) => apiClient.getInbox(a)))
      ).flatMap((r) => r.data);

      return response;
    } catch (e) {
      if (e.status === 404) {
        return [] as (SealedMessage & {
          timestamp: number;
        })[];
      } else {
        throw e;
      }
    }
  };

export { buildInboxFetcher };
