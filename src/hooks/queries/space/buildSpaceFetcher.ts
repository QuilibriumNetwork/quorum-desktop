import { QuorumDB } from '../../../db/db';

const buildSpaceFetcher =
  ({ messageDB, spaceId }: { messageDB: QuorumDB; spaceId: string }) =>
  async () => {
    const response = await messageDB.getSpace(spaceId);

    return response;
  };

export { buildSpaceFetcher };
