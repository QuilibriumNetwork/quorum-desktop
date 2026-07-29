// File-based pairing with a bot living in ANOTHER REPO's process.
//
// ── Why this shape, and not the one slice 4 specced ─────────────────────────
//
// `tasks/2026-07-27-cross-platform-dm-harness.md` slice 4 proposed bundling
// mobile's bot into a Node ESM artifact and running both bots in ONE desktop
// process. Two things that landed after it was written make that wrong:
//
//   1. Slice 2 (extract mobile's DM core) was deliberately NOT done. Mobile's
//      receive path is ~4000 lines of useCallback INSIDE WebSocketProvider, so
//      its bot RENDERS the provider via react-test-renderer rather than
//      extracting it. Bundling would drag React, react-test-renderer,
//      react-query, mobile's context layer and five native shims into desktop's
//      jsdom vitest — exactly the failure the slice-4 spec predicted of itself
//      ("the bundle won't build small (or at all)"). Mobile also has no bundler
//      installed, so it would mean a new dependency and a lockfile change the
//      task worked hard to avoid.
//   2. Slices 1-3 established that two bots CANNOT share a process: lazy
//      `require()`s run after jest's module isolation closes and resolve against
//      the shared registry, silently fusing the two devices being compared.
//      "Bots get one process each" is a finding, not a preference.
//
// So the pair is two processes in two repos, coordinated through disk, talking
// over the real relay — the shape mobile already uses for its own two bots. The
// cost is the spec's "one clock, one merged log"; both sides already emit
// timestamped JSONL, so merging is post-processing rather than architecture.
//
// ⚠️ This MUST stay wire-compatible with
// `quorum-mobile/dev/harness/rendezvous.ts`. Mobile runs its existing scenario
// unchanged, so any drift here breaks the pairing with a timeout rather than a
// useful error.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export type Role = 'a' | 'b';

export const peerOf = (role: Role): Role => (role === 'a' ? 'b' : 'a');

/**
 * The shared directory, which lives in quorum-mobile because mobile's
 * orchestrator owns the layout. Defaults to the sibling checkout; override when
 * the repos are not siblings.
 *
 * ⚠️ This deliberately points INTO quorum-mobile rather than keeping a desktop
 * copy. One directory IS the coordination mechanism — two would pair each bot
 * with itself and report a clean run that never happened.
 */
const ROOT =
  process.env.HARNESS_RENDEZVOUS_ROOT ??
  resolve(HERE, '../../../..', '..', 'quorum-mobile/dev/harness/.state/rendezvous');

function runDir(): string {
  const id = process.env.HARNESS_RUN_ID;
  if (!id) {
    throw new Error(
      '[harness] HARNESS_RUN_ID is not set. dm-cross is started by ' +
        'src/dev/tests/harness/run-cross.mjs, which sets it and spawns BOTH sides. ' +
        'Run `yarn harness:cross` rather than invoking this scenario directly — on ' +
        'its own it has no peer and would wait out its timeout.'
    );
  }
  return resolve(ROOT, id);
}

const filePath = (role: Role, kind: string) => resolve(runDir(), `${role}.${kind}.json`);

export function publish(role: Role, kind: string, data: unknown): void {
  mkdirSync(runDir(), { recursive: true });
  writeFileSync(filePath(role, kind), JSON.stringify(data, null, 2), 'utf8');
}

export function read<T>(role: Role, kind: string): T | null {
  const p = filePath(role, kind);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch {
    // A torn read costs one poll tick, not a bad pairing — mobile's choice, kept.
    return null;
  }
}

/** Poll until the peer publishes `kind`, or fail with a diagnosable message. */
export async function awaitPeer<T>(role: Role, kind: string, timeoutMs = 180_000): Promise<T> {
  const peer = peerOf(role);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read<T>(peer, kind);
    if (value) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `[harness] role ${role} waited ${timeoutMs}ms for peer ${peer}'s "${kind}" and it never ` +
      `appeared. The peer runs in the OTHER repo, so its failure is NOT in this ` +
      `output — read the quorum-mobile jest run. Rendezvous dir: ${runDir()}`
  );
}

/** Sleep until an absolute epoch ms, so both sides start their loop together. */
export async function waitUntil(epochMs: number): Promise<void> {
  const delta = epochMs - Date.now();
  if (delta > 0) await new Promise((r) => setTimeout(r, delta));
}

/** MUST match quorum-mobile/dev/harness/dm-two-bot.scenario.ts. */
export interface Hello {
  address: string;
  inboxAddress: string;
  readyAt: number;
}

/**
 * `A→B #7` / `B→A #7`, byte-identical to mobile's `label()`.
 *
 * ⚠️ The arrow is U+2192, NOT '->'. Mobile parses with /^([AB])→[AB] #(\d+)$/,
 * so an ASCII arrow here would send messages that arrive and decrypt perfectly
 * and count as zero — the worst possible failure, because it looks like loss.
 */
export const label = (from: Role, n: number) => (from === 'a' ? `A→B #${n}` : `B→A #${n}`);

export const parseLabel = (text: string): { from: Role; n: number } | null => {
  const m = /^([AB])→[AB] #(\d+)$/.exec(text);
  return m ? { from: m[1] === 'A' ? 'a' : 'b', n: Number(m[2]) } : null;
};
