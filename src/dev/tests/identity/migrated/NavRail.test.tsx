/**
 * The nav rail's own avatar tooltip is the SELF surface furthest from any
 * Space: it renders in the app shell, outside every Space/DM provider, and it
 * showed the passkey record's raw `displayName` where every other surface
 * showed the verified ".q".
 *
 * `currentPasskeyInfo` is the device-local auth record and carries no QNS name,
 * so the tooltip has to resolve through the identity module against the user's
 * own public profile — which is only reachable from the ROOT
 * <IdentityScopeProvider> App.tsx mounts (no spaceId, empty rosters).
 *
 * This mounts the real NavRail rather than a probe, because the mechanism was
 * already proven working in rootScopeSelfName.test.tsx while the rail was still
 * wrong: what was untested was this component's own wiring.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

const SELF = 'QmSelfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const getPublicProfile = vi.fn().mockResolvedValue({
  data: { display_name: 'Wandering Ibis', primary_username: 'ibis' },
});

vi.mock('@/api/baseTypes', async () => {
  const actual = await vi.importActual<typeof import('@/api/baseTypes')>('@/api/baseTypes');
  return {
    ...actual,
    QuorumApiClient: class {
      getPublicProfile = getPublicProfile;
    },
  };
});

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  usePasskeysContext: () => ({
    // The raw passkey display name — what the tooltip used to show, and what it
    // must NOT show once a QNS name is elected.
    currentPasskeyInfo: { address: SELF, displayName: 'Wandering Ibis Device', pfpUrl: '' },
  }),
}));

vi.mock('@/components/context/ModalProvider', () => ({
  useModalContext: () => ({ openUserSettings: vi.fn(), openNotifications: vi.fn() }),
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

vi.mock('@/hooks/queries/spaces', () => ({ useSpaces: () => ({ data: [] }) }));
vi.mock('@/hooks/business/mentions', () => ({ useSpaceMentionCounts: () => ({}) }));
vi.mock('@/hooks/business/replies', () => ({ useSpaceReplyCounts: () => ({}) }));
vi.mock('@/components/shell/useShellState', () => ({ useOptionalShellState: () => null }));

import { IdentityScopeProvider, type RosterNameRow } from '@/identity';
import { NavRail } from '@/components/shell/NavRail';

const EMPTY_ROSTERS: Record<string, Record<string, RosterNameRow>> = {};

const renderRail = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {/* Exactly the root mount App.tsx uses — no spaceId, no rosters. */}
      <IdentityScopeProvider rostersBySpace={EMPTY_ROSTERS} selfAddress={SELF}>
        <MemoryRouter>
          {/* Expanded rail: the name renders as text, so the assertion does not
              depend on hovering to open a tooltip. The collapsed rail's tooltip
              is fed from the same value. */}
          <NavRail collapsed={false} onToggleCollapse={null} />
        </MemoryRouter>
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
};

describe('NavRail — your own name in the app shell', () => {
  beforeAll(() => {
    i18n.load('en', messages);
    i18n.activate('en');
  });

  it('shows your QNS name with the .q, not the passkey display name', async () => {
    renderRail();

    await waitFor(() => expect(screen.getByText('ibis.q')).toBeTruthy());
    expect(screen.queryByText('Wandering Ibis Device')).toBeNull();
  });
});
