/**
 * The Block/Mute/Kick confirmations must show the avatar the CARD resolved,
 * not the one the card was handed.
 *
 * This is `2026-08-11-profile-card-from-a-mention-pill-shows-a-stale-bio-and-no-avatar`
 * one hop further down the chain. That fix gave the card
 * `useProfileCardIdentityFields`, so the card itself renders the right avatar
 * from either entry point. But the three moderation buttons kept handing
 * `props.user.userIcon` — the RAW caller payload — to
 * `openBlockUser`/`openMuteUser`/`openKickUser`. From a mention pill that
 * payload is `{ address }` and nothing else, so the confirmation dialog showed
 * initials while the card two pixels above it showed the photo.
 *
 * The confirmation modals have no ladder of their own (they take `userIcon` as
 * a plain prop and render it — see KickUserModal.tsx), so the hand-off IS the
 * defect. These tests assert on the hand-off payload for that reason: it is
 * the exact value that changed, and it fails for the reported reason when the
 * fix is reverted.
 *
 * Reported symptom: open a profile card by clicking a mention, then click
 * Mute/Block/Kick — the confirmation has no profile picture. Open the same
 * person's card from their message avatar and the same three confirmations
 * show it. The channel is incidental: you can only click an avatar in a
 * channel where they posted, which is what made this look channel-dependent.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { IdentityScopeProvider } from '@/identity';

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

const SELF_ADDR = 'QmSelf00000000000000000000000000000000';
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: SELF_ADDR } }),
}));

const getSpaceMembers = vi.fn();
const getSpace = vi.fn();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: {
      getSpace: (spaceId: string) => getSpace(spaceId),
      getSpaceMembers: (spaceId: string) => getSpaceMembers(spaceId),
      getUserConfig: vi.fn().mockResolvedValue(null),
      saveUserConfig: vi.fn(),
      deleteUserNote: vi.fn(),
      saveUserNote: vi.fn(),
    },
  }),
}));

// The whole point of the file: capture what the card hands the modals.
const openMuteUser = vi.fn();
const openKickUser = vi.fn();
const openBlockUser = vi.fn();
vi.mock('@/components/context/ModalProvider', () => ({
  useModals: () => ({ openMuteUser, openKickUser, openBlockUser }),
}));

// See UserProfile.test.tsx: ClickToCopyContent pulls in react-tooltip, which
// crashes under vitest with a duplicate-React "Invalid hook call".
vi.mock('@/components/ui', () => ({
  ClickToCopyContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Owner, so the Kick button renders at all (kick has no role path — it needs
// the owner's ED448 key, so `useSpaceOwner` is the only gate).
vi.mock('@/hooks/queries/spaceOwner', () => ({
  useSpaceOwner: () => ({ data: true }),
}));
vi.mock('@/hooks/queries/mutedUsers', () => ({
  useMutedUsers: () => ({ data: [] }),
}));
vi.mock('@/hooks/queries/userNotes', () => ({
  useUserNote: () => ({ data: null }),
  buildUserNoteKey: ({ targetAddress }: { targetAddress: string }) => ['user-note', targetAddress],
}));
vi.mock('@/hooks/business/user/useBlockUser', () => ({
  useBlockUser: () => ({ isBlocked: () => false, blockUser: vi.fn(), unblockUser: vi.fn() }),
}));

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useUserRoleManagement: () => ({ addRole: vi.fn(), removeRole: vi.fn(), loadingRoles: new Set() }),
    useUserProfileActions: () => ({ sendMessage: vi.fn() }),
    useUserRoleDisplay: () => ({ userRoles: [], availableRoles: [] }),
  };
});

const ADDR = 'QmPeerUEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

const ROSTER_ICON = 'https://example.com/live-roster-avatar.png';

/**
 * The member row as the identity announce leaves it: no per-space override
 * (its normal state), the avatar living in the live-pushed global slot. The
 * published public profile has no photo, which is what anyone who never opted
 * in has — so the roster is the ONLY source of this avatar, exactly as in the
 * reported case.
 */
const ROSTER_ROW = {
  address: ADDR,
  user_address: ADDR,
  display_name: '',
  global_display_name: 'Alice',
  user_icon: '',
  bio: '',
  global_user_icon: ROSTER_ICON,
  global_bio: 'A bio.',
};

