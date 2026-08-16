/**
 * useMentionInput — SORTING + FILTERING (Phase D row 19; revised 2026-08-11
 * for design decision 3's reversal).
 *
 * The mention picker RENDERS a bounded set (`maxDisplayResults = 50`, a
 * handful after a character or two) and now enriches, same as bookmarks and
 * notifications — but the ENRICHMENT itself is owned by the rendering
 * component (`MentionDropdown`'s `<MemberName enrich>` per row), not by this
 * hook. `useMentionInput` never calls `request`/`requestNames` itself: it
 * only READS whatever the ambient `<IdentityScopeProvider>` already has,
 * via `useNameResolver().resolve()` — the same read `<MemberName>` does, so
 * sorting/filtering can never show a person the dropdown wouldn't also
 * render, or vice versa. See the "no fetch from this hook" test at the
 * bottom of this file; the fetch itself is measured separately in
 * `../mentionDropdownFetch.test.tsx`.
 *
 * SORTING used to rank candidates via `resolveSpaceMemberName` run on the
 * raw fields the `User` object happened to carry (`displayName`/
 * `primaryUsername`/`globalDisplayName`), independent of the ambient roster.
 * That is provably wrong the moment the two disagree: the dropdown renders
 * via `<MemberName address>` (MentionDropdown, row 10), which reads the
 * AMBIENT `<IdentityScopeProvider>` roster — so a candidate's raw `User`
 * fields can say one thing while the roster the user actually SEES says
 * another (e.g. a stale prop, or simply a different data source). Sorting
 * must order by the name the roster resolves, i.e. the same source
 * `<MemberName>` reads, not by the candidate's own fields.
 *
 * Below, each user's raw fields are deliberately sabotaged to sort in the
 * OPPOSITE order from what the roster says — so a pass here is proof the
 * sort reads the roster, not the stale fields.
 *
 * FILTERING now ALSO matches the resolved (displayed) name, suffix
 * included, on top of the existing raw-field matching (kept — it is a real,
 * documented search aid; see `rawNameFieldAudit.test.ts`'s exception for
 * `MessageList.tsx`) — so typing the exact `.q` name a person is shown by
 * elsewhere in the app finds them, even when that differs from every raw
 * field on the `User` object.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdentityScopeProvider, useIdentityContext } from '@/identity/identityProvider';
import { useMentionInput } from '@/hooks/business/mentions/useMentionInput';

const ADDR_A = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const ADDR_B = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

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

/** Stands in for "some other already-rendered surface enriched this
 *  candidate" (a message header, the dropdown's own previous open, etc.) —
 *  `useMentionInput` itself never calls `request`. */
function Requester({ address }: { address: string }) {
  const { request } = useIdentityContext();
  React.useEffect(() => {
    request(address);
  }, [address, request]);
  return null;
}

function wrapperFor(rosters: Record<string, Record<string, unknown>>, extra?: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
          {extra}
          {children}
        </IdentityScopeProvider>
      </QueryClientProvider>
    );
  };
}

