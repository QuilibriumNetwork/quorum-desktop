/**
 * SpaceSettingsModal -> useInviteManagement, end-to-end wiring.
 *
 * Fix round 1: a prior review flagged (from this row's own report) that the
 * invite picker might fall back to a truncated address for a DM partner
 * known only locally. `useInviteManagement.test.tsx` already proves
 * `useInviteManagement` itself reads `locallyKnownNames` correctly — but
 * that test hand-builds the `<IdentityScopeProvider>` wrapper, which does
 * NOT prove `SpaceSettingsModal.tsx` (the real production wiring) actually
 * builds and passes that map. This file closes that gap: it mounts the REAL
 * `SpaceSettingsModal` default export (the outer provider-mounting
 * component), with the REAL `useInviteManagement` underneath, and only
 * stubs the surrounding tab UI and low-level data sources.
 *
 * `Invites` is stubbed to a thin shim that calls the REAL
 * `getUserOptions()` it's handed and renders each label as text — the
 * point is to observe what the ACTUAL hook, mounted the ACTUAL way
 * production mounts it, produces.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    getUser() {
      return Promise.resolve({ data: undefined });
    }
  },
  isHandledFetchError: () => false,
}));

const SELF_ADDR = 'QmSelf00000000000000000000000000000000';
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: SELF_ADDR } }),
}));

const ADDR_KNOWN = 'QmPeerKEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz'; // real local name, no profile
const ADDR_DOUBLE_UNKNOWN = 'QmPeerUEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz'; // placeholder local name, no profile

const conversations = [
  { address: ADDR_KNOWN, displayName: 'Bob (from conversation)', icon: '', conversationId: 'c1' },
  { address: ADDR_DOUBLE_UNKNOWN, displayName: 'Unknown User', icon: '', conversationId: 'c2' },
];

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useConversations: () => ({ data: { pages: [{ conversations }] } }),
    useRegistration: () => ({ data: { registration: {} } }),
    useSpace: () => ({ data: undefined }),
  };
});

// Every business hook in SpaceSettingsModalInner ultimately reads messageDB.
// A generic async-noop double avoids enumerating every method used across
// useSpaceManagement / useRoleManagement / useSpaceFileUploads /
// useCustomAssets / useInviteManagement / useSpaceProfile / useSpaceTag —
// none of those are what this test is about.
function asyncNoopProxy(): any {
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then' || typeof prop === 'symbol') return undefined;
        return (..._args: unknown[]) => Promise.resolve(undefined);
      },
    },
  );
}
const messageDBDouble = asyncNoopProxy();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () =>
    new Proxy(
      { messageDB: messageDBDouble },
      {
        get: (target, prop) => {
          if (prop in target) return (target as any)[prop];
          if (prop === 'then' || typeof prop === 'symbol') return undefined;
          return (..._args: unknown[]) => Promise.resolve(undefined);
        },
      },
    ),
}));
vi.mock('@/components/context/useRegistrationContext', () => ({
  useRegistrationContext: () => ({ keyset: {} }),
}));
vi.mock('@/components/context/QuorumApiContext', () => ({
  useQuorumApiClient: () => ({ apiClient: { getUser: vi.fn().mockResolvedValue({ data: undefined }) } }),
}));
vi.mock('@/hooks/queries/spaceOwner/useSpaceOwner', () => ({
  useSpaceOwner: () => ({ data: true }),
}));
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// Every tab except Invites is irrelevant here — stub trivially so their own
// (unrelated) hook dependencies never need mocking.
vi.mock('@/components/modals/SpaceSettingsModal/Account', () => ({ default: () => null }));
vi.mock('@/components/modals/SpaceSettingsModal/General', () => ({ default: () => null }));
vi.mock('@/components/modals/SpaceSettingsModal/Channels', () => ({ default: () => null }));
vi.mock('@/components/modals/SpaceSettingsModal/Roles', () => ({ default: () => null }));
vi.mock('@/components/modals/SpaceSettingsModal/SpaceTagSettings', () => ({ default: () => null }));
vi.mock('@/components/modals/SpaceSettingsModal/Emojis', () => ({ default: () => null }));
vi.mock('@/components/modals/SpaceSettingsModal/Stickers', () => ({ default: () => null }));
vi.mock('@/components/modals/SpaceSettingsModal/Danger', () => ({ default: () => null }));
vi.mock('@/components/modals/SpaceSettingsModal/Navigation', () => ({ default: () => null }));
// The one tab under test: render exactly what getUserOptions() (the REAL
// hook, mounted the REAL way) returns, nothing else.
vi.mock('@/components/modals/SpaceSettingsModal/Invites', () => ({
  default: (props: { getUserOptions: () => Array<{ value: string; label: string }> }) => (
    <ul>
      {props.getUserOptions().map((o) => (
        <li key={o.value}>{o.label}</li>
      ))}
    </ul>
  ),
}));
vi.mock('@/components/primitives', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

import SpaceSettingsModal from '@/components/modals/SpaceSettingsModal/SpaceSettingsModal';

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SpaceSettingsModal spaceId="space-1" dismiss={() => {}} initialTab="invites" />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('SpaceSettingsModal -> useInviteManagement — locally-known names reach the resolver, no fetch', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockResolvedValue({ data: null });
  });

  it('a DM partner known only from the local conversation row renders that name, not an address', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Bob (from conversation)')).toBeInTheDocument();
    });
    expect(screen.queryByText(/^QmPeerK/)).not.toBeInTheDocument();
  });

  it('never fetches a candidate’s public profile just from the modal opening', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText('Bob (from conversation)')).toBeInTheDocument();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(getPublicProfile).not.toHaveBeenCalledWith(ADDR_KNOWN);
    expect(getPublicProfile).not.toHaveBeenCalledWith(ADDR_DOUBLE_UNKNOWN);
  });
});
