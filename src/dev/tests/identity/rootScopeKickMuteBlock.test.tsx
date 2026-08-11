/**
 * Bug B: Kick/Mute/Block confirmations are mounted by `ModalProvider`
 * ABOVE any per-space `<IdentityScopeProvider>` (see Router.web.tsx —
 * `ModalProvider` wraps `<Space />`, not the reverse), so they resolve a
 * member's name through the ROOT `<IdentityScopeProvider>` App.tsx mounts.
 * That root used to ship with a PERMANENT `rostersBySpace={}}` (the literal
 * empty object, no keys at all) — so a member with no cached public profile
 * had nothing to resolve from, no matter which space the confirmation was
 * acting in, and rendered as a truncated address in the confirmation modal
 * while the exact same member's name rendered correctly a few pixels away
 * in the channel behind it.
 *
 * The fix is `useRootIdentityScope` (src/hooks/business/identity/), which
 * feeds the root provider the user's OWN rosters via `useMultiSpaceRosters`
 * — the same hook `GlobalNotificationsModal`/`MessagePreview`/`ReactionsModal`
 * already use for their own detached surfaces, reading local IndexedDB and
 * sharing its query key with `useSpaceMembers` (no extra fetch for a space
 * already open in a Channel tab).
 *
 * This test mounts the exact shape App.tsx now produces — an
 * `<IdentityScopeProvider>` fed by `useRootIdentityScope`, nothing scoped
 * beneath it — and resolves a member the SAME way KickUserModal/MuteUserModal/
 * BlockUserModal do: `useResolvedMemberName(address, { spaceId, enrich })`,
 * spaceId coming from the route/prop, not from an ancestor provider (there
 * isn't one more specific than root in the real app for these three modals).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const SELF = 'QmSelfRootScopeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MEMBER = 'QmPeerRootScopeEgVKpYZKYuFu2J49zHXnA8vZtEqzzzz';
const SPACE_ID = 'space-root-scope-1';

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

// The member has NO public profile (never opted in — the common case) —
// only the space roster's GLOBAL SLOT (the live push, see
// identity-resolution-and-profile-sync.md) knows their name. This is
// exactly the shape that rendered as an address before the fix: nothing but
// an empty root roster to fall back to.
const getSpaces = vi.fn();
const getSpaceMembers = vi.fn();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getSpaces, getSpaceMembers },
  }),
}));

import { IdentityScopeProvider, useResolvedMemberName } from '@/identity';
import { useRootIdentityScope } from '@/hooks/business/identity';

const KickLikeProbe: React.FC<{ address: string; spaceId: string }> = ({ address, spaceId }) => {
  // Same call shape as KickUserModal/MuteUserModal/BlockUserModal: spaceId
  // passed explicitly (from the route/prop), no ancestor Space provider.
  const resolved = useResolvedMemberName(address, { spaceId, enrich: true });
  return (
    <span data-testid="resolved-name">
      {resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name}
    </span>
  );
};

/** Mirrors App.tsx's root mount exactly: `useRootIdentityScope` feeds the
 *  provider, nothing scoped beneath it. */
const RootAppShell: React.FC<{ address: string; spaceId: string }> = ({ address, spaceId }) => {
  const { rostersBySpace, locallyKnownNames } = useRootIdentityScope(SELF, 'Device Name');
  return (
    <IdentityScopeProvider
      rostersBySpace={rostersBySpace}
      selfAddress={SELF}
      locallyKnownNames={locallyKnownNames}
    >
      <KickLikeProbe address={address} spaceId={spaceId} />
    </IdentityScopeProvider>
  );
};

function renderAtRootAppShell(address: string, spaceId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RootAppShell address={address} spaceId={spaceId} />
    </QueryClientProvider>,
  );
}

describe('Bug B — Kick/Mute/Block-shaped resolution through the root provider', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockResolvedValue({ data: null }); // no public profile
    getSpaces.mockReset();
    getSpaceMembers.mockReset();
  });

  it('resolves the roster global name once useRootIdentityScope has loaded the space — never the address', async () => {
    getSpaces.mockResolvedValue([{ spaceId: SPACE_ID, spaceName: 'Root Scope Space' }]);
    getSpaceMembers.mockResolvedValue([
      { spaceId: SPACE_ID, user_address: MEMBER, display_name: '', global_display_name: 'Roster Global Name' },
    ]);

    renderAtRootAppShell(MEMBER, SPACE_ID);

    await waitFor(() =>
      expect(screen.getByTestId('resolved-name').textContent).toBe('Roster Global Name'),
    );
  });

  it('the OLD shape — a root with no roster data for the space at all — still falls to the address (documents the bug this closes)', async () => {
    // No `useRootIdentityScope` here: the literal pre-fix root shape,
    // `rostersBySpace={}`, same stable EMPTY object App.tsx used to pass
    // unconditionally regardless of which space a modal was acting in.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider rostersBySpace={{}} selfAddress={SELF}>
          <KickLikeProbe address={MEMBER} spaceId={SPACE_ID} />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(getPublicProfile).toHaveBeenCalled());
    expect(screen.getByTestId('resolved-name').textContent).toMatch(/^Qm.*…/);
  });

  it('a member the user\'s own rosters genuinely have no row for still falls to the address (not every fallback is a bug)', async () => {
    // The space loaded fine — it's just empty of this particular member.
    // This is the 'no-source-anywhere' shape the diagnostic deliberately
    // does NOT flag as degraded (see diagnostics.ts).
    getSpaces.mockResolvedValue([{ spaceId: SPACE_ID, spaceName: 'Root Scope Space' }]);
    getSpaceMembers.mockResolvedValue([]);

    renderAtRootAppShell(MEMBER, SPACE_ID);

    await waitFor(() => expect(getPublicProfile).toHaveBeenCalled());
    expect(screen.getByTestId('resolved-name').textContent).toMatch(/^Qm.*…/);
  });
});
