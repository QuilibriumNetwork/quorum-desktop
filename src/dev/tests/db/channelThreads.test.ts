import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDB } from '../../../db/messages';
import type { ChannelThread } from '@quilibrium/quorum-shared';

describe('MessageDB - channel_threads store', () => {
  let db: MessageDB;

  beforeEach(async () => {
    // Reset fake-indexeddb global state between tests
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    const fdb = new FDBFactory();
    globalThis.indexedDB = fdb;

    db = new MessageDB();
    await db.init();
  });

  it('saves and retrieves a ChannelThread by channel', async () => {
    const thread: ChannelThread = {
      threadId: 'thread-1',
      spaceId: 'space-1',
      channelId: 'channel-1',
      rootMessageId: 'msg-1',
      createdBy: 'user-1',
      createdAt: 1000,
      lastActivityAt: 2000,
      replyCount: 3,
      isClosed: false,
      hasParticipated: false,
    };
    await db.saveChannelThread(thread);
    const results = await db.getChannelThreads({ spaceId: 'space-1', channelId: 'channel-1' });
    expect(results).toHaveLength(1);
    expect(results[0].threadId).toBe('thread-1');
  });

  it('returns only threads for the requested channel', async () => {
    await db.saveChannelThread({
      threadId: 'thread-a', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-a', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 0, isClosed: false, hasParticipated: false,
    });
    await db.saveChannelThread({
      threadId: 'thread-b', spaceId: 'space-1', channelId: 'channel-2',
      rootMessageId: 'msg-b', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 0, isClosed: false, hasParticipated: false,
    });
    const results = await db.getChannelThreads({ spaceId: 'space-1', channelId: 'channel-1' });
    expect(results).toHaveLength(1);
    expect(results[0].threadId).toBe('thread-a');
  });

  it('deletes a ChannelThread by threadId', async () => {
    await db.saveChannelThread({
      threadId: 'thread-del', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 0, isClosed: false, hasParticipated: false,
    });
    await db.deleteChannelThread('thread-del');
    const results = await db.getChannelThreads({ spaceId: 'space-1', channelId: 'channel-1' });
    expect(results).toHaveLength(0);
  });
});
