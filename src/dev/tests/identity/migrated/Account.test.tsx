/**
 * SpaceSettingsModal/Account.tsx — the per-space "Your name in this Space"
 * placeholder, migrated off `utils/resolveSelfName` (`selfNamePlaceholder`)
 * onto the identity module (`useMemberIdentity`).
 *
 * Missed by the plan's migration table. `Account.tsx` is reached through
 * `ModalProvider`, which is mounted at `Router.web.tsx` level — a SIBLING of
 * `Layout`/`Space`/`Channel`, not a descendant. Channel.tsx's own
 * `<IdentityScopeProvider>` is therefore NOT an ancestor of this modal, so a
 * naive migration (swap `resolveSelfName` for `useMemberIdentity`, change
 * nothing else) throws the moment the modal opens. The fix is
 * `SpaceSettingsModal.tsx` mounting its OWN provider one level up.
 *
 * First case pins the crash directly (Account.tsx rendered exactly as it
 * would be if no provider existed) — this is the RED this row's report
 * records. Second case renders it the way `SpaceSettingsModal.tsx` now
 * actually does (wrapped in `<IdentityScopeProvider>`), proving the fix.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
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
  usePasskeysContext: () => ({
    currentPasskeyInfo: { address: SELF_ADDR, displayName: 'Legacy Global Name' },
  }),
}));

// Everything below is unrelated to name resolution — canned data, so the
// test isolates the placeholder logic instead of exercising space
// management, roles, mute settings, etc.
vi.mock('@/hooks', () => ({
  useSpace: () => ({ data: undefined }),
}));
vi.mock('@/hooks/queries/spaceOwner/useSpaceOwner', () => ({
  useSpaceOwner: () => ({ data: true }),
}));
vi.mock('@/hooks/business/spaces/useSpaceLeaving', () => ({
  useSpaceLeaving: () => ({ confirmationStep: 0, handleLeaveClick: vi.fn(), error: undefined }),
}));
vi.mock('@/hooks/business/user/useUserRoleDisplay', () => ({
  useUserRoleDisplay: () => ({ userRoles: [] }),
}));
vi.mock('@/hooks/business/channels', () => ({
  useChannelMute: () => ({
    showMutedChannels: false,
    toggleShowMutedChannels: vi.fn(),
    isSpaceMuted: false,
    toggleSpaceMute: vi.fn(),
    isChannelMuted: () => false,
    toggleMute: vi.fn(),
  }),
}));
// Same reason as UserProfile.test.tsx: react-tooltip crashes under vitest
// with a duplicate-React "Invalid hook call", unrelated to name resolution.
vi.mock('@/components/ui', () => ({
  ReactTooltip: () => null,
}));

import Account from '@/components/modals/SpaceSettingsModal/Account';

const SPACE_ID = 'space-1';

const baseProps = {
  spaceId: SPACE_ID,
  spaceName: 'Test Space',
  displayName: '',
  setDisplayName: vi.fn(),
  bio: '',
  setBio: vi.fn(),
  bioErrors: [],
  currentPasskeyInfo: { address: SELF_ADDR },
  fileData: undefined,
  currentFile: undefined,
  avatarFileError: null,
  isAvatarUploading: false,
  isAvatarDragActive: false,
  getRootProps: () => ({}),
  getInputProps: () => ({}),
  clearFileError: vi.fn(),
  markedForDeletion: false,
  markForDeletion: vi.fn(),
  getProfileImageUrl: () => '',
  currentMember: undefined,
  onSave: vi.fn(),
  isSaving: false,
  hasValidationError: false,
  displayNameError: undefined,
  onClose: vi.fn(),
  roles: [],
  selectedMentionTypes: [],
  setSelectedMentionTypes: vi.fn(),
  isMentionSettingsLoading: false,
} as const;

function renderBare() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <Account {...baseProps} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

function renderWithProvider(rosterRow?: Record<string, unknown>) {
  getPublicProfile.mockResolvedValue({ data: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <IdentityScopeProvider
          spaceId={SPACE_ID}
          rostersBySpace={rosterRow ? { [SPACE_ID]: { [SELF_ADDR]: rosterRow } } : {}}
          selfAddress={SELF_ADDR}
        >
          <Account {...baseProps} />
        </IdentityScopeProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('Account.tsx — the crash this row prevents', () => {
  it('throws when rendered with no <IdentityScopeProvider> ancestor (the ModalProvider reality this row fixes)', () => {
    // Suppress the expected React error-boundary console noise for this one
    // assertion — the throw itself is the point.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderBare()).toThrow(/IdentityScopeProvider/);
    spy.mockRestore();
  });
});

describe('Account.tsx — per-space name placeholder, wrapped as SpaceSettingsModal now wraps it', () => {
  it('renders without throwing once a provider is mounted (the fix)', () => {
    expect(() => renderWithProvider()).not.toThrow();
  });

  it('promises the QNS name (with ".q") when self has a published public profile', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'gattopardo', display_name: 'GattoPardo' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{}} selfAddress={SELF_ADDR}>
            <Account {...baseProps} />
          </IdentityScopeProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );

    const input = await screen.findByPlaceholderText('gattopardo.q');
    expect(input).toBeInTheDocument();
  });

  it('falls back to the instructional copy when self has no name at all', async () => {
    getPublicProfile.mockResolvedValue({ data: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{}} selfAddress={SELF_ADDR}>
            <Account {...baseProps} />
          </IdentityScopeProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );

    const input = await screen.findByPlaceholderText('Your name in this Space');
    expect(input).toBeInTheDocument();
  });

  it('fix round 1 — a forged primary_username ending in ".q" is dropped, never doubled to "alice.q.q"', async () => {
    // `useMemberIdentity` returns the RAW MemberIdentity, not run through
    // shared's resolveIdentity (which is where the forged-suffix guard,
    // presentUnreserved, normally lives) — so Account.tsx must reapply the
    // SAME shared hasReservedQnsSuffix check itself. This pins that it does.
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice.q', display_name: 'GattoPardo' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{}} selfAddress={SELF_ADDR}>
            <Account {...baseProps} />
          </IdentityScopeProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );

    // Falls through to the global name — the forged qns tier is dropped, not
    // rendered (and never doubled to "alice.q.q").
    const input = await screen.findByPlaceholderText('GattoPardo');
    expect(input).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('alice.q.q')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/^alice\.q/)).not.toBeInTheDocument();
  });

  // Ported from the deleted `utils/resolveSelfName`'s `selfNamePlaceholder.test.ts`
  // (Task 7 — that module is dead, superseded by this component's own
  // `selfPlaceholderName`, but these two cases were real coverage the old
  // suite had and this one didn't).
  it('falls back to the global name when self has no QNS name elected', async () => {
    getPublicProfile.mockResolvedValue({ data: { display_name: 'Alice Smith' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{}} selfAddress={SELF_ADDR}>
            <Account {...baseProps} />
          </IdentityScopeProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );

    const input = await screen.findByPlaceholderText('Alice Smith');
    expect(input).toBeInTheDocument();
  });

  it('does not promise a global name that ends in ".q" — falls to the instructional copy instead', async () => {
    // Every other surface drops a name forging the verified marker and
    // renders the address instead; this field has no address to fall to, so
    // it falls to the caller's instructional copy. Promising "mallory.q"
    // here would be false — the app would never actually render it.
    getPublicProfile.mockResolvedValue({ data: { display_name: 'mallory.q' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{}} selfAddress={SELF_ADDR}>
            <Account {...baseProps} />
          </IdentityScopeProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );

    const input = await screen.findByPlaceholderText('Your name in this Space');
    expect(input).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('mallory.q')).not.toBeInTheDocument();
  });
});
