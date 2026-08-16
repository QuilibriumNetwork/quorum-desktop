/**
 * The provider is the ONE place that knows how a member's three name tiers are
 * assembled. These pin the merge, not the ladder (the ladder is shared's).
 *
 * Constraint 1 from the design is the load-bearing case: a virtualised list of
 * 200 rows must not register 200 query observers. `identityFromMaps` is pure so
 * that can be asserted without mounting anything.
 */
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  identityFromMaps,
  IdentityScopeProvider,
  useIdentityContext,
} from '@/identity/identityProvider';
import { publicProfileQueryKey } from '@/hooks/business/user/useUserPublicProfile';
import type { PublicProfileResponse } from '@/api/baseTypes';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

describe('identityFromMaps — tier assembly', () => {
  it('takes the per-space name from the roster override slot', () => {
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
      },
      verifiedQnsNames: {},
      profileGlobalNames: {},
      selfAddress: null,
      locallyKnownNames: {},
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
      profileGlobalNames: { [ADDR]: 'Profile Alice' },
      verifiedQnsNames: { [ADDR]: 'alice' },
      selfAddress: null,
      locallyKnownNames: {},
    });
    expect(r.globalName).toBe('Roster Alice');
    expect(r.qnsName).toBe('alice');
  });

  it('takes qnsName ONLY from the verified map', () => {
    // A roster row cannot carry primary_username; that is why bookmarks and
    // notifications showed a nickname but never a ".q". Since verification
    // moved upstream, the rule is stronger: the ONLY way a `.q` renders is an
    // entry somebody already proved, so a roster row cannot produce one and
    // neither can an unverified profile claim.
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: { 'space-1': { [ADDR]: { display_name: 'Alice' } } },
      verifiedQnsNames: {},
      profileGlobalNames: {},
      selfAddress: null,
      locallyKnownNames: {},
    });
    expect(r.qnsName).toBeNull();
  });

  it('returns an all-null identity for an unknown address, never undefined', () => {
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      verifiedQnsNames: {},
      profileGlobalNames: {},
      selfAddress: null,
      locallyKnownNames: {},
    });
    expect(r).toEqual({ address: ADDR, spaceName: null, qnsName: null, globalName: null });
  });

  it('ignores the roster when no spaceId is given', () => {
    // A DM, or a Space you have left. A per-space nickname is meaningless here.
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
      },
      profileGlobalNames: { [ADDR]: 'Alice' },
      verifiedQnsNames: { [ADDR]: 'alice' },
      selfAddress: null,
      locallyKnownNames: {},
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
      verifiedQnsNames: {},
      profileGlobalNames: {},
      selfAddress: null,
      locallyKnownNames: {},
    });
    expect(r.globalName).toBe('Alice');
    expect(r.qnsName).toBeNull();
  });
});

describe('identityFromMaps — the self tier', () => {
  it('reads YOUR OWN qnsName from your own public profile, on the same path as anyone else', () => {
    // currentPasskeyInfo carries no primary_username. Special-casing self from
    // it is what broke your own DM messages and your own profile card.
    //
    // Self used to have its own branch here, reading a separate `selfProfile`
    // field. It no longer does, and that is deliberate: your own claim is
    // verified on exactly the same path as everybody else's, because a name you
    // have not registered does not become yours just because you are the one
    // looking at it.
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      verifiedQnsNames: { [ADDR]: 'gatto' },
      profileGlobalNames: { [ADDR]: 'GattoPardo Mobile' },
      selfAddress: ADDR,
      locallyKnownNames: {},
    });
    expect(r.qnsName).toBe('gatto');
    expect(r.globalName).toBe('GattoPardo Mobile');
  });

  it('does NOT give self a shortcut past verification', () => {
    // The paired negative, and the one that would have caught a "self is always
    // trusted" shortcut. With no verified entry, self renders their global name
    // and no ".q" — same as any other unproven claimant.
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      verifiedQnsNames: {},
      profileGlobalNames: { [ADDR]: 'GattoPardo Mobile' },
      selfAddress: ADDR,
      locallyKnownNames: {},
    });
    expect(r.qnsName).toBeNull();
    expect(r.globalName).toBe('GattoPardo Mobile');
  });
});

describe('identityFromMaps — the local-name tier (fix round 1, DM identity lost with no public profile)', () => {
  // A DM partner known only from local conversation data (a peer broadcast /
  // decrypted-frame `user_profile`, no network round-trip) — the ONLY
  // scenario where a DM used to have nothing but a truncated address, since
  // `rostersBySpace` is always {} for a DM (no spaceId) and this partner has
  // never published a public profile.
  it('falls back to the local name when neither the roster nor a fetched profile knows one', () => {
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      verifiedQnsNames: {},
      profileGlobalNames: {},
      selfAddress: null,
      locallyKnownNames: { [ADDR]: 'Bob (from conversation)' },
    });
    expect(r.globalName).toBe('Bob (from conversation)');
    expect(r.qnsName).toBeNull();
  });

  it('a fetched public profile still wins over the local name — the local name is the LAST resort, not the first', () => {
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      profileGlobalNames: { [ADDR]: 'Published Bob' },
      verifiedQnsNames: { [ADDR]: 'bob' },
      selfAddress: null,
      locallyKnownNames: { [ADDR]: 'Bob (from conversation)' },
    });
    expect(r.globalName).toBe('Published Bob');
    expect(r.qnsName).toBe('bob');
  });

  it('the roster global slot still wins over the local name (Space precedence unchanged)', () => {
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: '', global_display_name: 'Roster Alice' } },
      },
      verifiedQnsNames: {},
      profileGlobalNames: {},
      selfAddress: null,
      locallyKnownNames: { [ADDR]: 'Local Alice' },
    });
    expect(r.globalName).toBe('Roster Alice');
  });

  it('an empty locallyKnownNames map (every Space surface) changes nothing', () => {
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      verifiedQnsNames: {},
      profileGlobalNames: {},
      selfAddress: null,
      locallyKnownNames: {},
    });
    expect(r.globalName).toBeNull();
  });
});

function NameProbe({ address }: { address: string }) {
  const { sources, request } = useIdentityContext();
  React.useEffect(() => {
    request(address);
  }, [address, request]);
  const identity = identityFromMaps(address, undefined, sources);
  return <span data-testid="probe-name">{identity.globalName ?? ''}</span>;
}

describe('IdentityScopeProvider — a setQueryData write to an already-loaded profile propagates', () => {
  it('shows the NEW display_name after a self-profile edit writes the cache directly', async () => {
    // Regression cover: useUserSettings.ts's self-edit path calls
    // queryClient.setQueryData(publicProfileQueryKey(addr), prev => ({...}))
    // against a profile that is ALREADY loaded — non-null before and after
    // the write. A `profiles` memo fingerprinted only on data PRESENCE can't
    // see that write, so the renamed user keeps seeing their OLD name on
    // every surface until an unrelated address happens to enter or leave the
    // requested set.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const key = publicProfileQueryKey(ADDR);
    queryClient.setQueryData<PublicProfileResponse>(key, {
      display_name: 'Old Name',
      profile_image: '',
      bio: '',
      timestamp: 1,
      signature: '',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
          <NameProbe address={ADDR} />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('probe-name').textContent).toBe('Old Name'),
    );

    act(() => {
      queryClient.setQueryData<PublicProfileResponse>(key, (prev) => ({
        ...(prev as PublicProfileResponse),
        display_name: 'New Name',
      }));
    });

    await waitFor(() =>
      expect(screen.getByTestId('probe-name').textContent).toBe('New Name'),
    );
  });
});
