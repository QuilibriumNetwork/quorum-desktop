/**
 * MessageMarkdownRenderer — a `@<address>` mention pill inside a message body
 * must resolve its label via the identity module (`useNameResolver`), not the
 * old `resolveSpaceMemberName`/`formatResolvedName` chain built from whatever
 * `resolveSender`/`mapSenderToUser` happened to return for that address.
 *
 * BEFORE this migration, a pill's label was
 * `formatResolvedName(resolveSpaceMemberName({ ...resolvedUser }))` — always
 * the SPACE-scope ladder, assembled from resolveSender/mapSenderToUser's own
 * fields, independent of the surrounding IdentityScopeProvider. `resolveSender`
 * below deliberately returns a WRONG displayName — proof the pill renders
 * through the identity module and not this local resolver. Pre-migration,
 * that stale string is exactly what would have rendered.
 *
 * A message body can carry many mentions, built as plain `<span>`s inside a
 * text-token loop (not one React component per pill) — this is the surface
 * `useNameResolver` exists for, so the load-bearing case here also proves the
 * bulk resolver, not just the single-address `<MemberName>` path.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Keep the tree light: neither is exercised by mention-only content.
vi.mock('@/components/message/InviteLink', () => ({
  InviteLink: () => null,
}));
vi.mock('@/components/ui/YouTubeFacade', () => ({
  YouTubeFacade: () => null,
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

import { MessageMarkdownRenderer } from '@/components/message/MessageMarkdownRenderer';
import { IdentityScopeProvider, MemberName } from '@/identity';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

// Deliberately WRONG name — see file header.
const staleResolver = (_addr: string) => ({
  address: ADDR,
  displayName: 'Stale Mapper Name',
  primaryUsername: undefined,
  globalDisplayName: undefined,
});

function renderInScope(
  ui: React.ReactNode,
  rosters: Record<string, Record<string, unknown>>,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
        {ui}
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('MessageMarkdownRenderer — mention pills resolve via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderInScope(
      <MessageMarkdownRenderer
        content={`hey @<${ADDR}> welcome`}
        mapSenderToUser={staleResolver}
        resolveSender={staleResolver}
      />,
      { [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } } },
    );

    await waitFor(() => {
      const pill = container.querySelector('.message-mentions-user');
      expect(pill?.textContent).toBe('@alice.q');
    });
    expect(container.querySelector('.message-mentions-user')?.textContent).not.toContain(
      'Stale Mapper Name',
    );
  });

  it('a member WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderInScope(
      <MessageMarkdownRenderer
        content={`hey @<${ADDR}> welcome`}
        mapSenderToUser={staleResolver}
        resolveSender={staleResolver}
      />,
      { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } },
    );

    await waitFor(() => {
      const pill = container.querySelector('.message-mentions-user');
      expect(pill?.textContent).toBe('@Mod Alice');
    });
    expect(container.querySelector('.message-mentions-user')?.textContent).not.toContain('.q');
  });

  it('a mention pill and a <MemberName> header resolve the SAME address to the SAME string', async () => {
    const rosters = { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } };

    const { container } = renderInScope(
      <>
        <MessageMarkdownRenderer
          content={`hey @<${ADDR}> welcome`}
          mapSenderToUser={staleResolver}
          resolveSender={staleResolver}
        />
        <MemberName address={ADDR} enrich className="header-name" />
      </>,
      rosters,
    );

    await waitFor(() => {
      const pillText = container.querySelector('.message-mentions-user')?.textContent;
      const headerText = container.querySelector('.header-name')?.textContent;
      expect(pillText).toBe('@Mod Alice');
      expect(headerText).toBe('Mod Alice');
    });
  });
});
