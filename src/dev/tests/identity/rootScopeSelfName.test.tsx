/**
 * The app-shell surfaces (nav rail avatar tooltip, settings row) render OUTSIDE
 * any Space or DM provider, so they resolve through the ROOT
 * <IdentityScopeProvider> mounted in App.tsx: no spaceId, empty rostersBySpace,
 * and `selfAddress` from the passkey record.
 *
 * That is the exact shape pinned here. The nav rail showed the passkey's raw
 * `displayName` instead of the verified ".q" name, and the fix depends on three
 * separate things being true at once — the root provider requests the self
 * profile, the self tier reads it (not `currentPasskeyInfo`), and the global
 * ladder ranks the QNS name above the display name. A test that only mounted a
 * Space provider would pass while the shell stayed broken.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const SELF = 'QmSelfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const getPublicProfile = vi.fn();

vi.mock('@/api/baseTypes', async () => {
  const actual = await vi.importActual<typeof import('@/api/baseTypes')>('@/api/baseTypes');
  return {
    ...actual,
    QuorumApiClient: class {
      getPublicProfile = getPublicProfile;
    },
  };
});

import { IdentityScopeProvider, useResolvedName, type RosterNameRow } from '@/identity';

// Same stable-reference shape App.tsx uses for the root mount.
const EMPTY_ROSTERS: Record<string, Record<string, RosterNameRow>> = {};

const SelfNameProbe: React.FunctionComponent<{ address: string }> = ({ address }) => (
  <span data-testid="self-name">{useResolvedName(address, { enrich: true })}</span>
);

const renderAtRootScope = (address: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IdentityScopeProvider rostersBySpace={EMPTY_ROSTERS} selfAddress={address}>
        <SelfNameProbe address={address} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
};

describe('root identity scope — your own name in the app shell', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('renders your QNS name with the .q suffix, not your display name', async () => {
    getPublicProfile.mockResolvedValue({
      data: { display_name: 'Wandering Ibis', primary_username: 'ibis' },
    });

    renderAtRootScope(SELF);

    await waitFor(() => expect(screen.getByTestId('self-name').textContent).toBe('ibis.q'));
  });

  it('falls back to your display name when no QNS name is elected', async () => {
    getPublicProfile.mockResolvedValue({ data: { display_name: 'Wandering Ibis' } });

    renderAtRootScope(SELF);

    await waitFor(() =>
      expect(screen.getByTestId('self-name').textContent).toBe('Wandering Ibis'),
    );
  });

  it('requests the self profile exactly once, for the self address', async () => {
    getPublicProfile.mockResolvedValue({
      data: { display_name: 'Wandering Ibis', primary_username: 'ibis' },
    });

    renderAtRootScope(SELF);

    await waitFor(() => expect(getPublicProfile).toHaveBeenCalled());
    expect(getPublicProfile).toHaveBeenCalledTimes(1);
    expect(getPublicProfile).toHaveBeenCalledWith(SELF);
  });
});
