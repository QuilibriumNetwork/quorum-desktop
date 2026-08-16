/**
 * PinnedMessagesPanel — each pinned-message row's sender name must resolve
 * via the identity module (`<MemberName>`), not the old
 * `resolveSpaceMemberName`/`ResolvedName` chain built from `mapSenderToUser`.
 *
 * BEFORE this migration the row built `resolveSpaceMemberName({ address,
 * displayName: sender.displayName, primaryUsername: sender.primaryUsername,
 * globalDisplayName: sender.globalDisplayName })` from whatever
 * `mapSenderToUser` returned — a LOCAL roster lookup that never carried
 * `primaryUsername`, so the pinned row's ".q" name could only ever appear if
 * a profile happened to already be cached from some other surface. It also
 * fell back to a caller-supplied "Unknown User" string when `mapSenderToUser`
 * returned nothing, instead of letting the resolver own that fallback.
 *
 * `mapSenderToUser` below deliberately returns a WRONG `displayName` — proof
 * the row renders through the identity module and not this local mapper.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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

// pinnedMessages data-loading, permissions and toggling are unrelated to
// name resolution — return canned data instead of wiring up messageDB.
const togglePin = vi.fn();
vi.mock('@/hooks', () => ({
  usePinnedMessages: (..._args: unknown[]) => ({
    pinnedMessages: pinnedMessagesFixture,
    pinnedCount: pinnedMessagesFixture.length,
    canPinMessages: false,
    togglePin,
    isLoading: false,
    error: null,
  }),
}));

// Real Virtuoso needs layout measurement jsdom doesn't provide — render every
// item directly instead, matching the desktop (`totalCount`) branch this
// panel uses when `isTouchDevice()` is false (jsdom has no touch support).
vi.mock('react-virtuoso', () => ({
  Virtuoso: (props: any) => {
    if (props.data) {
      return (
        <>
          {props.data.map((item: unknown, i: number) => (
            <React.Fragment key={i}>{props.itemContent(i, item)}</React.Fragment>
          ))}
        </>
      );
    }
    const count = props.totalCount ?? 0;
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <React.Fragment key={i}>{props.itemContent(i)}</React.Fragment>
        ))}
      </>
    );
  },
}));

// The message body/header inside each preview is a different, already
// migrated surface (row 6) — irrelevant here and pulls in markdown/formatting
// machinery this test doesn't need.
vi.mock('@/components/message/MessagePreview', () => ({
  __esModule: true,
  default: () => null,
  MessagePreview: () => null,
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

import { PinnedMessagesPanel } from '@/components/message/PinnedMessagesPanel';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerPEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
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
    isPinned: true,
    content: {
      senderId: ADDR,
      type: 'post' as const,
      text: 'pinned text',
    },
    ...overrides,
  }) as unknown as MessageType;

let pinnedMessagesFixture: MessageType[] = [baseMessage()];

// Deliberately WRONG name — see file header.
const staleMapSenderToUser = (_senderId: string) => ({
  address: ADDR,
  userIcon: undefined,
  displayName: 'Stale Mapper Name',
  primaryUsername: undefined,
  globalDisplayName: undefined,
});

function renderPanel(rosters: Record<string, Record<string, unknown>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
          <PinnedMessagesPanel
            isOpen
            onClose={() => {}}
            spaceId={SPACE_ID}
            channelId="channel-1"
            mapSenderToUser={staleMapSenderToUser}
          />
        </IdentityScopeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PinnedMessagesPanel — sender name resolves via the identity module', () => {
  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q', async () => {
    pinnedMessagesFixture = [baseMessage()];
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderPanel({
      [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
    });

    // The panel's DropdownPanel renders through a MobileDrawer portal
    // (attached to document.body, not the RTL container) whenever
    // isTouchDevice() reports true in this jsdom environment — query the
    // document so the assertion holds regardless of which branch renders.
    await waitFor(() => {
      const text = document.querySelector('.result-sender')?.textContent;
      expect(text).toBe('alice.q');
    });
    expect(document.querySelector('.result-sender')?.textContent).not.toContain('Stale Mapper Name');
  });

  it('a sender WITH a per-space nickname renders the nickname and no .q', async () => {
    pinnedMessagesFixture = [baseMessage()];
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderPanel({
      [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      const text = document.querySelector('.result-sender')?.textContent;
      expect(text).toBe('Mod Alice');
    });
    expect(document.querySelector('.result-sender')?.textContent).not.toContain('.q');
    expect(document.querySelector('.result-sender')?.textContent).not.toContain('Stale Mapper Name');
  });
});
