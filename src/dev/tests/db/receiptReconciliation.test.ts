import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDB } from '../../../db/messages';
import type { Message } from '@quilibrium/quorum-shared';

/**
 * Receipt truthfulness at the storage layer.
 *
 * The invariant under test: a read ack may never invent a delivery. Read acks
 * carry only a high-water mark ("read up to Y"), so expanding them across the
 * whole range used to stamp delivered+read on messages that never landed.
 */

const ME = 'QmMyAddress';
const PEER = 'QmPeerAddress';

describe('MessageDB - DM receipt reconciliation', () => {
  let db: MessageDB;

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();

    db = new MessageDB();
    await db.init();
  });

  /** A DM has spaceId === channelId === the partner address. */
  async function saveDm(
    over: { messageId: string; createdDate: number; senderId?: string; deliveredAt?: number; readAt?: number }
  ) {
    const message = {
      messageId: over.messageId,
      spaceId: PEER,
      channelId: PEER,
      createdDate: over.createdDate,
      content: { senderId: over.senderId ?? ME, text: 'hi' },
      deliveredAt: over.deliveredAt,
      readAt: over.readAt,
    } as unknown as Message;

    await db.saveMessage(message, over.createdDate, PEER, 'dm', '', 'Peer', ME);
  }

  const readAck = (upToMessageId: string, upToTimestamp: number, at = 9_000) =>
    db.updateMessagesReadAt(PEER, PEER, ME, upToMessageId, upToTimestamp, at);

  describe('read acks', () => {
    it('does NOT mark an undelivered message as read or delivered', async () => {
      // The core bug: this message never landed, so it has no deliveredAt.
      await saveDm({ messageId: 'lost', createdDate: 400 });
      await saveDm({ messageId: 'hwm', createdDate: 500, deliveredAt: 800 });

      await readAck('hwm', 500);

      const lost = await db.getMessageById('lost');
      expect(lost?.readAt).toBeUndefined();
      expect(lost?.deliveredAt).toBeUndefined();
    });

    it('marks a delivered in-range message as read', async () => {
      await saveDm({ messageId: 'm1', createdDate: 400, deliveredAt: 800 });

      await readAck('hwm', 500);

      const m1 = await db.getMessageById('m1');
      expect(m1?.readAt).toBe(9_000);
      expect(m1?.deliveredAt).toBe(800); // untouched — the real delivery time
    });

    it('stamps both on the high-water-mark message, since reading proves arrival', async () => {
      await saveDm({ messageId: 'hwm', createdDate: 500 });

      await readAck('hwm', 500);

      const hwm = await db.getMessageById('hwm');
      expect(hwm?.readAt).toBe(9_000);
      expect(hwm?.deliveredAt).toBe(9_000);
    });

    it('leaves the peer\'s own messages alone', async () => {
      await saveDm({ messageId: 'theirs', createdDate: 400, senderId: PEER });

      await readAck('hwm', 500);

      const theirs = await db.getMessageById('theirs');
      expect(theirs?.readAt).toBeUndefined();
    });

    it('ignores delivered messages newer than the high-water mark', async () => {
      await saveDm({ messageId: 'newer', createdDate: 600, deliveredAt: 800 });

      await readAck('hwm', 500);

      const newer = await db.getMessageById('newer');
      expect(newer?.readAt).toBeUndefined();
    });

    it('reproduces the reported bug: lost messages stay blank, neighbours upgrade', async () => {
      // Ten sent messages; #4 and #7 never landed on the recipient.
      for (let n = 1; n <= 10; n++) {
        const lost = n === 4 || n === 7;
        await saveDm({
          messageId: `m${n}`,
          createdDate: n * 100,
          deliveredAt: lost ? undefined : 800,
        });
      }

      await readAck('m10', 1000);

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => db.getMessageById(`m${i + 1}`))
      );
      const readIds = results.filter((m) => m?.readAt !== undefined).map((m) => m!.messageId);

      expect(readIds).toEqual(['m1', 'm2', 'm3', 'm5', 'm6', 'm8', 'm9', 'm10']);
      expect(results[3]?.readAt).toBeUndefined(); // m4 lost
      expect(results[3]?.deliveredAt).toBeUndefined();
      expect(results[6]?.readAt).toBeUndefined(); // m7 lost
      expect(results[6]?.deliveredAt).toBeUndefined();
    });
  });

  describe('read acks that name what was read', () => {
    const namedReadAck = (
      upToMessageId: string,
      upToTimestamp: number,
      ids: string[],
      at = 9_000
    ) => db.updateMessagesReadAt(PEER, PEER, ME, upToMessageId, upToTimestamp, at, new Set(ids));

    it('recovers a message whose delivery ack was lost, because reading proves arrival', async () => {
      // No deliveredAt: its delivery ack never made it back. Before naming, the
      // only escape was being the high-water mark itself.
      await saveDm({ messageId: 'm1', createdDate: 400 });
      await saveDm({ messageId: 'hwm', createdDate: 500, deliveredAt: 800 });

      await namedReadAck('hwm', 500, ['m1', 'hwm']);

      const m1 = await db.getMessageById('m1');
      expect(m1?.readAt).toBe(9_000);
      expect(m1?.deliveredAt).toBe(9_000);
    });

    it('still refuses a message the peer did NOT name — the delivery gate holds', async () => {
      await saveDm({ messageId: 'lost', createdDate: 400 });
      await saveDm({ messageId: 'read-one', createdDate: 450 });

      await namedReadAck('hwm', 500, ['read-one']);

      const lost = await db.getMessageById('lost');
      expect(lost?.readAt).toBeUndefined();
      expect(lost?.deliveredAt).toBeUndefined();
    });

    it('does not overwrite a real delivery time on a named message', async () => {
      await saveDm({ messageId: 'm1', createdDate: 400, deliveredAt: 800 });

      await namedReadAck('hwm', 500, ['m1']);

      const m1 = await db.getMessageById('m1');
      expect(m1?.readAt).toBe(9_000);
      expect(m1?.deliveredAt).toBe(800);
    });

    it('leaves the peer\'s own messages alone even when named', async () => {
      await saveDm({ messageId: 'theirs', createdDate: 400, senderId: PEER });

      await namedReadAck('hwm', 500, ['theirs']);

      const theirs = await db.getMessageById('theirs');
      expect(theirs?.readAt).toBeUndefined();
      expect(theirs?.deliveredAt).toBeUndefined();
    });

    it('repairs the reported-bug conversation when the reader names what it read', async () => {
      // Same ten messages, #4 and #7 lost — but now the reader names them, so
      // both recover instead of sitting blank until a delivery ack that never comes.
      for (let n = 1; n <= 10; n++) {
        const lost = n === 4 || n === 7;
        await saveDm({
          messageId: `m${n}`,
          createdDate: n * 100,
          deliveredAt: lost ? undefined : 800,
        });
      }

      await namedReadAck('m10', 1000, Array.from({ length: 10 }, (_, i) => `m${i + 1}`));

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => db.getMessageById(`m${i + 1}`))
      );

      expect(results.every((m) => m?.readAt === 9_000)).toBe(true);
      expect(results[3]?.deliveredAt).toBe(9_000); // m4 recovered
      expect(results[6]?.deliveredAt).toBe(9_000); // m7 recovered
    });

    it('behaves exactly as before when the peer names nothing (older build)', async () => {
      await saveDm({ messageId: 'lost', createdDate: 400 });
      await saveDm({ messageId: 'ok', createdDate: 450, deliveredAt: 800 });

      await readAck('hwm', 500);

      expect((await db.getMessageById('lost'))?.readAt).toBeUndefined();
      expect((await db.getMessageById('ok'))?.readAt).toBe(9_000);
    });
  });

  describe('delivery acks', () => {
    it('stamps deliveredAt when no read ack has arrived', async () => {
      await saveDm({ messageId: 'm1', createdDate: 400 });

      await db.updateMessageDeliveredAt('m1', 9_000);

      const m1 = await db.getMessageById('m1');
      expect(m1?.deliveredAt).toBe(9_000);
      expect(m1?.readAt).toBeUndefined();
    });

    it('completes the upgrade when a read ack already covered the message', async () => {
      // The common out-of-order case: read debounce (5s) beats delivery (10s).
      await saveDm({ messageId: 'm1', createdDate: 400 });

      await db.updateMessageDeliveredAt('m1', 9_000, new Map([[PEER, 500]]));

      const m1 = await db.getMessageById('m1');
      expect(m1?.deliveredAt).toBe(9_000);
      expect(m1?.readAt).toBe(9_000);
    });

    it('does not mark read when the message is newer than the watermark', async () => {
      await saveDm({ messageId: 'm2', createdDate: 600 });

      await db.updateMessageDeliveredAt('m2', 9_000, new Map([[PEER, 500]]));

      const m2 = await db.getMessageById('m2');
      expect(m2?.deliveredAt).toBe(9_000);
      expect(m2?.readAt).toBeUndefined();
    });
  });

  describe('ack ordering', () => {
    it('converges on delivered+read when the read ack arrives first', async () => {
      await saveDm({ messageId: 'm1', createdDate: 400 });

      // Read ack lands first — nothing to write yet, delivery is unconfirmed.
      await readAck('hwm', 500);
      expect((await db.getMessageById('m1'))?.readAt).toBeUndefined();

      // Delivery ack lands second and completes the upgrade.
      await db.updateMessageDeliveredAt('m1', 9_000, new Map([[PEER, 500]]));

      const m1 = await db.getMessageById('m1');
      expect(m1?.deliveredAt).toBe(9_000);
      expect(m1?.readAt).toBe(9_000);
    });

    it('converges on delivered+read when the delivery ack arrives first', async () => {
      await saveDm({ messageId: 'm1', createdDate: 400 });

      await db.updateMessageDeliveredAt('m1', 800);
      await readAck('hwm', 500);

      const m1 = await db.getMessageById('m1');
      expect(m1?.deliveredAt).toBe(800);
      expect(m1?.readAt).toBe(9_000);
    });

    it('leaves a permanently lost message blank in both orders', async () => {
      await saveDm({ messageId: 'lost', createdDate: 400 });

      await readAck('hwm', 500);
      await readAck('hwm2', 600); // a later read ack must not rescue it either

      const lost = await db.getMessageById('lost');
      expect(lost?.readAt).toBeUndefined();
      expect(lost?.deliveredAt).toBeUndefined();
    });
  });
});
