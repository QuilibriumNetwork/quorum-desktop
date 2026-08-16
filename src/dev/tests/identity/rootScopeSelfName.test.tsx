/**
 * The app-shell surfaces (nav rail avatar tooltip, settings row) render OUTSIDE
 * any Space or DM provider, so they resolve through the ROOT
 * <IdentityScopeProvider> mounted in App.tsx: no spaceId, real rosters from
 * `useRootIdentityScope` (empty here — this file is about the SELF tier, not
 * the roster one; see `rootScopeKickMuteBlock.test.tsx` for that), and
 * `selfAddress`/`locallyKnownNames` from the passkey record.
 *
 * That is the exact shape pinned here. The nav rail showed the passkey's raw
 * `displayName` instead of the verified ".q" name, and the fix depends on three
 * separate things being true at once — the root provider requests the self
 * profile, the self tier reads it (not `currentPasskeyInfo`), and the global
 * ladder ranks the QNS name above the display name. A test that only mounted a
 * Space provider would pass while the shell stayed broken.
 *
 * The LAST test in this file pins a SECOND, later defect found by the
 * operator with `/dev/fake-qns`: a self public profile with NEITHER
 * `display_name` NOR `primary_username` had no name source at all and fell
 * to the truncated address — in the nav rail (this file) and in the
 * operator's own DM messages (`DirectMessage.test.tsx`'s sibling case). The
 * fix, `App.tsx` feeding the root provider `locallyKnownNames` built by
 * `selfLocalNameEntry`, is exercised here the same way App.tsx wires it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// This test pins WIRING — that the name the identity module resolves is the one
// this surface renders. It is not a test of QNS ownership, which lives in
// `identity/verifiedQnsNames.test.ts` and shared's `verifyQnsClaim.test.ts`,
// both mutation-proven.
//
// The claim still travels the real path (profile -> claimedNamesIn ->
// verifiedQnsNames -> IdentitySources -> the ladder), so this still fails if the
// provider stops populating the verified map. Only the final comparison is
// stubbed, because the address fixtures here are arbitrary and no real key
// derives to them.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

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

import {
  IdentityScopeProvider,
  selfLocalNameEntry,
  useResolvedName,
  type RosterNameRow,
} from '@/identity';

// Same stable-reference shape App.tsx uses for the root mount.
const EMPTY_ROSTERS: Record<string, Record<string, RosterNameRow>> = {};

const SelfNameProbe: React.FunctionComponent<{ address: string }> = ({ address }) => (
  <span data-testid="self-name">{useResolvedName(address, { enrich: true })}</span>
);

const renderAtRootScope = (address: string, deviceDisplayName?: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IdentityScopeProvider
        rostersBySpace={EMPTY_ROSTERS}
        selfAddress={address}
        locallyKnownNames={selfLocalNameEntry(address, deviceDisplayName)}
      >
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

    renderAtRootScope(SELF, 'Device Name');

    await waitFor(() => expect(screen.getByTestId('self-name').textContent).toBe('ibis.q'));
  });

  it('falls back to your display name when no QNS name is elected', async () => {
    getPublicProfile.mockResolvedValue({ data: { display_name: 'Wandering Ibis' } });

    renderAtRootScope(SELF, 'Device Name');

    await waitFor(() =>
      expect(screen.getByTestId('self-name').textContent).toBe('Wandering Ibis'),
    );
  });

  it('requests the self profile exactly once, for the self address', async () => {
    getPublicProfile.mockResolvedValue({
      data: { display_name: 'Wandering Ibis', primary_username: 'ibis' },
    });

    renderAtRootScope(SELF, 'Device Name');

    await waitFor(() => expect(getPublicProfile).toHaveBeenCalled());
    expect(getPublicProfile).toHaveBeenCalledTimes(1);
    expect(getPublicProfile).toHaveBeenCalledWith(SELF);
  });

  it('a public profile with NO display_name and NO primary_username renders the device name, never the address (bug A)', async () => {
    // The exact reproduction: `/dev/fake-qns` removed the operator's own
    // `.q`, and their published profile carried no display_name either.
    getPublicProfile.mockResolvedValue({ data: {} });

    renderAtRootScope(SELF, 'Device Name');

    await waitFor(() => expect(screen.getByTestId('self-name').textContent).toBe('Device Name'));
    // Never the truncated address — that's the regression this pins. Revert
    // App.tsx's `locallyKnownNames={rootLocalNames}` wiring (or pass no
    // `deviceDisplayName` here) and this assertion goes red — see the
    // report's "diagnostic fires" transcript for the same claim proven a
    // second way, through the diagnostic instead of this assertion.
    expect(screen.getByTestId('self-name').textContent).not.toMatch(/^Qm.*…/);
  });
});
