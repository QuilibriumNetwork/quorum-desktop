/**
 * PinnedMessagesPanel — end-to-end: an in-BODY @mention inside a pinned
 * message's preview must resolve via the identity module, not the raw
 * `mapSenderToUser(id)?.displayName` field `useMessageFormatting.ts` used to
 * read (bug 1). The row's SENDER header (a different code path, already
 * migrated — see PinnedMessagesPanel.test.tsx) is not what this file pins;
 * this file is the one that actually renders the real `MessagePreview` body,
 * where the bug lived, instead of mocking it out.
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

const ADDR = 'QmPeerPEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const MENTIONED_ADDR = 'QmPeerQEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

const pinnedMessage = (): MessageType =>
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
      text: `great point @<${MENTIONED_ADDR}>`,
    },
    mentions: { memberIds: [MENTIONED_ADDR], roleIds: [], channelIds: [] },
  }) as unknown as MessageType;

// Swappable per-test, read at CALL time (the mock factory below is a
// closure, not evaluated until `usePinnedMessages()` actually runs) — same
// pattern as the sibling PinnedMessagesPanel.test.tsx's `pinnedMessagesFixture`.
let pinnedMessagesOverride: MessageType | null = null;

// pinnedMessages data-loading, permissions and toggling are unrelated to
// name resolution — return canned data instead of wiring up messageDB.
vi.mock('@/hooks', () => ({
  usePinnedMessages: (..._args: unknown[]) => ({
    pinnedMessages: [pinnedMessagesOverride ?? pinnedMessage()],
    pinnedCount: 1,
    canPinMessages: false,
    togglePin: vi.fn(),
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
import { MessagePreview } from '@/components/message/MessagePreview';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import { buildSpaceMembersKey } from '@/hooks/queries/spaceMembers/buildSpaceMembersKey';

// Deliberately WRONG name — proof the body renders through the identity
// module and not this local mapper, same convention as the sibling
// PinnedMessagesPanel.test.tsx / MessagePreview.test.tsx files.
const staleMapSenderToUser = (_senderId: string) => ({
  address: ADDR,
  displayName: 'Stale Mapper Name',
});

function renderPanel(rosters: Record<string, Record<string, unknown>>, client?: QueryClient) {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
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
  return { ...result, client: queryClient };
}

describe('PinnedMessagesPanel — body @mentions resolve via the identity module (bug 1)', () => {
  it('a mentioned member with a global name AND a QNS name renders <qns>.q inside the pinned preview', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'bob', display_name: 'Bob' } });

    renderPanel({
      [SPACE_ID]: { [MENTIONED_ADDR]: { display_name: '', global_display_name: 'Bob' } },
    });

    // DropdownPanel renders through a MobileDrawer portal (attached to
    // document.body, not the RTL container) whenever isTouchDevice() reports
    // true in this jsdom environment — query the document so the assertion
    // holds regardless of which branch renders (same as the sibling
    // PinnedMessagesPanel.test.tsx).
    await waitFor(() => {
      expect(document.querySelector('.message-mentions-user')?.textContent).toBe('bob.q');
    });
    expect(document.querySelector('.message-mentions-user')?.textContent).not.toContain('Stale Mapper Name');
  });
});

/**
 * The operator's actual reported split, end to end: the SAME pinned message
 * renders correctly inside the real `PinnedMessagesPanel` (nested in
 * Channel's own identity scope) but showed a truncated address in the
 * unpin-confirmation modal (rendered detached, by Layout.tsx's
 * ConfirmationModalProvider, via `usePinnedMessages.ts`'s `togglePin` —
 * `preview: React.createElement(MessagePreview, {...})`). Reproduces both
 * placements against the SAME message, SAME control member (an empty QNS
 * name, so only the roster's global name can resolve it — the /dev/fake-qns
 * shape the operator actually pinned), and the SAME shared `QueryClient`,
 * exactly like the one cache a running app instance has.
 */
describe('PinnedMessagesPanel vs. the detached confirmation-modal preview — parity (the operator-reported bug)', () => {
  // Empty QNS name deliberately: the only name source is the roster's
  // global slot, read via useMultiSpaceRosters — the exact control shape
  // the operator pinned in /dev/fake-qns.
  const CONTROL_ADDR = 'QmPeerREgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

  const controlPinnedMessage = (): MessageType =>
    ({
      messageId: 'msg-control',
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
        text: `great point @<${CONTROL_ADDR}>`,
      },
      mentions: { memberIds: [CONTROL_ADDR], roleIds: [], channelIds: [] },
    }) as unknown as MessageType;

  it('the pinned panel and a detached MessagePreview (the modal-host shape) resolve the mention to the SAME name — never a truncated address', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: '', display_name: '' } });
    pinnedMessagesOverride = controlPinnedMessage();

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(buildSpaceMembersKey({ spaceId: SPACE_ID }), [
      { user_address: CONTROL_ADDR, display_name: '', global_display_name: 'Bright Beacon' },
    ]);

    // Nested placement: the real PinnedMessagesPanel inside Channel's own
    // (rich) provider — this is the surface that already worked.
    renderPanel(
      { [SPACE_ID]: { [CONTROL_ADDR]: { display_name: '', global_display_name: 'Bright Beacon' } } },
      client,
    );

    // Detached placement: a standalone MessagePreview under ONLY a
    // root-style provider (empty rostersBySpace, no spaceId) — exactly what
    // Layout.tsx's ConfirmationModalProvider renders under. Same QueryClient
    // as above: one shared cache, like the real running app.
    const detached = render(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
          <MessagePreview
            message={controlPinnedMessage()}
            mapSenderToUser={staleMapSenderToUser}
            hideHeader={true}
            currentSpaceId={SPACE_ID}
          />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );

    const truncated = `${CONTROL_ADDR.slice(0, 6)}…${CONTROL_ADDR.slice(-4)}`;
    await waitFor(() => {
      const nestedText = document.querySelector('.message-mentions-user')?.textContent;
      const detachedText = detached.container.querySelector('.message-mentions-user')?.textContent;
      expect(nestedText).toBe('Bright Beacon');
      expect(detachedText).toBe('Bright Beacon');
      expect(detachedText).not.toBe(truncated);
      expect(detachedText).toBe(nestedText);
    });

    pinnedMessagesOverride = null;
  });
});
