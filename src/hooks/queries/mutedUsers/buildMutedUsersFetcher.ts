import { MessageDB } from '../../../db/messages';

const buildMutedUsersFetcher =
  ({ messageDB, spaceId }: { messageDB: MessageDB; spaceId: string }) =>
  async () => {
    return await messageDB.getMutedUsers(spaceId);
  };

export { buildMutedUsersFetcher };
