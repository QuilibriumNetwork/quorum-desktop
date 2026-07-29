// Measures how long the DM ratchet lock is HELD, per conversation.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// `bugs/.solved/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md` says the receive
// path awaits relay HTTP inside `dmRatchetMutex.runExclusive(conversationId, …)`,
// so one slow `/inbox/delete` stalls every message on that conversation. That was
// found by READING. This turns it into a direct measurement.
//
// Inferring it from message counts is weaker evidence and needs things to actually
// go missing. A hold-time histogram confirms or refutes the mechanism even on a
// run where nothing is lost, because the signature is in the TIMING:
//
//   holds clustering at ~22s / ~45s / ~69s  ⇒ the lock is waiting on a timing-out
//                                             POST (1, 2 or 3 attempts — see the
//                                             bug's §1 retry arithmetic)
//   holds in the low milliseconds           ⇒ the lock is doing crypto only, and
//                                             the mechanism is NOT firing here
//
// ⚠️ The bug's §5.3 originally said to look for a cluster "near 22s". That is
// wrong and would produce a FALSE NEGATIVE: mutations retry twice, so a stalled
// ack lands near 45s or 69s and never near 22s. Read the whole distribution.
//
// ── Why a harness-side wrapper, not instrumentation in the product ──────────
//
// `dmRatchetMutex` is an exported singleton (`src/utils/keyedMutex.ts:17`), so it
// can be wrapped from outside exactly the way bot.ts tees `messageDB.saveMessage`.
// Nothing in `src/services/` changes, so the code under measurement is the code
// that ships — which is the whole point of measuring it rather than a copy.
import { dmRatchetMutex } from '../../../utils/keyedMutex';

export interface LockSample {
  /** conversationId the lock was taken on. */
  key: string;
  /** ms spent QUEUED behind other holders — how long this message waited its turn. */
  waitedMs: number;
  /** ms the lock was HELD — the number that carries the signature. */
  heldMs: number;
  /** ms since probe install, so samples can be lined up against the run. */
  t: number;
}

let installed = false;
const samples: LockSample[] = [];
let installedAt = 0;

/**
 * Critical sections that have STARTED and not yet returned.
 *
 * ⚠️ This exists because `samples` structurally cannot show a deadlock. A sample
 * is pushed in a `finally`, so a critical section that never returns is never
 * sampled — which means `max=…` only ever reports "the longest hold that
 * COMPLETED". On 2026-07-29 a run showed `max=412ms` while one device had stopped
 * persisting entirely; that number was not evidence the lock was healthy, it was
 * evidence about the holds that finished.
 *
 * A permanently-held lock produces a very specific signature: both directions of
 * one conversation stop at the same instant, forever, while the socket keeps
 * receiving. `KeyedMutex`'s own docs warn about it as a circular wait. This map is
 * what turns that hypothesis into a yes/no.
 */
interface InFlightHold {
  key: string;
  startedAt: number;
  /** ms since probe install, so it can be lined up against the run timeline. */
  t: number;
}
const inFlight = new Map<number, InFlightHold>();
let holdSeq = 0;

/**
 * Wrap the shared mutex once per process. Idempotent: the singleton is shared by
 * every bot in this process, so a second install would double-count every hold.
 */
export function installLockProbe(): LockSample[] {
  if (installed) return samples;
  installed = true;
  installedAt = Date.now();

  const original = dmRatchetMutex.runExclusive.bind(dmRatchetMutex);
  (dmRatchetMutex as unknown as { runExclusive: typeof dmRatchetMutex.runExclusive }).runExclusive =
    async function <T>(key: string, fn: () => Promise<T>): Promise<T> {
      const queuedAt = Date.now();
      return original(key, async () => {
        const startedAt = Date.now();
        // Registered BEFORE the body runs and removed in `finally`, so anything
        // still here at the end of the run never returned. That is the only way
        // to see a deadlock — `samples` below cannot, by construction.
        const holdId = ++holdSeq;
        inFlight.set(holdId, { key, startedAt, t: startedAt - installedAt });
        try {
          return await fn();
        } finally {
          inFlight.delete(holdId);
          // Recorded in `finally` so a throwing critical section still reports its
          // hold — the delete-conversation and give-up paths RETHROW (bug §1), and
          // those are exactly the holds worth seeing.
          samples.push({
            key,
            waitedMs: startedAt - queuedAt,
            heldMs: Date.now() - startedAt,
            t: startedAt - installedAt,
          });
        }
      });
    };
  return samples;
}

