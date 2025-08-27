import { MessageDB } from '../../../db/messages';

const buildSpaceOwnerFetcher =
  ({ messageDB, spaceId }: { messageDB: MessageDB; spaceId: string }) =>
  async () => {
    const response = await messageDB.getSpaceKey(spaceId, 'owner');

    return !!response;
  };

export { buildSpaceOwnerFetcher };
