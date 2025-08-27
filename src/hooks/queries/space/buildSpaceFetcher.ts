import { MessageDB } from '../../../db/messages';

const buildSpaceFetcher =
  ({ messageDB, spaceId }: { messageDB: MessageDB; spaceId: string }) =>
  async () => {
    const response = await messageDB.getSpace(spaceId);

    return response;
  };

export { buildSpaceFetcher };
