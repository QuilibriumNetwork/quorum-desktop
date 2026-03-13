import { logger } from '@quilibrium/quorum-shared';
import type { MessageDB } from '../db/messages';
import type {
  Message,
  ThreadMessage,
  ThreadMeta,
  ChannelThread,
} from '../api/quorumApi';
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from './channelThreadHelpers';

export class ThreadService {
  constructor(private messageDB: MessageDB) {}

  /**
   * Unified thread authorization: thread creator OR message:delete permission.
   * Replaces 6 duplicate auth checks across MessageService's three code paths.
   */
  async isThreadAuthorized(params: {
    senderId: string;
    createdBy: string | undefined;
    spaceId: string;
  }): Promise<boolean> {
    if (params.senderId === params.createdBy) return true;

    const space = await this.messageDB.getSpace(params.spaceId);
    return (
      space?.roles?.some(
        (role: { members: string[]; permissions: string[] }) =>
          role.members.includes(params.senderId) &&
          role.permissions.includes('message:delete')
      ) ?? false
    );
  }
}
