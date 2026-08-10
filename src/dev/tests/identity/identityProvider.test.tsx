/**
 * The provider is the ONE place that knows how a member's three name tiers are
 * assembled. These pin the merge, not the ladder (the ladder is shared's).
 *
 * Constraint 1 from the design is the load-bearing case: a virtualised list of
 * 200 rows must not register 200 query observers. `identityFromMaps` is pure so
 * that can be asserted without mounting anything.
 */
import { describe, it, expect } from 'vitest';
import { identityFromMaps } from '@/identity/identityProvider';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

describe('identityFromMaps — tier assembly', () => {
  it('takes the per-space name from the roster override slot', () => {
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
      },
      profiles: {},
      selfAddress: null,
      selfProfile: null,
    });
    expect(r).toEqual({
      address: ADDR,
      spaceName: 'Mod Alice',
      globalName: 'Alice',
      qnsName: null,
    });
  });

  it('prefers the roster global slot over the public profile for globalName', () => {
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: '', global_display_name: 'Roster Alice' } },
      },
      profiles: { [ADDR]: { display_name: 'Profile Alice', primary_username: 'alice' } },
      selfAddress: null,
      selfProfile: null,
    });
    expect(r.globalName).toBe('Roster Alice');
    expect(r.qnsName).toBe('alice');
  });

  it('takes qnsName ONLY from the public profile', () => {
    // A roster row cannot carry primary_username; that is why bookmarks and
    // notifications showed a nickname but never a ".q".
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: { 'space-1': { [ADDR]: { display_name: 'Alice' } } },
      profiles: {},
      selfAddress: null,
      selfProfile: null,
    });
    expect(r.qnsName).toBeNull();
  });

  it('returns an all-null identity for an unknown address, never undefined', () => {
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      profiles: {},
      selfAddress: null,
      selfProfile: null,
    });
    expect(r).toEqual({ address: ADDR, spaceName: null, qnsName: null, globalName: null });
  });

  it('ignores the roster when no spaceId is given', () => {
    // A DM, or a Space you have left. A per-space nickname is meaningless here.
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
      },
      profiles: { [ADDR]: { display_name: 'Alice', primary_username: 'alice' } },
      selfAddress: null,
      selfProfile: null,
    });
    expect(r.spaceName).toBeNull();
    expect(r.qnsName).toBe('alice');
  });
});

describe('identityFromMaps — offline (design constraint 5)', () => {
  it('still resolves a name from the roster alone, with no profile at all', () => {
    // DM and Space names render from IndexedDB with no network round-trip
    // today, and must continue to. A missing profile costs the ".q", never the
    // name — it must not degrade to an address.
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
      },
      profiles: {},
      selfAddress: null,
      selfProfile: null,
    });
    expect(r.globalName).toBe('Alice');
    expect(r.qnsName).toBeNull();
  });
});

describe('identityFromMaps — the self tier', () => {
  it('reads YOUR OWN qnsName from your own public profile', () => {
    // currentPasskeyInfo carries no primary_username. Special-casing self from
    // it is what broke your own DM messages and your own profile card.
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      profiles: {},
      selfAddress: ADDR,
      selfProfile: { display_name: 'GattoPardo Mobile', primary_username: 'gatto' },
    });
    expect(r.qnsName).toBe('gatto');
    expect(r.globalName).toBe('GattoPardo Mobile');
  });
});
