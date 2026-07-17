import { describe, it, expect } from 'vitest';
import { KeyedMutex } from '../../../utils/keyedMutex';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('KeyedMutex', () => {
  it('serializes concurrent callers on the same key (no interleaving)', async () => {
    const mutex = new KeyedMutex();
    const events: string[] = [];

    const task = (name: string, delay: number) =>
      mutex.runExclusive('conv-a', async () => {
        events.push(`${name}:start`);
        await sleep(delay);
        events.push(`${name}:end`);
      });

    // First task is slow; if the mutex didn't serialize, t2 would start
    // before t1 ends.
    await Promise.all([task('t1', 30), task('t2', 5), task('t3', 5)]);

    expect(events).toEqual([
      't1:start',
      't1:end',
      't2:start',
      't2:end',
      't3:start',
      't3:end',
    ]);
  });

  it('runs in FIFO arrival order', async () => {
    const mutex = new KeyedMutex();
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        mutex.runExclusive('k', async () => {
          await sleep(1);
          order.push(n);
        })
      )
    );
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not block different keys against each other', async () => {
    const mutex = new KeyedMutex();
    const events: string[] = [];

    const slow = mutex.runExclusive('a', async () => {
      events.push('a:start');
      await sleep(40);
      events.push('a:end');
    });
    const fast = mutex.runExclusive('b', async () => {
      events.push('b:start');
      await sleep(1);
      events.push('b:end');
    });

    await Promise.all([slow, fast]);
    // b finished while a was still running.
    expect(events.indexOf('b:end')).toBeLessThan(events.indexOf('a:end'));
  });

  it('returns the callback result', async () => {
    const mutex = new KeyedMutex();
    await expect(mutex.runExclusive('k', async () => 42)).resolves.toBe(42);
  });

  it('releases the lock when the callback throws, and later callers still run', async () => {
    const mutex = new KeyedMutex();
    const events: string[] = [];

    const failing = mutex
      .runExclusive('k', async () => {
        events.push('fail:start');
        throw new Error('boom');
      })
      .catch((e: Error) => events.push(`caught:${e.message}`));

    const next = mutex.runExclusive('k', async () => {
      events.push('next:ran');
    });

    await Promise.all([failing, next]);
    expect(events).toContain('caught:boom');
    expect(events).toContain('next:ran');
    // The failure did not wedge the queue: next ran after the failure.
    expect(events.indexOf('next:ran')).toBeGreaterThan(
      events.indexOf('fail:start')
    );
  });

  it('cleans up idle keys (no unbounded map growth)', async () => {
    const mutex = new KeyedMutex();
    for (let i = 0; i < 50; i++) {
      await mutex.runExclusive(`key-${i}`, async () => {});
    }
    // Private field — reach in for the leak assertion only.
    const tails = (mutex as unknown as { tails: Map<string, Promise<void>> })
      .tails;
    expect(tails.size).toBe(0);
  });
});
