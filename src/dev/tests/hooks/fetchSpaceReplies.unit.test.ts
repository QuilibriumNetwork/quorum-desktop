import { describe, it, expect, vi } from 'vitest';

const ME = 'QmMeAddr0000000000000000000000000000000000';

function makeSpace() {
  return {
    spaceId: 'space-1',
    spaceName: 'Test Space',
    roles: [],
    members: {},
    groups: [{ channels: [{ channelId: 'chan-1', channelName: 'general' }] }],
  } as any;
}

function makeReply() {
  return {
    messageId: 'r1',
    createdDate: 2000,
    content: { senderId: 'QmSomeoneElse', text: 'reply text' },
    replyMetadata: { parentAuthor: ME },
  };
}

function makeDB(over: any = {}) {
  return {
    getConversation: vi.fn().mockResolvedValue({ conversation: { lastReadTimestamp: 0 } }),
    getThreadReadTimesForChannel: vi.fn().mockResolvedValue({}),
    getUnreadReplies: vi.fn().mockResolvedValue([makeReply()]),
    ...over,
  } as any;
}

describe('fetchSpaceReplies', () => {
  it('returns a reply row tagged with spaceId and spaceName when enabled', async () => {
    const { fetchSpaceReplies } = await import('../../../hooks/business/replies/fetchSpaceReplies');
    const rows = await fetchSpaceReplies(makeDB(), makeSpace(), ME, {
      enabled: true,
      config: { notificationSettings: {}, mutedChannels: {} } as any,
    });
    expect(rows).toHaveLength(1);
    expect((rows[0] as any).spaceId).toBe('space-1');
    expect((rows[0] as any).spaceName).toBe('Test Space');
    expect(rows[0].type).toBe('reply');
  });

  it('returns [] when not enabled', async () => {
    const { fetchSpaceReplies } = await import('../../../hooks/business/replies/fetchSpaceReplies');
    const rows = await fetchSpaceReplies(makeDB(), makeSpace(), ME, {
      enabled: false,
      config: { notificationSettings: {} } as any,
    });
    expect(rows).toEqual([]);
  });

  it('returns [] when the space is muted', async () => {
    const { fetchSpaceReplies } = await import('../../../hooks/business/replies/fetchSpaceReplies');
    const rows = await fetchSpaceReplies(makeDB(), makeSpace(), ME, {
      enabled: true,
      config: { notificationSettings: { 'space-1': { isMuted: true } } } as any,
    });
    expect(rows).toEqual([]);
  });
});
