// OFFLINE. Proves the lock probe measures what it claims, before a networked run
// depends on it.
//
//   yarn harness lock-probe
//
// A probe that silently recorded nothing would report "no samples" after a
// 7-minute run against production and waste it — and worse, a probe that recorded
// the WRONG number would be read as evidence. The bug this instrument exists to
// confirm turns on distinguishing a ~20ms hold from a ~22s one, so the two
// quantities are checked against known, deliberately-induced delays.
import { test, expect } from 'vitest';
import { dmRatchetMutex } from '../../../utils/keyedMutex';
import { installLockProbe, summariseLockHolds } from './lock-probe';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('lock-probe: records hold time and queue time against known delays', async () => {
  const samples = installLockProbe();
  const before = samples.length;

  // Two callers on the SAME key: the second cannot start until the first
  // finishes, which is the serialization the bug is about.
  const key = 'probe-conversation/probe-conversation';
  const first = dmRatchetMutex.runExclusive(key, async () => {
    await sleep(300);
    return 'a';
  });
  // Started after the first has taken the lock, so it must queue behind it.
  await sleep(20);
  const second = dmRatchetMutex.runExclusive(key, async () => {
    await sleep(50);
    return 'b';
  });

  expect(await first).toBe('a');
  expect(await second).toBe('b');

  const mine = samples.slice(before).filter((s) => s.key === key);
  expect(mine).toHaveLength(2);

  const [held1, held2] = mine.map((s) => s.heldMs);
  // Generous bounds: this asserts the probe measures the right ORDER OF
  // MAGNITUDE, which is all the bug needs. Tight bounds would make it flaky on a
  // loaded machine for no diagnostic gain.
  expect(held1).toBeGreaterThanOrEqual(250);
  expect(held1).toBeLessThan(2_000);
  expect(held2).toBeGreaterThanOrEqual(40);
  expect(held2).toBeLessThan(2_000);

  // The second caller queued behind the first — the user-visible consequence.
  const queued = mine[1].waitedMs;
  expect(queued).toBeGreaterThanOrEqual(200);

  // A throwing critical section must still be recorded: the delete-conversation
  // and give-up paths RETHROW (bug §1), and those are the holds most worth seeing.
  const n = samples.length;
  await expect(
    dmRatchetMutex.runExclusive(key, async () => {
      await sleep(30);
      throw new Error('probe: deliberate');
    })
  ).rejects.toThrow('probe: deliberate');
  expect(samples.length).toBe(n + 1);
  expect(samples[samples.length - 1].heldMs).toBeGreaterThanOrEqual(20);

  // Installing twice must not double-count — the mutex is a process-wide
  // singleton shared by every bot, so a second wrap would inflate every hold.
  const again = installLockProbe();
  expect(again).toBe(samples);
  const m = samples.length;
  await dmRatchetMutex.runExclusive('other/other', async () => sleep(10));
  expect(samples.length).toBe(m + 1);

  for (const line of summariseLockHolds(samples)) console.log(`[lock-probe] ${line}`);
}, 60_000);
