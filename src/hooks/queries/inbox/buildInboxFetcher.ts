import { QuorumApiClient } from '../../../api/baseTypes';
import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
type SealedMessage = channel.SealedMessage;

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
      if ((e as any).status === 404) {
        return [] as (SealedMessage & {
          timestamp: number;
        })[];
      } else {
        throw e;
      }
    }
  };

export { buildInboxFetcher };
