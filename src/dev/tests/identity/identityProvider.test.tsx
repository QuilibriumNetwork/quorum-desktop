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
