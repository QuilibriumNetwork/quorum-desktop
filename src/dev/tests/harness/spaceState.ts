// Carry ONE space across harness runs, so a scenario that only needs somewhere
// to post stops minting a permanent one every time.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// Spaces are create-only. There is no delete endpoint anywhere in the API
// surface (`src/api/quorumApi.ts`) — `/inbox/delete`, `/hub/delete` and
// `DELETE /users/<addr>/public-profile` exist, nothing removes an account or a
// space, and registrations do not expire. So every `yarn verify` run that
// creates a space leaves one
// behind forever, and the AGENTS.md rule makes that per-code-change.
//
// The account half of the same problem was fixed by simply reusing fixed bot
// names (see `identity.ts` and
// `.agents/issues/2026-08-23-harness-mints-permanent-accounts-every-run.md`).
// That worked because isolation never depended on the identity: `storage.ts`
// backs MessageDB with in-memory `fake-indexeddb`, so every run already starts
// from an empty database.
//
// That same fact is what makes spaces HARDER. An owner with an empty database
// does not know the space exists, so it creates another one. Reuse therefore
// needs the space's local rows carried forward on disk.
//
// ── What a space actually needs to come back, and how that was established ──
//
// READ from the production code on 2026-08-23, not assumed:
//
//   `spaces`                  the space record itself.
//   `space_keys`              THE CRYPTO. `SpaceService.sendHubMessage`
//                             (SpaceService.ts:1202) seals with the `hub` and
//                             `config` keys read straight out of this store,
//                             and `MessageService.handleNewMessage`'s space
//                             branch (MessageService.ts:5421-5471) unseals with
//                             the same two. Both are STATIC — no ratchet
//                             advances on send or receive, so a restored key is
//                             as good as a fresh one however old it is.
//   `space_members`           the roster.
//   `space_member_devices`    per-device signing keys for roster resolution.
//   `encryption_states`       ROUTING, and only the rows whose conversationId
//     (space rows only)       is `<spaceId>/<spaceId>`. Two things need them:
//                             `handleNewMessage` builds an inboxId→state map
//                             and looks the arriving frame up in it
//                             (MessageService.ts:4557), and `spaceBot`'s
//                             `refreshSubscriptions` derives the socket
//                             subscription list from the same store. Without
//                             the space row a restored bot neither subscribes
//                             to the space inbox nor can route a frame that
//                             arrives on it.
//
// ⚠️ The design doc for this work
// (`.agents/issues/.open/2026-08-23-harness-space-reuse-design.md`) listed
// `encryption_states` under "never persist". That was WRONG, and the reason it
// looked right is worth keeping: for DMs the store holds an advancing double
// ratchet, and carrying a stale one across runs would be exactly the kind of
// silent corruption the doc was guarding against. For a SPACE it holds no such
// thing on the current path — the ratchet fields are read only by the legacy
// `TripleRatchetDecrypt` branch and the `peerMapDelta` apply, and
// `TripleRatchetEncrypt` appears nowhere in `src/services/`. So the DM rows
// stay ephemeral and the space rows are carried; the split is by conversation,
// not by store.
//
// ── What is deliberately NOT carried ───────────────────────────────────────
//
// `messages`, `deleted_messages`, `action_queue`, `channel_threads`,
// `latest_states`, `conversations`, and every non-space `encryption_states`
// row. `messages` is the important one: it is what the delivery assertions
// read, and a scenario that could satisfy an assertion from a previous run's
// message is worse than no scenario at all.
//
// PERSIST_STORES is an allowlist and the filter defaults to dropping anything
// not on it, so a new store added to `messages.ts` is ephemeral until someone
// deliberately adds it. That rots loudly (a scenario fails because state it
// expected is missing) rather than silently (an assertion quietly stops
// proving anything).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MessageDB } from '../../../db/messages';
import { config } from './env';

/**
 * Stores carried across runs, with the predicate that scopes each one to the
 * space being carried. Anything not listed here is ephemeral.
 */
