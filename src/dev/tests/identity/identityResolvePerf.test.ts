/**
 * Route (a) for the review finding on `useMemberIdentity`'s memo: the
 * provider rebuilds `sources` as a new object whenever ANY address's profile
 * query settles (identityProvider.tsx's `profiles` memo keys on
 * `dataUpdatedAt`, not presence — see its own tests). That new reference
 * invalidates `identityFromMaps`'s useMemo for every mounted row, so a
 * 200-row `<MemberName>` list re-runs `identityFromMaps` + `resolveIdentity`
 * 200 times whenever one member's fetch lands.
 *
 * Narrowing the memo to skip that recompute would require re-deriving, in
 * the hook, which roster row / profile / self-branch `identityFromMaps`
 * would pick — i.e. duplicating the tier-selection logic the provider owns.
 * A duplicated merge rule is a worse defect than a redundant recompute (it
 * is exactly the kind of drift `identityFromMaps`'s docstring says cost ~18
 * render surfaces one day, across two clients, the last time it existed in
 * two places). So this measures the recompute instead of eliminating it:
 * both functions are pure, allocation-light object/string lookups, and a
 * full 200-row re-resolve is expected to be negligible.
 *
 * This also pre-answers "design constraint 1" (a virtualised 200-row list)
 * for whichever later task first renders one for real.
 */
import { describe, it, expect } from 'vitest';
import { resolveIdentity } from '@quilibrium/quorum-shared';
import { identityFromMaps, type IdentitySources, type RosterNameRow } from '@/identity/identityProvider';

const ROW_COUNT = 200;

const addressAt = (i: number): string => `QmPerf${String(i).padStart(4, '0')}${'A'.repeat(38)}`;

function buildSources(count: number): { addresses: string[]; sources: IdentitySources } {
  const addresses = Array.from({ length: count }, (_, i) => addressAt(i));
  const roster: Record<string, RosterNameRow> = {};
  const profiles: IdentitySources['profiles'] = {};
  addresses.forEach((address, i) => {
    // Mixed shapes, like a real roster: some with a per-space nickname, some
    // with only a global name, some with a QNS-verified profile.
    roster[address] = {
      display_name: i % 3 === 0 ? `Nick ${i}` : '',
      global_display_name: `Member ${i}`,
    };
    if (i % 2 === 0) {
      profiles[address] = {
        display_name: `Profile ${i}`,
        primary_username: i % 4 === 0 ? `user${i}` : undefined,
        profile_image: '',
        bio: '',
        timestamp: 1,
        signature: '',
      };
    }
  });
  return {
    addresses,
    sources: { rostersBySpace: { 'space-1': roster }, profiles, selfAddress: null, selfProfile: null },
  };
}

/** One full pass resolving every address, mirroring what every mounted
 *  `<MemberName>` row in the list would do when the context value changes. */
function resolveAll(addresses: string[], sources: IdentitySources): void {
  for (const address of addresses) {
    const identity = identityFromMaps(address, 'space-1', sources);
    resolveIdentity(identity, { scope: 'space' });
  }
}

describe('identityFromMaps + resolveIdentity — 200-row re-resolve cost (design constraint 1)', () => {
  it('stays negligible even when every mounted row recomputes on one unrelated address settling', () => {
    const { addresses, sources } = buildSources(ROW_COUNT);

    // Warm up the JIT, then take the min over several trials — standard
    // microbenchmark noise reduction. A genuine O(n^2) regression is slow on
    // every trial; a one-off CI scheduling hiccup is not.
    resolveAll(addresses, sources);
    const trials = 7;
    let minMs = Infinity;
    for (let t = 0; t < trials; t += 1) {
      const start = performance.now();
      resolveAll(addresses, sources);
      minMs = Math.min(minMs, performance.now() - start);
    }

    // Measured on the dev machine: ~0.16ms (min of 7 trials) for the full
    // 200-row pass — roughly 125x headroom under this bound. Loose enough not
    // to be flaky on a slow CI runner; still tight enough that an accidental
    // O(n^2) rewrite of identityFromMaps (e.g. scanning the whole roster per
    // address instead of an O(1) lookup) would push a 200-row pass to ~30ms+
    // and blow through it.
    expect(minMs).toBeLessThan(20);
  });
});
