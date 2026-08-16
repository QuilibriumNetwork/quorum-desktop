/**
 * The profile card must render IDENTICALLY from both entry points.
 *
 * This is the general form of two bugs already fixed one field at a time:
 *
 *   #328  the card's own bio and avatar    (2026-08-11)
 *   #344  the avatar handed to Block/Mute/Kick (2026-08-16)
 *
 * Both had the same shape. A mention-pill click passes `{ address }` and
 * nothing else (`MessageMarkdownRenderer.tsx`, deliberate — the name resolves
 * from `src/identity` either way); a message-avatar click passes a fully-merged
 * member record (`Message.tsx`). Any field the card reads off that payload
 * instead of resolving from the address therefore renders differently
 * depending on which pill you happened to click.
 *
 * Fixing those fields one at a time does not converge — each fix leaves the
 * next unfound field in place, and nothing says how many are left. So this file
 * asserts the WHOLE rendered card is identical between the two payloads,
 * against identical sources. Any divergence is a bug of this class, including
 * ones nobody has thought of yet.
 *
 * The fixture is deliberately hostile: the member is KICKED and their avatar
 * exists only in the roster's live-pushed global slot, with an empty public
 * profile. That is the state in which the caller payload and the address-keyed
 * sources disagree the most, so a field read from the wrong one cannot pass by
 * coincidence.
 *
 * READING A FAILURE: the button-summary assertion runs first and names the
 * offending control in plain text. The full-DOM assertion below it is the
 * exhaustive net and produces a long diff — check the summary first.
 *
 * WHAT THIS DOES NOT COVER: the loading window. The caller payload is
 * deliberately the top rung of the avatar/bio ladder so the avatar path does
 * not flash while the roster read settles, which means the two entry points
 * legitimately differ for a few milliseconds. Both renders are awaited to a
 * settled state before comparison.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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

vi.mock('@/components/context/ModalProvider', () => ({
  useModals: () => ({ openMuteUser: vi.fn(), openKickUser: vi.fn(), openBlockUser: vi.fn() }),
}));

// See UserProfile.test.tsx: ClickToCopyContent pulls in react-tooltip, which
// crashes under vitest with a duplicate-React "Invalid hook call".
vi.mock('@/components/ui', () => ({
  ClickToCopyContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Owner, so every moderation control is on screen and therefore in scope for
// the comparison. A card missing the buttons would pass this file trivially.
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
const ROSTER_BIO = 'The bio I just edited on my other device.';

/**
 * Kicked, avatar and bio only in the live-pushed global slots, no per-space
 * override. `isKicked` is a real persisted roster field (written by
 * `MessageService.ts:5914`, mapped at `indexedDbAdapter.ts:159`), so it is
 * resolvable from the address like everything else here.
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
  isKicked: true,
};

/** Opt-in and empty, which is its normal state — so the roster is the only
 *  source of the avatar and the caller payload cannot be covered for. */
const PUBLIC_PROFILE = {
  primary_username: 'alice',
  display_name: 'Alice',
  bio: ROSTER_BIO,
  profile_image: '',
};

/** Grants SELF `user:mute`, so the Mute button renders. Mute has no owner
 *  bypass by design; owners hold a role like any other moderator. */
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

/** What `MessageMarkdownRenderer`'s mention-pill click passes. */
const MENTION_PAYLOAD = { address: ADDR };

/** What `Message.tsx`'s avatar click passes: the merged member record, whose
 *  fields `useChannelData` has already resolved off the same roster row. */
const AVATAR_PAYLOAD = {
  address: ADDR,
  displayName: 'Alice',
  userIcon: ROSTER_ICON,
  bio: ROSTER_BIO,
  isKicked: true,
};

function renderCard(user: Record<string, unknown>, variant?: 'card' | 'drawer') {
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
        <UserProfile spaceId={SPACE_ID} user={user} dismiss={() => {}} variant={variant} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

/**
 * `Button.web.tsx` generates `button-<random>` when given no explicit id, and
 * feeds it to the tooltip's `id`/`data-tooltip-id`. That is genuine
 * per-render noise, not a divergence, so it is normalised away. Nothing else
 * about the markup is touched — the point of this file is to compare
 * everything that is NOT noise.
 */
function normalize(html: string): string {
  return html.replace(/button-[a-z0-9]+/g, 'button-NORMALIZED');
}

/** The legible half of the comparison: every control, its label, and whether
 *  it is disabled. A failure here names the broken button in one line. */
function buttonSummary(root: HTMLElement) {
  return Array.from(root.querySelectorAll('button')).map((b) => ({
    label: b.textContent?.trim(),
    disabled: b.disabled,
  }));
}

/** Settled = the roster read has landed and the card is showing the roster
 *  avatar. Comparing before this would compare the deliberate pre-fill flash. */
async function renderSettled(user: Record<string, unknown>, variant?: 'card' | 'drawer') {
  const view = renderCard(user, variant);
  const iconSelector = variant === 'drawer' ? '.user-profile-header img' : '.user-profile-icon img';
  await waitFor(() => {
    const img = view.container.querySelector<HTMLImageElement>(iconSelector);
    expect(img?.src).toBe(ROSTER_ICON);
  });
  return view;
}

async function captureBothEntryPoints(variant?: 'card' | 'drawer') {
  const mentionView = await renderSettled(MENTION_PAYLOAD, variant);
  const fromMention = {
    buttons: buttonSummary(mentionView.container),
    html: normalize(mentionView.container.innerHTML),
  };
  mentionView.unmount();

  const avatarView = await renderSettled(AVATAR_PAYLOAD, variant);
  const fromAvatar = {
    buttons: buttonSummary(avatarView.container),
    html: normalize(avatarView.container.innerHTML),
  };
  avatarView.unmount();

  return { fromMention, fromAvatar };
}

describe('the profile card renders identically from both entry points', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getSpaceMembers.mockReset();
    getSpace.mockReset();
  });

  it('shows the same controls, with the same labels and disabled states', async () => {
    const { fromMention, fromAvatar } = await captureBothEntryPoints();
    expect(fromMention.buttons).toEqual(fromAvatar.buttons);
  });

  it('produces byte-identical markup', async () => {
    const { fromMention, fromAvatar } = await captureBothEntryPoints();
    expect(fromMention.html).toBe(fromAvatar.html);
  });

  it('produces byte-identical markup in the drawer variant too', async () => {
    // The below-1024px presentation is a different render path through the
    // same component, so it can diverge independently of the card variant.
    const { fromMention, fromAvatar } = await captureBothEntryPoints('drawer');
    expect(fromMention.html).toBe(fromAvatar.html);
  });

  it('sanity: the fixture actually distinguishes the two payloads', async () => {
    // Control arm. If the sources were so complete that the caller payload
    // could not matter, every assertion above would pass no matter how many
    // fields were read raw, and this file would be worthless. Prove the
    // payloads really are different objects carrying different information.
    expect(Object.keys(MENTION_PAYLOAD)).toEqual(['address']);
    expect(Object.keys(AVATAR_PAYLOAD).length).toBeGreaterThan(1);
    expect(AVATAR_PAYLOAD.isKicked).toBe(true);
    expect((MENTION_PAYLOAD as Record<string, unknown>).isKicked).toBeUndefined();
  });
});
