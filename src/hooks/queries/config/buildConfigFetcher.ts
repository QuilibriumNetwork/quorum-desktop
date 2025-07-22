import { QuorumDB } from '../../../db/db';

const buildConfigFetcher =
  ({ messageDB, userAddress }: { messageDB: QuorumDB; userAddress: string }) =>
  async () => {
    const response = await messageDB.getUserConfig({ address: userAddress });
    if (!response) return { address: userAddress, spaceIds: [] };
    return response;
  };

export { buildConfigFetcher };
