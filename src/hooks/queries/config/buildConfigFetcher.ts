import { MessageDB } from '../../../db/messages';

const buildConfigFetcher =
  ({ messageDB, userAddress }: { messageDB: MessageDB; userAddress: string }) =>
  async () => {
    const response = await messageDB.getUserConfig({ address: userAddress });
    if (!response) return { address: userAddress, spaceIds: [] };
    return response;
  };

export { buildConfigFetcher };
