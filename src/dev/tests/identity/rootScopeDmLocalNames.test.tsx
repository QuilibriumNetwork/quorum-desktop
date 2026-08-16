/**
 * Reported bug: in DM search results, a DM partner with no public profile and
 * no space roster row (they are a DM contact, not a space member) rendered as
 * a truncated address instead of their name — even though the app already
 * knows their name locally, from `Conversation.displayName` (a peer broadcast
 * or a decrypted message frame, no network round-trip).
 *
 * Root cause, verified from source: `useRootIdentityScope`
 * (`src/hooks/business/identity/useRootIdentityScope.ts`) built
 * `locallyKnownNames` from `selfLocalNameEntry` ONLY — self's own device
 * name, never a DM partner's. DM partners' local names were built per-surface
 * in `DirectMessage.tsx`/`DirectMessageContactsList.tsx`, fed only to THOSE
 * components' own providers. Any OTHER surface resolving through a provider
 * that has no roster row and no local name for that address (the ROOT
 * provider, and any detached surface that mounts its own scope the same
 * shape `SearchResults` does) had nothing left but the truncated-address
 * fallback.
 *
 * This test mounts the exact shape App.tsx produces — `useRootIdentityScope`
 * feeding `<IdentityScopeProvider>`, nothing scoped beneath it — the same
 * shape `rootScopeKickMuteBlock.test.tsx` uses for bug B, and resolves the
 * partner on the GLOBAL ladder (no spaceId), matching how a DM sender
 * resolves in search results and anywhere else with no space context.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildConversationsKey } from '@/hooks/queries/conversations/buildConversationsKey';

const SELF = 'QmSelfRootDmNamesAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PARTNER = 'QmPeerRootDmNamesEgVKpYZKYuFu2J49zHXnA8vZtEqzz';
const PARTNER_WITH_PROFILE = 'QmPeerRootDmNamesProfileEgVKpYZKYuFu2J49zHXnAz';

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

const getSpaces = vi.fn();
const getSpaceMembers = vi.fn();
const getConversations = vi.fn();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getSpaces, getSpaceMembers, getConversations },
  }),
}));

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

import { IdentityScopeProvider, useResolvedMemberName } from '@/identity';
import { useRootIdentityScope } from '@/hooks/business/identity';

const GlobalScopeProbe: React.FC<{ address: string }> = ({ address }) => {
  // No spaceId — the global ladder, exactly how a DM message's sender
  // resolves in search results (DMs carry no spaceId) and how any
  // no-space surface resolves.
  const resolved = useResolvedMemberName(address, { enrich: true });
  return (
    <span data-testid="resolved-name">
      {resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name}
    </span>
  );
};

/** Mirrors App.tsx's root mount exactly. */
const RootAppShell: React.FC<{ address: string }> = ({ address }) => {
  const { rostersBySpace, locallyKnownNames } = useRootIdentityScope(SELF, 'Device Name');
  return (
    <IdentityScopeProvider
      rostersBySpace={rostersBySpace}
      selfAddress={SELF}
      locallyKnownNames={locallyKnownNames}
    >
      <GlobalScopeProbe address={address} />
    </IdentityScopeProvider>
  );
};

