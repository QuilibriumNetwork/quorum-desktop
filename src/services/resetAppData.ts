/**
 * The destructive half of "Reset App Data".
 *
 * Split out of DangerZone so the wipe can be tested directly — the guarantee
 * this has to make (no key material survives) is not something you want
 * resting on a component test that could pass for the wrong reason.
 *
 * Callers must run the device deregistration BEFORE this: it signs with the
 * master key, and this is what destroys the master key.
 */

import { QUORUM_DB_NAME } from '../db/dbVersion';

/**
 * The SDK's key store (`@quilibrium/quilibrium-js-sdk-channels`, `callOnStore`).
 *
 * Reaching for this by name couples us to an SDK internal — it is a string
 * literal in the SDK, not part of its exported API — and the coupling fails
 * QUIETLY, because `deleteDatabase` on a database that does not exist resolves
 * successfully. If a future SDK version renames it, this stops deleting
 * anything and says nothing.
 *
 * `resetAppDataKeyMaterial.test.ts` is the tripwire: it seeds through the
 * SDK's own `encryptDataSaveKey` and asserts the key is gone afterwards, so a
 * rename breaks the test instead of breaking users. If the SDK ever exposes
 * something like `passkey.clearStoredKeys()`, use that and drop this constant.
 */
const SDK_KEY_DB = 'KeyDB';

const deleteDatabase = (name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    // Blocked means another tab still holds the database open. The old code
    // treated this as success, which silently reloaded on the SAME data and
    // made the reset look like it had done nothing. Reject so the user is
    // told to close other tabs.
    req.onblocked = () => reject(new Error('blocked'));
  });

/**
 * Erase every local trace of the account: both IndexedDB databases and all web
 * storage.
 *
 * Order is deliberate. `quorum_db` is the one held open long-term (MessageDB),
 * so it is the one that realistically blocks — attempting it first means a
 * blocked reset aborts having deleted nothing, instead of destroying the key
 * store and then failing. The key store is opened and closed per operation by
 * the SDK, so it is the far less likely of the two to block.
 *
 * The storage clears deliberately do NOT run on failure. Clearing them anyway
 * would drop `passkeys-list` — the only record that an account exists here —
 * while key material was still on disk, which locks the user out AND keeps the
 * thing the reset was supposed to remove. Failing without touching storage
 * leaves a state the user can simply retry out of, since deleting an
 * already-deleted database succeeds. `resetAppDataKeyMaterial.test.ts` pins
 * this, so please don't "tidy" it into a `finally`.
 */
export const wipeLocalAppData = async (): Promise<void> => {
  await deleteDatabase(QUORUM_DB_NAME);
  await deleteDatabase(SDK_KEY_DB);
  localStorage.clear();
  sessionStorage.clear();
};
