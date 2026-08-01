/**
 * Shared read-only opener for `quorum_db`, used by the dev tools (DB Inspector,
 * DM Doctor).
 *
 * Two rules, both learned the hard way:
 *
 * 1. **Never pass a version.** IndexedDB refuses to open an existing database at
 *    a LOWER version than it is stamped at (`VersionError`), so any hardcoded
 *    version here goes stale — and breaks the tool — on the next schema bump.
 *    A version-less open takes the database exactly as it is and never fires an
 *    upgrade. Read `db.version` / `db.objectStoreNames` afterwards to learn the
 *    live schema.
 *
 * 2. **A version-less open still CREATES the database if it is missing**, at
 *    version 1 with no stores. That is worse than an error: `MessageDB.init()`
 *    only creates its initial stores when `oldVersion < 1`, so a stray v1
 *    database leaves the app with no stores at all. An upgrade event here means
 *    the database was absent, so the creation is aborted and rolled back and the
 *    caller gets a clear error instead.
 */

import { QUORUM_DB_NAME } from '../db/dbVersion';

export class QuorumDbMissingError extends Error {
  constructor(dbName: string) {
    super(`Database "${dbName}" does not exist yet. Open the app and sign in first.`);
    this.name = 'QuorumDbMissingError';
  }
}

export function openQuorumDb(dbName = QUORUM_DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    let missing = false;

    req.onupgradeneeded = (event) => {
      missing = true;
      (event.target as IDBOpenDBRequest).transaction?.abort();
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      if (!missing) {
        reject(req.error ?? new Error(`Failed to open ${dbName}`));
        return;
      }
      // Belt and braces: don't rely on every engine rolling the aborted
      // creation back identically. Nothing holds a connection after an aborted
      // upgrade, so this can't block, and it can only ever target a database we
      // just created ourselves.
      const del = indexedDB.deleteDatabase(dbName);
      const done = () => reject(new QuorumDbMissingError(dbName));
      del.onsuccess = done;
      del.onerror = done;
      del.onblocked = done;
    };
  });
}
