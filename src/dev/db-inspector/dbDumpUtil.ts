/**
 * Database Dump Utility
 *
 * Safely dumps IndexedDB contents with sensitive data redacted.
 * Used by DbInspector UI and exposed as window.__dbDump() in dev mode.
 *
 * SECURITY: Private keys and encryption states are redacted but their
 * presence/length is preserved for debugging purposes.
 *
 * SCHEMA DRIFT: this module deliberately knows NOTHING about the current schema
 * version or store list up front — both are read from the live database at
 * runtime (see `openDb` / `listStores`). A hardcoded `DB_VERSION` here used to
 * go stale on every schema bump and made the whole tool throw `VersionError`
 * (IndexedDB refuses to open an existing DB at a LOWER version than it is
 * stamped at). The only schema knowledge left is the redaction classification
 * below, and stores missing from it are redacted by default (fail closed) and
 * flagged in the UI. `dbInspectorCoverage.test.ts` fails the moment a new store
 * is added to `messages.ts` without being classified here.
 *
 * NOTE: This file is in src/dev/ which is only included in development builds.
 * Additional runtime checks ensure functions are not exposed in production.
 */

import { QUORUM_DB_NAME, QUORUM_DB_VERSION } from '../../db/dbVersion';
import { openQuorumDb } from '../openQuorumDb';

// Safety check - this module should never be imported in production
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
  throw new Error('db-inspector should not be imported in production builds');
}

const DB_NAME = QUORUM_DB_NAME;

// Stores that are safe to dump in full
const SAFE_STORES = [
  'messages',
  'conversations',
  'conversation_users',
  'user_info',
  'inbox_mapping',
  'spaces',
  'bookmarks',
  'muted_users',
  'action_queue',
  'deleted_messages',
  'channel_threads',
  'thread_read_times',
  'space_member_devices',
  // Which Spaces the user left or was removed from. Safe: ids and a timestamp,
  // no key material.
  'departed_spaces',
] as const;

// Stores with sensitive data that need redaction
const SENSITIVE_STORES = [
  'space_keys',
  'encryption_states',
  'latest_states',
  'user_config',
  'space_members',
  'user_notes',
  'search_indices',
] as const;

type SafeStore = (typeof SAFE_STORES)[number];
type SensitiveStore = (typeof SENSITIVE_STORES)[number];
/** A store this module knows how to classify. Discovery returns plain strings,
 *  since the live DB may hold stores newer than this list. */
type KnownStore = SafeStore | SensitiveStore;
type StoreName = string;

const CLASSIFIED_STORES: KnownStore[] = [...SAFE_STORES, ...SENSITIVE_STORES];

/** Stores this module can classify, in a stable display order. Note this is NOT
 *  the list the tool dumps — that comes from the live DB. */
const ALL_STORES: KnownStore[] = CLASSIFIED_STORES;

const CLASSIFIED_SET = new Set<string>(CLASSIFIED_STORES);
const SENSITIVE_SET = new Set<string>(SENSITIVE_STORES);

/** Redaction state of a store, as reported in dumps and in the UI. */
export type StoreClassification = 'safe' | 'sensitive' | 'unclassified';

export function classifyStore(storeName: string): StoreClassification {
  if (SENSITIVE_SET.has(storeName)) return 'sensitive';
  if (CLASSIFIED_SET.has(storeName)) return 'safe';
  return 'unclassified';
}

/**
 * Redact a sensitive string, preserving length info
 */
function redactString(value: unknown, fieldName: string): string {
  if (value === undefined) return '[MISSING]';
  if (value === null) return '[NULL]';
  if (typeof value !== 'string') return `[INVALID:${typeof value}]`;
  if (value.length === 0) return '[EMPTY]';

  // For public keys, show first 8 and last 4 chars
  if (fieldName === 'publicKey' && value.length > 16) {
    return `${value.slice(0, 8)}...${value.slice(-4)} [${value.length}chars]`;
  }

  return `[REDACTED:${value.length}chars]`;
}

/**
 * Redact sensitive fields from a space_keys record
 */
function redactSpaceKey(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...record,
    privateKey: redactString(record.privateKey, 'privateKey'),
    publicKey: redactString(record.publicKey, 'publicKey'),
  };
}

/**
 * Redact sensitive fields from encryption_states / latest_states record
 */
function redactEncryptionState(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...record,
    state: redactString(record.state, 'state'),
  };
}

/**
 * Redact sensitive fields from user_config record
 */
function redactUserConfig(record: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...record };

  // Redact spaceKeys array
  if (Array.isArray(record.spaceKeys)) {
    redacted.spaceKeys = record.spaceKeys.map((sk: Record<string, unknown>) => ({
      spaceId: sk.spaceId,
      encryptionState: sk.encryptionState ? '[REDACTED:encryptionState]' : '[MISSING]',
      keys: Array.isArray(sk.keys)
        ? sk.keys.map((k: Record<string, unknown>) => redactSpaceKey(k))
        : '[MISSING]',
    }));
  }

  return redacted;
}