/** Buckets chosen to match the bug's retry arithmetic, not round numbers. */
const BUCKETS: [string, (ms: number) => boolean][] = [
  ['<100ms      (crypto only)', (ms) => ms < 100],
  ['100ms-1s', (ms) => ms >= 100 && ms < 1_000],
  ['1-5s', (ms) => ms >= 1_000 && ms < 5_000],
  ['5-15s       (decayed timeout, in-app)', (ms) => ms >= 5_000 && ms < 15_000],
  ['15-30s      ⚠ 1 timed-out attempt', (ms) => ms >= 15_000 && ms < 30_000],
  ['30-55s      ⚠ 2 attempts', (ms) => ms >= 30_000 && ms < 55_000],
  ['>55s        ⚠ 3 attempts (full retry)', (ms) => ms >= 55_000],
];

/**
 * Human-readable summary. Reports the tail explicitly: a mean is useless here
 * because the whole claim is about rare, very long holds among many short ones.
 */
export function summariseLockHolds(all: LockSample[]): string[] {
  if (all.length === 0) return ['lock probe: no samples (was installLockProbe() called before the bots?)'];

  const held = all.map((s) => s.heldMs).sort((a, b) => a - b);
  const at = (q: number) => held[Math.min(held.length - 1, Math.floor(held.length * q))];
  const lines: string[] = [
    `lock holds: n=${held.length}  p50=${at(0.5)}ms  p90=${at(0.9)}ms  p99=${at(0.99)}ms  max=${held[held.length - 1]}ms`,
  ];
  for (const [label, test] of BUCKETS) {
    const n = held.filter(test).length;
    if (n > 0) lines.push(`  ${label.padEnd(38)} ${n}`);
  }

  // The longest holds by conversation: if the mechanism is real these concentrate
  // on one conversationId rather than spreading evenly.
  const worst = [...all].sort((a, b) => b.heldMs - a.heldMs).slice(0, 5);
  for (const s of worst) {
    if (s.heldMs < 1_000) break;
    lines.push(`  slowest: ${s.heldMs}ms held on ${s.key.slice(0, 24)} at t+${Math.round(s.t / 1000)}s`);
  }

  // Queueing is the user-visible consequence — how long a message sat waiting.
  const waited = all.map((s) => s.waitedMs).sort((a, b) => a - b);
  lines.push(
    `queued behind the lock: p50=${waited[Math.floor(waited.length * 0.5)]}ms  ` +
      `max=${waited[waited.length - 1]}ms`
  );
  return lines;
}

/**
 * Critical sections still outstanding — the DEADLOCK report.
 *
 * Call at the very end of a run. Anything listed here entered
 * `dmRatchetMutex.runExclusive` and never came back, which means every later
 * message on that `conversationId` is blocked forever. A DM's two directions share
 * one conversationId, so a single entry here explains BOTH directions of that
 * conversation stopping at the same instant.
 *
 * Empty is the expected result. A non-empty list is the strongest possible
 * evidence for the stall class this investigation has been chasing, because
 * unlike a missing-message count it names the lock, the moment, and the fact that
 * it never released.
 */
export function summariseOutstandingHolds(): string[] {
  if (inFlight.size === 0) {
    return ['outstanding critical sections: NONE (no lock was still held at the end)'];
  }
  const now = Date.now();
  const lines = [
    `⛔ OUTSTANDING CRITICAL SECTIONS: ${inFlight.size} — these NEVER returned.`,
    `   Every later message on these conversationIds is blocked permanently.`,
  ];
  for (const { key, startedAt, t } of [...inFlight.values()].sort((a, b) => a.startedAt - b.startedAt)) {
    lines.push(
      `   held ${Math.round((now - startedAt) / 1000)}s and counting on ${key.slice(0, 24)} ` +
        `(acquired at t+${Math.round(t / 1000)}s)`
    );
  }
  return lines;
}

/** Reset between scenarios in one process — the mutex wrap itself stays installed. */
export function resetLockProbe(): void {
  samples.length = 0;
  inFlight.clear();
}
