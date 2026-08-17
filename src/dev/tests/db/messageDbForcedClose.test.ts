import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import forceCloseDatabase from 'fake-indexeddb/lib/forceCloseDatabase';
import { MessageDB } from '../../../db/messages';
import type { ChannelThread } from '@quilibrium/quorum-shared';

/**
 * The browser can force-close an IndexedDB connection without the app asking:
 * storage eviction, corruption, Safari's ITP wipe, or the user clearing site
 * data with the tab open. When that happens the connection object is still
 * non-null but every transaction on it throws InvalidStateError.
 *
 * `MessageDB.init()` short-circuits on `if (this.db) return`, so unless the
 * closed connection is cleared the instance never reopens — and since
 * MessageDBProvider builds one instance for the whole app lifetime, that
 * wedges every read and write for the rest of the tab's session.
 *
 * `forceCloseDatabase` is fake-indexeddb's spec-accurate simulation of exactly
 * that event (closing-connection steps with the forced flag set), which is what
 * makes this reproducible without a real browser.
 */
/**
 * Wait for the forced close to actually land rather than guessing a delay.
 *
 * `closeConnection` sets `_closePending` synchronously but defers the close
 * event via queueTask whenever a transaction is not yet finished, so a fixed
 * `setTimeout(0)` is a race: it passed in isolation and failed under full-suite
 * CPU load. Polling the condition the fix is responsible for makes the test
 * deterministic regardless of machine load.
 */
const waitForConnectionDrop = async (db: MessageDB): Promise<void> => {
  for (let i = 0; i < 100; i++) {
    if ((db as unknown as { db: IDBDatabase | null }).db === null) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(
    'onclose never cleared the connection handle after a forced close'
  );
};

describe('MessageDB - recovery from a forced connection close', () => {
  let db: MessageDB;

  const thread: ChannelThread = {
    threadId: 'thread-forced-close',
    spaceId: 'space-1',
    channelId: 'channel-1',
    rootMessageId: 'msg-1',
    createdBy: 'user-1',
    createdAt: 1000,
    lastActivityAt: 2000,
    replyCount: 0,
    isClosed: false,
    hasParticipated: false,
  };

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();

    db = new MessageDB();
    await db.init();
  });

  // Control arm: proves the harness itself can read back a write, so a failure
  // in the test below is attributable to the forced close and nothing else.
  it('reads back a saved thread when the connection is never closed', async () => {
    await db.saveChannelThread(thread);
    await expect(db.getChannelThread(thread.threadId)).resolves.toMatchObject({
      threadId: thread.threadId,
    });
  });

  it('reopens and serves reads after the browser force-closes the connection', async () => {
    await db.saveChannelThread(thread);

    const rawConnection = (db as unknown as { db: IDBDatabase | null }).db;
    expect(rawConnection).not.toBeNull();

    forceCloseDatabase(rawConnection);
    await waitForConnectionDrop(db);

    await expect(db.getChannelThread(thread.threadId)).resolves.toMatchObject({
      threadId: thread.threadId,
    });
  });

  it('serves writes after the browser force-closes the connection', async () => {
    const rawConnection = (db as unknown as { db: IDBDatabase | null }).db;
    forceCloseDatabase(rawConnection);
    await waitForConnectionDrop(db);

    await expect(db.saveChannelThread(thread)).resolves.toBeUndefined();
    await expect(db.getChannelThread(thread.threadId)).resolves.toMatchObject({
      threadId: thread.threadId,
    });
  });
});