function renderAtRootAppShell(address: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(
    <QueryClientProvider client={client}>
      <RootAppShell address={address} />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

/**
 * Waits for `useLocalDmNames`' own conversations read — the SAME
 * `useInfiniteQuery` key `buildConversationsKey({ type: 'direct' })` — to
 * actually settle in the query cache.
 *
 * This is the fix for the false-negative bug in the "own address" and
 * "literal Unknown User" cases below: both used to wait on
 * `getPublicProfile` having been CALLED, which fires from an effect on
 * mount and is satisfied on the very first `waitFor` poll — well before the
 * async conversations page this test cares about has resolved. That let both
 * assertions run against EMPTY `locallyKnownNames` (indistinguishable from
 * "not loaded yet"), so neither test ever exercised the placeholder guard at
 * all — see .agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md.
 * Waiting on the query's own `status` instead ties the wait to the thing the
 * guard actually runs over.
 */
async function waitForLocalDmNamesToSettle(client: QueryClient) {
  await waitFor(() => {
    const state = client.getQueryState(buildConversationsKey({ type: 'direct' }));
    expect(state?.status).toBe('success');
  });
}

describe('DM search-shaped resolution through the root provider — conversation-derived local names', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getSpaces.mockReset();
    getSpaceMembers.mockReset();
    getConversations.mockReset();
    getSpaces.mockResolvedValue([]);
    getSpaceMembers.mockResolvedValue([]);
  });

  it('a DM partner known only from the local conversation record renders their name, never a truncated address', async () => {
    getPublicProfile.mockResolvedValue({ data: null }); // no public profile — the 404 case
    getConversations.mockResolvedValue({
      conversations: [
        { address: PARTNER, displayName: 'Bob (from conversation)' },
      ],
    });

    renderAtRootAppShell(PARTNER);

    await waitFor(() =>
      expect(screen.getByTestId('resolved-name').textContent).toBe('Bob (from conversation)'),
    );
  });

  it('a fetched public profile with a QNS name still outranks the local conversation name', async () => {
    getPublicProfile.mockResolvedValue({
      data: { primary_username: 'carol', display_name: 'Published Carol' },
    });
    getConversations.mockResolvedValue({
      conversations: [
        { address: PARTNER_WITH_PROFILE, displayName: 'Carol (from conversation)' },
      ],
    });

    renderAtRootAppShell(PARTNER_WITH_PROFILE);

    await waitFor(() =>
      expect(screen.getByTestId('resolved-name').textContent).toBe('carol.q'),
    );
    expect(screen.queryByText('Carol (from conversation)')).not.toBeInTheDocument();
  });

  it('a PLACEHOLDER conversation name (the partner\'s own address) never leaks through as a "known" name', async () => {
    getPublicProfile.mockResolvedValue({ data: null });
    getConversations.mockResolvedValue({
      conversations: [
        // The stored placeholder shape: displayName === the peer's own address.
        { address: PARTNER, displayName: PARTNER },
      ],
    });

    const { client } = renderAtRootAppShell(PARTNER);

    // Wait for the conversations page itself to settle — NOT for
    // `getPublicProfile` to have been called (see
    // `waitForLocalDmNamesToSettle`'s docstring: that used to make this a
    // false negative, asserting on empty `locallyKnownNames` before the
    // guard ever ran over the placeholder row).
    await waitForLocalDmNamesToSettle(client);

    // Falls through to the resolver's OWN truncated-address fallback — never
    // the full raw address, which is what renders if `isPlaceholderDisplayName`
    // fails to recognise `displayName === address` as a placeholder and lets
    // it through into `locallyKnownNames`.
    const expectedTruncated = `${PARTNER.slice(0, 6)}…${PARTNER.slice(-4)}`;
    await waitFor(() => {
      expect(screen.getByTestId('resolved-name').textContent).toBe(expectedTruncated);
    });
    expect(screen.getByTestId('resolved-name').textContent).not.toBe(PARTNER);
  });

  it('a PLACEHOLDER conversation name (the literal "Unknown User") never leaks through as a "known" name', async () => {
    getPublicProfile.mockResolvedValue({ data: null });
    getConversations.mockResolvedValue({
      conversations: [{ address: PARTNER, displayName: 'Unknown User' }],
    });

    const { client } = renderAtRootAppShell(PARTNER);

    await waitForLocalDmNamesToSettle(client);

    const expectedTruncated = `${PARTNER.slice(0, 6)}…${PARTNER.slice(-4)}`;
    await waitFor(() => {
      expect(screen.getByTestId('resolved-name').textContent).toBe(expectedTruncated);
    });
    expect(screen.getByTestId('resolved-name').textContent).not.toBe('Unknown User');
  });
});
