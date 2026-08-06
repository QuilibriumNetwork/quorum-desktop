import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDB } from '../../../db/messages';
import type { Message } from '@quilibrium/quorum-shared';
import { buildMessagesFetcher } from '../../../hooks/queries/messages/buildMessagesFetcher';
import { loadMessagesAround } from '../../../hooks/queries/messages/loadMessagesAround';

// Regression suite for "a channel shows as empty until you refresh the page".
//
// Three defects, all in the read path that decides which slice of a channel's
// history the message list gets on mount:
//
//  1. `determineInitialCursor` treated "never read" (lastReadTimestamp 0) as
//     "everything is unread", so the auto-jump anchored on the OLDEST message
//     in the channel and the initial page contained just that one message.
//     Channel.tsx's own auto-jump effect already skips when lastReadTimestamp
//     is 0 — the fetcher disagreed with it.
//
//  2. `getMessages` shadowed its `cursor` PARAMETER with the IDB cursor inside
//     `onsuccess`, so the "should I reverse?" test read the exhausted IDB
//     cursor instead. Forward pages came back newest-first whenever the scan
//     ran to the end rather than stopping at `limit`.
//
//  3. `getMessages` gated `nextCursor` on `messages.length === limit`. A page
//     anchored at an old unread message is short by definition, so nextCursor
//     was null, `hasNextPage` was false, and every message newer than the
//     anchor was unreachable for the lifetime of that mount.

const SPACE = 'space-1';
const CHANNEL = 'channel-1';
const SENDER = 'QmSenderAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const conversationId = `${SPACE}/${CHANNEL}`;

const msg = (n: number): Message =>
  ({
    messageId: `msg-${String(n).padStart(4, '0')}`,
    spaceId: SPACE,
    channelId: CHANNEL,
    createdDate: n * 1000,
    modifiedDate: n * 1000,
    digestAlgorithm: 'SHA-256',
    nonce: `nonce-${n}`,
    lastModifiedHash: '',
    content: { type: 'post', senderId: SENDER, text: [`m${n}`] },
    reactions: [],
    mentions: { memberIds: [], roleIds: [], channelIds: [] },
  }) as unknown as Message;

const ids = (ms: Message[]) => ms.map((m) => m.messageId);

