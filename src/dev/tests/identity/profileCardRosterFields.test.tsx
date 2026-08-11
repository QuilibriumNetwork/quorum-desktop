/**
 * The profile card's avatar and bio must not depend on WHICH pill you clicked.
 *
 * Two entry points hand the card different payloads: a message-avatar click
 * passes a fully-merged member record, a mention-pill click passes an address
 * and nothing else (deliberate — the NAME resolves from `src/identity` either
 * way). Before this fix the card's own address-keyed fallback for avatar/bio
 * went straight to the published public profile, skipping `space_members`'
 * per-space override and its live-pushed `global_user_icon`/`global_bio`
 * slots — the tier `useChannelData` merges for every other surface, and where
 * most members' avatar and bio actually live.
 *
 * Reported symptom: opening someone's card from a mention pill showed a stale
 * bio and no profile picture; opening the same person's card from their
 * message avatar, one click away, showed both correctly and updated live.
 *
 * The component test below carries a CONTROL ARM: the same two payloads are
 * rendered against identical sources, and the NAME is asserted to match. The
 * name never came from the caller (it resolves through
 * `useResolvedMemberName`), so it must be identical from both entry points. If
 * a future change makes the name diverge here, the control fails and says so;
 * if the name diverges in the running app while this control stays green, the
 * difference is in the SOURCES, not in this component.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { IdentityScopeProvider } from '@/identity';
import { DefaultImages } from '@/utils';
import {
  pickProfileCardBio,
  pickProfileCardIcon,
} from '@/hooks/business/user/useProfileCardIdentityFields';

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
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: {
      getSpace: vi.fn().mockResolvedValue(null),
      getUserConfig: vi.fn().mockResolvedValue(null),
      getSpaceMembers: (spaceId: string) => getSpaceMembers(spaceId),
      saveUserConfig: vi.fn(),
      deleteUserNote: vi.fn(),
      saveUserNote: vi.fn(),
    },
  }),
}));

vi.mock('@/components/context/ModalProvider', () => ({
  useModals: () => ({ openMuteUser: vi.fn(), openKickUser: vi.fn(), openBlockUser: vi.fn() }),
}));

// See UserProfile.test.tsx: ClickToCopyContent pulls in react-tooltip, which
// crashes under vitest with a duplicate-React "Invalid hook call".
vi.mock('@/components/ui', () => ({
  ClickToCopyContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/queries/spaceOwner', () => ({
  useSpaceOwner: () => ({ data: false }),
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
const ROSTER_BIO = 'The bio I just edited on my other device.';
const STALE_PUBLIC_BIO = 'The bio I published to my public profile months ago.';

import UserProfile from '@/components/user/UserProfile';

/**
 * The member row as the identity announce leaves it under the two-slot model:
 * no per-space override (its normal state), and the live global slots carrying
 * the avatar and bio. The published public profile is deliberately WORSE — an
 * empty `profile_image`, which is what a user who never opted into a public
 * photo has, and a stale bio.
 */
const ROSTER_ROW = {
  address: ADDR,
  user_address: ADDR,
  display_name: '',
  global_display_name: 'Alice',
  user_icon: '',
  bio: '',
  global_user_icon: ROSTER_ICON,
  global_bio: ROSTER_BIO,
};

const PUBLIC_PROFILE = {
  primary_username: 'alice',
  display_name: 'Alice',
  bio: STALE_PUBLIC_BIO,
  profile_image: '',
};

