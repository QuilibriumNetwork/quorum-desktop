import { MessageDB } from '../../../db/messages';

const buildConversationFetcher =
  ({
    messageDB,
    conversationId,
  }: {
    messageDB: MessageDB;
    conversationId: string;
  }) =>
  async () => {
    const response = await messageDB.getConversation({
      conversationId,
    });
    return response;
  };

export { buildConversationFetcher };
