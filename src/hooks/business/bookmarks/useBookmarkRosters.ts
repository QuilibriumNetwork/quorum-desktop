// useBookmarkRosters — build the multi-space `rostersBySpace` shape
// <IdentityScopeProvider> needs for the standalone /bookmarks page.
//
// Every other <IdentityScopeProvider> mount (Channel.tsx) lives inside a
// single Space and hands the provider that ONE space's roster. Bookmarks are
// different: the /bookmarks page renders bookmarks from EVERY space the user
// belongs to in one flat list, so a single-space roster map is not enough —
// the provider needs one roster per distinct spaceId represented on the page.
//
// Local IndexedDB reads only (no network), reusing the same query key/fetcher
// as `useSpaceMembers` so a space already open in a Channel tab is not
// re-fetched.

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { RosterNameRow } from '../../../identity';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { buildSpaceMembersFetcher } from '../../queries/spaceMembers/buildSpaceMembersFetcher';
import { buildSpaceMembersKey } from '../../queries/spaceMembers/buildSpaceMembersKey';

export function useBookmarkRosters(
  spaceIds: string[]
): Record<string, Record<string, RosterNameRow>> {
  const { messageDB } = useMessageDB();
  const uniqueSpaceIds = useMemo(
    () => Array.from(new Set(spaceIds.filter(Boolean))),
    [spaceIds]
  );

  const queries = useQueries({
    queries: uniqueSpaceIds.map((spaceId) => ({
      queryKey: buildSpaceMembersKey({ spaceId }),
      queryFn: buildSpaceMembersFetcher({ spaceId, messageDB }),
      networkMode: 'always' as const, // IndexedDB, not the network
      staleTime: 60 * 1000,
    })),
  });

  // Same fingerprinting approach as IdentityScopeProvider's own `profiles`
  // memo: `useQueries` returns a fresh array every render, so memo on a
  // stable per-query signal (`dataUpdatedAt`) rather than on `queries`
  // itself, or every consumer re-renders on every render of this hook.
  const dataKey = queries.map((q) => q.data ?? null);
  const updatedAtKey = queries.map((q) => q.dataUpdatedAt ?? 0).join('|');

  return useMemo(() => {
    const map: Record<string, Record<string, RosterNameRow>> = {};
    uniqueSpaceIds.forEach((spaceId, i) => {
      const rows: Record<string, RosterNameRow> = {};
      const members = dataKey[i] ?? [];
      for (const member of members) {
        if (!member.user_address) continue;
        rows[member.user_address] = {
          display_name: member.display_name,
          global_display_name: member.global_display_name,
        };
      }
      map[spaceId] = rows;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueSpaceIds, updatedAtKey]);
}
