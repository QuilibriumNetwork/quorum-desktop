// THREAD 2 — reproduce the poisoning DELIBERATELY, through the real client.
//
// Volume does not do it (slice 4: fresh accounts, concurrent load, zero skipped
// keys, zero failures) because the relay delivers in order, so nothing is ever
// skipped and no skipped-keys bucket ever forms. The offline mechanism work
// (`.agents/tools/dm-debug/dr-prune-safety.mjs`) says exactly what is needed:
//
//   1. a LATER frame of a sending chain must be processed before earlier ones,
//      which files the earlier indices as skipped keys under the header key that
//      has just become the receiver's CURRENT receiving header key;
//   2. the sender must then open a NEW sending chain (it does so as soon as it
//      receives a reply);
//   3. frames of that new chain whose index COLLIDES with an index in the stale
//      bucket are handed an old-chain message key and fail AEAD.
//
// Non-colliding indices decrypt fine, which is why the failure looks like it
// depends on "position in the chain".
//
//   yarn harness dm-reorder
import { test, expect } from 'vitest';
import { createBot } from './bot';
import { ratchetStats } from './inspect';
import { RunLog } from './log';

const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 3000);
/** How many of the first chain's frames to withhold (= the stale bucket's size). */
const WITHHOLD = Number(process.env.HARNESS_WITHHOLD ?? 3);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test(
  'dm-reorder: out-of-order delivery forms a stale bucket, then the next chain fails on demand',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('dm-reorder', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[dm-reorder] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    // Fresh throwaway accounts. Reused accounts carry queued frames that produce
    // failures for an unrelated reason (stale redelivery) — the confound that
    // falsified the previous "harness reproduced the bug" read.
    const stamp = String(startedAt).slice(-6);
    const [alice, bob] = await Promise.all([
      createBot(`ro-a-${stamp}`),
      createBot(`ro-b-${stamp}`),
    ]);
    await Promise.all([alice.start(), bob.start()]);

    const bobRecv: string[] = [];
    bob.onDecrypted = (m) => {
      if (m.content?.type === 'post') bobRecv.push(String((m.content as { body?: string }).body ?? ''));
    };

    // --- phase 1: establish both directions -------------------------------
    await alice.send(bob.identity.address, 'setup A->B');
    await sleep(SETTLE_MS);
    await bob.send(alice.identity.address, 'setup B->A');
    await sleep(SETTLE_MS);
    say(`sessions established; bob decrypted ${bobRecv.length} post(s), ${bob.errors.length} error(s)`);

    const before = await ratchetStats(bob.messageDB);
    say(`bob skipped-keys before: ${before.map((s) => `${s.inbox}=${s.skipped}`).join(' ') || 'none'}`);

    // --- phase 2: withhold the head of a chain, deliver a later frame first --
    bob.transport.holdInbound();
    for (let i = 0; i <= WITHHOLD; i++) {
      await alice.send(bob.identity.address, `chain1-#${i}`);
      await sleep(400);
    }
    await sleep(SETTLE_MS);
    say(`bob is holding ${bob.transport.heldCount} inbound frame(s)`);

    // Release ONLY the last one. The earlier indices become skipped keys filed
    // under the header key that thereby becomes bob's current receiving key.
    // The rest stay withheld by fingerprint, so relay redeliveries don't undo it.
    const { delivered, withheld } = await bob.transport.releaseInbound((held) => {
      const last = held[held.length - 1];
      return last ? [last] : [];
    });
    await sleep(SETTLE_MS);
    say(`released ${delivered}, withholding ${withheld} across redeliveries`);

    const poisoned = await ratchetStats(bob.messageDB);
    const skipped = poisoned.reduce((a, s) => a + s.skipped, 0);
    say(`after out-of-order delivery: bob skipped-keys=${skipped} ` +
      `(${poisoned.map((s) => `${s.inbox}=${s.skipped}/${s.buckets}b`).join(' ')})`,
      { skipped });

    // --- phase 3: make alice open a NEW sending chain ----------------------
    // Alice rotates her sending chain as soon as she processes a frame from bob.
    await bob.send(alice.identity.address, 'B->A rotate');
    await sleep(SETTLE_MS);

    const errBefore = bob.errors.length;
    for (let i = 0; i < WITHHOLD + 2; i++) {
      await alice.send(bob.identity.address, `chain2-#${i}`);
      await sleep(600);
    }
    await sleep(SETTLE_MS * 2);
    const newFailures = bob.errors.length - errBefore;

    say(`NEW-CHAIN DELIVERY: ${newFailures} decrypt failure(s) on bob ` +
      `(sent ${WITHHOLD + 2} frames; predicted ~${WITHHOLD} to collide)`,
      { newFailures, predicted: WITHHOLD });

    // --- phase 4: the withheld frames, delivered late ----------------------
    // These are the frames whose keys live in the stale bucket. They must still
    // decrypt — that is the recovery path any mitigation must not break.
    const errBeforeLate = bob.errors.length;
    const late = await bob.transport.deliverWithheld();
    await sleep(SETTLE_MS);
    say(`late delivery of ${late} withheld frame(s): ${bob.errors.length - errBeforeLate} failure(s)`);

    say(`bob decrypted posts: ${bobRecv.length} -> ${JSON.stringify(bobRecv.slice(-8))}`);
    say(`bob total errors: ${bob.errors.length}`);
    console.log(`[dm-reorder] log: ${log.file}`);

    alice.stop();
    bob.stop();

    // The measurement is the run. Assert only that the mechanism's precondition
    // was actually built — without a stale bucket the scenario proves nothing.
    expect(skipped).toBeGreaterThan(0);
  },
  20 * 60 * 1000
);