function renderCard(user: Record<string, unknown>) {
  getPublicProfile.mockResolvedValue({ data: PUBLIC_PROFILE });
  getSpaceMembers.mockResolvedValue([ROSTER_ROW]);
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

/** What `Message.tsx`'s avatar click passes: the merged member record, whose
 *  `userIcon`/`bio` `useChannelData` already resolved off the global slots. */
const AVATAR_PAYLOAD = {
  address: ADDR,
  displayName: 'Alice',
  userIcon: ROSTER_ICON,
  bio: ROSTER_BIO,
};

describe('profile card avatar/bio — the roster global slots are a tier', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getSpaceMembers.mockReset();
  });

  it('renders the roster global bio, not the stale public-profile bio, from an address-only payload', async () => {
    renderCard(MENTION_PAYLOAD);

    await waitFor(() => {
      expect(document.querySelector('.user-profile-bio-text')?.textContent).toBe(ROSTER_BIO);
    });
    expect(document.querySelector('.user-profile-bio-text')?.textContent).not.toBe(
      STALE_PUBLIC_BIO,
    );
  });

  it('renders the roster global avatar from an address-only payload, where the public profile has none', async () => {
    renderCard(MENTION_PAYLOAD);

    await waitFor(() => {
      const img = document.querySelector<HTMLImageElement>('.user-profile-icon img');
      expect(img?.src).toBe(ROSTER_ICON);
    });
  });

  it('agrees with the message-avatar entry point on all three fields', async () => {
    const mention = renderCard(MENTION_PAYLOAD);
    await waitFor(() => {
      expect(document.querySelector('.user-profile-bio-text')?.textContent).toBe(ROSTER_BIO);
    });
    const fromMention = {
      name: document.querySelector('.user-profile-username')?.textContent,
      bio: document.querySelector('.user-profile-bio-text')?.textContent,
      icon: document.querySelector<HTMLImageElement>('.user-profile-icon img')?.src,
    };
    mention.unmount();

    renderCard(AVATAR_PAYLOAD);
    await waitFor(() => {
      expect(document.querySelector('.user-profile-bio-text')?.textContent).toBe(ROSTER_BIO);
    });
    const fromAvatar = {
      name: document.querySelector('.user-profile-username')?.textContent,
      bio: document.querySelector('.user-profile-bio-text')?.textContent,
      icon: document.querySelector<HTMLImageElement>('.user-profile-icon img')?.src,
    };

    // Control arm: the name never came from the caller, so it must already
    // match — if THIS assertion is the one that fails, the defect is in name
    // resolution, not in the avatar/bio ladder this file is about.
    expect(fromMention.name).toBe(fromAvatar.name);
    expect(fromMention.bio).toBe(fromAvatar.bio);
    expect(fromMention.icon).toBe(fromAvatar.icon);
  });
});

describe('the precedence rules themselves', () => {
  it('prefers a per-space override over the global slot over the public profile', () => {
    expect(
      pickProfileCardIcon({
        memberIcon: 'override.png',
        memberGlobalIcon: 'global.png',
        publicProfileIcon: 'public.png',
      }),
    ).toBe('override.png');
    expect(
      pickProfileCardIcon({ memberGlobalIcon: 'global.png', publicProfileIcon: 'public.png' }),
    ).toBe('global.png');
    expect(pickProfileCardIcon({ publicProfileIcon: 'public.png' })).toBe('public.png');
  });

  it('treats an empty per-space override as "follow global", not as "no value"', () => {
    // The override being empty is its NORMAL state under the two-slot model,
    // so `||`-style skipping is the whole point of the ladder.
    expect(pickProfileCardIcon({ memberIcon: '', memberGlobalIcon: 'global.png' })).toBe(
      'global.png',
    );
    expect(pickProfileCardBio({ memberBio: '   ', memberGlobalBio: 'global bio' })).toBe(
      'global bio',
    );
  });

  it('falls through the UNKNOWN_USER placeholder so initials can take over', () => {
    // Same rule as useChannelData's pickAvatar: the default image counts as
    // absent, otherwise a broken-looking placeholder renders instead of
    // coloured initials.
    expect(
      pickProfileCardIcon({
        memberIcon: DefaultImages.UNKNOWN_USER,
        memberGlobalIcon: 'global.png',
      }),
    ).toBe('global.png');
  });

  it('keeps your own global config bio as the last bio tier', () => {
    expect(pickProfileCardBio({ ownConfigBio: 'my global bio' })).toBe('my global bio');
    expect(pickProfileCardBio({ memberGlobalBio: 'roster', ownConfigBio: 'config' })).toBe(
      'roster',
    );
  });

  it('returns undefined when nothing knows anything', () => {
    expect(pickProfileCardIcon({})).toBeUndefined();
    expect(pickProfileCardBio({})).toBeUndefined();
  });
});