const PUBLIC_PROFILE = {
  primary_username: 'alice',
  display_name: 'Alice',
  bio: 'A bio.',
  profile_image: '',
};

/** Grants SELF the `user:mute` permission, so the Mute button renders.
 *  Mute has no owner bypass by design — the receiving side cannot verify
 *  ownership, so owners must hold a role like every other moderator. */
const SPACE = {
  spaceId: SPACE_ID,
  roles: [
    {
      roleId: 'mod',
      roleTag: 'mod',
      displayName: 'Mod',
      color: 'blue',
      members: [SELF_ADDR],
      permissions: ['user:mute'],
    },
  ],
};

import UserProfile from '@/components/user/UserProfile';

function renderCard(user: Record<string, unknown>) {
  getPublicProfile.mockResolvedValue({ data: PUBLIC_PROFILE });
  getSpaceMembers.mockResolvedValue([ROSTER_ROW]);
  getSpace.mockResolvedValue(SPACE);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider
        spaceId={SPACE_ID}
        rostersBySpace={{
          [SPACE_ID]: {
            [ADDR]: {
              display_name: ROSTER_ROW.display_name,
              global_display_name: ROSTER_ROW.global_display_name,
            },
          },
        }}
        selfAddress={SELF_ADDR}
      >
        <UserProfile spaceId={SPACE_ID} user={user} dismiss={() => {}} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

/** What `MessageMarkdownRenderer`'s mention-pill click passes: address only. */
const MENTION_PAYLOAD = { address: ADDR };

/** What `Message.tsx`'s avatar click passes: the merged member record. */
const AVATAR_PAYLOAD = {
  address: ADDR,
  displayName: 'Alice',
  userIcon: ROSTER_ICON,
  bio: 'A bio.',
};

/** Wait until the ladder has settled, i.e. the card is showing the roster
 *  avatar. Clicking before this would test the pre-fill flash, not the fix. */
async function waitForCardAvatar() {
  await waitFor(() => {
    const img = document.querySelector<HTMLImageElement>('.user-profile-icon img');
    expect(img?.src).toBe(ROSTER_ICON);
  });
}

describe('moderation confirmations get the RESOLVED avatar, not the caller payload', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getSpaceMembers.mockReset();
    getSpace.mockReset();
    openMuteUser.mockReset();
    openKickUser.mockReset();
    openBlockUser.mockReset();
  });

  it('passes the roster avatar to Block, from an address-only payload', async () => {
    renderCard(MENTION_PAYLOAD);
    await waitForCardAvatar();

    fireEvent.click(screen.getByRole('button', { name: 'Block' }));

    expect(openBlockUser).toHaveBeenCalledWith(
      expect.objectContaining({ address: ADDR, userIcon: ROSTER_ICON }),
    );
  });

  it('passes the roster avatar to Mute, from an address-only payload', async () => {
    renderCard(MENTION_PAYLOAD);
    await waitForCardAvatar();

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));

    expect(openMuteUser).toHaveBeenCalledWith(
      expect.objectContaining({ address: ADDR, userIcon: ROSTER_ICON }),
    );
  });

  it('passes the roster avatar to Kick, from an address-only payload', async () => {
    renderCard(MENTION_PAYLOAD);
    await waitForCardAvatar();

    fireEvent.click(screen.getByRole('button', { name: 'Kick' }));

    expect(openKickUser).toHaveBeenCalledWith(
      expect.objectContaining({ address: ADDR, userIcon: ROSTER_ICON }),
    );
  });

  it('hands the message-avatar entry point the identical payload', async () => {
    // Control arm. This path already worked before the fix — its payload
    // carried the icon. If THIS one ever fails, the ladder itself broke, not
    // the hand-off, and the sibling profileCardRosterFields test is the one to
    // read.
    const mention = renderCard(MENTION_PAYLOAD);
    await waitForCardAvatar();
    fireEvent.click(screen.getByRole('button', { name: 'Kick' }));
    const fromMention = openKickUser.mock.calls[0][0];
    mention.unmount();

    openKickUser.mockReset();
    renderCard(AVATAR_PAYLOAD);
    await waitForCardAvatar();
    fireEvent.click(screen.getByRole('button', { name: 'Kick' }));
    const fromAvatar = openKickUser.mock.calls[0][0];

    expect(fromMention).toEqual(fromAvatar);
  });
});
