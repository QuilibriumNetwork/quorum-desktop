import { QuorumApiClient } from '../../../api/baseTypes';
import { MessageDB } from '../../../db/messages';

const buildEncryptionStatesFetcher =
  ({
    messageDB,
    conversationId,
  }: {
    messageDB: MessageDB;
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
