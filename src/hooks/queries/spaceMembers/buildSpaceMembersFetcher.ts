import { MessageDB } from '../../../db/messages';

const buildSpaceMembersFetcher =
  ({ spaceId, messageDB }: { spaceId: string; messageDB: MessageDB }) =>
  async () => {
    const response = await messageDB.getSpaceMembers(spaceId);

    return response;
  };

export { buildSpaceMembersFetcher };
