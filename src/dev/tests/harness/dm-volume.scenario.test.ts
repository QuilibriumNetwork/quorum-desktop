// SLICE 4 — measure whether volume ages a DM session. The open question (§1 of
// the resurfaced-DM bug): the skipped_keys_map grew 2 → 20 → 23 → 37 across a day
// and the failure rate rose with it, but nobody has reproduced the aging
// deliberately — and cause/effect are circular on captured evidence (failures
// also create skipped keys).
//
// This drives CONCURRENT bidirectional load (both bots sending at once → frames
// arrive out-of-order across DH steps → skipped keys accumulate) and samples the
// skipped-keys count over the run. If it grows and failures appear, aging is
// reproduced on the bench. If volume alone does nothing, that is itself the
// answer: the trigger is time or cross-platform, not volume.
//
//   yarn harness dm-volume            # HARNESS_MESSAGES (default 60)
import { test, expect } from 'vitest';
import { createBot, type HarnessBot } from './bot';
import { totalSkipped } from './inspect';
import { RunLog } from './log';

const MESSAGES = Number(process.env.HARNESS_MESSAGES ?? 60);
const SAMPLE_EVERY = Number(process.env.HARNESS_SAMPLE_EVERY ?? 10);
const GAP_MS = Number(process.env.HARNESS_GAP_MS ?? 60);
const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 10000);

test(
  'dm-volume: skipped-keys growth under concurrent bidirectional load',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('dm-volume', startedAt);

    // Account names configurable so the same scenario can compare a fresh pair
    // (clean history) against a reused pair (accumulated queued frames).
    const [alice, bob] = await Promise.all([
      createBot(process.env.HARNESS_A_NAME ?? 'vol-alice'),
      createBot(process.env.HARNESS_B_NAME ?? 'vol-bob'),
    ]);

    let aRecv = 0;
    let bRecv = 0;
    alice.onDecrypted = (m) => { if (m.content?.type === 'post') aRecv += 1; };
    bob.onDecrypted = (m) => { if (m.content?.type === 'post') bRecv += 1; };

    await Promise.all([alice.start(), bob.start()]);

    // Establish sessions both ways before the load.
    await alice.send(bob.identity.address, 'A→B init');
    await new Promise((r) => setTimeout(r, 2500));
    await bob.send(alice.identity.address, 'B→A init');
    await new Promise((r) => setTimeout(r, 2500));

    const sample = async (label: string) => {
      const aSkip = await totalSkipped(alice.messageDB);
      const bSkip = await totalSkipped(bob.messageDB);
      const row = {
        label,
        aSkip,
        bSkip,
        aErr: alice.errors.length,
        bErr: bob.errors.length,
      };
      log.add(Date.now(), 'harness', 'sample', row);
      console.log(
        `[dm-volume] ${label.padEnd(10)} aSkip=${aSkip} bSkip=${bSkip} aErr=${alice.errors.length} bErr=${bob.errors.length}`
      );
    };
    await sample('after-init');

    for (let i = 1; i <= MESSAGES; i++) {
      // Both directions at once — the out-of-order generator.
      await Promise.all([
        alice.send(bob.identity.address, `A→B #${i}`).catch(() => {}),
        bob.send(alice.identity.address, `B→A #${i}`).catch(() => {}),
      ]);
      await new Promise((r) => setTimeout(r, GAP_MS));
      if (i % SAMPLE_EVERY === 0) await sample(`msg-${i}`);
    }

    await new Promise((r) => setTimeout(r, SETTLE_MS));
    await sample('final');

    console.log(
      `[dm-volume] receives A=${aRecv} B=${bRecv}  failures A=${alice.errors.length} B=${bob.errors.length}`
    );
    console.log(`[dm-volume] log: ${log.file}`);

    alice.stop();
    bob.stop();

    // The run itself is the measurement; assert only that traffic flowed.
    expect(aRecv + bRecv).toBeGreaterThan(0);
  },
  10 * 60 * 1000
);
