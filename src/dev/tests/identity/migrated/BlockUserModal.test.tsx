/**
 * BlockUserModal — takes an ADDRESS (and its Space) and resolves the name
 * itself, not a caller-supplied `userName` string (see KickUserModal.test.tsx
 * for the full rationale). Block is per-space, viewer-side, and every
 * caller already carries `spaceId` explicitly (see `BlockUserTarget` /
 * `BlockUserModalContainer` in `ModalProvider.tsx`), so unlike Kick/Mute this
 * modal takes `spaceId` as a genuine prop rather than reading the route.
 *
 * The name is also interpolated into the confirmation SENTENCE ("You won't
 * see any of {name}'s messages..."), not just the avatar/label — this test
 * covers that too, since it's a second render site for the same value.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

import BlockUserModal from '@/components/modals/BlockUserModal';
import { IdentityScopeProvider, type RosterNameRow } from '@/identity';

const SPACE_ID = 'space-1';
const ADDR = 'QmPeerCEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

function renderModal(rosters: Record<string, Record<string, RosterNameRow>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider rostersBySpace={rosters} selfAddress={null}>
        <BlockUserModal
          visible
          onClose={() => {}}
          onConfirm={async () => {}}
          userAddress={ADDR}
          spaceId={SPACE_ID}
        />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('BlockUserModal — resolves the name from the address, via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q, including in the sentence', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'carol', display_name: 'Carol' } });

    renderModal({ [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Carol' } } });

    await waitFor(() => expect(screen.getByText('carol.q')).toBeInTheDocument());
    expect(
      screen.getByText((_, node) => node?.textContent === "You won't see any of carol.q's messages in this Space. This only affects your view, and only in this Space. You can unblock anytime."),
    ).toBeInTheDocument();
  });

  it('a per-space nickname renders the nickname and no .q, including in the sentence', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'carol', display_name: 'Carol' } });

    renderModal({ [SPACE_ID]: { [ADDR]: { display_name: 'Mod Carol', global_display_name: 'Carol' } } });

    await waitFor(() => expect(screen.getAllByText(/Mod Carol/).length).toBeGreaterThan(0));
    expect(screen.queryByText('carol.q')).not.toBeInTheDocument();
    expect(screen.queryByText(/carol\.q/)).not.toBeInTheDocument();
  });
});
