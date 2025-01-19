import { MessageDB } from '../../../db/messages';

const buildUserInfoFetcher =
  ({ messageDB, address }: { messageDB: MessageDB; address: string }) =>
  async () => {
    try {
      const response = await messageDB.getUser({ address });

      return {
        ...response.userProfile,
      };
    } catch (e) {
      if (e.status === 404) {
        return { address };
      } else {
        throw e;
      }
    }
  };

export { buildUserInfoFetcher };
