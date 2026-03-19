import { describe, it, expect } from 'vitest';
import type { ChannelThread } from '@quilibrium/quorum-shared';
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from '../../../services/channelThreadHelpers';

describe('channelThreadHelpers', () => {
  it('buildChannelThreadFromCreate produces correct ChannelThread', () => {
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1',
      channelId: 'channel-1',
      rootMessageId: 'msg-1',
      threadMeta: {
        threadId: 'thread-1',
        createdBy: 'user-creator',
        lastActivityAt: 5000,
      },
      rootMessageText: 'Hello world this is a long message',
      currentUserAddress: 'user-creator',
      now: 5000,
    });

    expect(result.threadId).toBe('thread-1');
    expect(result.createdBy).toBe('user-creator');
    expect(result.hasParticipated).toBe(true);
    expect(result.titleSnapshot).toBe('Hello world this is a long message');
    expect(result.replyCount).toBe(0);
    expect(result.isClosed).toBe(false);
  });

  it('buildChannelThreadFromCreate sets hasParticipated=false for other users', () => {
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1',
      channelId: 'channel-1',
      rootMessageId: 'msg-1',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-other', lastActivityAt: 5000 },
      rootMessageText: 'Test',
      currentUserAddress: 'user-local',
      now: 5000,
    });
    expect(result.hasParticipated).toBe(false);
  });

  it('updateChannelThreadOnReply increments replyCount and updates lastActivityAt', () => {
    const existing: ChannelThread = {
      threadId: 'thread-1', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 2, isClosed: false, hasParticipated: false,
    };
    const updated = updateChannelThreadOnReply({
      existing,
      replySenderId: 'user-local',
      replyTimestamp: 9000,
      currentUserAddress: 'user-local',
    });
    expect(updated.replyCount).toBe(3);
    expect(updated.lastActivityAt).toBe(9000);
    expect(updated.hasParticipated).toBe(true);
  });

  it('updateChannelThreadOnReply preserves hasParticipated=true once set', () => {
    const existing: ChannelThread = {
      threadId: 'thread-1', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 1, isClosed: false, hasParticipated: true,
    };
    const updated = updateChannelThreadOnReply({
      existing,
      replySenderId: 'user-other',
      replyTimestamp: 9000,
      currentUserAddress: 'user-local',
    });
    expect(updated.hasParticipated).toBe(true);
  });
});