describe('useMentionInput — candidate ordering matches the resolved (displayed) name', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockResolvedValue({ data: null });
  });

  it('Tier 1 (empty query, alphabetical): sorts by the ROSTER name, not the stale raw fields on the User object', async () => {
    // Raw fields say B < A ("Aaa Stale" < "Zzz Stale" would put... — here we
    // sabotage them to reverse the roster order below).
    const users = [
      {
        address: ADDR_A,
        displayName: 'Zzz Stale', // wrong on purpose
        globalDisplayName: 'Zzz Stale',
        primaryUsername: undefined,
      },
      {
        address: ADDR_B,
        displayName: 'Aaa Stale', // wrong on purpose
        globalDisplayName: 'Aaa Stale',
        primaryUsername: undefined,
      },
    ];

    // The roster (what <MemberName> actually renders) says the OPPOSITE order.
    const rosters = {
      [SPACE_ID]: {
        [ADDR_A]: { display_name: '', global_display_name: 'Aaron' },
        [ADDR_B]: { display_name: '', global_display_name: 'Bea' },
      },
    };

    const { result } = renderHook(
      (props: { textValue: string; cursorPosition: number }) =>
        useMentionInput({ ...props, users, onMentionSelect: () => {} }),
      {
        wrapper: wrapperFor(rosters),
        initialProps: { textValue: '@', cursorPosition: 1 },
      },
    );

    await waitFor(() => {
      expect(result.current.filteredOptions.length).toBeGreaterThan(0);
    });

    const order = result.current.filteredOptions.map((o) =>
      o.type === 'user' ? o.data.address : null,
    );
    // Roster order: Aaron (A) before Bea (B) — the opposite of what the raw
    // stale fields would produce.
    expect(order).toEqual([ADDR_A, ADDR_B]);
  });

  it('a member WITH a per-space nickname sorts by the nickname, not the global/raw fields', async () => {
    const users = [
      { address: ADDR_A, displayName: 'Stale A', globalDisplayName: 'Stale A', primaryUsername: undefined },
      { address: ADDR_B, displayName: 'Stale B', globalDisplayName: 'Stale B', primaryUsername: undefined },
    ];

    const rosters = {
      [SPACE_ID]: {
        // A's per-space nickname sorts AFTER B's, even though A's raw fields
        // (and A's global name) would sort first.
        [ADDR_A]: { display_name: 'Zed (mod)', global_display_name: 'Global A' },
        [ADDR_B]: { display_name: 'Amy (mod)', global_display_name: 'Global B' },
      },
    };

    const { result } = renderHook(
      (props: { textValue: string; cursorPosition: number }) =>
        useMentionInput({ ...props, users, onMentionSelect: () => {} }),
      {
        wrapper: wrapperFor(rosters),
        initialProps: { textValue: '@', cursorPosition: 1 },
      },
    );

    await waitFor(() => {
      expect(result.current.filteredOptions.length).toBeGreaterThan(0);
    });

    const order = result.current.filteredOptions.map((o) =>
      o.type === 'user' ? o.data.address : null,
    );
    // "Amy (mod)" < "Zed (mod)" — B's nickname sorts first.
    expect(order).toEqual([ADDR_B, ADDR_A]);
  });

  it('this HOOK never enriches on its own — no public-profile fetch is issued by useMentionInput itself (enrichment is MentionDropdown row-rendering, see mentionDropdownFetch.test.tsx)', async () => {
    const users = [
      { address: ADDR_A, displayName: '', globalDisplayName: 'Alice', primaryUsername: undefined },
    ];
    const rosters = { [SPACE_ID]: { [ADDR_A]: { display_name: '', global_display_name: 'Alice' } } };

    // No API mock implementation registered — if useMentionInput called
    // `request()`/`requestNames()` for a candidate, the unmocked fetch path
    // would throw inside the query and this test would fail via an
    // unhandled rejection / act() warning. The mention picker AS A WHOLE
    // does now enrich (design decision 3, revised), but the fetch is issued
    // by the RENDERING component (MentionDropdown's `<MemberName enrich>`
    // per row), never by this filtering/sorting hook.
    const { result } = renderHook(
      (props: { textValue: string; cursorPosition: number }) =>
        useMentionInput({ ...props, users, onMentionSelect: () => {} }),
      {
        wrapper: wrapperFor(rosters),
        initialProps: { textValue: '@', cursorPosition: 1 },
      },
    );

    await waitFor(() => {
      expect(result.current.filteredOptions.length).toBeGreaterThan(0);
    });
    expect(result.current.filteredOptions[0]).toMatchObject({
      type: 'user',
      data: { address: ADDR_A },
    });
    expect(getPublicProfile).not.toHaveBeenCalled();
  });

  it('typing the ".q" name finds a candidate whose profile is already resolved — filtering matches the SAME resolved name the dropdown would render, suffix included', async () => {
    // Global name and QNS handle deliberately DIFFER, so a match can only
    // come from the resolved/enriched name, never the raw globalDisplayName.
    const users = [
      { address: ADDR_A, displayName: '', globalDisplayName: 'Alice Wonderland', primaryUsername: undefined },
      { address: ADDR_B, displayName: '', globalDisplayName: 'Bob Builder', primaryUsername: undefined },
    ];
    const rosters = {
      [SPACE_ID]: {
        [ADDR_A]: { display_name: '', global_display_name: 'Alice Wonderland' },
        [ADDR_B]: { display_name: '', global_display_name: 'Bob Builder' },
      },
    };

    getPublicProfile.mockImplementation((address: string) =>
      address === ADDR_A
        ? Promise.resolve({ data: { primary_username: 'alicequeen', display_name: 'Alice Wonderland' } })
        : Promise.resolve({ data: null }),
    );

    const { result } = renderHook(
      (props: { textValue: string; cursorPosition: number }) =>
        useMentionInput({ ...props, users, onMentionSelect: () => {}, debounceMs: 10 }),
      {
        wrapper: wrapperFor(rosters, <Requester address={ADDR_A} />),
        initialProps: { textValue: '@alicequeen.q', cursorPosition: 13 },
      },
    );

    // Sanity: the raw fields alone (empty displayName, "Alice Wonderland"
    // globalDisplayName, no primaryUsername) would NOT match "alicequeen.q"
    // — only the resolved/enriched name does, once it lands.
    await waitFor(
      () => {
        expect(result.current.filteredOptions).toHaveLength(1);
      },
      { timeout: 3000 },
    );
    expect(result.current.filteredOptions[0]).toMatchObject({
      type: 'user',
      data: { address: ADDR_A },
    });
  });
});
