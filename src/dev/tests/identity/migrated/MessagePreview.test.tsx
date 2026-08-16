/**
 * MessagePreview — the (currently header-hidden-in-production) sender header
 * must resolve via the identity module (`<MemberName>`), not the deleted
 * `getDisplayName`/`resolveNameForContext`/`formatResolvedName` chain built
 * from `mapSenderToUser`'s raw fields.
 *
 * BEFORE this migration, `getDisplayName` called `mapSenderToUser(senderId)`
 * and fed its fields through `resolveNameForContext`/`formatResolvedName` —
 * a resolution path independent of any surrounding IdentityScopeProvider.
 * `mapSenderToUser` below deliberately returns a WRONG displayName — proof
 * the header renders through the identity module and not this local mapper.
 *
 * Both current production callers (PinnedMessagesPanel, BookmarkItem) pass
 * `hideHeader={true}`, so this header is dead code in production today; these
 * tests mount it directly with `hideHeader={false}` to pin what it does when
 * re-enabled, exactly as the pre-migration code comment intended.
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

import { MessagePreview } from '@/components/message/MessagePreview';
import { IdentityScopeProvider, MemberName } from '@/identity';
import { buildSpaceMembersKey } from '@/hooks/queries/spaceMembers/buildSpaceMembersKey';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const MENTIONED_ADDR = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

// `MessagePreview` now mounts its OWN <IdentityScopeProvider>, sourced from
// `useMultiSpaceRosters` — which reads the exact query-cache entry
// `useSpaceMembers` would populate in the real app (`buildSpaceMembersKey`).
// Seed that cache directly rather than relying on an ambient provider: after
// the detachment fix, MessagePreview's own scope always wins for its own
// resolution, so a roster only reachable via an ambient wrapper (and not
// this cache) would silently never be seen by the preview itself — the same
// gap that produced the original bug, just moved into the test harness.
function seedRoster(
  client: QueryClient,
  spaceId: string,
  rosters: Record<string, Record<string, unknown>>,
) {
  client.setQueryData(
    buildSpaceMembersKey({ spaceId }),
    Object.entries(rosters[spaceId] ?? {}).map(([user_address, row]) => ({
      user_address,
      ...(row as object),
    })),
  );
}

// Deliberately WRONG name — see file header.
const staleMapSenderToUser = (_addr: string) => ({
  address: ADDR,
  displayName: 'Stale Mapper Name',
  primaryUsername: undefined,
  globalDisplayName: undefined,
});

const baseMessage = (): MessageType =>
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
      senderId: ADDR,
      type: 'post' as const,
      text: 'hello there',
    },
  }) as unknown as MessageType;

function renderPreview(
  rosters: Record<string, Record<string, unknown>>,
  extra?: React.ReactNode,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  seedRoster(client, SPACE_ID, rosters);
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
        <MessagePreview
          message={baseMessage()}
          mapSenderToUser={staleMapSenderToUser}
          hideHeader={false}
          currentSpaceId={SPACE_ID}
        />
        {extra}
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('MessagePreview — header sender name resolves via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderPreview({
      [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      const name = container.querySelector('.dropdown-result-sender');
      expect(name?.textContent).toBe('alice.q');
    });
    expect(container.querySelector('.dropdown-result-sender')?.textContent).not.toBe(
      'Stale Mapper Name',
    );
  });

  it('a sender WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderPreview({
      [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      const name = container.querySelector('.dropdown-result-sender');
      expect(name?.textContent).toBe('Mod Alice');
    });
  });

  it('the preview header and a <MemberName> resolve the SAME address to the SAME string', async () => {
    const rosters = { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } };

    const { container } = renderPreview(
      rosters,
      <MemberName address={ADDR} enrich className="header-name" />,
    );

    await waitFor(() => {
      const previewText = container.querySelector('.dropdown-result-sender')?.textContent;
      const headerText = container.querySelector('.header-name')?.textContent;
      expect(previewText).toBe('Mod Alice');
      expect(headerText).toBe('Mod Alice');
    });
  });
});

/**
 * Bug 1: an in-BODY @mention (`useMessageFormatting.ts`'s `processTextToken`,
 * a DIFFERENT code path from the header above) built its label from
 * `mapSenderToUser(id)?.displayName` — a raw caller-supplied field with a
 * caller-owned fallback — instead of resolving through `src/identity`. The
 * mention rendered the roster's global name (no ".q"), never the verified
 * QNS name, regardless of what the mentioned member's public profile said.
 *
 * `hideHeader={true}` matches how every production caller (PinnedMessagesPanel,
 * BookmarkItem, the delete/pin confirmation modals) actually renders this
 * component — the header case above is dead code in production today.
 */
