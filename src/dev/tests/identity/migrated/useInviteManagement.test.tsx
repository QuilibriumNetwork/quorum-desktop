/**
 * useInviteManagement — the invite picker's user-option labels (Phase D row
 * 20). Can list every DM conversation the user has, so — same rule as the
 * member sidebar and the mention picker (row 19) — it must NOT enrich: no
 * public-profile fetch may be issued just because the invite tab opened.
 *
 * BEFORE this migration, `getUserOptions` read `useConversationsWithProfileBackfill`
 * (an unconditional N-fetch backfill of every DM partner's public profile —
 * this WAS the "no request" rule's violation) and built each label via
 * `resolveMemberName`/`formatResolvedName` from the backfilled row's raw
 * fields.
 *
 * The fix resolves through `useNameResolver` (`global: true` — these are DM
 * partners, not this space's roster) with NO `requestNames` call. A DM
 * partner who has never published a public profile still gets a real name
 * from `locallyKnownNames` (the conversation's own local `displayName`,
 * mirroring the DM surfaces' fix round 1 — no network round-trip), and a
 * partner who already has an enriched profile cached (from having opened
 * their DM) still shows their `.q` for free, because `resolve()` reads
 * whatever the provider already has.
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

describe('useInviteManagement — invite picker options (no enrich)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockResolvedValue({ data: null });
  });

  it('renders a DM partner with no public profile via the LOCAL conversation name, no fetch', async () => {
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

  it('shows the .q suffix for a partner whose profile is ALREADY cached (enriched elsewhere) — for free, no fetch of its own', async () => {
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

  it('never issues a public-profile request for a DM candidate (no enrich) — opening the tab must not fire N fetches', async () => {
    // The provider's own selfAddress bootstrap always fetches YOUR OWN
    // profile regardless of this hook — that's not what "no enrich" governs.
    // What must never happen is a request for a CANDIDATE in the list.
    const { result } = renderHook(
      () => useInviteManagement({ spaceId: SPACE_ID, defaultChannel: undefined }),
      { wrapper: wrapperFor({ [ADDR_A]: 'Bob (from conversation)' }) },
    );

    await waitFor(() => {
      expect(result.current.getUserOptions().length).toBe(2);
    });
    // Give any accidental effect-driven fetch a chance to fire before asserting.
    await new Promise((r) => setTimeout(r, 50));
    expect(getPublicProfile).not.toHaveBeenCalledWith(ADDR_A);
    expect(getPublicProfile).not.toHaveBeenCalledWith(ADDR_B);
  });
});
