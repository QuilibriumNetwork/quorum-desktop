import { MessageDB } from '../../../db/messages';
import { wrapPaginatedFetcher } from '../../utils';

const buildConversationsFetcher = ({
  messageDB,
  type,
}: {
  messageDB: MessageDB;
  type: 'direct' | 'group';
}) =>
  wrapPaginatedFetcher(async ({ pageParam: cursor }) => {
    const response = await messageDB.getConversations({
      type,
      cursor,
    });

    return response;
  });

export { buildConversationsFetcher };
