/**
 * Fix round 1 on Phase D rows 15-18: `identityFromMaps`'s `globalName` used
 * to have exactly two sources — the roster global slot (Spaces only) and a
 * FETCHED public profile. In a DM there is no `spaceId`, so the roster tier
 * is always empty, and the ONLY surviving source was the fetch. A DM partner
 * who has never published a public profile therefore resolved to an
 * all-null identity and rendered as a truncated address — even when the app
 * already knows their name locally, from `Conversation.displayName` (a peer
 * broadcast or a decrypted message frame, see
 * `.agents/issues/2026-08-01-dm-partner-identity-lost-on-established-sessions.md`).
 *
 * That violated design constraint 5 in
 * `.agents/issues/.open/2026-08-10-identity-resolution-architecture-design.md`:
 * "DM identity currently renders from IndexedDB with no network round-trip.
 * The provider must preserve that, not make names await a fetch."
 *
 * The fix: `IdentitySources` gains `locallyKnownNames` (address -> name), fed
 * by a caller that already has it in memory, and `identityFromMaps` uses it
 * as the LAST `globalName` tier — after the roster global slot, after a
 * fetched profile, before falling through to a truncated address. One place,
 * not a second lookup path and not a per-component special case.
 *
 * Two tests, each written to fail against the PRE-FIX provider and pass
 * against the POST-FIX one (see the report for both transcripts):
 *
 *   1. The name survives with no profile at all, and a fetched profile still
 *      wins when one exists.
 *   2. No network round-trip: rendering from local data alone issues ZERO
 *      fetches and produces the name SYNCHRONOUSLY on first paint — the
 *      counting-fake approach from `identitySidebarFetch.test.tsx`, reused
 *      here because it is the one instrument in this repo that can actually
 *      falsify "this quietly started awaiting a fetch".
 */
import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getPublicProfile = vi.fn();

vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

// This file pins the local-name TIER ORDER, not QNS ownership (that lives in
// `verifiedQnsNames.test.ts` and shared's `verifyQnsClaim.test.ts`, both
// mutation-proven). The claim still travels the real path, so this still fails
// if the provider stops populating the verified map — only the final comparison
// is stubbed, because `ADDR` is an arbitrary fixture no real key derives to.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

import { IdentityScopeProvider } from '@/identity/identityProvider';
import { MemberName } from '@/identity/MemberName';

const ADDR = 'QmPeerLocalNameEgVKpYZKYuFu2J49zHXnA8vZtEqzzzz';

describe('DM identity — the local name survives with no public profile (constraint 5)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('a partner known only from local conversation data renders that name, never a truncated address', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider
          rostersBySpace={{}}
          selfAddress={null}
          locallyKnownNames={{ [ADDR]: 'Bob (from conversation)' }}
        >
          <MemberName address={ADDR} />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );

    // Synchronous — no network round-trip needed to know this name (see the
    // second test below for the same claim as a fetch-count assertion).
    expect(screen.getByText('Bob (from conversation)')).toBeInTheDocument();
    expect(screen.queryByText(/^Qm/)).not.toBeInTheDocument();
  });

  it('a fetched public profile still wins over the local name once enriched', async () => {
    getPublicProfile.mockResolvedValue({
      data: { primary_username: 'bob', display_name: 'Published Bob' },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider
          rostersBySpace={{}}
          selfAddress={null}
          locallyKnownNames={{ [ADDR]: 'Bob (from conversation)' }}
        >
          <MemberName address={ADDR} enrich />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );

    // Local name renders first (no await needed for it to appear at all)...
    expect(screen.getByText('Bob (from conversation)')).toBeInTheDocument();
    // ...then the fetched profile — authoritative — takes over.
    await waitFor(() => expect(screen.getByText('bob.q')).toBeInTheDocument());
    expect(screen.queryByText('Bob (from conversation)')).not.toBeInTheDocument();
  });
});

describe('DM identity — resolving from local data alone issues ZERO fetches', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('renders the local name synchronously on first paint, with no enrich and no network round-trip', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    // No `act`/`waitFor` around this render at all — if the name only shows
    // up after a query settles, this assertion (made immediately after
    // `render`, synchronously) is exactly what catches it.
    render(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider
          rostersBySpace={{}}
          selfAddress={null}
          locallyKnownNames={{ [ADDR]: 'Bob (from conversation)' }}
        >
          <MemberName address={ADDR} />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Bob (from conversation)')).toBeInTheDocument();
    expect(getPublicProfile).not.toHaveBeenCalled();
  });
});