/**
 * Redact sensitive fields from space_members record
 */
function redactSpaceMember(record: Record<string, unknown>): Record<string, unknown> {
  // space_members doesn't have private keys, but let's be safe
  // and only include known safe fields
  return {
    spaceId: record.spaceId,
    user_address: record.user_address,
    inbox_address: record.inbox_address,
    isKicked: record.isKicked,
    name: record.name,
    profile_image: record.profile_image,
  };
}

/**
 * Redact a user_notes record. The note body is a private annotation one user
 * wrote about another and is never synced — keep it out of pasted dumps.
 */
function redactUserNote(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...record,
    note: redactString(record.note, 'note'),
  };
}

/**
 * Redact a search_indices record. `serializedIndex` is the full message corpus
 * for a conversation — both private and large enough to swamp a dump.
 */
function redactSearchIndex(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...record,
    serializedIndex: redactString(record.serializedIndex, 'serializedIndex'),
  };
}

/**
 * Fallback redaction for a store this module doesn't know about yet (added to
 * `messages.ts` without being classified here). Field names survive so the
 * shape is still debuggable; every value is replaced by a type/size descriptor
 * so nothing sensitive can leak from a store nobody has reviewed.
 */
function redactUnclassified(record: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null) redacted[key] = '[NULL]';
    else if (value === undefined) redacted[key] = '[MISSING]';
    else if (typeof value === 'string') redacted[key] = `[UNCLASSIFIED:string:${value.length}chars]`;
    else if (Array.isArray(value)) redacted[key] = `[UNCLASSIFIED:array:${value.length}items]`;
    else redacted[key] = `[UNCLASSIFIED:${typeof value}]`;
  }
  return redacted;
}

/**
 * Apply redaction to a record based on store name
 */
function redactRecord(storeName: string, record: Record<string, unknown>): Record<string, unknown> {
  switch (storeName) {
    case 'space_keys':
      return redactSpaceKey(record);
    case 'encryption_states':
    case 'latest_states':
      return redactEncryptionState(record);
    case 'user_config':
      return redactUserConfig(record);
    case 'space_members':
      return redactSpaceMember(record);
    case 'user_notes':
      return redactUserNote(record);
    case 'search_indices':
      return redactSearchIndex(record);
    default:
      return classifyStore(storeName) === 'safe' ? record : redactUnclassified(record);
  }
}

/** Open at whatever version the database is currently stamped at — see
 *  `openQuorumDb` for why no version is passed. */
async function openDb(): Promise<IDBDatabase> {
  return openQuorumDb(DB_NAME);
}

/** Store names present in the live database, in a stable order: classified
 *  stores first (in declaration order), then anything unrecognised. */
function listStores(db: IDBDatabase): string[] {
  const present = new Set(Array.from(db.objectStoreNames));
  const known = CLASSIFIED_STORES.filter((name) => present.has(name));
  const unknown = Array.from(present)
    .filter((name) => !CLASSIFIED_SET.has(name))
    .sort();
  return [...known, ...unknown];
}

/**
 * Read all records from a store
 */
async function readStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(`Failed to read ${storeName}: ${req.error?.message}`));
    } catch (err) {
      // Store might not exist
      resolve([]);
    }
  });
}

/**
 * Count records in a store
 */
async function countStore(db: IDBDatabase, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(`Failed to count ${storeName}: ${req.error?.message}`));
    } catch (err) {
      resolve(0);
    }
  });
}

export interface DbDumpOptions {
  /** Include full records (default: true for stores with <100 records) */
  includeRecords?: boolean;
  /** Stores to include (default: every store present in the database) */
  stores?: StoreName[];
  /** Max records per store (default: 100) */
  maxRecords?: number;
  /** Include message content (can be large) */
  includeMessages?: boolean;
}

export interface StoreDump {
  name: string;
  count: number;
  records?: unknown[];
  truncated?: boolean;
  /** How this store's records were redacted. */
  classification?: StoreClassification;
}

export interface DbDump {
  timestamp: string;
  dbName: string;
  /** Version the live database is actually stamped at. */
  dbVersion: number;
  /** Version this build of the app opens the database at. A mismatch means the
   *  DB predates the running build (or was written by a newer branch). */
  appDbVersion: number;
  stores: StoreDump[];
  summary: Record<string, number>;
  /** Stores found in the database that this tool has no redaction rule for. */
  unclassifiedStores?: string[];
}

/** Live schema shape, read from the database rather than assumed. */
export interface DbInfo {
  dbName: string;
  dbVersion: number;
  appDbVersion: number;
  stores: string[];
  counts: Record<string, number>;
  unclassifiedStores: string[];
  /** Classified stores the live database doesn't have (usually: the DB predates
   *  a schema bump and needs a reset — see the dev gotcha in
   *  `.agents/docs/quorum-db-schema.md`). */
  missingStores: string[];
}

/**
 * Read the live database's version, store list and record counts.
 */
