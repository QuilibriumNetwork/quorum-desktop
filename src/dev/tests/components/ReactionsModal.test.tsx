/**
 * ReactionsModal — the reaction list must show a member's REAL name.
 *
 * Regression cover for the "fallback fed INTO the resolver" defect: the modal
 * used to compute `member?.displayName || memberId.slice(0, 8) + '...'` and pass
 * the RESULT to `resolveSpaceMemberName`. For a follow-global member — the
 * DEFAULT state since the follow-global work, where the per-space override slot
 * is deliberately left empty — that handed the resolver an address in the
 * `displayName` slot. The resolver reads a present `displayName` as a deliberate
 * per-space name, and a per-space name outranks the QNS `.q` name, so the pill
 * showed `QmPeer…zzzz` while the member's `.q` name sat unused in the very same
 * object.
 *
 * The load-bearing case is `follow-global member with a .q name`. Delete the
 * `displayName` line from ReactionsModal's memo and that test must go red.
 *
 * MIGRATED (Phase D row 9) to resolve via `src/identity` (`<MemberName>`)
 * instead of `resolveSpaceMemberName`/`ResolvedName`. The ladder itself is
 * UNCHANGED — same `resolveIdentity` tiers, same test scenarios below — only
 * the DATA SOURCE changed: names no longer come from fields on the `members`
 * prop (`displayName`/`primaryUsername`/`globalDisplayName`), they come from
 * the per-space roster + public profile the modal's own
 * `<IdentityScopeProvider>` loads for `spaceId`. `ReactionsModal` is mounted
 * from `Layout.tsx` as a SIBLING of the app shell (no ambient provider), so
 * it mounts its own — see the file's production counterpart for why `spaceId`
 * is passed explicitly rather than relying on ambient scope.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { ReactionsModal } from '@/components/modals/ReactionsModal';
import type { MemberInfo } from '@/components/modals/ReactionsModal';
import { buildSpaceMembersKey } from '@/hooks/queries/spaceMembers/buildSpaceMembersKey';
import { publicProfileQueryKey } from '@/hooks/business/user/useUserPublicProfile';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

// Render the modal body inline — we're asserting on names, not on portals.
vi.mock('@/components/primitives/Modal/ModalContainer', () => ({
  ModalContainer: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <div data-testid="modal-container">{children}</div> : null),
}));

vi.mock('@/components/primitives/Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
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

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({
    currentPasskeyInfo: { address: 'QmSelf00000000000000000000000000000000' },
  }),
}));

// The detached modal's own <IdentityScopeProvider> loads its roster via
// useMultiSpaceRosters -> useMessageDB -> messageDB.getSpaceMembers. Local
// IndexedDB read, stubbed here.
const getSpaceMembers = vi.fn();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getSpaceMembers: (...args: unknown[]) => getSpaceMembers(...args) },
  }),
}));

// This test pins WIRING — that the name the identity module resolves is the one
// this surface renders. QNS ownership itself is tested in
// `identity/verifiedQnsNames.test.ts` and shared's `verifyQnsClaim.test.ts`,
// both mutation-proven. The claim still travels the real path here, so this
// still fails if the provider stops populating the verified map; only the final
// comparison is stubbed, because the address fixtures are arbitrary and no real
// key derives to them.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

const ADDR = 'QmPeerFEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';
const CHANNEL_ID = 'channel-1'; // distinct from SPACE_ID — the ordinary, non-DM shape

const reactions = [{ emojiId: 'e1', emojiName: '👍', count: 1, memberIds: [ADDR] }];

/**
 * @param roster The per-space roster row for ADDR (undefined = ADDR absent
 *   from the roster entirely — the "member has no name at all" case).
 * @param profile The public profile for ADDR (undefined = no profile / 404).
 */
function renderWith(
  roster: { display_name?: string; global_display_name?: string } | undefined,
  profile?: { primary_username?: string; display_name?: string },
) {
  getSpaceMembers.mockResolvedValue(
    roster ? [{ user_address: ADDR, ...roster }] : [],
  );
  getPublicProfile.mockResolvedValue({ data: profile ?? null });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const members: Record<string, MemberInfo> = { [ADDR]: { address: ADDR } };
  return render(
    <QueryClientProvider client={client}>
      <ReactionsModal
        visible
        onClose={() => {}}
        reactions={reactions as never}
        customEmojis={[]}
        members={members}
        spaceId={SPACE_ID}
        channelId={CHANNEL_ID}
      />
    </QueryClientProvider>,
  );
}