describe('MessagePreview — body @mentions resolve via the identity module (bug 1)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  const mentionMessage = (): MessageType =>
    ({
      messageId: 'msg-mention-1',
      spaceId: SPACE_ID,
      channelId: 'channel-1',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'nonce',
      lastModifiedHash: 'hash',
      signature: 'sig',
      content: {
        senderId: ADDR,
        type: 'post' as const,
        text: `hey @<${MENTIONED_ADDR}> welcome`,
      },
      mentions: { memberIds: [MENTIONED_ADDR], roleIds: [], channelIds: [] },
    }) as unknown as MessageType;

  function renderBody(rosters: Record<string, Record<string, unknown>>) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    seedRoster(client, SPACE_ID, rosters);
    return render(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
          <MessagePreview
            message={mentionMessage()}
            mapSenderToUser={staleMapSenderToUser}
            hideHeader={true}
            currentSpaceId={SPACE_ID}
          />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );
  }

  it('the load-bearing case: a mentioned member with a global name AND a QNS name renders <qns>.q in the mention', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'bob', display_name: 'Bob' } });

    const { container } = renderBody({
      [SPACE_ID]: { [MENTIONED_ADDR]: { display_name: '', global_display_name: 'Bob' } },
    });

    await waitFor(() => {
      expect(container.querySelector('.message-mentions-user')?.textContent).toBe('bob.q');
    });
  });

  it('a mentioned member WITH a per-space nickname renders the nickname, not the QNS name', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'bob', display_name: 'Bob' } });

    const { container } = renderBody({
      [SPACE_ID]: { [MENTIONED_ADDR]: { display_name: 'Mod Bob', global_display_name: 'Bob' } },
    });

    await waitFor(() => {
      expect(container.querySelector('.message-mentions-user')?.textContent).toBe('Mod Bob');
    });
  });
});

/**
 * The operator-reported bug, reproduced directly: `showConfirmationModal`'s
 * `preview` (usePinnedMessages.ts's togglePin, useMessageActions.ts's
 * handleDelete) is built inside a Channel's identity scope but RENDERED by
 * Layout.tsx's `ConfirmationModalProvider` — a sibling of the app shell,
 * mounted outside any Channel/DirectMessage `<IdentityScopeProvider>`. React
 * resolves context where an element is rendered, not where it was created,
 * so before the fix a mention inside that preview saw only App.tsx's ROOT
 * provider (`rostersBySpace={}}`, no spaceId) — the exact shape mounted
 * below. A member with no cached public profile then fell through every
 * tier to the truncated-address fallback, even though the SAME member
 * resolves correctly a few pixels away in the Pinned Messages panel (which
 * renders inside Channel's own, richer provider).
 *
 * The roster is seeded into the shared query cache rather than passed to an
 * ambient provider — the SAME mechanism a warm Channel tab uses in the real
 * app (`useMultiSpaceRosters` shares its query key with `useSpaceMembers`,
 * see that hook's file header) — because after the fix MessagePreview reads
 * its OWN roster via that hook regardless of what wraps it.
 */