const PERSIST_STORES: {
  name: string;
  belongsTo: (row: Record<string, unknown>, spaceId: string) => boolean;
}[] = [
  { name: 'spaces', belongsTo: (r, s) => r.spaceId === s },
  { name: 'space_keys', belongsTo: (r, s) => r.spaceId === s },
  { name: 'space_members', belongsTo: (r, s) => r.spaceId === s },
  { name: 'space_member_devices', belongsTo: (r, s) => r.spaceId === s },
  {
    // Space rows ONLY — see the header. A DM row here would carry an advancing
    // double ratchet and must never be restored from a previous run.
    name: 'encryption_states',
    belongsTo: (r, s) => r.conversationId === `${s}/${s}`,
  },
];

export interface SpaceStateSnapshot {
  spaceId: string;
  channelId: string;
  /** Wall-clock of the snapshot, for the "how old is this space" log line. */
  savedAt: number;
  /** store name → the rows belonging to `spaceId`. */
  stores: Record<string, Record<string, unknown>[]>;
}

/**
 * The live IDBDatabase behind a MessageDB.
 *
 * Reaching into a private field, the same way `storage.ts` reaches in to
 * rename `DB_NAME`. Going through MessageDB's typed accessors instead was
 * considered and rejected: there is no public reader for
 * `space_member_devices` by space, and no writer at all for
 * `encryption_states` that preserves the row verbatim. Copying rows is the
 * whole job here, so a generic store-level copy is both shorter and less
 * likely to quietly drop a field that a future schema adds.
 *
 * Read fresh on every call rather than cached — MessageDB drops its reference
 * on `versionchange`/`onclose` and reopens on next access, so a cached handle
 * can go stale underneath us.
 */
async function connectionOf(db: MessageDB): Promise<IDBDatabase> {
  await (db as unknown as { init: () => Promise<void> }).init();
  const conn = (db as unknown as { db: IDBDatabase | null }).db;
  if (!conn) throw new Error('[spaceState] MessageDB has no open connection');
  return conn;
}

function readAll(
  conn: IDBDatabase,
  store: string
): Promise<Record<string, unknown>[]> {
  return new Promise((res, rej) => {
    const req = conn.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => res(req.result as Record<string, unknown>[]);
    req.onerror = () => rej(req.error);
  });
}

function writeAll(
  conn: IDBDatabase,
  store: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  return new Promise((res, rej) => {
    const tx = conn.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const row of rows) os.put(row);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    // A write that cannot land must not read as a restore that worked: the
    // scenario would then create a second space believing the first was gone,
    // or worse, run against a half-restored one.
    tx.onabort = () =>
      rej(tx.error ?? new Error(`[spaceState] write to ${store} aborted`));
  });
}

/** Stable key for comparing two row sets regardless of store iteration order. */
const digest = (rows: Record<string, unknown>[]): string =>
  JSON.stringify(rows.map((r) => JSON.stringify(r)).sort());

/** Read every carried store, scoped to one space. */
export async function snapshotSpaceState(
  db: MessageDB,
  spaceId: string,
  channelId: string
): Promise<SpaceStateSnapshot> {
  const conn = await connectionOf(db);
  const stores: Record<string, Record<string, unknown>[]> = {};
  for (const { name, belongsTo } of PERSIST_STORES) {
    stores[name] = (await readAll(conn, name)).filter((r) =>
      belongsTo(r, spaceId)
    );
  }
  return { spaceId, channelId, savedAt: Date.now(), stores };
}

/**
 * Put a snapshot back into a fresh in-memory database.
 *
 * Verifies the round-trip before returning, and throws if it does not match.
 * That check is not ceremony: these rows go to disk as JSON, and a field that
 * does not survive `JSON.stringify` (a typed array, a Date, an ArrayBuffer of
 * key material) would come back subtly wrong rather than absent. A space whose
 * `hub` key lost a byte still looks like a restored space to every caller here
 * — it just silently fails to decrypt anything, which presents at the far end
 * as a delivery bug in whatever change is being verified.
 */
