import { QuorumApiClient } from '../../../api/baseTypes';
import { QuorumDB } from '../../../db/db';

const buildEncryptionStatesFetcher =
  ({
    messageDB,
    conversationId,
  }: {
    messageDB: QuorumDB;
    conversationId: string;
  }) =>
  async () => {
    try {
      const response = await messageDB.getEncryptionStates({ conversationId });

      return {
        conversationId,
        encryptionStates: response,
      };
    } catch (e) {
      return {
        conversationId,
        encryptionStates: [],
      };
    }
  };

export { buildEncryptionStatesFetcher };
