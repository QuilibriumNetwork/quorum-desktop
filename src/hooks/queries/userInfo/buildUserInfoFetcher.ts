import { MessageDB } from '../../../db/messages';
import { t } from '@lingui/core/macro';

const buildUserInfoFetcher =
  ({ messageDB, address }: { messageDB: MessageDB; address: string }) =>
  async () => {
    try {
      const response = await messageDB.getUser({ address });

      return {
        ...response.userProfile,
      };
    } catch (e) {
      if (e instanceof Error && 'status' in e && e.status === 404) {
        return { address, display_name: t`Unknown User` };
      } else {
        throw e;
      }
    }
  };

export { buildUserInfoFetcher };
