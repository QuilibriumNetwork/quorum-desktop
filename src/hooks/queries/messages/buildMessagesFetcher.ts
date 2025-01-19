import { MessageDB } from '../../../db/messages';
import { wrapPaginatedFetcher } from '../../utils';

const buildMessagesFetcher = ({
  messageDB,
  spaceId,
  channelId,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
}) =>
  wrapPaginatedFetcher(async ({ pageParam: cursor }) => {
    const response = await messageDB.getMessages({
      spaceId,
      channelId,
      cursor: cursor?.cursor,
      direction: cursor?.direction,
    });

    return response;
  });

export { buildMessagesFetcher };
