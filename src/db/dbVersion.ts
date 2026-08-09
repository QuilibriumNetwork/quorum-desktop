/**
 * Single source of truth for the IndexedDB name and schema version.
 *
 * Kept in its own module (rather than as constants inside `messages.ts`) so dev
 * tools and tests can import the expected version without pulling in the whole
 * `MessageDB` class and its MiniSearch dependency.
 *
 * Bump `QUORUM_DB_VERSION` whenever you add a store or an index in
 * `messages.ts`'s `onupgradeneeded` chain, and update
 * `.agents/docs/quorum-db-schema.md`.
 */

export const QUORUM_DB_NAME = 'quorum_db';

/** Schema version the app opens the database at. */
export const QUORUM_DB_VERSION = 16;
