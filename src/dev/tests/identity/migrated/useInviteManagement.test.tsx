/**
 * useInviteManagement — the invite picker's user-option labels (Phase D row
 * 20; REVISED 2026-08-11, design decision 3, second look).
 *
 * This is a search over the user's OWN DM contacts, not a roster dump — the
 * same reasoning that already let bookmarks and `DirectMessageContactsList`
 * enrich their (also personal-list-bounded) candidates up front applies
 * here too, so the original "must NOT enrich" call was over-conservative.
 * `getUserOptions` now calls `requestNames` for every DM conversation
 * address, unconditionally (not just the currently-filtered/rendered ones —
 * same reasoning as `BookmarksPage.tsx`'s proactive `requestNames`: a
 * contact hidden by an active search term still needs its profile in hand
 * so a NEW search term can match their QNS name on the first keystroke).
 * This list is a personal contact list, never a space's full membership, so
 * it does not reintroduce the fetch storm the sidebar's policy guards
 * against.
 *
 * BEFORE the Phase D migration, `getUserOptions` read
 * `useConversationsWithProfileBackfill` (an unconditional N-fetch backfill
 * of every DM partner's public profile) and built each label via
 * `resolveMemberName`/`formatResolvedName` from the backfilled row's raw
 * fields.
 *
 * The fix resolves through `useNameResolver` (`global: true` — these are DM
 * partners, not this space's roster). A DM partner who has never published
 * a public profile still gets a real name from `locallyKnownNames` (the
 * conversation's own local `displayName`, mirroring the DM surfaces' fix
 * round 1 — no network round-trip), and a partner who already has an
 * enriched profile cached (from having opened their DM, or from this hook's
 * own `requestNames`) shows their `.q`, because `resolve()` reads whatever
 * the provider already has.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdentityScopeProvider, useIdentityContext } from '@/identity/identityProvider';

/** Simulates "some other surface in this provider already enriched this
 *  address" — e.g. the DM sidebar rendering `<MemberName enrich />` for the
 *  same partner. `resolve()` must read whatever request() anyone already
 *  triggered; it never issues its own. */
function Requester({ address }: { address: string }) {
  const { request } = useIdentityContext();
  React.useEffect(() => {
    request(address);
  }, [address, request]);
  return null;
}

const getPublicProfile = vi.fn();
vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

const SELF_ADDR = 'QmSelf00000000000000000000000000000000';
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: SELF_ADDR } }),
}));

const ADDR_A = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz'; // never published a profile
const ADDR_B = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz'; // profile already cached elsewhere

const conversations = [
  { address: ADDR_A, displayName: 'Bob (from conversation)', icon: '', conversationId: 'c1' },
  { address: ADDR_B, displayName: 'Stale B', icon: '', conversationId: 'c2' },
];

vi.mock('@/hooks/queries', () => ({
  useConversations: () => ({ data: { pages: [{ conversations }] } }),
  useRegistration: () => ({ data: { registration: {} } }),
}));

const getEncryptionStates = vi.fn().mockResolvedValue([]);
const getSpaceMember = vi.fn().mockResolvedValue(undefined);
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getEncryptionStates, getSpaceMember },
    ensureKeyForSpace: vi.fn(),
    sendInviteToUser: vi.fn(),
    generateNewInviteLink: vi.fn(),
    constructInviteLink: vi.fn(),
  }),
}));
vi.mock('@/components/context/useRegistrationContext', () => ({
  useRegistrationContext: () => ({ keyset: {} }),
}));
vi.mock('@/components/context/QuorumApiContext', () => ({
  useQuorumApiClient: () => ({ apiClient: { getUser: vi.fn() } }),
}));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
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

import { useInviteManagement } from '@/hooks/business/spaces/useInviteManagement';

const SPACE_ID = 'space-1';

function wrapperFor(locallyKnownNames: Record<string, string>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <IdentityScopeProvider
          spaceId={SPACE_ID}
          rostersBySpace={{}}
          selfAddress={SELF_ADDR}
          locallyKnownNames={locallyKnownNames}
        >
          {children}
        </IdentityScopeProvider>
      </QueryClientProvider>
    );
  };
}

describe('useInviteManagement — invite picker options (enrich, bounded by the DM contact list)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockResolvedValue({ data: null });
  });

  it('renders a DM partner with no public profile via the LOCAL conversation name (a fetch is issued, per decision 3, but resolves to null here)', async () => {
    const { result } = renderHook(
      () => useInviteManagement({ spaceId: SPACE_ID, defaultChannel: undefined }),
      { wrapper: wrapperFor({ [ADDR_A]: 'Bob (from conversation)' }) },
    );

    const options = result.current.getUserOptions();
    const optA = options.find((o) => o.value === ADDR_A);
    expect(optA?.label).toBe('Bob (from conversation)');
    // Not the stale/wrong prop name from the raw conversation row.
    expect(optA?.label).not.toBe('Stale B');
  });

  it('shows the .q suffix for a partner whose profile resolves (this hook\'s own requestNames, or already cached from elsewhere — either source, same read)', async () => {
    getPublicProfile.mockImplementation((address: string) =>
      address === ADDR_B
        ? Promise.resolve({ data: { display_name: 'Bea', primary_username: 'bea' } })
        : Promise.resolve({ data: null }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    const { result } = renderHook(
      () => useInviteManagement({ spaceId: SPACE_ID, defaultChannel: undefined }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={client}>
            <IdentityScopeProvider
              spaceId={SPACE_ID}
              rostersBySpace={{}}
              selfAddress={SELF_ADDR}
              locallyKnownNames={{}}
            >
              <Requester address={ADDR_B} />
              {children}
            </IdentityScopeProvider>
          </QueryClientProvider>
        ),
      },
    );

    await waitFor(() => {
      const options = result.current.getUserOptions();
      const optB = options.find((o) => o.value === ADDR_B);
      expect(optB?.label).toBe('bea.q');
    });
  });

  it('enriches every DM candidate exactly once (design decision 3, revised): opening the tab requests each contact\'s profile, bounded by the contact list, and a second read adds zero more', async () => {
    const { result } = renderHook(
      () => useInviteManagement({ spaceId: SPACE_ID, defaultChannel: undefined }),
      { wrapper: wrapperFor({ [ADDR_A]: 'Bob (from conversation)' }) },
    );

    await waitFor(() => {
      expect(result.current.getUserOptions().length).toBe(2);
    });

    // Bounded by the DM contact list (2 conversations) PLUS the provider's
    // own unconditional self-address bootstrap (unrelated to this hook —
    // see the sibling test above) — requested up front, same reasoning as
    // BookmarksPage's proactive requestNames, so a new search term can match
    // a QNS name on the first keystroke rather than only after that contact
    // happens to render once.
    await waitFor(() => {
      expect(getPublicProfile).toHaveBeenCalledWith(ADDR_A);
      expect(getPublicProfile).toHaveBeenCalledWith(ADDR_B);
    });
    const afterFirstRead = getPublicProfile.mock.calls.length;
    expect(afterFirstRead).toBe(3); // ADDR_A, ADDR_B, and the self address

    // Reading the options again (e.g. a re-render while the tab stays open)
    // must not re-request — the provider's own dedupe plus the 1h cache
    // serve it back from memory.
    result.current.getUserOptions();
    await new Promise((r) => setTimeout(r, 20));
    expect(getPublicProfile.mock.calls.length).toBe(afterFirstRead);
  });
});
