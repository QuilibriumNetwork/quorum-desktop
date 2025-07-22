import { QuorumDB } from '../../../db/db';

const buildSpaceOwnerFetcher =
  ({ messageDB, spaceId }: { messageDB: QuorumDB; spaceId: string }) =>
  async () => {
    const response = await messageDB.getSpaceKey(spaceId, 'owner');

    return !!response;
  };

export { buildSpaceOwnerFetcher };
