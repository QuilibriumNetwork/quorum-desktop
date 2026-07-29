/**
 * DM Doctor — IndexedDB reads.
 *
 * Thin IO layer, deliberately separate from `dmDoctorCore.ts` so the matching
 * logic stays pure and unit-testable without a browser. Opens `quorum_db`
 * without a version number (never triggers an upgrade — see
 * `.agents/docs/quorum-db-schema.md`'s dev gotcha), same as the console probe
 * this tool replaces (`.agents/tools/dm-debug/07-receiver-probe.js`).
 */

import type { DmDoctorConversationRow, DmDoctorMessageRow } from './dmDoctorCore';

const DB_NAME = 'quorum_db';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to open ${DB_NAME}`));
  });
}

function readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to read ${storeName}`));
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/** Every row in the `messages` store — the whole store, not one conversation,
 *  since misfiled rows live under the wrong conversation by definition. */
export async function readAllMessages(): Promise<DmDoctorMessageRow[]> {
  const db = await openDb();
  try {
    return await readAll<DmDoctorMessageRow>(db, 'messages');
  } finally {
    db.close();
  }
}

/** Every row in the `conversations` store. */
export async function readAllConversations(): Promise<DmDoctorConversationRow[]> {
  const db = await openDb();
  try {
    return await readAll<DmDoctorConversationRow>(db, 'conversations');
  } finally {
    db.close();
  }
}
