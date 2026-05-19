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

  it('buildChannelThreadFromCreate truncates rootMessageText to 100 chars', () => {
    const longText = 'a'.repeat(150);
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1', channelId: 'channel-1', rootMessageId: 'msg-1',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-1', lastActivityAt: 1000 },
      rootMessageText: longText,
      currentUserAddress: 'user-1',
      now: 1000,
    });
    expect(result.titleSnapshot).toBe('a'.repeat(100));
  });

  it('buildChannelThreadFromCreate sets titleSnapshot to undefined for empty rootMessageText', () => {
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1', channelId: 'channel-1', rootMessageId: 'msg-1',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-1', lastActivityAt: 1000 },
      rootMessageText: '',
      currentUserAddress: 'user-1',
      now: 1000,
    });
    expect(result.titleSnapshot).toBeUndefined();
  });

  it('buildChannelThreadFromCreate strips markdown from rootMessageText', () => {
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1', channelId: 'channel-1', rootMessageId: 'msg-1',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-1', lastActivityAt: 1000 },
      rootMessageText: '**bold** text',
      currentUserAddress: 'user-1',
      now: 1000,
    });
    expect(result.titleSnapshot).toBe('bold text');
  });

  it('buildChannelThreadFromCreate passes through customTitle from threadMeta', () => {
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1', channelId: 'channel-1', rootMessageId: 'msg-1',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-1', lastActivityAt: 1000, customTitle: 'My Thread' },
      rootMessageText: 'Some text',
      currentUserAddress: 'user-1',
      now: 1000,
    });
    expect(result.customTitle).toBe('My Thread');
  });

  it('buildChannelThreadFromCreate falls back to now when threadMeta.lastActivityAt is undefined', () => {
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1', channelId: 'channel-1', rootMessageId: 'msg-1',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-1', lastActivityAt: undefined },
      rootMessageText: 'Some text',
      currentUserAddress: 'user-1',
      now: 7777,
    });
    expect(result.lastActivityAt).toBe(7777);
  });

  it('updateChannelThreadOnReply rewinds lastActivityAt when replyTimestamp is older (current behavior)', () => {
    // current behavior: no max guard — out-of-order reply rewinds the timestamp
    const existing: ChannelThread = {
      threadId: 'thread-1', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 5000, replyCount: 1, isClosed: false, hasParticipated: false,
    };
    const updated = updateChannelThreadOnReply({
      existing,
      replySenderId: 'user-other',
      replyTimestamp: 3000,
      currentUserAddress: 'user-local',
    });
    expect(updated.lastActivityAt).toBe(3000);
  });
});
