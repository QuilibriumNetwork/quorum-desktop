/**
 * Reset App Data — the wipe has to clear key material, not just app data.
 *
 * The SDK keeps key material in its own IndexedDB database, separate from the
 * app's `quorum_db`. The invariant under test: once `wipeLocalAppData()`
 * resolves, nothing readable is left in EITHER store, so the dialog's promise
 * to delete "your private keys" holds on every code path.
 *
 * Everything here goes through the SDK's PUBLIC helpers
 * (`passkey.encryptDataSaveKey` / `loadKeyDecryptData` / `authenticate`) and
 * never touches the `'KeyDB'` string itself. That is deliberate: the wipe
 * deletes that database BY NAME, which couples it to an SDK internal, and
 * `indexedDB.deleteDatabase` on a database that does not exist resolves
 * successfully rather than erroring. So if a future SDK version renames its
 * database, the delete would silently become a no-op. Seeding through the
 * SDK's own API is what turns that silent no-op into a red test here.
 *
 * The keys below are invented constants, not real key material.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Buffer } from 'buffer';
import { passkey } from '@quilibrium/quilibrium-js-sdk-channels';
import { wipeLocalAppData } from '@/services/resetAppData';
import { QUORUM_DB_NAME } from '@/db/dbVersion';

/** Matches `fqAppPrefix: 'Quorum'` in useUnifiedOnboardingFlow.ts. */
const APP_PREFIX = 'Quorum';
const FALLBACK_FLAG = `${APP_PREFIX.toLowerCase()}-master-prf-incompatibility`;

/**
 * An Ed448 private key is 57 bytes, and `authenticate` branches on that exact
 * length (`data.byteLength == 57` → hex) — so the fixture has to be 57 bytes or
 * the SDK takes its utf-8 branch and the test stops exercising the real path.
 */
const FAKE_MASTER_KEY = new Uint8Array(57).map((_, i) => (i * 7 + 3) & 0xff);
const FAKE_MASTER_KEY_HEX = Buffer.from(FAKE_MASTER_KEY).toString('hex');

beforeAll(() => {
  // setup.ts replaces crypto.subtle with vi.fn() stubs that return undefined.
  // AES-GCM has to be real here or encryptDataSaveKey silently stores nothing.
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
});

beforeEach(async () => {
  const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
  const fdb = new FDBFactory();
  globalThis.indexedDB = fdb;
  // The SDK's callOnStore reads `window.indexedDB`, not the bare global.
  (window as unknown as { indexedDB: IDBFactory }).indexedDB = fdb;
  localStorage.clear();
  sessionStorage.clear();
});

