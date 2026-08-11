/**
 * Invites.tsx's `ConversationList` (DM-contact invite picker) — the avatar
 * initials must come from the SAME bare resolved name as the label (final
 * fix wave, finding 9).
 *
 * `option.displayName`/`option.label` arrive ALREADY resolved from
 * `useInviteManagement.ts`'s `getUserOptions` (it calls `useNameResolver`
 * itself) — but WITH the ".q" suffix appended for a verified contact.
 * Feeding that suffixed string straight to `UserAvatar`'s `displayName` prop
 * is the same "gatto.q beside a circle showing G" bug class rule 4 of the
 * migration recipe exists to prevent: `getInitials` splits on non-letters,
 * so "alice.q" produces the wrong initials instead of "A".
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
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

import { ConversationList } from '@/components/modals/SpaceSettingsModal/Invites';
import { IdentityScopeProvider, useIdentityContext } from '@/identity/identityProvider';

const ADDR = 'QmPeerIEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

// `ConversationList`'s own `resolve()` is a pure READ — it never calls
// `request` itself; enrichment for this surface is owned by
// `useInviteManagement.ts`'s `getUserOptions` (design decision 3, revised
// 2026-08-11: the DM contact list is bounded, so it now enriches up front).
// In production a DM contact's QNS name can also be cached here because SOME
// OTHER already-enriched surface (the DM sidebar) requested it first —
// `identityFromMaps` reads whatever the provider already has, it does not
// care who asked. This probe stands in for either source.
const EnrichProbe: React.FC<{ address: string }> = ({ address }) => {
  const { request } = useIdentityContext();
  React.useEffect(() => {
    request(address);
  }, [address, request]);
  return null;
};

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // Mirrors useInviteManagement.ts's getUserOptions shape exactly: `label`
  // and `displayName` both carry the resolved name WITH ".q" — the real
  // upstream shape, not a hypothetical.
  const options = [
    {
      value: ADDR,
      label: 'alice.q',
      avatar: '',
      displayName: 'alice.q',
      userAddress: ADDR,
      subtitle: 'Qm1234…5678',
    },
  ];
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
        <EnrichProbe address={ADDR} />
        <ConversationList value="" options={options} onChange={() => {}} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('Invites ConversationList — avatar initials use the BARE resolved name, never the ".q"-suffixed label', () => {
  it('the avatar aria-label reflects the bare name, not the suffixed one', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderList();

    expect(await screen.findByText('alice.q')).toBeInTheDocument();

    await waitFor(() => {
      const avatar = screen.getByRole('img');
      expect(avatar.getAttribute('aria-label')).toBe("alice's avatar");
      expect(avatar.getAttribute('aria-label')).not.toBe("alice.q's avatar");
    });
  });
});