describe('MessagePreview — self-mounted identity scope survives a detached render host (confirmation-modal bug)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  // The control shape from /dev/fake-qns: pinned with an EMPTY ".q" name, so
  // the only name source is the space roster's global slot.
  const CONTROL_ADDR = 'QmPeerCEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
  // A second, unrelated member WITH a QNS name, for the paired case.
  const QNS_ADDR = 'QmPeerDEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

  const mentionOf = (address: string, msgId: string): MessageType =>
    ({
      messageId: msgId,
      spaceId: SPACE_ID,
      channelId: 'channel-1',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'nonce',
      lastModifiedHash: 'hash',
      signature: 'sig',
      content: {
        senderId: ADDR,
        type: 'post' as const,
        text: `ping @<${address}> please`,
      },
      mentions: { memberIds: [address], roleIds: [], channelIds: [] },
    }) as unknown as MessageType;

  // Mounted under ONLY a root-style provider — empty rostersBySpace, no
  // spaceId — exactly what App.tsx mounts above the Router, which is what
  // Layout.tsx's ConfirmationModalProvider actually renders under.
  function renderDetached(message: MessageType, client: QueryClient) {
    return render(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
          <MessagePreview
            message={message}
            mapSenderToUser={() => ({})}
            hideHeader={true}
            currentSpaceId={SPACE_ID}
          />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );
  }

  it("the operator's control case: a member with a global name and NO QNS name renders that name — never a truncated address — with no ambient roster at all", async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: '', display_name: '' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(buildSpaceMembersKey({ spaceId: SPACE_ID }), [
      { user_address: CONTROL_ADDR, display_name: '', global_display_name: 'Bright Beacon' },
    ]);

    const { container } = renderDetached(mentionOf(CONTROL_ADDR, 'msg-control'), client);

    const truncated = `${CONTROL_ADDR.slice(0, 6)}…${CONTROL_ADDR.slice(-4)}`;
    await waitFor(() => {
      expect(container.querySelector('.message-mentions-user')?.textContent).toBe('Bright Beacon');
    });
    expect(container.querySelector('.message-mentions-user')?.textContent).not.toBe(truncated);
  });

  it('paired case: a member WITH a QNS name renders <name>.q from the same self-mounted, detached scope', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'carol', display_name: 'Carol' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(buildSpaceMembersKey({ spaceId: SPACE_ID }), [
      { user_address: QNS_ADDR, display_name: '', global_display_name: 'Carol' },
    ]);

    const { container } = renderDetached(mentionOf(QNS_ADDR, 'msg-qns'), client);

    await waitFor(() => {
      expect(container.querySelector('.message-mentions-user')?.textContent).toBe('carol.q');
    });
  });

  it('parity: the SAME message and member resolve to the SAME string whether MessagePreview renders nested (Pinned Messages panel shape) or detached (confirmation-modal shape)', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: '', display_name: '' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(buildSpaceMembersKey({ spaceId: SPACE_ID }), [
      { user_address: CONTROL_ADDR, display_name: '', global_display_name: 'Bright Beacon' },
    ]);
    const message = mentionOf(CONTROL_ADDR, 'msg-parity');

    // "Nested" shape: MessagePreview under a RICH ambient provider, matching
    // PinnedMessagesPanel's placement inside Channel's own scope — same
    // QueryClient as the detached render below, exactly like the one shared
    // cache a running app instance actually has.
    const nested = render(
      <QueryClientProvider client={client}>
        <IdentityScopeProvider
          spaceId={SPACE_ID}
          rostersBySpace={{ [SPACE_ID]: { [CONTROL_ADDR]: { display_name: '', global_display_name: 'Bright Beacon' } } }}
          selfAddress={null}
        >
          <MessagePreview
            message={message}
            mapSenderToUser={() => ({})}
            hideHeader={true}
            currentSpaceId={SPACE_ID}
          />
        </IdentityScopeProvider>
      </QueryClientProvider>,
    );

    // "Detached" shape: the confirmation-modal host — root-style provider only.
    const detached = renderDetached(message, client);

    await waitFor(() => {
      const nestedText = nested.container.querySelector('.message-mentions-user')?.textContent;
      const detachedText = detached.container.querySelector('.message-mentions-user')?.textContent;
      expect(nestedText).toBe('Bright Beacon');
      expect(detachedText).toBe('Bright Beacon');
      expect(detachedText).toBe(nestedText);
    });
  });
});
