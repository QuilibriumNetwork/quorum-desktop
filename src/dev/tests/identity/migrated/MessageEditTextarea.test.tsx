/**
 * MessageEditTextarea — entering edit mode rebuilds every mention pill from
 * the stored `@<address>` tokens as raw DOM nodes (contentEditable), so this
 * is the second surface (after MessageMarkdownRenderer) `useNameResolver`
 * exists for: a hook cannot be called per address inside that rebuild loop.
 *
 * BEFORE this migration, `resolveMentionName` called `mapSenderToUser(address)`
 * (the roster/effectiveMembers row) and fed it through `resolveMentionPillName`
 * from `mentionPillDom` — a SEPARATE resolution path from the message body's
 * own pills, and the private `createPillElement` copy in this file duplicated
 * `mentionPillDom`'s DOM-building. `mapSenderToUser` below deliberately
 * returns a WRONG displayName — proof the rebuilt pill renders through the
 * identity module and not this local mapper.
 *
 * The pill-rebuild effect runs ONCE on mount (deliberately, so it can't blow
 * away an in-progress edit) — so a QNS name only appears when the profile is
 * already warm by the time Edit is clicked, exactly like the real flow
 * (the message was visible, with its own resolved pills, before Edit opened
 * it). The load-bearing test below simulates that by warming the identity
 * provider's cache before mounting the editor.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
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

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getSpace: vi.fn(), getConversation: vi.fn(), getUserConfig: vi.fn() },
    actionQueueService: undefined,
  }),
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

// Toolbar/dropdown chrome — irrelevant to pill name resolution.
vi.mock('@/components/message/MarkdownToolbar', () => ({ MarkdownToolbar: () => null }));
vi.mock('@/components/message/MentionDropdown', () => ({ MentionDropdown: () => null }));

import { MessageEditTextarea } from '@/components/message/MessageEditTextarea';
import { MemberName } from '@/identity';
import { IdentityScopeProvider, useIdentityContext } from '@/identity/identityProvider';
import { publicProfileQueryKey } from '@/hooks/business/user/useUserPublicProfile';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

// Deliberately WRONG name — see file header.
const staleMapSenderToUser = (_addr: string) => ({
  address: ADDR,
  displayName: 'Stale Mapper Name',
  userIcon: undefined,
  primaryUsername: undefined,
  globalDisplayName: undefined,
});

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
    content: {
      senderId: 'QmSender0000000000000000000000000000000000',
      type: 'post' as const,
      text: `hey @<${ADDR}> welcome`,
    },
    mentions: { memberIds: [ADDR], channelIds: [], roleIds: [], everyone: false },
    ...overrides,
  }) as unknown as MessageType;

/** Fires `request(address)` on mount, to warm the provider's cache before a
 *  second render mounts the component under test — mirrors the real flow
 *  where the message (and its pills) were already visible, and so already
 *  enriched, before Edit was clicked. */
function WarmUp({ addresses }: { addresses: string[] }) {
  const { request } = useIdentityContext();
  React.useEffect(() => {
    addresses.forEach(request);
  }, [addresses, request]);
  return null;
}

function renderEditor(
  ui: React.ReactNode,
  rosters: Record<string, Record<string, unknown>>,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
        {ui}
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
  return { ...utils, client };
}

describe('MessageEditTextarea — mention pills resolve via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: a warm QNS profile renders <qns>.q on the rebuilt pill', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });
    const rosters = { [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } } };

    const { container, rerender, client } = renderEditor(
      <WarmUp addresses={[ADDR]} />,
      rosters,
    );

    // Wait for the warm-up fetch to actually land in the cache before
    // mounting the editor — the pill-rebuild effect only runs once, on
    // mount, so it must see the resolved profile on its FIRST render.
    await waitFor(() => {
      expect(client.getQueryData(publicProfileQueryKey(ADDR))).toBeTruthy();
    });

    rerender(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
          <WarmUp addresses={[ADDR]} />
          <MessageEditTextarea
            message={baseMessage()}
            initialText={`hey @<${ADDR}> welcome`}
            onCancel={() => {}}
            submitMessage={async () => {}}
            mapSenderToUser={staleMapSenderToUser}
          />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const pill = container.querySelector('[data-mention-type="user"]');
      expect(pill?.textContent).toBe('@alice.q');
    });
    expect(container.querySelector('[data-mention-type="user"]')?.textContent).not.toContain(
      'Stale Mapper Name',
    );
  });

  it('a member WITH a per-space nickname rebuilds the pill with the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });
    const rosters = { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } };

    const { container } = renderEditor(
      <MessageEditTextarea
        message={baseMessage()}
        initialText={`hey @<${ADDR}> welcome`}
        onCancel={() => {}}
        submitMessage={async () => {}}
        mapSenderToUser={staleMapSenderToUser}
      />,
      rosters,
    );

    await waitFor(() => {
      const pill = container.querySelector('[data-mention-type="user"]');
      expect(pill?.textContent).toBe('@Mod Alice');
    });
    expect(container.querySelector('[data-mention-type="user"]')?.textContent).not.toContain('.q');
  });

  it('the rebuilt pill and a <MemberName> header resolve the SAME address to the SAME string', async () => {
    const rosters = { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } };

    const { container } = renderEditor(
      <>
        <MessageEditTextarea
          message={baseMessage()}
          initialText={`hey @<${ADDR}> welcome`}
          onCancel={() => {}}
          submitMessage={async () => {}}
          mapSenderToUser={staleMapSenderToUser}
        />
        <MemberName address={ADDR} enrich className="header-name" />
      </>,
      rosters,
    );

    await waitFor(() => {
      const pillText = container.querySelector('[data-mention-type="user"]')?.textContent;
      const headerText = container.querySelector('.header-name')?.textContent;
      expect(pillText).toBe('@Mod Alice');
      expect(headerText).toBe('Mod Alice');
    });
  });
});
