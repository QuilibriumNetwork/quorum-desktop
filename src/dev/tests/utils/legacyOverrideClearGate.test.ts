import { describe, it, expect, vi } from 'vitest';
import {
  legacySpaceOverrideClearDone,
  releaseLegacySpaceOverrideClearGate,
} from '@/utils/legacyOverrideClearGate';

/**
 * The gate is what stops the on-connect announce (and the tag rebroadcast) from
 * re-broadcasting a still-poisoned per-space override with a fresh timestamp
 * before the one-time clear has landed — the exact mechanism that made those
 * stale names permanent.
 *
 * Two properties matter and both are failure modes if wrong:
 *  - it must NOT resolve on its own (otherwise it gates nothing)
 *  - it must ALWAYS be releasable (otherwise a failed migration silences the
 *    identity announce for the whole session, trading a stale name for an
 *    invisible member — worse than the bug)
 */
describe('legacySpaceOverrideClearGate', () => {
  it('does not resolve until it is released', async () => {
    const settled = vi.fn();
    void legacySpaceOverrideClearDone.then(settled);

    // Flush the microtask queue. A promise that were already resolved would
    // have run its callback by now.
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
  });

  it('resolves once released, and awaiting it afterwards is instant', async () => {
    releaseLegacySpaceOverrideClearGate();
    await expect(legacySpaceOverrideClearDone).resolves.toBeUndefined();
  });

  it('is idempotent — releasing repeatedly is safe', () => {
    expect(() => {
      releaseLegacySpaceOverrideClearGate();
      releaseLegacySpaceOverrideClearGate();
      releaseLegacySpaceOverrideClearGate();
    }).not.toThrow();
  });

  it('stays resolved for every later awaiter', async () => {
    releaseLegacySpaceOverrideClearGate();
    await legacySpaceOverrideClearDone;
    // A second, independent await must not hang — the announce fires from more
    // than one trigger, so more than one caller waits on this.
    await expect(legacySpaceOverrideClearDone).resolves.toBeUndefined();
  });
});
