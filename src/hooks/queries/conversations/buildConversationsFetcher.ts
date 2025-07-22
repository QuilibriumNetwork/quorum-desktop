import { QuorumDB } from '../../../db/db';
import { wrapPaginatedFetcher } from '../../utils';

const buildConversationsFetcher = ({
  messageDB,
  type,
}: {
  messageDB: QuorumDB;
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