/** Stand in for MessageDB: create the app database with one store. */
const createAppDb = (): Promise<IDBDatabase> =>
  new Promise((resolve) => {
    const open = indexedDB.open(QUORUM_DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('messages');
    open.onsuccess = () => resolve(open.result);
  });

/**
 * Whether the app database is still there.
 *
 * Opening it is the portable probe: `onupgradeneeded` only fires when there was
 * nothing to open. It leaves an empty database behind, which is harmless — each
 * test gets a fresh IndexedDB factory.
 */
const appDbExists = (): Promise<boolean> =>
  new Promise((resolve) => {
    let existed = true;
    const open = indexedDB.open(QUORUM_DB_NAME);
    open.onupgradeneeded = () => {
      existed = false;
    };
    open.onsuccess = () => {
      open.result.close();
      resolve(existed);
    };
  });

/** Onboarding on the fallback path: master key to id=1, flag set. */
const seedFallbackRegistration = async () => {
  localStorage.setItem(FALLBACK_FLAG, 'true');
  localStorage.setItem(
    'passkeys-list',
    JSON.stringify([
      {
        credentialId: 'not-passkey',
        address: 'QmFakeAddrForTest0000000000000000',
        publicKey: 'aabbcc',
        completedOnboarding: true,
      },
    ])
  );
  await passkey.encryptDataSaveKey(1, Buffer.from(FAKE_MASTER_KEY));
};

/**
 * The control arm. Every assertion below is "the SDK can no longer read X",
 * which would also pass if the fixture had never stored X in the first place —
 * a broken seed, stubbed crypto, the wrong IndexedDB factory. This proves the
 * seed works, so a later rejection means "deleted" and not "never written".
 */
describe('fixture: seeding through the SDK stores a readable key', () => {
  it('authenticate() returns what encryptDataSaveKey stored', async () => {
    await seedFallbackRegistration();

    const cred = await passkey.authenticate(APP_PREFIX, {
      credentialId: 'not-passkey',
    });

    expect(cred.largeBlob).toBe(FAKE_MASTER_KEY_HEX);
  });
});

describe('the fix: wipeLocalAppData clears the SDK key store', () => {
  it('makes the master key unreadable through the SDK', async () => {
    await seedFallbackRegistration();

    await wipeLocalAppData();
    localStorage.setItem(FALLBACK_FLAG, 'true');

    // 'no data' is the SDK's own rejection for an absent record. Asserting the
    // exact reason matters: a bare "it rejected" would also pass if the test
    // had broken the crypto or the store, i.e. for the wrong reason.
    await expect(passkey.loadKeyDecryptData(1)).rejects.toBe('no data');
  });

  it('leaves authenticate() with nothing to hand back', async () => {
    await seedFallbackRegistration();

    await wipeLocalAppData();
    localStorage.setItem(FALLBACK_FLAG, 'true');

    await expect(
      passkey.authenticate(APP_PREFIX, { credentialId: 'not-passkey' })
    ).rejects.toBe('no data');
  });

  /**
   * The id=2 record holds the identity and device keysets. On the fallback
   * path it is encrypted under SHA-256(master key), so id=1 is enough to open
   * it — both records have to go, which is why the fix drops the whole store
   * rather than one row.
   */
  it('clears the identity/device keyset record too', async () => {
    await seedFallbackRegistration();
    await passkey.encryptDataSaveKey(2, Buffer.from('{"identity":"x"}', 'utf-8'));

    await wipeLocalAppData();

    await expect(passkey.loadKeyDecryptData(2)).rejects.toBe('no data');
  });

  it('still deletes the app database', async () => {
    await seedFallbackRegistration();
    (await createAppDb()).close();

    await wipeLocalAppData();

    expect(await appDbExists()).toBe(false);
  });

  it('still clears web storage', async () => {
    await seedFallbackRegistration();
    sessionStorage.setItem('some-session-state', 'x');

    await wipeLocalAppData();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  /**
   * A blocked delete means another tab still holds the database open. Treating
   * it as success would reload on the same data and the reset would appear to
   * do nothing, so it has to surface — same contract quorum_db already had.
   */
  it('rejects with "blocked" rather than half-completing', async () => {
    await seedFallbackRegistration();

    // Holding the connection open makes deleteDatabase fire onblocked.
    const held = await createAppDb();

    await expect(wipeLocalAppData()).rejects.toThrow('blocked');
    held.close();
  });

  /**
   * The failure path, pinned deliberately.
   *
   * It is tempting to move the storage clears into a `finally` so a failed
   * wipe still "does as much as it can". That is the wrong trade: clearing
   * `passkeys-list` — the only record that an account exists on this device —
   * while key material is still on disk would lock the user out AND leave
   * behind the exact thing the reset exists to remove. Failing without
   * touching storage leaves a state the user retries out of cleanly, because
   * deleting an already-deleted database succeeds.
   */
  it('leaves web storage untouched when the wipe fails', async () => {
    await seedFallbackRegistration();
    const held = await createAppDb();

    await expect(wipeLocalAppData()).rejects.toThrow('blocked');

    expect(localStorage.getItem('passkeys-list')).not.toBeNull();
    expect(localStorage.getItem(FALLBACK_FLAG)).toBe('true');
    held.close();
  });

  /**
   * Retrying after a blocked reset has to converge, otherwise the error the
   * user is shown ("close your other tabs, then try again") is a dead end.
   */
  it('completes on retry once the blocking connection closes', async () => {
    await seedFallbackRegistration();
    const held = await createAppDb();
    await expect(wipeLocalAppData()).rejects.toThrow('blocked');

    held.close();
    await wipeLocalAppData();

    expect(await appDbExists()).toBe(false);
    expect(localStorage.length).toBe(0);
    await expect(passkey.loadKeyDecryptData(1)).rejects.toBe('no data');
  });
});
