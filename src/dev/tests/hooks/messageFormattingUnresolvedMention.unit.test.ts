import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

/**
 * `processTextToken`'s user-mention branch used to read a caller-supplied
 * `mapSenderToUser(id)?.displayName` with a caller-owned fallback
 * (`@${address.substring(0,8)}...`). `mapSenderToUser` is typed
 * `(id) => any` and callers legitimately return undefined for a sender they
 * cannot resolve — dereferencing it bare once threw inside render and took
 * a whole panel down through the error boundary.
 *
 * Post phase-D fix, name resolution goes through `src/identity`'s
 * `useNameResolver` instead (see `useMessageFormatting.ts`'s
 * `processTextToken`) — the resolver, not the caller, owns the fallback. The
 * property this file pins is unchanged: an address the resolver cannot name
 * degrades to a truncated-address label, never a throw. The exact fallback
 * shape is `resolveIdentity`'s own truncation (`slice(0,6)…slice(-4)`), not
 * the old caller-owned `@xxxxxxxx...` string — asserting the OLD shape here
 * would silently stop testing the code that actually runs today.
 */

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

import { useMessageFormatting } from '@/hooks/business/messages/useMessageFormatting';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const SENDER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const MENTIONED = 'QmPeerLEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const messageWithMention = () =>
  ({
    messageId: 'msg-1',
    spaceId: 'space-1',
    channelId: 'channel-1',
    createdDate: 1_000,
    content: { type: 'post', senderId: SENDER, text: [`hey @<${MENTIONED}> look`] },
    reactions: [],
    mentions: { memberIds: [MENTIONED], roleIds: [], channelIds: [] },
  }) as any;

function renderFormatting(rosters: Record<string, Record<string, unknown>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        IdentityScopeProvider,
        { spaceId: 'space-1', rostersBySpace: rosters, selfAddress: null },
        children,
      ),
    );
  return renderHook(
    () =>
      useMessageFormatting({
        message: messageWithMention(),
        stickers: {},
        mapSenderToUser: () => undefined,
        onImageClick: () => {},
        currentSpaceId: 'space-1',
      }),
    { wrapper },
  );
}

describe('useMessageFormatting — mention with an unresolvable sender', () => {
  it('falls back to a truncated-address label instead of throwing', async () => {
    getPublicProfile.mockResolvedValue({ data: null });

    const { result } = renderFormatting();

    await waitFor(() => {
      const token = result.current.processTextToken(`@<${MENTIONED}>`, 'msg-1', 0, 1);
      expect(token.type).toBe('mention');
      expect(token.address).toBe(MENTIONED);
      expect(token.displayName).toBe('QmPeer…zzzz');
    });
  });

  it('prefers a roster name when the identity module knows one', async () => {
    getPublicProfile.mockResolvedValue({ data: null });

    const { result } = renderFormatting({
      'space-1': { [MENTIONED]: { display_name: 'Ada Lovelace' } },
    });

    await waitFor(() => {
      const token = result.current.processTextToken(`@<${MENTIONED}>`, 'msg-1', 0, 1);
      expect(token.displayName).toBe('Ada Lovelace');
    });
  });

  it('renders the verified QNS name when the resolver has a public profile', async () => {
    getPublicProfile.mockImplementation((address: string) =>
      Promise.resolve(
        address === MENTIONED
          ? { data: { primary_username: 'ada', display_name: 'Ada Lovelace' } }
          : { data: null },
      ),
    );

    const { result } = renderFormatting();

    await waitFor(() => {
      const token = result.current.processTextToken(`@<${MENTIONED}>`, 'msg-1', 0, 1);
      expect(token.displayName).toBe('ada.q');
    });
  });
});
