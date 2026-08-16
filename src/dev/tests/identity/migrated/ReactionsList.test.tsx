/**
 * ReactionsList — the "Reacted by: ..." tooltip must list reactors' REAL
 * names, resolved via the identity module, not the old
 * `resolveSpaceMemberName`/`formatResolvedName` chain built from
 * `mapSenderToUser`.
 *
 * BEFORE this migration the tooltip called `resolveSpaceMemberName({
 * address, displayName: u.displayName, primaryUsername: u.primaryUsername,
 * globalDisplayName: u.globalDisplayName })` from whatever `mapSenderToUser`
 * returned — a LOCAL roster lookup that never carried `primaryUsername`, so
 * a reactor's ".q" name could only appear if a profile happened to already
 * be cached from some other surface. `mapSenderToUser` below deliberately
 * returns a WRONG `displayName` — proof the tooltip renders through the
 * identity module and not this local mapper.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { Message as MessageType } from '@quilibrium/quorum-shared';

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

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({
    currentPasskeyInfo: { address: 'QmSelf00000000000000000000000000000000' },
  }),
}));

vi.mock('@/components/context/ReactionsModalProvider', () => ({
  useReactionsModal: () => ({ showReactionsModal: vi.fn() }),
}));

// This test pins WIRING — that the name the identity module resolves is the one
// this surface renders. It is not a test of QNS ownership, which lives in
// `identity/verifiedQnsNames.test.ts` and shared's `verifyQnsClaim.test.ts`,
// both mutation-proven.
//
// The claim still travels the real path (profile -> claimedNamesIn ->
// verifiedQnsNames -> IdentitySources -> the ladder), so this still fails if the
// provider stops populating the verified map. Only the final comparison is
// stubbed, because the address fixtures here are arbitrary and no real key
// derives to them.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

// The real Tooltip defers its content to a hover/floating-ui portal that
// doesn't render in jsdom without simulated interaction — dump `content`
// into a plain, always-present element instead so the resolved names can be
// asserted directly. Rich (non-touch) tooltip content is a React node.
vi.mock('@/components/primitives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/primitives')>();
  return {
    ...actual,
    Tooltip: ({ content, children }: { content: React.ReactNode; children: React.ReactNode }) => (
      <div>
        {children}
        <div data-testid="tooltip-content">{content}</div>
      </div>
    ),
  };
});

import { ReactionsList } from '@/components/message/ReactionsList';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerLEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

const baseMessage = (overrides: Partial<MessageType> = {}): MessageType =>
  ({
    messageId: 'msg-1',
    spaceId: SPACE_ID,
    channelId: 'channel-1',
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    digestAlgorithm: 'sha256' as const,
    nonce: 'nonce',
    lastModifiedHash: 'hash',
    signature: 'sig',
    content: { senderId: ADDR, type: 'post' as const, text: 'hi' },
    reactions: [{ emojiId: 'e1', emojiName: '👍', count: 1, memberIds: [ADDR] }],
    ...overrides,
  }) as unknown as MessageType;

// Deliberately WRONG name — see file header.
const staleMapSenderToUser = (_addr: string) => ({
  address: ADDR,
  userIcon: undefined,
  displayName: 'Stale Mapper Name',
  primaryUsername: undefined,
  globalDisplayName: undefined,
});

function renderList(rosters: Record<string, Record<string, unknown>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
        <ReactionsList
          message={baseMessage()}
          userAddress="QmSelf00000000000000000000000000000000"
          customEmojis={[]}
          mapSenderToUser={staleMapSenderToUser}
          onReactionClick={() => {}}
        />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('ReactionsList — reactor names resolve via the identity module', () => {
  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q in the tooltip', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { getByTestId } = renderList({
      [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      expect(getByTestId('tooltip-content').textContent).toContain('alice.q');
    });
    expect(getByTestId('tooltip-content').textContent).not.toContain('Stale Mapper Name');
  });

  it('a reactor WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { getByTestId } = renderList({
      [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      expect(getByTestId('tooltip-content').textContent).toContain('Mod Alice');
    });
    expect(getByTestId('tooltip-content').textContent).not.toContain('.q');
    expect(getByTestId('tooltip-content').textContent).not.toContain('Stale Mapper Name');
  });
});
