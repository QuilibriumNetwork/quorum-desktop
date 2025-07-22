import { QuorumDB } from '../../../db/db';

const buildConversationFetcher =
  ({
    messageDB,
    conversationId,
  }: {
    messageDB: QuorumDB;
    conversationId: string;
  }) =>
  async () => {
    const response = await messageDB.getConversation({
      conversationId,
    });
    return response;
  };

export { buildConversationFetcher };
