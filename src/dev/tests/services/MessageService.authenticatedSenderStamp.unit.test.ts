/**
 * The stamp, and the ONE ordering rule that makes it worth anything.
 *
 * `Message.authenticatedSenderId` is what the reveal ledger reads to answer
 * "did I write this?". It is only trustworthy because `saveMessage` assigns it
 * from the crypto layer AFTER spreading the wire message. Written before the
 * spread, a peer could put the field in their own payload and name themselves
 * as anyone — a field that LOOKS authoritative and is entirely attacker-chosen,
 * which is strictly worse than not having it at all.
 *
 * That ordering is one token of source. Nothing about a wrong version looks
 * wrong in review, and the resulting leak is silent. So it is pinned here.
 *
 * The three arms are deliberate and none is redundant:
 *   1. STAMPED     — the crypto value lands on the row at all.
 *   2. CLOBBERED   — a forged value in the payload loses to it. (The security
 *                    property. Passing arm 1 while failing this is exactly the
 *                    "spread last" bug.)
 *   3. ABSENT      — a space save writes no marker, so nothing can read one.
 */
import { describe, it, expect, vi } from 'vitest';
import { MessageService } from '@/services/MessageService';
import type { Message } from '@quilibrium/quorum-shared';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
}));

const SELF = 'QmMeMeMeVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imBBBB';
const PARTNER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imAAAA';

function makeService() {
  const saveMessage = vi.fn().mockResolvedValue(undefined);
  const messageDB = {
    saveMessage,
    getConversation: vi.fn().mockResolvedValue({ conversation: undefined }),
    getMessage: vi.fn().mockResolvedValue(undefined),
    // No tombstone, and no space row — the read-only gate fails OPEN on a
    // missing space by design, which is the path a plain post should take.
    isMessageDeleted: vi.fn().mockResolvedValue(false),
    getSpace: vi.fn().mockResolvedValue(undefined),
    getSpaceMembers: vi.fn().mockResolvedValue([]),
  } as never;
  const service = new MessageService({
    messageDB,
    threadService: { handleThreadReplyReceive: vi.fn().mockResolvedValue(undefined) },
  } as never);
  return { service, saveMessage, messageDB };
}

/** An ordinary post, as it arrives off the wire. */
const post = (extra: Record<string, unknown> = {}): Message =>
  ({
    messageId: 'm-1',
    channelId: PARTNER,
    spaceId: PARTNER,
    digestAlgorithm: 'SHA-256',
    nonce: 'n-1',
    createdDate: 1_700_000_000_000,
    modifiedDate: 1_700_000_000_000,
    lastModifiedHash: '',
    content: { type: 'post', senderId: PARTNER, text: 'hello' },
    reactions: [],
    mentions: { memberIds: [], roleIds: [], channelIds: [] },
    ...extra,
  }) as unknown as Message;

/** The row the DB layer actually received. */
const savedRow = (saveMessage: ReturnType<typeof vi.fn>) =>
  saveMessage.mock.calls[0][0] as Message & { authenticatedSenderId?: string };

describe('saveMessage stamps the authenticated sender', () => {
  it('writes the crypto layer’s answer onto the stored row', async () => {
    const { service, saveMessage, messageDB } = makeService();
    await service.saveMessage(
      post(),
      messageDB,
      PARTNER,
      PARTNER,
      'direct',
      {},
      PARTNER, // what the crypto layer authenticated
      SELF
    );
    expect(saveMessage).toHaveBeenCalledTimes(1);
    expect(savedRow(saveMessage).authenticatedSenderId).toBe(PARTNER);
  });

  it('CLOBBERS a forged marker supplied in the wire payload', async () => {
    // The attack this ordering rule exists to stop: the partner sends a frame
    // that already contains `authenticatedSenderId: <victim>`. If the spread
    // ran last, the victim's own client would store the attacker's claim as
    // authenticated fact and the ledger would read it back as consent.
    const { service, saveMessage, messageDB } = makeService();
    await service.saveMessage(
      post({ authenticatedSenderId: SELF }), // forged: claims the victim wrote it
      messageDB,
      PARTNER,
      PARTNER,
      'direct',
      {},
      PARTNER, // the crypto layer says otherwise, and it wins
      SELF
    );
    expect(savedRow(saveMessage).authenticatedSenderId).toBe(PARTNER);
    expect(savedRow(saveMessage).authenticatedSenderId).not.toBe(SELF);
  });

  it('writes NO marker for a space message, and drops a forged one there too', async () => {
    // `null` is the explicit "not applicable" answer. It must persist as
    // absent — readers fail closed on undefined — and it must still beat a
    // payload-supplied value, or a space message would carry a forged marker
    // into a store the DM ledger also reads from.
    const { service, saveMessage, messageDB } = makeService();
    await service.saveMessage(
      post({ authenticatedSenderId: SELF }),
      messageDB,
      'space-1',
      'channel-1',
      'group',
      {},
      null,
      SELF
    );
    expect(savedRow(saveMessage).authenticatedSenderId).toBeUndefined();
  });
});
