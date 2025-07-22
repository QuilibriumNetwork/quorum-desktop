import { QuorumDB } from '../../../db/db';
import { t } from '@lingui/core/macro';

const buildUserInfoFetcher =
  ({ messageDB, address }: { messageDB: QuorumDB; address: string }) =>
  async () => {
    try {
      const response = await messageDB.getUser({ address });

      return {
        ...response.userProfile,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        return { address, display_name: t`Unknown User` };
      } else {
        throw e;
      }
    }
  };

export { buildUserInfoFetcher };
