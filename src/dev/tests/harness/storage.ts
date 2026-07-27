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
