// #1 — end-to-end reset → recover. The user-facing "works after a reset"
// behavior, which NO unit test covers (the unit tests mock the SDK and check the
// guard/selection LOGIC in isolation; this drives the real two-party init-envelope
// path with real crypto).
//
// Non-overlap note: the offline ratchet lock and sent_accept plumbing are already
// unit-tested (ActionQueueHandlers.unit.test.ts, sessionSelection.unit.test.ts),
// and isStaleInitEnvelope has 18 pure-function cases. This test deliberately does
// NOT re-assert any of that — it asserts the emergent behavior: after one side's
// session is wiped, a fresh re-init recovers the conversation.
//
//   yarn harness dm-reset-recover
import { test, expect } from 'vitest';
import { createBot } from './bot';

const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 6000);

function isPost(m: { content?: { type?: string; text?: string } }, prefix: string): boolean {
  return m.content?.type === 'post' && (m.content.text ?? '').startsWith(prefix);
}

test(
  'dm-reset-recover: a wiped session re-initialises and the conversation recovers',
  async () => {
    // Throwaway bots: this tests the reset MECHANISM, so a clean slate is what we
    // want (no history, no stale-frame noise).
    const [alice, bob] = await Promise.all([
      createBot('reset-alice'),
      createBot('reset-bob'),
    ]);

    let bobGotBefore = false;
    let bobGotAfter = false;
    let aliceGotRecover = false;
    bob.onDecrypted = (m) => {
      if (isPost(m, 'before')) bobGotBefore = true;
      if (isPost(m, 'after')) bobGotAfter = true;
    };
    alice.onDecrypted = (m) => {
      if (isPost(m, 'recover')) aliceGotRecover = true;
    };

    await Promise.all([alice.start(), bob.start()]);

    // 1. Establish + confirm normal delivery.
    await alice.send(bob.identity.address, 'before-reset #1');
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    expect(bobGotBefore).toBe(true);

    // 2. Reset: wipe Bob's sessions (simulates a wipe/prune/reset).
    const removed = await bob.wipeSessions();
    console.log(`[dm-reset-recover] wiped ${removed} session row(s) on Bob`);

    // 3. Recover: Bob re-initialises by sending to Alice (fresh init envelope).
    await bob.send(alice.identity.address, 'recover-init #1');
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    expect(aliceGotRecover).toBe(true);

    // 4. Alice sends again — must now flow over the re-established session.
    await alice.send(bob.identity.address, 'after-recovery #1');
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    console.log(
      `[dm-reset-recover] before=${bobGotBefore} recover=${aliceGotRecover} after=${bobGotAfter} bobErrors=${bob.errors.length}`
    );

    alice.stop();
    bob.stop();

    // The conversation recovered: post-reset traffic flows both ways again.
    expect(bobGotAfter).toBe(true);
  },
  120_000
);
