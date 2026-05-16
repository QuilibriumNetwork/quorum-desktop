import { MessageDB } from '../../../db/messages';

const buildUserNoteFetcher =
  ({ messageDB, targetAddress }: { messageDB: MessageDB; targetAddress: string }) =>
  async () => {
    return (await messageDB.getUserNote(targetAddress)) ?? null;
  };

export { buildUserNoteFetcher };
