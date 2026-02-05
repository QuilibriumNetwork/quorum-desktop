/**
 * Database Dump Utility
 *
 * Safely dumps IndexedDB contents with sensitive data redacted.
 * Used by DbInspector UI and exposed as window.__dbDump() in dev mode.
 *
 * SECURITY: Private keys and encryption states are redacted but their
 * presence/length is preserved for debugging purposes.
 *
 * NOTE: This file is in src/dev/ which is only included in development builds.
 * Additional runtime checks ensure functions are not exposed in production.
 */

// Safety check - this module should never be imported in production
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
  throw new Error('db-inspector should not be imported in production builds');
}

const DB_NAME = 'quorum_db';
const DB_VERSION = 7;

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
] as const;

// Stores with sensitive data that need redaction
const SENSITIVE_STORES = [
  'space_keys',
  'encryption_states',
  'latest_states',
  'user_config',
  'space_members',
] as const;

type SafeStore = (typeof SAFE_STORES)[number];
type SensitiveStore = (typeof SENSITIVE_STORES)[number];
type StoreName = SafeStore | SensitiveStore;

const ALL_STORES: StoreName[] = [...SAFE_STORES, ...SENSITIVE_STORES];

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
 * Apply redaction to a record based on store name
 */
function redactRecord(storeName: StoreName, record: Record<string, unknown>): Record<string, unknown> {
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
    default:
      return record;
  }
}

/**
 * Open the database
 */
async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(`Failed to open database: ${req.error?.message}`));
  });
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
  /** Stores to include (default: all) */
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
}

export interface DbDump {
  timestamp: string;
  dbName: string;
  dbVersion: number;
  stores: StoreDump[];
  summary: Record<string, number>;
}

/**
 * Dump the database with redacted sensitive data
 */
export async function dumpDatabase(options: DbDumpOptions = {}): Promise<DbDump> {
  const {
    includeRecords = true,
    stores = ALL_STORES,
    maxRecords = 100,
    includeMessages = false,
  } = options;

  const db = await openDb();
  const result: DbDump = {
    timestamp: new Date().toISOString(),
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: [],
    summary: {},
  };

  try {
    for (const storeName of stores) {
      // Skip messages by default (can be very large)
      if (storeName === 'messages' && !includeMessages) {
        const count = await countStore(db, storeName);
        result.stores.push({ name: storeName, count, records: undefined });
        result.summary[storeName] = count;
        continue;
      }

      const count = await countStore(db, storeName);
      result.summary[storeName] = count;

      if (!includeRecords) {
        result.stores.push({ name: storeName, count });
        continue;
      }

      const records = await readStore(db, storeName);
      const isSensitive = (SENSITIVE_STORES as readonly string[]).includes(storeName);

      // Redact if sensitive
      const processedRecords = isSensitive
        ? records.map((r) => redactRecord(storeName as StoreName, r as Record<string, unknown>))
        : records;

      // Truncate if too many
      const truncated = processedRecords.length > maxRecords;
      const finalRecords = truncated ? processedRecords.slice(0, maxRecords) : processedRecords;

      result.stores.push({
        name: storeName,
        count,
        records: finalRecords,
        truncated: truncated || undefined,
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
    const count = await countStore(db, storeName);
    const records = await readStore(db, storeName);
    const isSensitive = (SENSITIVE_STORES as readonly string[]).includes(storeName);

    const processedRecords = isSensitive
      ? records.map((r) => redactRecord(storeName, r as Record<string, unknown>))
      : records;

    const truncated = processedRecords.length > maxRecords;
    const finalRecords = truncated ? processedRecords.slice(0, maxRecords) : processedRecords;

    return {
      name: storeName,
      count,
      records: finalRecords,
      truncated: truncated || undefined,
    };
  } finally {
    db.close();
  }
}

/**
 * Get counts for all stores
 */
export async function getStoreCounts(): Promise<Record<string, number>> {
  const db = await openDb();
  const counts: Record<string, number> = {};

  try {
    for (const storeName of ALL_STORES) {
      counts[storeName] = await countStore(db, storeName);
    }
  } finally {
    db.close();
  }

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__dbDump = async (includeMessages = false) => {
    const json = await quickDump(includeMessages);
    console.log(json);
    return json;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__dbCounts = async () => {
    const counts = await getStoreCounts();
    console.table(counts);
    return counts;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__dbStore = async (storeName: string, maxRecords = 50) => {
    const dump = await dumpStore(storeName as StoreName, maxRecords);
    console.log(JSON.stringify(dump, null, 2));
    return dump;
  };

  console.log(
    '%c[Dev] DB Inspector available: __dbDump(), __dbCounts(), __dbStore(name)',
    'color: #22c55e; font-weight: bold'
  );
}

export { ALL_STORES, SAFE_STORES, SENSITIVE_STORES };
export type { StoreName };
