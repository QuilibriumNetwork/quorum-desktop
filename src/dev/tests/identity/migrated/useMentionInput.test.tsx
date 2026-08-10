/**
 * useMentionInput — SORTING (Phase D row 19).
 *
 * The mention picker can span a whole roster, so it must NOT enrich (same
 * rule as the member sidebar / MentionDropdown, already migrated in row 10):
 * every candidate resolves from the roster maps already in memory, never a
 * per-address public-profile fetch. `userMatchesQuery` (filtering) was fixed
 * in that earlier row — this file covers what's left, the SORT, which used
 * to rank candidates via `resolveSpaceMemberName` run on the raw fields the
 * `User` object happened to carry (`displayName`/`primaryUsername`/
 * `globalDisplayName`), independent of the ambient roster.
 *
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
 */
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import { useMentionInput } from '@/hooks/business/mentions/useMentionInput';

const ADDR_A = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const ADDR_B = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

function wrapperFor(rosters: Record<string, Record<string, unknown>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
          {children}
        </IdentityScopeProvider>
      </QueryClientProvider>
    );
  };
}

describe('useMentionInput — candidate ordering matches the resolved (displayed) name', () => {
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

  it('does not enrich: no public-profile fetch is issued for any candidate', async () => {
    const users = [
      { address: ADDR_A, displayName: '', globalDisplayName: 'Alice', primaryUsername: undefined },
    ];
    const rosters = { [SPACE_ID]: { [ADDR_A]: { display_name: '', global_display_name: 'Alice' } } };

    // No API mock registered at all — if useMentionInput called `request()`
    // for a candidate, the unmocked fetch path would throw inside the query
    // and this test would fail via an unhandled rejection / act() warning.
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
  });
});