describe('ReactionsModal — name resolution', () => {
  beforeEach(() => {
    getSpaceMembers.mockReset();
    getPublicProfile.mockReset();
  });

  it('shows the .q name for a follow-global member (empty per-space override)', async () => {
    // The default state: no per-space override, a global name, and a QNS name.
    renderWith(
      { display_name: '', global_display_name: 'Alice' },
      { primary_username: 'alice' },
    );

    // `.q` is rendered as a sibling text node, so match the whole label.
    await waitFor(() => expect(screen.getByText('alice.q')).toBeInTheDocument());
    // The exact defect: an address stood in for the name.
    expect(screen.queryByText(/^QmV5xWMo/)).not.toBeInTheDocument();
  });

  it('shows the .q name when the roster echoes the global name at join', async () => {
    // roster === global means "not deliberately set for this space", so the
    // QNS name still wins. Same outcome, different storage shape.
    renderWith(
      { display_name: 'Alice', global_display_name: 'Alice' },
      { primary_username: 'alice' },
    );

    await waitFor(() => expect(screen.getByText('alice.q')).toBeInTheDocument());
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('still lets a DELIBERATE per-space name outrank the .q name', async () => {
    // The tier that must NOT regress: a real override differs from the global
    // name and is the whole point of the two-slot model.
    renderWith(
      { display_name: 'Alice (mod)', global_display_name: 'Alice' },
      { primary_username: 'alice' },
    );

    await waitFor(() => expect(screen.getByText('Alice (mod)')).toBeInTheDocument());
    expect(screen.queryByText('alice.q')).not.toBeInTheDocument();
  });

  it('renders globalDisplayName as a real resolver TIER', async () => {
    // CHANGED DELIBERATELY 2026-08-05, kept true across the identity-module
    // migration. This test previously pinned the opposite: that
    // `globalDisplayName` was only a comparator and this shape rendered a
    // truncated address. It said "if a future caller supplies the two slots
    // separately, this test is the one that will change — deliberately". This
    // was that change, and it was not hypothetical.
    renderWith({ display_name: '', global_display_name: 'Alice' }, undefined);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('still prefers the QNS name over the global slot', async () => {
    // Ladder order: deliberate override → QNS → global → address. Adding the
    // global tier must not let it jump the QNS name.
    renderWith(
      { display_name: '', global_display_name: 'Alice' },
      { primary_username: 'alice' },
    );
    await waitFor(() => expect(screen.getByText('alice.q')).toBeInTheDocument());
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('demotes an override that merely ECHOES the global name', async () => {
    // roster === global means a legacy stamp, not a choice. It must not outrank
    // the QNS name.
    renderWith(
      { display_name: 'Alice', global_display_name: 'Alice' },
      { primary_username: 'alice' },
    );
    await waitFor(() => expect(screen.getByText('alice.q')).toBeInTheDocument());
  });

  it('renders the merged global name when the enricher has filled displayName', async () => {
    // How the global name ACTUALLY reaches this surface in production.
    renderWith({ display_name: 'Alice', global_display_name: 'Alice' }, undefined);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('falls back to a truncated address when the member has no name at all', async () => {
    // The fallback is legitimate HERE — produced by the resolver, as output.
    renderWith(undefined, undefined);
    await waitFor(() => expect(screen.getByText(/QmPeer/)).toBeInTheDocument());
  });

  it('does not render a member entirely absent from the members map as blank', async () => {
    getSpaceMembers.mockResolvedValue([]);
    getPublicProfile.mockResolvedValue({ data: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <ReactionsModal
          visible
          onClose={() => {}}
          reactions={reactions as never}
          customEmojis={[]}
          members={{}}
          spaceId={SPACE_ID}
          channelId={CHANNEL_ID}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText(/QmPeer/)).toBeInTheDocument());
  });

  describe('a reactor on a DM message resolves through the GLOBAL ladder', () => {
    // DM messages support reactions too (no rejection logic like pins/threads
    // have), and are stored with spaceId === channelId === the peer's own
    // address (the app-wide convention). Before this fix, ReactionsModal
    // treated that pseudo-spaceId as a real Space and forced the SPACE
    // ladder — see ReactionsModal.tsx's own doc comment and MessagePreview's
    // identical, earlier-fixed defect.
    const PEER = 'QmPeerDMReactorEgVKpYZKYuFu2J49zHXnA8vZtEqzzz';
    const dmReactions = [{ emojiId: 'e1', emojiName: '👍', count: 1, memberIds: [PEER] }];

    /**
     * Waits for the query cache to go fully idle, AFTER first confirming the
     * profile fetch (issued unconditionally by `enrich`, in every code path)
     * has at least been kicked off — a floor that rules out a premature
     * "nothing has started yet, so nothing is fetching" false pass.
     *
     * Deliberately does NOT wait on a specific query key the way
     * `waitForLocalDmNamesToSettle` (rootScopeDmLocalNames.test.tsx) does:
     * under the FIXED code path no roster query is ever issued at all
     * (`spaceIds` is empty), while under the BROKEN path it is — the set of
     * queries in flight differs by construction between the two, so no
     * single key works for both. `isFetching() === 0` is symmetric: it is
     * satisfied once whatever queries this render actually triggered have
     * all settled, regardless of how many that turned out to be.
     *
     * This closes the exact false-negative shape the earlier
     * rootScopeDmLocalNames.test.tsx fix pinned: an initial `waitFor` that
     * stops polling the instant its condition is first satisfied can catch a
     * TRANSIENT state (here: the profile query settling before the
     * poisoned-roster query does, briefly rendering the correct QNS name
     * before the roster data lands and — under the bug — overwrites it).
     * Confirmed empirically: the naive single-assertion version of this test
     * passed even with `isDM` hard-disabled, for exactly this reason.
     */
    async function waitForReactionsModalToSettle(client: QueryClient) {
      await waitFor(() => expect(getPublicProfile).toHaveBeenCalledWith(PEER));
      await waitFor(() => expect(client.isFetching()).toBe(0));
    }

    it('renders the QNS name, never a per-space nickname from an unrelated "space" that merely shares the same key', async () => {
      // Plants the exact regression this pins: if DM detection is missing or
      // broken, ReactionsModal fetches "space" PEER's roster (since
      // spaceId === channelId === PEER) — which here holds a nickname for
      // that same address, on purpose, to prove it must never be consulted
      // for a DM. `getSpaceMembers` is called with the spaceId as a plain
      // positional arg (see buildSpaceMembersFetcher.ts).
      getSpaceMembers.mockImplementation(async (spaceId: string) =>
        spaceId === PEER
          ? [{ user_address: PEER, display_name: 'Unrelated Space Nickname', global_display_name: '' }]
          : [],
      );
      getPublicProfile.mockResolvedValue({ data: { primary_username: 'peerqns' } });

      const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
      const members: Record<string, MemberInfo> = { [PEER]: { address: PEER } };
      render(
        <QueryClientProvider client={client}>
          <ReactionsModal
            visible
            onClose={() => {}}
            reactions={dmReactions as never}
            customEmojis={[]}
            members={members}
            spaceId={PEER}
            channelId={PEER}
          />
        </QueryClientProvider>,
      );

      await waitForReactionsModalToSettle(client);

      expect(screen.getByText('peerqns.q')).toBeInTheDocument();
      expect(screen.queryByText('Unrelated Space Nickname')).not.toBeInTheDocument();
    });

    it('falls back to the truncated address, never the unrelated-space nickname, when the reactor has no public profile', async () => {
      getSpaceMembers.mockImplementation(async (spaceId: string) =>
        spaceId === PEER
          ? [{ user_address: PEER, display_name: 'Unrelated Space Nickname', global_display_name: '' }]
          : [],
      );
      getPublicProfile.mockResolvedValue({ data: null });

      const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
      const members: Record<string, MemberInfo> = { [PEER]: { address: PEER } };
      render(
        <QueryClientProvider client={client}>
          <ReactionsModal
            visible
            onClose={() => {}}
            reactions={dmReactions as never}
            customEmojis={[]}
            members={members}
            spaceId={PEER}
            channelId={PEER}
          />
        </QueryClientProvider>,
      );

      await waitForReactionsModalToSettle(client);

      expect(screen.getByText(new RegExp(`^${PEER.slice(0, 6)}…`))).toBeInTheDocument();
      expect(screen.queryByText('Unrelated Space Nickname')).not.toBeInTheDocument();
    });
  });
});
