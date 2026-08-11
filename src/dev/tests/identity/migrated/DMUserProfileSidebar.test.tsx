/**
 * DMUserProfileSidebar — the DM profile sidebar's name AND avatar resolve
 * via the identity module (`<MemberName withAvatar>`), not the caller-passed
 * `displayName`/`primaryUsername` fields and a separately-computed avatar.
 *
 * BEFORE this migration the component called
 * `resolveMemberName({address, displayName, primaryUsername})` for the
 * name label, while `<UserAvatar>` was fed `user.displayName ?? user.address`
 * directly — two independent reads of the SAME caller snapshot, which is how
 * a member could render `gatto.q` next to a circle showing "G" for someone
 * else. `user` below carries a deliberately WRONG `displayName`; only the
 * ambient `<IdentityScopeProvider>` has the real one. `withAvatar` sources
 * both the label and the avatar's initials from ONE resolved value, so they
 * cannot disagree.
 *
 * DMUserProfileSidebar is rendered from DirectMessage.tsx, INSIDE that
 * component's own `<IdentityScopeProvider>` (global scope — no spaceId) —
 * mounted externally here the same way, matching production.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
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

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({ messageDB: {} }),
}));
vi.mock('@/hooks/queries/userNotes', () => ({
  useUserNote: () => ({ data: null }),
  buildUserNoteKey: ({ targetAddress }: { targetAddress: string }) => ['user-note', targetAddress],
}));

// ClickToCopyContent pulls in primitives' <Tooltip> (react-tooltip), which
// crashes under vitest with a duplicate-React "Invalid hook call" here —
// unrelated to name/avatar resolution. Stub it like other component tests
// stub heavy primitives (see UserProfile.test.tsx).
vi.mock('@/components/ui', () => ({
  ClickToCopyContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { DMUserProfileSidebar } from '@/components/direct/DMUserProfileSidebar';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerDEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

function renderSidebar(profile: Record<string, unknown> | null) {
  getPublicProfile.mockResolvedValue({ data: profile });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
          <DMUserProfileSidebar
            user={{
              address: ADDR,
              // Deliberately WRONG — proof the sidebar no longer trusts this.
              displayName: 'Stale Caller Name',
              primaryUsername: undefined,
            }}
          />
        </IdentityScopeProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('DMUserProfileSidebar — name + avatar resolve via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q', async () => {
    renderSidebar({ primary_username: 'alice', display_name: 'Alice' });

    expect(await screen.findByText('alice.q')).toBeInTheDocument();
    expect(screen.queryByText('Stale Caller Name')).not.toBeInTheDocument();
  });

  it('a global name with no QNS name renders with no .q', async () => {
    renderSidebar({ primary_username: '', display_name: 'Alice' });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Caller Name')).not.toBeInTheDocument();
  });

  it('the avatar initials come from the SAME resolved name as the label (withAvatar)', async () => {
    renderSidebar({ primary_username: 'alice', display_name: 'Alice' });

    await screen.findByText('alice.q');
    // Bare resolved name "alice" -> initial "A", never "S" for the stale
    // "Stale Caller Name" prop.
    expect(screen.getByRole('img', { name: /alice's avatar/i })).toBeInTheDocument();
  });
});
