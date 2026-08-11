/**
 * useMessageActions — the offline DM action-queue payload's `senderDisplayName`
 * (final fix wave, finding 4).
 *
 * `buildDmActionContext` used to set `senderDisplayName:
 * currentPasskeyInfo?.displayName` — the device-local auth record, which
 * carries no QNS name and can be stale (it is not kept in sync with a
 * profile edit the way `src/identity`'s resolved self-name is). Reacting to
 * or deleting a DM message while offline broadcasts this value to the peer
 * inside the encrypted frame, for THEIR `locallyKnownNames` tier
 * (`identityProvider.tsx`) — so an offline action could hand the peer a
 * stale name even after you've published a QNS name or edited your global
 * display name.
 *
 * Fixed by resolving the self name through `useResolvedMemberName` (same
 * ladder every other name on screen uses), bare (no ".q" — that tier is
 * explicitly unverified).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { publicProfileQueryKey } from '@/hooks/business/user/useUserPublicProfile';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const SELF_ADDR = 'QmSelfMEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const PEER_ADDR = 'QmPeerMEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

// The device-local auth record: STALE, no QNS name — deliberately different
// from the resolved identity below, proof the payload doesn't read this.
const currentPasskeyInfo = {
  address: SELF_ADDR,
  displayName: 'Stale Device Name',
  pfpUrl: undefined,
};

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({ currentPasskeyInfo }),
}));

const getPublicProfile = vi.fn();
vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

vi.mock('@/components/context/ConfirmationModalProvider', () => ({
  useConfirmationModal: () => ({ showConfirmationModal: vi.fn() }),
}));

vi.mock('@/hooks/business/ui', () => ({
  useCopyToClipboard: () => ({ copied: false, copyToClipboard: vi.fn() }),
}));

vi.mock('@/hooks/business/bookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: () => false,
    toggleBookmark: vi.fn(),
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
  }),
}));

const updateMessage = vi.fn().mockResolvedValue(undefined);
const enqueue = vi.fn().mockResolvedValue(undefined);
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { updateMessage },
    actionQueueService: { enqueue },
  }),
}));

import { useMessageActions } from '@/hooks/business/messages/useMessageActions';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import type { Message as MessageType } from '@quilibrium/quorum-shared';

const dmMessage = (): MessageType =>
  ({
    messageId: 'msg-1',
    spaceId: PEER_ADDR,
    channelId: PEER_ADDR,
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    digestAlgorithm: 'sha256' as const,
    nonce: 'nonce',
    lastModifiedHash: 'hash',
    signature: 'sig',
    reactions: [],
    content: {
      senderId: PEER_ADDR,
      type: 'post' as const,
      text: 'hi',
    },
  }) as unknown as MessageType;

function renderActions() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <IdentityScopeProvider rostersBySpace={{}} selfAddress={SELF_ADDR}>
        {children}
      </IdentityScopeProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useMessageActions({
        message: dmMessage(),
        userAddress: SELF_ADDR,
        onSubmitMessage: vi.fn(),
        onSetInReplyTo: vi.fn(),
        onSetEmojiPickerOpen: vi.fn(),
        spaceId: PEER_ADDR,
        channelId: PEER_ADDR,
        dmContext: {
          self: { user_address: SELF_ADDR } as any,
          counterparty: { user_address: PEER_ADDR } as any,
        },
      }),
    { wrapper },
  );
  return { ...hook, client };
}

describe('useMessageActions — offline DM reaction broadcasts the RESOLVED self name, not the stale local one', () => {
  let onLineSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getPublicProfile.mockReset();
    updateMessage.mockClear();
    enqueue.mockClear();
    onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  });

  afterEach(() => {
    onLineSpy.mockRestore();
  });

  it('sends the resolved global name, never currentPasskeyInfo.displayName', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: '', display_name: 'Alice' } });

    const { result, client } = renderActions();

    // Wait for IdentityScopeProvider's automatic self-profile fetch to land
    // (MEASURED via the query cache, not a render assertion) before invoking
    // the action — otherwise the closure would still hold the pre-load
    // fallback name.
    await waitFor(() => {
      expect(client.getQueryData(publicProfileQueryKey(SELF_ADDR))).toBeTruthy();
    });

    await act(async () => {
      await result.current.handleReaction('👍');
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    const [taskType, payload] = enqueue.mock.calls[0];
    expect(taskType).toBe('reaction-dm');
    expect(payload.senderDisplayName).toBe('Alice');
    expect(payload.senderDisplayName).not.toBe('Stale Device Name');
  });
});
