import { QuorumDB } from '../../../db/db';

const buildSpacesFetcher =
  ({ messageDB }: { messageDB: MessageDB }) =>
  async () => {
    const response = await messageDB.getSpaces();

    return response;
  };

export { buildSpacesFetcher };
