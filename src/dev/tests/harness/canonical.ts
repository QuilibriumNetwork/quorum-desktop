// The two canonical test users, loaded from BOT_A_PRIVATE_KEY / BOT_B_PRIVATE_KEY
// in .env.local. These are the operator's REAL, history-rich test accounts
// (owners of test spaces; both members of a shared space with real users, owned
// by user A). Use them when a scenario needs realistic state — and above all for
// space work, where user A's ownership matters.
//
// For clean-slate DM baselines prefer throwaway bots (createBot('name')) instead:
// these accounts carry lots of history and queued frames, so reusing them in a DM
// test can surface stale-frame redelivery noise (see the run-1 finding). Pass
// { drain: true } to clear the device inbox first when you want a cleaner start.
import { createBot, type HarnessBot } from './bot';
import { config } from './env';

export function hasCanonicalKeys(): boolean {
  return Boolean(config.botKeys.A && config.botKeys.B);
}

/** user A — owner of the shared/general test space. Device persisted as user-a. */
export function createUserA(): Promise<HarnessBot> {
  if (!config.botKeys.A) throw new Error('BOT_A_PRIVATE_KEY not set in .env.local');
  return createBot('user-a', { privateKeyHex: config.botKeys.A });
}

export function createUserB(): Promise<HarnessBot> {
  if (!config.botKeys.B) throw new Error('BOT_B_PRIVATE_KEY not set in .env.local');
  return createBot('user-b', { privateKeyHex: config.botKeys.B });
}

/**
 * Both canonical users, started. `drain: true` clears each device inbox of queued
 * frames first — use it when you want a cleaner start on these reused accounts.
 */
export async function createCanonicalPair(
  opts: { drain?: boolean } = {}
): Promise<{ a: HarnessBot; b: HarnessBot }> {
  if (!hasCanonicalKeys()) {
    throw new Error(
      'Set BOT_A_PRIVATE_KEY and BOT_B_PRIVATE_KEY in src/dev/tests/harness/.env.local'
    );
  }
  const [a, b] = await Promise.all([createUserA(), createUserB()]);
  if (opts.drain) {
    const [da, db] = await Promise.all([a.drainInbox(), b.drainInbox()]);
    if (da || db) console.log(`[canonical] drained inbox: A=${da} B=${db} frame(s)`);
  }
  return { a, b };
}
