import { MessageDB } from '../../../db/messages';

const buildSpacesFetcher =
  ({ messageDB }: { messageDB: MessageDB }) =>
  async () => {
    const response = await messageDB.getSpaces();

    return response;
  };

export { buildSpacesFetcher };
