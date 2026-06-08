// useMembersWithPublicProfileFallback
//
// Takes a member map (address -> { displayName?, userIcon?, ... }) plus a
// list of addresses currently rendered, and back-fills missing/empty
// entries by fetching the public-profile endpoint for each address.
//
// Resolution rule (matches mobile's behavior):
//   - If the local member has a populated displayName or userIcon, keep it.
//   - If the local member has neither, fill from the public profile when
//     available. Per-field merge: a field that's populated locally wins;
//     a field that's empty locally falls back to the public profile.
//   - Members not appearing in `visibleAddresses` are passed through
//     untouched — we don't fetch profiles for the entire space roster.
//
// IMPORTANT perf note (verbatim port from mobile source comment):
// `useQueries` returns a fresh array reference every render, so a naive
// `useMemo([..., queries])` would invalidate on every render even when
// nothing material changed — yielding a new map identity, which then
// forces every downstream memo (the messages array, virtualized list
// data, etc.) to recompute. With a busy chat that work piles up on the
// JS thread and starves things like input handling.
//
// Cache the result manually on a ref instead. We only rebuild when (a)
// `members` or `addressesToFetch` change identity, or (b) any of the
// per-address query data references changes — React Query keeps those
// stable until a refetch produces new data.
//
// Mirrors mobile's `hooks/useMembersWithPublicProfileFallback.ts`.
// Shape adapted to desktop's `members` map produced by `useChannelData`.

import { useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { QuorumApiClient, isHandledFetchError } from '../../../api/baseTypes';
import type { PublicProfileResponse } from '../../../api/baseTypes';
import { publicProfileQueryKey } from './useUserPublicProfile';

interface MemberRecord {
  address: string;
  userIcon?: string;
  displayName?: string;
  // Additional fields preserved opaquely (isKicked, spaceTag, joinedAt, etc).
  [extra: string]: unknown;
}

type MemberMap = { [address: string]: MemberRecord };

export function useMembersWithPublicProfileFallback(
  members: MemberMap,
  visibleAddresses: string[]
): MemberMap {
  // Determine which addresses need a public-profile query — addresses
  // where we have no local record, OR the record exists but has neither
  // displayName nor userIcon. Fully-populated members aren't queried.
  const addressesToFetch = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const addr of visibleAddresses) {
      if (!addr || seen.has(addr)) continue;
      seen.add(addr);
      const m = members[addr];
      if (!m || (!m.displayName && !m.userIcon)) {
        out.push(addr);
      }
    }
    return out;
  }, [members, visibleAddresses]);

  const queries = useQueries({
    queries: addressesToFetch.map((address) => ({
      queryKey: publicProfileQueryKey(address),
      queryFn: async (): Promise<PublicProfileResponse | null> => {
        try {
          const response = await new QuorumApiClient().getPublicProfile(address);
          return response.data;
        } catch (error: unknown) {
          if (isHandledFetchError(error) && error.status === 404) {
            return null;
          }
          throw error;
        }
      },
      staleTime: 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
    })),
  });

  // Snapshot the data refs once per render (cheap), then compare against
  // the previous-render cache before deciding whether to rebuild.
  const dataRefs: (PublicProfileResponse | null)[] = queries.map(
    (q) => q?.data ?? null
  );
  const cacheRef = useRef<{
    members: MemberMap;
    addressesToFetch: string[];
    dataRefs: (PublicProfileResponse | null)[];
    result: MemberMap;
  } | null>(null);

  const cached = cacheRef.current;
  const sameInputs =
    cached !== null &&
    cached.members === members &&
    cached.addressesToFetch === addressesToFetch &&
    cached.dataRefs.length === dataRefs.length &&
    cached.dataRefs.every((d, i) => d === dataRefs[i]);
  if (sameInputs) return cached!.result;

  let result: MemberMap;
  if (addressesToFetch.length === 0) {
    result = members;
  } else {
    const merged: MemberMap = { ...members };
    addressesToFetch.forEach((addr, i) => {
      const pub = dataRefs[i];
      if (!pub) return;
      const local = members[addr];
      // Per-field merge. A populated local field wins; an empty local
      // field falls back to the public profile.
      merged[addr] = {
        ...(local ?? { address: addr }),
        displayName: local?.displayName || pub.display_name || undefined,
        userIcon: local?.userIcon || pub.profile_image || undefined,
      };
    });
    result = merged;
  }

  cacheRef.current = { members, addressesToFetch, dataRefs, result };
  return result;
}
