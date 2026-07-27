// 1b/1c AT SCALE — the same poisoning cycle repeated many times, measured with the
// stale-bucket retry OFF and then ON, in one process, on one pair of fresh accounts.
//
// The captured corpus holds only failures ([XPDUMP] fires in the decrypt-failure
// catch blocks), so it cannot answer "does the mitigation ever break a frame that
// would otherwise succeed". This can: every cycle produces BOTH kinds of frame
// against the same session —
//
//   colliding frames  — new-chain frames at an index present in the stale bucket.
//                       These are the failures the mitigation must recover.
//   clean frames      — new-chain frames at non-colliding indices. These succeed
//                       either way; if the mitigation breaks one, it shows here.
//   delayed frames    — the withheld frames whose keys live IN the stale bucket.
//                       These are what a naive prune destroys (measured 3/3), so
//                       they are the regression test for the re-file step.
//
//   yarn harness dm-stale-bucket
//   HARNESS_CYCLES=12 HARNESS_WITHHOLD=4 yarn harness dm-stale-bucket
import { test, expect } from 'vitest';
import { createBot, type HarnessBot } from './bot';
import { staleBucketRetry } from '../../../utils/dmStaleBucketRetry';
import { ratchetStats } from './inspect';
import { RunLog } from './log';

const CYCLES = Number(process.env.HARNESS_CYCLES ?? 8);
const WITHHOLD = Number(process.env.HARNESS_WITHHOLD ?? 3);
const CLEAN = Number(process.env.HARNESS_CLEAN ?? 3);
const STEP_MS = Number(process.env.HARNESS_STEP_MS ?? 350);
const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 2500);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Tally {
  cycles: number;
  poisonedBuckets: number;
  newChainFailures: number;
  delayedFailures: number;
  postsDelivered: number;
}

/**
 * One poisoning cycle:
 *   1. withhold the head of a sending chain, deliver a later frame first
 *      -> the withheld indices are filed under the receiver's CURRENT
 *         receiving header key
 *   2. make the sender open a NEW chain, deliver WITHHOLD+CLEAN frames of it
 *      -> the first WITHHOLD indices collide with the stale bucket
 *   3. release the withheld frames -> they must still decrypt
 */
async function cycle(
  sender: HarnessBot,
  receiver: HarnessBot,
  n: number,
  tally: Tally,
  say: (m: string) => void
): Promise<void> {
  receiver.transport.holdInbound();
  for (let i = 0; i <= WITHHOLD; i++) {
    await sender.send(receiver.identity.address, `c${n}-head-${i}`);
    await sleep(STEP_MS);
  }
  await sleep(SETTLE_MS);
  await receiver.transport.releaseInbound((held) => {
    const last = held[held.length - 1];
    return last ? [last] : [];
  });
  await sleep(SETTLE_MS);

  const stats = await ratchetStats(receiver.messageDB);
  const poisoned = stats.filter((s) => s.skipped > 0).length > 0;
  if (poisoned) tally.poisonedBuckets += 1;

  // The receiver replies, so the sender rotates its sending chain.
  await receiver.send(sender.identity.address, `c${n}-rotate`);
  await sleep(SETTLE_MS);

  const before = receiver.errors.length;
  const postsBefore = tally.postsDelivered;
  for (let i = 0; i < WITHHOLD + CLEAN; i++) {
    await sender.send(receiver.identity.address, `c${n}-new-${i}`);
    await sleep(STEP_MS);
  }
  await sleep(SETTLE_MS);
  const newChainFailures = receiver.errors.length - before;
  tally.newChainFailures += newChainFailures;

  const beforeLate = receiver.errors.length;
  const late = await receiver.transport.deliverWithheld();
  await sleep(SETTLE_MS);
  const delayedFailures = receiver.errors.length - beforeLate;
  tally.delayedFailures += delayedFailures;
  tally.cycles += 1;

  say(
    `cycle ${n}: bucket=${poisoned ? 'formed' : 'NONE'} ` +
    `new-chain failures=${newChainFailures}/${WITHHOLD + CLEAN} ` +
    `late(${late}) failures=${delayedFailures} ` +
    `posts+${tally.postsDelivered - postsBefore}`
  );
}

test(
  'dm-stale-bucket: poisoning cycle at scale, retry OFF vs ON',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('dm-stale-bucket', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[stale-bucket] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const results: Record<string, Tally> = {};

    for (const arm of ['OFF', 'ON'] as const) {
      staleBucketRetry.enabled = arm === 'ON';
      // A fresh pair per arm: a session carried over would bring the previous
      // arm's accumulated buckets with it and the two arms would not be comparable.
      const stamp = `${String(startedAt).slice(-5)}${arm.toLowerCase()}`;
      const [sender, receiver] = await Promise.all([
        createBot(`sb-s-${stamp}`),
        createBot(`sb-r-${stamp}`),
      ]);
      await Promise.all([sender.start(), receiver.start()]);

      const tally: Tally = {
        cycles: 0, poisonedBuckets: 0, newChainFailures: 0,
        delayedFailures: 0, postsDelivered: 0,
      };
      receiver.onDecrypted = (m) => {
        if (m.content?.type === 'post') tally.postsDelivered += 1;
      };

      say(`==== arm: retry ${arm} ====`);
      await sender.send(receiver.identity.address, 'init');
      await sleep(SETTLE_MS);
      await receiver.send(sender.identity.address, 'init-back');
      await sleep(SETTLE_MS);

      for (let n = 1; n <= CYCLES; n++) {
        await cycle(sender, receiver, n, tally, (m) => say(m));
      }

      const framesPerCycle = WITHHOLD + CLEAN;
      say(
        `arm ${arm}: cycles=${tally.cycles} buckets-formed=${tally.poisonedBuckets} ` +
        `new-chain frames=${tally.cycles * framesPerCycle} failures=${tally.newChainFailures} ` +
        `delayed-frame failures=${tally.delayedFailures} ` +
        `novel=${receiver.novelErrors().length} replay=${receiver.errors.length - receiver.novelErrors().length}`,
        { arm, ...tally, novel: receiver.novelErrors().length }
      );
      results[arm] = tally;

      sender.stop();
      receiver.stop();
      await sleep(1000);
    }

    staleBucketRetry.enabled = true;

    const framesPerCycle = WITHHOLD + CLEAN;
    const off = results.OFF;
    const on = results.ON;
    say('');
    say('================ RESULT ================');
    say(`new-chain frames per arm            ${off.cycles * framesPerCycle} (OFF) / ${on.cycles * framesPerCycle} (ON)`);
    say(`AEAD failures on new-chain frames   ${off.newChainFailures} (OFF) -> ${on.newChainFailures} (ON)`);
    say(`failures on the DELAYED frames      ${off.delayedFailures} (OFF) -> ${on.delayedFailures} (ON)`);
    say(`  ^ any increase here means the mitigation destroyed a recoverable frame`);
    say(`posts delivered                     ${off.postsDelivered} (OFF) -> ${on.postsDelivered} (ON)`);
    console.log(`[stale-bucket] log: ${log.file}`);

    // The precondition must actually have been built, or the arms compare nothing.
    expect(off.poisonedBuckets).toBeGreaterThan(0);
    expect(on.poisonedBuckets).toBeGreaterThan(0);
    // The mitigation must recover failures WITHOUT costing delayed frames.
    expect(on.newChainFailures).toBeLessThan(off.newChainFailures);
    expect(on.delayedFailures).toBeLessThanOrEqual(off.delayedFailures);
  },
  90 * 60 * 1000
);