export async function getDbInfo(): Promise<DbInfo> {
  const db = await openDb();

  try {
    const stores = listStores(db);
    const counts: Record<string, number> = {};
    for (const storeName of stores) {
      counts[storeName] = await countStore(db, storeName);
    }

    return {
      dbName: DB_NAME,
      dbVersion: db.version,
      appDbVersion: QUORUM_DB_VERSION,
      stores,
      counts,
      unclassifiedStores: stores.filter((name) => !CLASSIFIED_SET.has(name)),
      missingStores: CLASSIFIED_STORES.filter((name) => !stores.includes(name)),
    };
  } finally {
    db.close();
  }
}

/**
 * Dump the database with redacted sensitive data
 */
export async function dumpDatabase(options: DbDumpOptions = {}): Promise<DbDump> {
  const {
    includeRecords = true,
    stores,
    maxRecords = 100,
    includeMessages = false,
  } = options;

  const db = await openDb();
  const present = listStores(db);
  const selected = stores ? stores.filter((name) => present.includes(name)) : present;

  const result: DbDump = {
    timestamp: new Date().toISOString(),
    dbName: DB_NAME,
    dbVersion: db.version,
    appDbVersion: QUORUM_DB_VERSION,
    stores: [],
    summary: {},
  };

  const unclassified = selected.filter((name) => !CLASSIFIED_SET.has(name));
  if (unclassified.length > 0) result.unclassifiedStores = unclassified;

  try {
    for (const storeName of selected) {
      const classification = classifyStore(storeName);

      // Skip messages by default (can be very large)
      if (storeName === 'messages' && !includeMessages) {
        const count = await countStore(db, storeName);
        result.stores.push({ name: storeName, count, records: undefined, classification });
        result.summary[storeName] = count;
        continue;
      }

      const count = await countStore(db, storeName);
      result.summary[storeName] = count;

      if (!includeRecords) {
        result.stores.push({ name: storeName, count, classification });
        continue;
      }

      const records = await readStore(db, storeName);

      // Redact unless the store is on the known-safe list (fail closed)
      const processedRecords =
        classification === 'safe'
          ? records
          : records.map((r) => redactRecord(storeName, r as Record<string, unknown>));

      // Truncate if too many
      const truncated = processedRecords.length > maxRecords;
      const finalRecords = truncated ? processedRecords.slice(0, maxRecords) : processedRecords;

      result.stores.push({
        name: storeName,
        count,
        records: finalRecords,
        truncated: truncated || undefined,
        classification,
      });
    }
  } finally {
    db.close();
  }

  return result;
}

/**
 * Dump a single store
 */
export async function dumpStore(storeName: StoreName, maxRecords = 100): Promise<StoreDump> {
  const db = await openDb();

  try {
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(
        `Store "${storeName}" is not in ${DB_NAME} v${db.version}. ` +
          `The database may predate this build (app expects v${QUORUM_DB_VERSION}) — reset it from Settings → Danger Zone.`
      );
    }

    const classification = classifyStore(storeName);
    const count = await countStore(db, storeName);
    const records = await readStore(db, storeName);

    const processedRecords =
      classification === 'safe'
        ? records
        : records.map((r) => redactRecord(storeName, r as Record<string, unknown>));

    const truncated = processedRecords.length > maxRecords;
    const finalRecords = truncated ? processedRecords.slice(0, maxRecords) : processedRecords;

    return {
      name: storeName,
      count,
      records: finalRecords,
      truncated: truncated || undefined,
      classification,
    };
  } finally {
    db.close();
  }
}

/**
 * Get counts for every store present in the database
 */
export async function getStoreCounts(): Promise<Record<string, number>> {
  const { counts } = await getDbInfo();
  return counts;
}

/**
 * Format dump as JSON string for copying
 */
export function formatDumpForCopy(dump: DbDump): string {
  return JSON.stringify(dump, null, 2);
}

/**
 * Quick dump for debugging - returns formatted JSON string
 */
export async function quickDump(includeMessages = false): Promise<string> {
  const dump = await dumpDatabase({ includeMessages });
  return formatDumpForCopy(dump);
}

// Expose to window in development
if (typeof window !== 'undefined' && import.meta.env?.DEV) {

  (window as any).__dbDump = async (includeMessages = false) => {
    const json = await quickDump(includeMessages);
    console.log(json);
    return json;
  };


  (window as any).__dbCounts = async () => {
    const counts = await getStoreCounts();
    console.table(counts);
    return counts;
  };


  (window as any).__dbStore = async (storeName: string, maxRecords = 50) => {
    const dump = await dumpStore(storeName, maxRecords);
    console.log(JSON.stringify(dump, null, 2));
    return dump;
  };


  (window as any).__dbInfo = async () => {
    const info = await getDbInfo();
    console.log(info);
    return info;
  };

  console.log(
    '%c[Dev] DB Inspector available: __dbDump(), __dbCounts(), __dbStore(name), __dbInfo()',
    'color: #22c55e; font-weight: bold'
  );
}

export { ALL_STORES, SAFE_STORES, SENSITIVE_STORES, CLASSIFIED_STORES };
export type { StoreName, KnownStore };
