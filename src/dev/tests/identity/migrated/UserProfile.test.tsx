/**
 * UserProfile (the profile card) — name resolves via the identity module
 * (`<MemberName>` / `useResolvedMemberName`), replacing
 * `resolveProfileCardName`/`profileCardNeedsProfileFetch` from
 * `utils/profileCardIdentity` (deleted by this migration — the provider makes
 * both redundant: it already carries the roster + public profile every other
 * migrated surface reads from).
 *
 * BEFORE this migration, the card's name came from `props.user.displayName`/
 * `primaryUsername`/`globalDisplayName` merged with one on-demand profile
 * fetch. That is a caller-supplied snapshot, independent of the roster this
 * card's ambient `<IdentityScopeProvider>` (mounted by Channel.tsx /
 * BookmarksPage.tsx — see the report for why no provider is mounted inline
 * here) already holds. `user` below deliberately carries a WRONG
 * `displayName` with no `globalDisplayName` — proof (on the RED run) that the
 * card rendered through the caller's snapshot and not the identity module.
 *
 * THE BIO REGRESSION (the reason this row exists now rather than later): an
 * earlier row narrowed the mention-pill `onUserClick` payload to just an
 * address. `resolvedBio` used to read only `props.user.bio` (falling back to
 * the viewer's OWN config bio) and never the public profile this component
 * already fetches — so opening the card from a mention pill (address-only
 * payload) silently dropped the bio. The fix sources `resolvedBio` from the
 * fetched public profile too, so it no longer depends on what the caller
 * passed. Same class of bug for the avatar (`userIcon`): pinned below too.
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

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: {
      getSpace: vi.fn().mockResolvedValue(null),
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

// ClickToCopyContent pulls in primitives' <Tooltip> (react-tooltip), which
// crashes under vitest with a duplicate-React "Invalid hook call" here —
// unrelated to name/bio/avatar resolution. Stub it out like other component
// tests stub heavy primitives (see ReactionsModal.test.tsx).
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

// Barrel — UserProfile imports three hooks from it directly, but the barrel
// is also used transitively (e.g. ClickToCopyContent's useCopyToClipboard),
// so keep everything else real and override only what this file needs to
// control. The override bypasses useUserProfileActions' real `useNavigate()`
// call, which would otherwise need a Router ancestor unrelated to what this
// file tests.
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

import UserProfile from '@/components/user/UserProfile';

function renderCard(
  user: Record<string, unknown>,
  { rosterRow, profile }: { rosterRow?: Record<string, unknown>; profile?: Record<string, unknown> | null } = {},
) {
  getPublicProfile.mockResolvedValue({ data: profile ?? null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider
        spaceId={SPACE_ID}
        rostersBySpace={rosterRow ? { [SPACE_ID]: { [ADDR]: rosterRow } } : {}}
        selfAddress={SELF_ADDR}
      >
        <UserProfile spaceId={SPACE_ID} user={user} dismiss={() => {}} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('UserProfile — name resolves via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q', async () => {
    // Deliberately WRONG name from the caller — see file header. If the card
    // still trusted this, it would render "Stale Caller Name", not "alice.q".
    renderCard(
      { address: ADDR, displayName: 'Stale Caller Name' },
      { rosterRow: { display_name: '', global_display_name: 'Alice' }, profile: { primary_username: 'alice', display_name: 'Alice' } },
    );

    await waitFor(() => {
      const text = document.querySelector('.user-profile-username')?.textContent;
      expect(text).toBe('alice.q');
    });
    expect(document.querySelector('.user-profile-username')?.textContent).not.toContain('Stale Caller Name');
  });

  it('a member WITH a per-space nickname renders the nickname and no .q', async () => {
    renderCard(
      { address: ADDR, displayName: 'Stale Caller Name' },
      { rosterRow: { display_name: 'Mod Alice', global_display_name: 'Alice' }, profile: { primary_username: 'alice', display_name: 'Alice' } },
    );

    await waitFor(() => {
      const text = document.querySelector('.user-profile-username')?.textContent;
      expect(text).toBe('Mod Alice');
    });
    const text = document.querySelector('.user-profile-username')?.textContent;
    expect(text).not.toContain('.q');
    expect(text).not.toContain('Stale Caller Name');
  });
});

describe('UserProfile — the bio regression', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('renders the bio from the fetched public profile when the caller payload is address-only (mention-pill shape)', async () => {
    // Exactly what MessageMarkdownRenderer's mention pill passes today:
    // `onUserClick({ address }, ...)` — no displayName, no bio, nothing else.
    renderCard(
      { address: ADDR },
      { profile: { primary_username: 'carol', display_name: 'Carol', bio: 'Building decentralized things.', profile_image: '' } },
    );

    await waitFor(() => {
      expect(document.querySelector('.user-profile-bio-text')?.textContent).toBe(
        'Building decentralized things.',
      );
    });
  });

  it('still shows the caller-passed bio when one is provided (message-avatar / sidebar clicks)', async () => {
    renderCard(
      { address: ADDR, bio: 'From the caller.' },
      { profile: { primary_username: 'carol', display_name: 'Carol', bio: 'From the fetch.' } },
    );

    await waitFor(() => {
      expect(document.querySelector('.user-profile-bio-text')?.textContent).toBe('From the caller.');
    });
  });
});

describe('UserProfile — the avatar regression (same class of bug as bio)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('renders the avatar from the fetched public profile when the caller payload carries no userIcon', async () => {
    renderCard(
      { address: ADDR },
      { profile: { primary_username: 'carol', display_name: 'Carol', bio: '', profile_image: 'https://example.com/carol.png' } },
    );

    await waitFor(() => {
      const img = document.querySelector<HTMLImageElement>('.user-profile-icon img');
      expect(img?.src).toBe('https://example.com/carol.png');
    });
  });
});