describe('channel message pagination', () => {
  let db: MessageDB;

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    db = new MessageDB();
    await db.init();
  });

  /** Incoming messages only — no read state, exactly like a channel never opened. */
  const seed = async (count: number) => {
    for (let i = 1; i <= count; i++) {
      await db.saveMessage(msg(i), i * 1000, SPACE, 'space', '', '');
    }
  };

  /** One channel mount: the first page the message list is handed. */
  const mount = async () => {
    const fetcher = buildMessagesFetcher({
      messageDB: db,
      spaceId: SPACE,
      channelId: CHANNEL,
      includeThreadReplies: false,
    });
    const page = (await (fetcher as unknown as (c: unknown) => Promise<{
      messages: Message[];
      nextCursor: number | null;
      prevCursor: number | null;
    }>)({ pageParam: undefined }));
    return { ids: ids(page.messages), hasNextPage: !!page.nextCursor, page };
  };

  describe('initial load', () => {
    it('a channel that was never opened loads its most recent history, not just the oldest message', async () => {
      await seed(50);

      const { ids: loaded, hasNextPage } = await mount();

      // Before the fix this was exactly ['msg-0001'] — one message, the oldest
      // in the channel — with hasNextPage false, so the other 49 never arrived.
      expect(loaded).toHaveLength(50);
      expect(loaded[loaded.length - 1]).toBe('msg-0050');
      expect(hasNextPage).toBe(false);
    });

    it('control: a fully-read channel loads the same way', async () => {
      await seed(50);
      await db.saveReadTime({ conversationId, lastMessageTimestamp: 50 * 1000 });

      const { ids: loaded } = await mount();

      expect(loaded).toHaveLength(50);
      expect(loaded[loaded.length - 1]).toBe('msg-0050');
    });

    it('does not creep forward one message per mount', async () => {
      await seed(50);

      // Mount, then mark read the way Channel.tsx does (max createdDate of the
      // LOADED list), three times over. A short first page used to make each
      // subsequent mount reveal exactly one more message.
      for (let round = 0; round < 3; round++) {
        const { ids: loaded } = await mount();
        expect(loaded).toHaveLength(50);
        const newest = Math.max(
          ...loaded.map((id) => parseInt(id.replace('msg-', ''), 10))
        );
        await db.saveReadTime({ conversationId, lastMessageTimestamp: newest * 1000 });
      }
    });

    it('still anchors on the first unread when there is a real read pointer', async () => {
      await seed(50);
      await db.saveReadTime({ conversationId, lastMessageTimestamp: 30 * 1000 });

      const { ids: loaded } = await mount();

      // The page ends at the first unread (msg-0031) so the unread separator
      // has something to anchor to.
      expect(loaded[loaded.length - 1]).toBe('msg-0031');
      expect(loaded[0]).toBe('msg-0001');
    });
  });

  describe('reaching messages newer than the anchor', () => {
    it('exposes a nextCursor when the page stops at an old unread message', async () => {
      await seed(20);
      await db.saveReadTime({ conversationId, lastMessageTimestamp: 17 * 1000 });

      const { ids: loaded, hasNextPage, page } = await mount();

      expect(loaded[loaded.length - 1]).toBe('msg-0018');
      // Before the fix: null, because 18 < limit(100). msg-0019 and msg-0020
      // were unreachable until a full page reload.
      expect(hasNextPage).toBe(true);

      const forward = await db.getMessages({
        spaceId: SPACE,
        channelId: CHANNEL,
        cursor: page.nextCursor!,
        direction: 'forward',
      });
      expect(ids(forward.messages)).toEqual(['msg-0019', 'msg-0020']);
    });

    it('control: loading from the bottom has no newer page to fetch', async () => {
      await seed(20);
      await db.saveReadTime({ conversationId, lastMessageTimestamp: 20 * 1000 });

      const { hasNextPage } = await mount();

      expect(hasNextPage).toBe(false);
    });
  });

  describe('forward pagination ordering', () => {
    it('returns messages oldest-first when the page is not full', async () => {
      await seed(10);

      const res = await db.getMessages({
        spaceId: SPACE,
        channelId: CHANNEL,
        cursor: 3000,
        direction: 'forward',
        limit: 40,
      });

      // Before the fix this came back reversed: msg-0010 … msg-0004.
      expect(ids(res.messages)).toEqual([
        'msg-0004', 'msg-0005', 'msg-0006', 'msg-0007',
        'msg-0008', 'msg-0009', 'msg-0010',
      ]);
    });

    it('control: a full page was already oldest-first and stays that way', async () => {
      await seed(10);

      const res = await db.getMessages({
        spaceId: SPACE,
        channelId: CHANNEL,
        cursor: 3000,
        direction: 'forward',
        limit: 3,
      });

      expect(ids(res.messages)).toEqual(['msg-0004', 'msg-0005', 'msg-0006']);
    });

    it('control: backward pages stay oldest-first', async () => {
      await seed(10);

      const res = await db.getMessages({
        spaceId: SPACE,
        channelId: CHANNEL,
        cursor: 8000,
        direction: 'backward',
        limit: 40,
      });

      expect(ids(res.messages)).toEqual([
        'msg-0001', 'msg-0002', 'msg-0003', 'msg-0004',
        'msg-0005', 'msg-0006', 'msg-0007',
      ]);
    });
  });

  // prevCursor drives scroll-UP ("load older"). The fix deliberately left its
  // semantics alone, but "unchanged" was never actually asserted anywhere —
  // before or after. These pin it so a future edit to the cursor block can't
  // quietly break loading history.
  describe('prevCursor / loading older messages', () => {
    it('points at the oldest message of the page', async () => {
      await seed(10);

      const res = await db.getMessages({
        spaceId: SPACE,
        channelId: CHANNEL,
        cursor: 8000,
        direction: 'backward',
        limit: 40,
      });

      expect(res.prevCursor).toBe(1000); // msg-0001
    });

    it('is null for an empty page, so pagination terminates', async () => {
      await seed(10);

      const res = await db.getMessages({
        spaceId: SPACE,
        channelId: CHANNEL,
        cursor: 1000, // nothing older than msg-0001
        direction: 'backward',
        limit: 40,
      });

      expect(res.messages).toEqual([]);
      expect(res.prevCursor).toBeNull();
    });

    it('walks the whole history to the top without gaps or duplicates', async () => {
      await seed(25);

      const seen: string[] = [];
      let cursor: number | undefined;
      for (let guard = 0; guard < 20; guard++) {
        const page = await db.getMessages({
          spaceId: SPACE,
          channelId: CHANNEL,
          cursor,
          direction: cursor === undefined ? undefined : 'backward',
          limit: 10,
        });
        if (page.messages.length === 0) break;
        seen.unshift(...ids(page.messages));
        if (page.prevCursor === null) break;
        cursor = page.prevCursor;
      }

      expect(seen).toHaveLength(25);
      expect(new Set(seen).size).toBe(25);
      expect(seen[0]).toBe('msg-0001');
      expect(seen[24]).toBe('msg-0025');
    });
  });

  describe('loadMessagesAround', () => {
    it('returns one chronological run through the target', async () => {
      await seed(10);

      const around = await loadMessagesAround({
        messageDB: db,
        spaceId: SPACE,
        channelId: CHANNEL,
        targetMessageId: 'msg-0005',
      });

      // Before the fix the tail was reversed:
      // [1,2,3,4,5,10,9,8,7,6] — hash navigation and the unread jump both
      // rendered every message after the target in reverse order.
      expect(ids(around.messages)).toEqual([
        'msg-0001', 'msg-0002', 'msg-0003', 'msg-0004', 'msg-0005',
        'msg-0006', 'msg-0007', 'msg-0008', 'msg-0009', 'msg-0010',
      ]);
    });
  });
});
