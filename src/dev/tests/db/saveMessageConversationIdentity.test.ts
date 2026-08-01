import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDB } from '../../../db/messages';
import type { Message } from '@quilibrium/quorum-shared';
import { DefaultImages } from '../../../utils';

// `db.saveMessage` also upserts the conversation row, and that `put` replaces
// the whole record. Before this guard it wrote whatever identity the caller
// happened to pass, which meant:
//
//  - the DM SEND path (which reads the row at the TOP of the send and falls
//    back to the 'Unknown User' / default-icon placeholders) could revert a
//    name learned mid-send from a `dm-update-profile`; and
//  - the SPACE paths, which pass `{}` and reach the DB as `undefined`, blanked
//    the channel row's identity on every single message saved.
//
// The rule under test: a REAL incoming value wins; otherwise keep what is
// stored; and only fall back to the incoming placeholder when the row is new,
// so a brand-new row keeps the shape `Conversation` requires.
//
// See .agents/tasks/2026-08-01-identity-announce-cadence-research.md §2.

const PARTNER = 'QmNSr2YL6iLho1CQfRNikQRs2mBxGQRSL2CXYmtKL5ihUB';
const REAL_NAME = 'Ada Lovelace';
const REAL_ICON = 'data:image/jpeg;base64,/9j/REAL';

const message = (overrides: Partial<Message> = {}): Message =>
  ({
    messageId: 'msg-1',
    spaceId: PARTNER,
    channelId: PARTNER,
    createdDate: 1000,
    modifiedDate: 1000,
    digestAlgorithm: 'SHA-256',
    nonce: 'nonce-1',
    lastModifiedHash: '',
    content: { type: 'post', senderId: PARTNER, text: ['hi'] },
    reactions: [],
    mentions: { memberIds: [], roleIds: [], channelIds: [] },
    ...overrides,
  }) as unknown as Message;

describe('MessageDB.saveMessage — conversation identity is never downgraded', () => {
  let db: MessageDB;

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    db = new MessageDB();
    await db.init();
  });

  const conversationId = `${PARTNER}/${PARTNER}`;

  const seedRealIdentity = async () => {
    await db.saveMessage(
      message(),
      1000,
      PARTNER,
      'direct',
      REAL_ICON,
      REAL_NAME
    );
  };

  it('writes a real incoming identity onto a new row', async () => {
    await seedRealIdentity();
    const conv = await db.getConversation({ conversationId }).then((r) => r.conversation);
    expect(conv?.displayName).toBe(REAL_NAME);
    expect(conv?.icon).toBe(REAL_ICON);
  });

  it('THE BUG: a placeholder from the send path no longer overwrites a real name', async () => {
    await seedRealIdentity();

    // The DM send path's fallback, carrying a stale snapshot of the row.
    await db.saveMessage(
      message({ messageId: 'msg-2', createdDate: 2000 }),
      2000,
      PARTNER,
      'direct',
      DefaultImages.UNKNOWN_USER,
      'Unknown User'
    );

    const conv = await db.getConversation({ conversationId }).then((r) => r.conversation);
    expect(conv?.displayName).toBe(REAL_NAME);
    expect(conv?.icon).toBe(REAL_ICON);
  });

  it('THE SPACE BUG: undefined identity no longer blanks the row', async () => {
    await seedRealIdentity();

    // Space callers pass `{}` and the wrapper asserts `user_icon!`, so both
    // arrive here as undefined.
    await db.saveMessage(
      message({ messageId: 'msg-3', createdDate: 3000 }),
      3000,
      PARTNER,
      'direct',
      undefined as unknown as string,
      undefined as unknown as string
    );

    const conv = await db.getConversation({ conversationId }).then((r) => r.conversation);
    expect(conv?.displayName).toBe(REAL_NAME);
    expect(conv?.icon).toBe(REAL_ICON);
  });

  it('an empty string does not clear a stored identity either', async () => {
    await seedRealIdentity();
    await db.saveMessage(
      message({ messageId: 'msg-4', createdDate: 4000 }),
      4000,
      PARTNER,
      'direct',
      '',
      ''
    );
    const conv = await db.getConversation({ conversationId }).then((r) => r.conversation);
    expect(conv?.displayName).toBe(REAL_NAME);
    expect(conv?.icon).toBe(REAL_ICON);
  });

  it('a real update still wins over a stored placeholder (recovery still works)', async () => {
    // Row starts life as a placeholder, as a never-identified partner's does.
    await db.saveMessage(
      message(),
      1000,
      PARTNER,
      'direct',
      DefaultImages.UNKNOWN_USER,
      'Unknown User'
    );

    await db.saveMessage(
      message({ messageId: 'msg-5', createdDate: 5000 }),
      5000,
      PARTNER,
      'direct',
      REAL_ICON,
      REAL_NAME
    );

    const conv = await db.getConversation({ conversationId }).then((r) => r.conversation);
    expect(conv?.displayName).toBe(REAL_NAME);
    expect(conv?.icon).toBe(REAL_ICON);
  });

  it('a real identity change still overwrites an older real identity', async () => {
    await seedRealIdentity();
    await db.saveMessage(
      message({ messageId: 'msg-6', createdDate: 6000 }),
      6000,
      PARTNER,
      'direct',
      'data:image/jpeg;base64,/9j/NEWER',
      'Ada L.'
    );
    const conv = await db.getConversation({ conversationId }).then((r) => r.conversation);
    expect(conv?.displayName).toBe('Ada L.');
    expect(conv?.icon).toBe('data:image/jpeg;base64,/9j/NEWER');
  });

  it('a brand-new row still gets the placeholder, so its shape is unchanged', async () => {
    await db.saveMessage(
      message(),
      1000,
      PARTNER,
      'direct',
      DefaultImages.UNKNOWN_USER,
      'Unknown User'
    );
    const conv = await db.getConversation({ conversationId }).then((r) => r.conversation);
    expect(conv?.displayName).toBe('Unknown User');
    expect(conv?.icon).toBe(DefaultImages.UNKNOWN_USER);
  });

  it('preserves unrelated fields it has always preserved', async () => {
    await seedRealIdentity();
    const seeded = await db.getConversation({ conversationId }).then((r) => r.conversation);
    await db.saveConversation({
      ...seeded!,
      isRepudiable: true,
      bio: 'mathematician',
    });

    await db.saveMessage(
      message({ messageId: 'msg-7', createdDate: 7000 }),
      7000,
      PARTNER,
      'direct',
      undefined as unknown as string,
      undefined as unknown as string
    );

    const conv = await db.getConversation({ conversationId }).then((r) => r.conversation);
    expect(conv?.isRepudiable).toBe(true);
    expect(conv?.bio).toBe('mathematician');
    expect(conv?.displayName).toBe(REAL_NAME);
    expect(conv?.lastMessageId).toBe('msg-7');
  });
});
