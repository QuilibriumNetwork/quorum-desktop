/**
 * Channel.tsx's member-sidebar role-list row (final fix wave, finding 2):
 * the avatar and the `<MemberName>` label beside it must derive their
 * initials/name from the SAME resolved identity.
 *
 * BEFORE this fix the avatar took `item.displayName ?? item.address` —
 * `useChannelData.ts`'s `curr.display_name`, the per-space OVERRIDE tier
 * ONLY, with no global or profile fallback — while `<MemberName>` correctly
 * resolves through the full ladder (space → QNS → global → truncated
 * address). A member with no per-space nickname therefore showed their
 * correctly-resolved global/QNS name next to an avatar whose initials came
 * from their raw address: the "gatto.q beside a circle showing G" failure
 * the design exists to make unrepresentable.
 *
 * Extracted as `MemberListRowAvatarAndName` because the row is built inside
 * `Virtuoso`'s `itemContent` callback — called per visible row, not a place
 * a hook can be called. Exported from Channel.tsx for direct testing, same
 * reasoning as `ChannelTypingIndicator`.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { IdentityScopeProvider } from '@/identity/identityProvider';

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

const ADDR = 'QmPeerREgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

import { MemberListRowAvatarAndName } from '@/components/space/Channel';

function renderRow(rosterRow: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider
        spaceId={SPACE_ID}
        rostersBySpace={{ [SPACE_ID]: { [ADDR]: rosterRow } }}
        selfAddress={null}
      >
        <MemberListRowAvatarAndName
          address={ADDR}
          avatarClassName="avatar-class"
          nameWrapperClassName="name-wrapper-class"
        />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('MemberListRowAvatarAndName — avatar and label agree on the resolved name', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockResolvedValue({ data: null });
  });

  it('the load-bearing case: no per-space nickname — the avatar takes the resolved global name, not the raw address', async () => {
    renderRow({ display_name: '', global_display_name: 'Alice' });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const avatar = screen.getByRole('img');
    // The avatar's aria-label is built from its `displayName` prop — this is
    // what proves the initials were computed from "Alice", not from the
    // address. Before the fix this read the address's own aria-label.
    expect(avatar.getAttribute('aria-label')).toBe("Alice's avatar");
    expect(avatar.getAttribute('aria-label')).not.toContain(ADDR);
  });

  it('a member WITH a per-space nickname: avatar and label both take the nickname', async () => {
    renderRow({ display_name: 'Mod Alice', global_display_name: 'Alice' });

    await waitFor(() => {
      expect(screen.getByText('Mod Alice')).toBeInTheDocument();
    });

    const avatar = screen.getByRole('img');
    expect(avatar.getAttribute('aria-label')).toBe("Mod Alice's avatar");
  });
});
