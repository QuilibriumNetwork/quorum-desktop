import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ReceiptService,
  isReadAckTimestampValid,
  advanceReadWatermark,
} from '@quilibrium/quorum-shared';
import { MessageDB } from '../../../db/messages';
import type { Message } from '@quilibrium/quorum-shared';

/**
 * The lost-delivery-ack scenario, driven through the real ReceiptService and
 * real IndexedDB storage.
 *
 * This is the case that cannot be produced by hand in the app: the settings UI
 * cascades delivery-receipts-off into read-receipts-off (Privacy.tsx and
 * ConversationSettingsModal.tsx), so there is no way to run a session where a
 * reader sends read acks but no delivery acks. Here we simply never deliver
 * them, which is what transport loss looks like to the sender.
 *
 * WHAT THIS COVERS
 * - Reader side: the real ReceiptService accumulating read ids and emitting
 *   them on its real 5s timer.
 * - The wire payload built from that flush, in the shape ActionQueueHandlers
 *   .sendReadAck puts on the wire.
 * - Sender side: the real ReceiptService intercept entry point, and the real
 *   MessageDB IndexedDB walk that stamps the ticks.
 *
 * WHAT THIS DOES NOT COVER
 * - Encryption and transport (encryptAndSendDm) — no network in unit tests.
 * - Rendering: that a message carrying deliveredAt+readAt draws two ticks.
 * - The ~10 lines of glue inside MessageDBProvider's onReadAckProcessed, which
 *   live in a React useMemo and are mirrored here rather than imported. The
 *   mirror is marked below; keep it in step with MessageDB.tsx.
 */

const ME = 'QmMyAddress';
const PEER = 'QmPeerAddress';

/** The wire shape ActionQueueHandlers.sendReadAck emits. */
type ReadAckWire = {
  senderId: string;
  type: 'read-ack';
  upToMessageId: string;
  upToTimestamp: number;
  messageIds?: string[];
};

