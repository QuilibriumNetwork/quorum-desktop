// Storage: the real MessageDB backed by fake-indexeddb. fake-indexeddb/auto
// installs indexedDB + IDBKeyRange as globals, which MessageDB.init() opens
// exactly as it does in the browser. Node 22 provides structuredClone, which
// fake-indexeddb needs.
//
// ⚠️ EACH BOT NEEDS ITS OWN DATABASE. MessageDB hardcodes `DB_NAME = 'quorum_db'`,
// and every bot in this process shares the one global fake-indexeddb — so without
// a per-bot name, two bots open the SAME database and become one client with two
// MessageService instances writing the same rows. Measured consequences of the
// shared-DB version (2026-07-27): each bot subscribed to the other's session
// inboxes (because `refreshSubscriptions` reads every encryption_states row), so
// 41-48% of all arrivals were the bot's OWN outbound ciphertext, each an
// unavoidable AEAD failure. Real browsers showed 0% self-echo across 2709
// captured arrivals, confirming it was this and not app behaviour.
//
// DB_NAME is `private readonly` to TypeScript only; at runtime it is an ordinary
// instance field, so it can be renamed after construction and before init().
import 'fake-indexeddb/auto';
import { MessageDB } from '../../../db/messages';

export async function makeMessageDB(namespace?: string): Promise<MessageDB> {
  const db = new MessageDB();
  if (namespace) {
    (db as unknown as { DB_NAME: string }).DB_NAME = `quorum_db_${namespace}`;
  }
  await db.init();
  return db;
}

/** The database name a MessageDB instance is actually bound to. */
export function dbNameOf(db: MessageDB): string {
  return (db as unknown as { DB_NAME: string }).DB_NAME;
}

/**
 * Destroy the whole database behind a MessageDB — every store, the way the
 * BROWSER destroys it, not row by row.
 *
 * This is what Safari's ITP does after 7 days of non-interaction, and equally
 * what "clear site data" and a brand-new device look like to the app: it comes
 * back to a database that is not there. Deleting rows through the app's own
 * write methods would be a different (and much gentler) experiment — the point
 * here is that the store itself vanishes underneath a live connection.
 *
 * Nothing has to be re-wired afterwards. `deleteDatabase` fires `versionchange`
 * on every open connection, and MessageDB's own handler closes the connection
 * and drops its reference (messages.ts, `connection.onversionchange`). Every
 * read/write method then calls `await this.init()`, which reopens — empty. So
 * the caller keeps the SAME MessageDB instance, and every reference held by
 * MessageService / ActionQueueService / the capture tee stays valid. That
 * recovery is real production code, not a harness fixture.
 *
 * Deliberately NOT the SDK's `KeyDB`. `wipeLocalAppData` (services/resetAppData.ts)
 * deletes both because a real reset must, but this harness never populates KeyDB
 * — bot identities are re-derived from `.state/<name>.json`, since the
 * passkey/WebAuthn layer cannot cross into node (identity.ts). Deleting it here
 * would be a no-op dressed up as coverage, and worse, all bots in this process
 * share one global fake-indexeddb, so it would reach into the OTHER bot. The
 * scenario logs `listDatabaseNames()` instead, which records what is actually
 * there rather than assuming.
 */
export function deleteDatabaseFor(db: MessageDB): Promise<void> {
  const name = dbNameOf(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    // Must REJECT, never resolve. A blocked delete leaves the data fully intact,
    // so treating it as success would let every "the history is gone" assertion
    // downstream pass against a database that was never touched — the exact
    // shape of a test that cannot fail. resetAppData.ts carries the same rule
    // for the same reason.
    req.onblocked = () => reject(new Error(`deleteDatabase(${name}) blocked`));
  });
}
