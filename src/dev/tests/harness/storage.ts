// Storage: the real MessageDB backed by fake-indexeddb. fake-indexeddb/auto
// installs indexedDB + IDBKeyRange as globals, which MessageDB.init() opens
// exactly as it does in the browser. Node 22 provides structuredClone, which
// fake-indexeddb needs.
import 'fake-indexeddb/auto';
import { MessageDB } from '../../../db/messages';

export async function makeMessageDB(): Promise<MessageDB> {
  const db = new MessageDB();
  await db.init();
  return db;
}
