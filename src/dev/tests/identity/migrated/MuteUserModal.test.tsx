/**
 * MuteUserModal — takes an ADDRESS and resolves the name itself, not a
 * caller-supplied `userName` string (see KickUserModal.test.tsx for the full
 * rationale — same field-threading chain, same fix).
 *
 * Mute is a Space-scoped moderation action; the modal itself doesn't call
 * `useUserMuting` (that hook is only invoked by `ModalProvider`, which builds
 * `onConfirm`), but it needs the SAME spaceId source that hook uses
 * (`useParams`, not a prop) so the resolved name and the muted space always
 * agree — mirrors `KickUserModal`.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
// MuteUserModal imports `useParams` from 'react-router', not
// 'react-router-dom' — use the SAME package here (see DirectMessage.test.tsx
// and KickUserModal.test.tsx for the same gotcha).
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

import MuteUserModal from '@/components/modals/MuteUserModal';
import { IdentityScopeProvider, type RosterNameRow } from '@/identity';

const SPACE_ID = 'space-1';
const ADDR = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

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
                <MuteUserModal visible onClose={() => {}} onConfirm={async () => {}} userAddress={ADDR} />
              </IdentityScopeProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MuteUserModal — resolves the name from the address, via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'bob', display_name: 'Bob' } });

    renderModal({ [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Bob' } } });

    await waitFor(() => expect(screen.getByText('bob.q')).toBeInTheDocument());
  });

  it('a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'bob', display_name: 'Bob' } });

    renderModal({ [SPACE_ID]: { [ADDR]: { display_name: 'Mod Bob', global_display_name: 'Bob' } } });

    await waitFor(() => expect(screen.getByText('Mod Bob')).toBeInTheDocument());
    expect(screen.queryByText('bob.q')).not.toBeInTheDocument();
  });
});