describe('Lost delivery ack — a read ack that names messages still earns both ticks', () => {
  let db: MessageDB;

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    db = new MessageDB();
    await db.init();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** One of OUR sent messages, awaiting ticks. No deliveredAt = its ack was lost. */
  async function saveOwnMessage(messageId: string, createdDate: number, deliveredAt?: number) {
    const message = {
      messageId,
      spaceId: PEER,
      channelId: PEER,
      createdDate,
      content: { senderId: ME, text: 'hi' },
      deliveredAt,
    } as unknown as Message;
    await db.saveMessage(message, createdDate, PEER, 'dm', '', 'Peer', ME);
  }

  /**
   * READER SIDE — drive the real service and capture what it would send.
   * Returns the wire object, exactly as sendReadAck would build it.
   */
  function readerFlush(reads: Array<{ messageId: string; timestamp: number }>): ReadAckWire {
    const flushes: Array<{ messageId: string; timestamp: number; messageIds: string[] }> = [];
    const reader = new ReceiptService({
      onFlush: () => {
        throw new Error('delivery acks must not be sent in this scenario');
      },
      onReadFlush: (_address, payload) => flushes.push(payload),
    });

    // Fake timers only around the flush — IndexedDB needs real task scheduling,
    // so they must not be installed while the DB is doing work.
    vi.useFakeTimers();
    for (const r of reads) reader.onMessageRead(PEER, r.messageId, r.timestamp);
    vi.advanceTimersByTime(5_000); // the real READ_FLUSH_TIMEOUT_MS
    reader.destroy();
    vi.useRealTimers();

    expect(flushes).toHaveLength(1);
    const payload = flushes[0];

    return {
      senderId: PEER,
      type: 'read-ack',
      upToMessageId: payload.messageId,
      upToTimestamp: payload.timestamp,
      ...(payload.messageIds?.length ? { messageIds: payload.messageIds } : {}),
    };
  }

  /**
   * SENDER SIDE — feed the wire object through the real intercept entry point
   * and the real storage walk.
   */
  async function senderReceives(wire: ReadAckWire, now: number) {
    const watermarks = new Map<string, number>();
    const writes: Array<Promise<void>> = [];

    const sender = new ReceiptService({
      onFlush: () => {},
      // MIRROR of MessageDBProvider.onReadAckProcessed (MessageDB.tsx). Keep in step.
      onReadAckProcessed: (upToMessageId, upToTimestamp, conversationAddress, messageIds) => {
        if (!isReadAckTimestampValid(upToTimestamp, now)) return;
        watermarks.set(
          conversationAddress,
          advanceReadWatermark(watermarks.get(conversationAddress) ?? 0, upToTimestamp)
        );
        const readMessageIds = messageIds?.length ? new Set(messageIds) : undefined;
        writes.push(
          db.updateMessagesReadAt(
            conversationAddress,
            conversationAddress,
            ME,
            upToMessageId,
            upToTimestamp,
            now,
            readMessageIds
          )
        );
      },
    });

    // This is what MessageService.interceptControlMessages does for raw.type === 'read-ack'.
    sender.onReadAckReceived(wire.upToMessageId, wire.upToTimestamp, PEER, wire.messageIds);
    await Promise.all(writes);
    sender.destroy();
  }

  const ticksOf = async (ids: string[]) =>
    Promise.all(
      ids.map(async (id) => {
        const m = await db.getMessageById(id);
        return { id, delivered: m?.deliveredAt !== undefined, read: m?.readAt !== undefined };
      })
    );

  it('gives all four messages both ticks even though no delivery ack ever arrived', async () => {
    // Four sent messages, none acknowledged as delivered — every delivery ack lost.
    await saveOwnMessage('m1', 100);
    await saveOwnMessage('m2', 200);
    await saveOwnMessage('m3', 300);
    await saveOwnMessage('m4', 400);

    const wire = readerFlush([
      { messageId: 'm1', timestamp: 100 },
      { messageId: 'm2', timestamp: 200 },
      { messageId: 'm3', timestamp: 300 },
      { messageId: 'm4', timestamp: 400 },
    ]);

    // The reader names every message it read, not just the newest.
    expect(wire.messageIds).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(wire.upToMessageId).toBe('m4');

    await senderReceives(wire, 9_000);

    expect(await ticksOf(['m1', 'm2', 'm3', 'm4'])).toEqual([
      { id: 'm1', delivered: true, read: true },
      { id: 'm2', delivered: true, read: true },
      { id: 'm3', delivered: true, read: true },
      { id: 'm4', delivered: true, read: true },
    ]);
  });

  it('without the named ids, only the high-water mark could upgrade — the contrast', async () => {
    // Same setup, but the ids are stripped, which is exactly what an older peer
    // sends. This is why the test above proves the new path and not the old one.
    await saveOwnMessage('m1', 100);
    await saveOwnMessage('m2', 200);
    await saveOwnMessage('m3', 300);
    await saveOwnMessage('m4', 400);

    const wire = readerFlush([
      { messageId: 'm1', timestamp: 100 },
      { messageId: 'm2', timestamp: 200 },
      { messageId: 'm3', timestamp: 300 },
      { messageId: 'm4', timestamp: 400 },
    ]);
    delete wire.messageIds;

    await senderReceives(wire, 9_000);

    expect(await ticksOf(['m1', 'm2', 'm3', 'm4'])).toEqual([
      { id: 'm1', delivered: false, read: false },
      { id: 'm2', delivered: false, read: false },
      { id: 'm3', delivered: false, read: false },
      { id: 'm4', delivered: true, read: true }, // the mark alone is self-proving
    ]);
  });

  it('does not touch a message the reader never read, even below the mark', async () => {
    // The invariant that the original bug violated: falling below the read
    // timestamp is not evidence of anything.
    await saveOwnMessage('never-arrived', 150);
    await saveOwnMessage('m2', 200);

    const wire = readerFlush([{ messageId: 'm2', timestamp: 200 }]);
    expect(wire.messageIds).toEqual(['m2']);

    await senderReceives(wire, 9_000);

    expect(await ticksOf(['never-arrived', 'm2'])).toEqual([
      { id: 'never-arrived', delivered: false, read: false },
      { id: 'm2', delivered: true, read: true },
    ]);
  });

  it('preserves a genuine delivery time rather than overwriting it with now', async () => {
    await saveOwnMessage('m1', 100, 800);

    const wire = readerFlush([{ messageId: 'm1', timestamp: 100 }]);
    await senderReceives(wire, 9_000);

    const m1 = await db.getMessageById('m1');
    expect(m1?.deliveredAt).toBe(800);
    expect(m1?.readAt).toBe(9_000);
  });

  it('carries ids read out of order, which the mark alone would leave behind', async () => {
    // Reading an older message after a newer one does not move the mark, so
    // before naming there was no way for it to earn a tick.
    await saveOwnMessage('older', 100);
    await saveOwnMessage('newer', 400);

    const wire = readerFlush([
      { messageId: 'newer', timestamp: 400 },
      { messageId: 'older', timestamp: 100 },
    ]);

    expect(wire.upToMessageId).toBe('newer');
    expect(wire.messageIds).toEqual(['newer', 'older']);

    await senderReceives(wire, 9_000);

    expect(await ticksOf(['older', 'newer'])).toEqual([
      { id: 'older', delivered: true, read: true },
      { id: 'newer', delivered: true, read: true },
    ]);
  });
});
