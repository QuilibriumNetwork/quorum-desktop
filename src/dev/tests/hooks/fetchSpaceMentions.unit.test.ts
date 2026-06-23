/* globals are injected by vitest (globals: true) — no import needed */
import { fetchSpaceMentions } from '../../../hooks/business/mentions/fetchSpaceMentions';

const ME = 'QmMeAddr0000000000000000000000000000000000';
const SENDER = 'QmSender000000000000000000000000000000000';

function makeSpace() {
  return {
    spaceId: 'space-1',
    spaceName: 'Test Space',
    roles: [],
    members: {},
    groups: [{ channels: [{ channelId: 'chan-1', channelName: 'general' }] }],
  } as any;
}

function makeMessage(overrides: any = {}) {
  return {
    messageId: 'm1',
    createdDate: 1000,
    content: { senderId: SENDER, text: 'hey @<' + ME + '>' },
    mentions: { memberIds: [ME], roleIds: [], everyone: false, channelIds: [] },
    ...overrides,
  };
}

function makeDB(over: any = {}) {
  return {
    getUserConfig: vi.fn().mockResolvedValue({ notificationSettings: {}, mutedChannels: {} }),
    getSpace: vi.fn().mockResolvedValue(makeSpace()),
    getConversation: vi.fn().mockResolvedValue({ conversation: { lastReadTimestamp: 0 } }),
    getThreadReadTimesForChannel: vi.fn().mockResolvedValue({}),
    getUnreadMentions: vi.fn().mockResolvedValue([makeMessage()]),
    ...over,
  } as any;
}

describe('fetchSpaceMentions', () => {
  it('returns a mention row tagged with spaceId and spaceName', async () => {
    const db = makeDB();
    const rows = await fetchSpaceMentions(db, makeSpace(), ME, {
      enabledTypes: ['mention-you', 'mention-everyone', 'mention-roles'],
      userRoleIds: [],
      config: { notificationSettings: {}, mutedChannels: {} } as any,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].spaceId).toBe('space-1');
    expect(rows[0].spaceName).toBe('Test Space');
    expect(rows[0].channelName).toBe('general');
    expect(rows[0].mentionType).toBe('you');
  });

  it('returns [] when the space is muted', async () => {
    const db = makeDB();
    const rows = await fetchSpaceMentions(db, makeSpace(), ME, {
      enabledTypes: ['mention-you'],
      userRoleIds: [],
      config: { notificationSettings: { 'space-1': { isMuted: true } } } as any,
    });
    expect(rows).toEqual([]);
  });

  it('excludes muted channels', async () => {
    const db = makeDB();
    const rows = await fetchSpaceMentions(db, makeSpace(), ME, {
      enabledTypes: ['mention-you'],
      userRoleIds: [],
      config: { notificationSettings: {}, mutedChannels: { 'space-1': ['chan-1'] } } as any,
    });
    expect(rows).toEqual([]);
  });
});
