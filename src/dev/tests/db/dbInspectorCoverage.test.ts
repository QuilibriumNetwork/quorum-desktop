import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDB } from '../../../db/messages';
import { QUORUM_DB_VERSION } from '../../../db/dbVersion';
import {
  getDbInfo,
  dumpDatabase,
  dumpStore,
  classifyStore,
  CLASSIFIED_STORES,
} from '../../db-inspector/dbDumpUtil';

// Guards the DB Inspector against schema drift. It used to hardcode
// `DB_VERSION = 7` and a fixed store list, so every schema bump silently broke
// it: opening an existing v14 database at v7 throws VersionError, and stores
// added after v7 were invisible. These tests fail the moment either kind of
// drift reappears.
describe('DB Inspector - schema coverage', () => {
  let db: MessageDB;

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    db = new MessageDB();
    await db.init(); // creates quorum_db at the app's current DB_VERSION
  });

  it('opens the database at whatever version the app created it at', async () => {
    const info = await getDbInfo();

    expect(info.dbVersion).toBe(QUORUM_DB_VERSION);
    expect(info.appDbVersion).toBe(QUORUM_DB_VERSION);
    expect(info.dbName).toBe('quorum_db');
  });

  it('classifies every store the app actually creates', async () => {
    const info = await getDbInfo();

    // A new store in messages.ts with no entry in SAFE_STORES/SENSITIVE_STORES
    // lands here. Classify it in dbDumpUtil.ts rather than deleting this
    // assertion — unclassified stores are fully redacted and unreadable.
    expect(info.unclassifiedStores).toEqual([]);
  });

  it('knows about no stores the app does not create', async () => {
    const info = await getDbInfo();

    // The reverse drift: a store removed from (or renamed in) messages.ts but
    // still listed in dbDumpUtil.ts.
    expect(info.missingStores).toEqual([]);
  });

  it('discovers stores from the live database, not a hardcoded list', async () => {
    const info = await getDbInfo();

    expect(info.stores.length).toBe(CLASSIFIED_STORES.length);
    // Spot-check stores added after the stale v7 list was written.
    expect(info.stores).toContain('space_member_devices');
    expect(info.stores).toContain('search_indices');
    expect(info.stores).toContain('user_notes');
  });

  it('dumps every store without throwing', async () => {
    const dump = await dumpDatabase();

    expect(dump.dbVersion).toBe(QUORUM_DB_VERSION);
    expect(dump.stores.map((s) => s.name).sort()).toEqual([...(await getDbInfo()).stores].sort());
    expect(dump.unclassifiedStores).toBeUndefined();
  });

  it('reports a helpful error for a store that is not in the database', async () => {
    await expect(dumpStore('not_a_real_store')).rejects.toThrow(/not in quorum_db/);
  });
});

describe('DB Inspector - redaction', () => {
  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    await new MessageDB().init();
  });

  it('redacts private keys in space_keys', async () => {
    const write = (store: string, value: unknown) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('quorum_db');
        req.onsuccess = () => {
          const idb = req.result;
          const tx = idb.transaction(store, 'readwrite');
          tx.objectStore(store).put(value);
          tx.oncomplete = () => {
            idb.close();
            resolve();
          };
          tx.onerror = () => {
            idb.close();
            reject(tx.error);
          };
        };
        req.onerror = () => reject(req.error);
      });

    await write('space_keys', {
      spaceId: 'space-1',
      keyId: 'key-1',
      privateKey: 'super-secret-private-key',
      publicKey: 'pub'.repeat(10),
    });

    const dump = await dumpStore('space_keys');
    const record = dump.records?.[0] as Record<string, unknown>;

    expect(dump.classification).toBe('sensitive');
    expect(record.privateKey).toMatch(/^\[REDACTED:\d+chars\]$/);
    expect(JSON.stringify(dump)).not.toContain('super-secret-private-key');
  });

  it('treats an unknown store as sensitive rather than dumping it raw', () => {
    expect(classifyStore('some_future_store')).toBe('unclassified');
    expect(classifyStore('space_keys')).toBe('sensitive');
    expect(classifyStore('messages')).toBe('safe');
  });
});

describe('DB Inspector - missing database', () => {
  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
  });

  it('does not create an empty v1 database when none exists', async () => {
    // A version-less open would otherwise create quorum_db at v1, which makes
    // MessageDB.init() skip its `oldVersion < 1` block and leave the app with
    // no object stores at all.
    await expect(getDbInfo()).rejects.toThrow(/does not exist yet/);

    const dbs = await indexedDB.databases();
    expect(dbs.find((d) => d.name === 'quorum_db')).toBeUndefined();

    // And the app can still create it normally afterwards.
    await new MessageDB().init();
    const info = await getDbInfo();
    expect(info.dbVersion).toBe(QUORUM_DB_VERSION);
  });
});
