import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import forceCloseDatabase from 'fake-indexeddb/lib/forceCloseDatabase';
import { MessageDB } from '../../../db/messages';
import { logger } from '@quilibrium/quorum-shared';
import type { ChannelThread } from '@quilibrium/quorum-shared';

/** Read the private connection handle the lifecycle handlers manage. */
const connectionOf = (db: MessageDB): IDBDatabase | null =>
  (db as unknown as { db: IDBDatabase | null }).db;

const setConnection = (db: MessageDB, connection: IDBDatabase | null): void => {
  (db as unknown as { db: IDBDatabase | null }).db = connection;
};

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
    if (connectionOf(db) === null) return;
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

    const rawConnection = connectionOf(db);
    expect(rawConnection).not.toBeNull();

    forceCloseDatabase(rawConnection);
    await waitForConnectionDrop(db);

    // Asserting on the saved row, not merely on "a read succeeded", also proves
    // the reopen landed on the SAME database rather than a fresh empty one.
    await expect(db.getChannelThread(thread.threadId)).resolves.toMatchObject({
      threadId: thread.threadId,
    });
  });

  it('serves writes after the browser force-closes the connection', async () => {
    const rawConnection = connectionOf(db);
    forceCloseDatabase(rawConnection);
    await waitForConnectionDrop(db);

    await expect(db.saveChannelThread(thread)).resolves.toBeUndefined();
    await expect(db.getChannelThread(thread.threadId)).resolves.toMatchObject({
      threadId: thread.threadId,
    });
  });

  it('recovers from repeated forced closes, not just the first', async () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      forceCloseDatabase(connectionOf(db));
      await waitForConnectionDrop(db);

      const cycleThread = { ...thread, threadId: `thread-cycle-${cycle}` };
      await expect(db.saveChannelThread(cycleThread)).resolves.toBeUndefined();
      await expect(
        db.getChannelThread(cycleThread.threadId)
      ).resolves.toMatchObject({ threadId: cycleThread.threadId });
    }
  });

  it('logs a warning when the browser force-closes the connection', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    forceCloseDatabase(connectionOf(db));
    await waitForConnectionDrop(db);

    // A forced close only ever happens for reasons that destroy or invalidate
    // the store, so recovering without a trace would erase the only evidence
    // the user's local data may have just been wiped.
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('force-closed by the browser')
    );
  });
});

describe('MessageDB - connection lifecycle guards', () => {
  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens exactly one connection when init() is called concurrently', async () => {
    const openSpy = vi.spyOn(globalThis.indexedDB, 'open');
    const db = new MessageDB();

    await Promise.all(Array.from({ length: 8 }, () => db.init()));

    // Without the in-flight guard each caller starts its own open and the last
    // onsuccess wins the field, orphaning the rest: still open, never closed,
    // and able to block a later onupgradeneeded forever.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(connectionOf(db)).not.toBeNull();
  });

  it('ignores a close event from a connection that is no longer current', async () => {
    const db = new MessageDB();
    await db.init();
    const stale = connectionOf(db);
    expect(stale).not.toBeNull();

    // Stand in for the losing side of an init() race: another connection has
    // since become the current one, while `stale` still carries the handlers.
    const replacement = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open('quorum-db-replacement', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    setConnection(db, replacement);

    forceCloseDatabase(stale);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The stale connection's handler must not clear a healthy current one.
    expect(connectionOf(db)).toBe(replacement);
  });
});
