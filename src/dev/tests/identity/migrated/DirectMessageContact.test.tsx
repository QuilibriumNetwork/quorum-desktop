/**
 * DirectMessageContact — the DM list row's name resolves via the identity
 * module (`useResolvedMemberName`, feeding both the avatar's bare name and
 * the visible label from the SAME resolved value), not the caller-passed
 * `displayName`/`primaryUsername` props.
 *
 * BEFORE this migration the row called `resolveMemberName({ address,
 * displayName, primaryUsername })` directly on its OWN props — a snapshot
 * threaded down by `DirectMessageContactsList`. The props below carry a
 * deliberately STALE name; only the ambient `<IdentityScopeProvider>` (via
 * its public-profile fetch) has the real one. Passing requires reading
 * through the provider, not the frozen props — rendering the stale prop is
 * exactly the bug class this migration exists to catch red-handed.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

import DirectMessageContact from '@/components/direct/DirectMessageContact';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerCEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

function renderRow(profile: Record<string, unknown> | null) {
  getPublicProfile.mockResolvedValue({ data: profile });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/messages']}>
        <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
          <DirectMessageContact
            unread={false}
            address={ADDR}
            // Deliberately WRONG — proof the row no longer trusts this prop
            // for the rendered name once migrated.
            displayName="Stale Caller Name"
            primaryUsername={undefined}
          />
        </IdentityScopeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DirectMessageContact — name resolves via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q', async () => {
    renderRow({ primary_username: 'alice', display_name: 'Alice' });

    expect(await screen.findByText('alice.q')).toBeInTheDocument();
    expect(screen.queryByText('Stale Caller Name')).not.toBeInTheDocument();
  });

  it('a global name with no QNS name renders with no .q', async () => {
    renderRow({ primary_username: '', display_name: 'Alice' });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Caller Name')).not.toBeInTheDocument();
  });
});
