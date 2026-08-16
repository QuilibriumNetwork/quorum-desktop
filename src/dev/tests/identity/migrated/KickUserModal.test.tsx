/**
 * KickUserModal — takes an ADDRESS and resolves the name itself, not a
 * caller-supplied `userName` string. BEFORE this migration the modal took
 * `userName: string` and fed it straight into the avatar's `displayName` and
 * a label — a field-threading chain that started at `UserProfile.tsx`
 * (already migrated) and ran through `ModalProvider.tsx`'s `target.displayName`.
 * That is exactly the shape this refactor exists to remove: a modal cannot
 * forget a field it never receives.
 *
 * Kick is a Space-scoped moderation action; `useUserKicking` (unchanged by
 * this migration) already derives `spaceId` from the ROUTE (`useParams`),
 * never a prop — mirrored here so the modal's own name resolution uses the
 * SAME spaceId source, and a per-space nickname renders correctly even
 * though `KickUserModal` is mounted by `ModalProvider` above any per-space
 * `<IdentityScopeProvider>` (see `Router.web.tsx`: `ModalProvider` wraps
 * `<Space />`, not the reverse).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
// KickUserModal (via useUserKicking AND its own name resolution) imports
// `useParams` from 'react-router', not 'react-router-dom' — use the SAME
// package here so the route context is the one that hook actually reads
// (see DirectMessage.test.tsx for the same gotcha, first found there).
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const getPublicProfile = vi.fn();
vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: 'QmSelf000000000000000000000000000000000000' } }),
}));

// Pins WIRING, not QNS ownership. Only the final ownership comparison is
// stubbed, because the address fixtures here are arbitrary and no real ed448
// key derives to them. The claim still travels the whole real path, so this
// still fails if the provider stops populating the verified map. Ownership
// itself is pinned in `identity/verifiedQnsNames.test.ts` and shared's
// `verifyQnsClaim.test.ts`, both mutation-proven.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

// Bypasses the kick action's own machinery (registration/actionQueue) — this
// test is about NAME resolution, not the kick action itself.
vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useUserKicking: () => ({
      kicking: false,
      confirmationStep: 0,
      handleKickClick: vi.fn(),
      kickUserFromSpace: vi.fn(),
      resetConfirmation: vi.fn(),
    }),
  };
});

import KickUserModal from '@/components/modals/KickUserModal';
import { IdentityScopeProvider, type RosterNameRow } from '@/identity';

const SPACE_ID = 'space-1';
const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

function renderModal(rosters: Record<string, Record<string, RosterNameRow>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/spaces/${SPACE_ID}/general`]}>
        <Routes>
          <Route
            path="/spaces/:spaceId/:channelId"
            element={
              <IdentityScopeProvider rostersBySpace={rosters} selfAddress={null}>
                <KickUserModal visible onClose={() => {}} userAddress={ADDR} />
              </IdentityScopeProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('KickUserModal — resolves the name from the address, via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderModal({ [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } } });

    await waitFor(() => expect(screen.getByText('alice.q')).toBeInTheDocument());
  });

  it('a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderModal({ [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } });

    await waitFor(() => expect(screen.getByText('Mod Alice')).toBeInTheDocument());
    expect(screen.queryByText('alice.q')).not.toBeInTheDocument();
  });
});