export async function restoreSpaceState(
  db: MessageDB,
  snap: SpaceStateSnapshot
): Promise<number> {
  const conn = await connectionOf(db);
  let rows = 0;
  for (const { name } of PERSIST_STORES) {
    const incoming = snap.stores[name] ?? [];
    if (!incoming.length) continue;
    await writeAll(conn, name, incoming);
    rows += incoming.length;
  }

  const after = await snapshotSpaceState(db, snap.spaceId, snap.channelId);
  for (const { name } of PERSIST_STORES) {
    const want = digest(snap.stores[name] ?? []);
    const got = digest(after.stores[name] ?? []);
    if (want !== got) {
      throw new Error(
        `[spaceState] restore of "${name}" did not round-trip for space ` +
          `${snap.spaceId.slice(0, 12)} — the persisted rows are not what came ` +
          `back out. Delete the state file and re-run with HARNESS_FRESH=1 to ` +
          `mint a new space; do NOT trust a delivery result from this run.`
      );
    }
  }
  return rows;
}

function spaceStatePath(name: string): string {
  return resolve(config.stateDir, `${name}-space.json`);
}

export function saveSpaceState(name: string, snap: SpaceStateSnapshot): void {
  mkdirSync(config.stateDir, { recursive: true });
  writeFileSync(spaceStatePath(name), JSON.stringify(snap, null, 2), 'utf-8');
}

export function loadSpaceState(name: string): SpaceStateSnapshot | undefined {
  const path = spaceStatePath(name);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SpaceStateSnapshot;
  } catch {
    // A truncated or hand-edited file must not wedge the arm — creating a
    // fresh space is always a correct fallback, just a more expensive one.
    return undefined;
  }
}

/**
 * Skip the persisted space and mint a new one.
 *
 * An env var rather than a CLI flag because scenarios run under `vitest --run`,
 * which parses argv itself and rejects options it does not know:
 *
 *   HARNESS_FRESH=1 yarn harness space-delivery
 *
 * Use it for clean-room reproduction when a persisted space is suspected of
 * being the problem, and after any change to PERSIST_STORES.
 */
export const wantsFreshSpace = (): boolean =>
  process.env.HARNESS_FRESH === '1' || process.env.HARNESS_FRESH === 'true';

/**
 * Restore a space shared by several bots, or report that one must be created.
 *
 * All-or-nothing on purpose. A run where one bot restored and the other did not
 * is the worst available state: the restored bot holds a space the other cannot
 * see, so every delivery assertion fails for a reason that has nothing to do
 * with the code under test.
 */
export async function restoreSharedSpace(
  bots: { name: string; messageDB: MessageDB }[]
): Promise<{ spaceId: string; channelId: string; ageMs: number } | undefined> {
  if (wantsFreshSpace()) return undefined;

  const snaps = bots.map((b) => loadSpaceState(b.name));
  if (snaps.some((s) => !s)) return undefined;

  const loaded = snaps as SpaceStateSnapshot[];
  const spaceId = loaded[0].spaceId;
  const channelId = loaded[0].channelId;
  // Two bots holding DIFFERENT spaces would each restore happily and then fail
  // to exchange anything. Cheaper to notice here than to debug at the far end.
  if (
    loaded.some((s) => s.spaceId !== spaceId || s.channelId !== channelId)
  ) {
    return undefined;
  }

  for (const [i, bot] of bots.entries()) {
    await restoreSpaceState(bot.messageDB, loaded[i]);
  }
  return {
    spaceId,
    channelId,
    ageMs: Date.now() - Math.min(...loaded.map((s) => s.savedAt)),
  };
}

/** Snapshot a shared space from every participant, for the next run. */
export async function saveSharedSpace(
  bots: { name: string; messageDB: MessageDB }[],
  spaceId: string,
  channelId: string
): Promise<void> {
  for (const bot of bots) {
    saveSpaceState(
      bot.name,
      await snapshotSpaceState(bot.messageDB, spaceId, channelId)
    );
  }
}
