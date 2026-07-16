// useMembersWithPublicProfileFallback
//
// Takes a member map (address -> { displayName?, userIcon?, ... }) plus a
// list of addresses currently rendered, and enriches each visible member by
// fetching the public-profile endpoint for their address.
//
// Resolution rule:
//   - Per-field merge for displayName/userIcon/bio: a field that's populated
//     locally wins; an empty local field falls back to the public profile.
//   - primaryUsername (QNS) and globalDisplayName come ONLY from the public
//     profile, so every visible member is fetched — even fully-populated ones.
//     (globalDisplayName is what lets resolveSpaceMemberName tell a custom
//     per-space name apart from the global default echoed into the roster.)
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
  /** QNS primary username (no ".q" suffix — that's render-time). Sourced from
   *  the public-profile fallback so members we don't share fresh data with
   *  still show their verified name. */
  primaryUsername?: string;
  /** The member's GLOBAL display name (roster global slot if present, else the
   *  public profile). Kept SEPARATE from `displayName` (the roster override
   *  name) so resolveSpaceMemberName can compare the two to decide whether the
   *  roster name was deliberately set for the space. */
  globalDisplayName?: string;
  /** Roster GLOBAL avatar/bio slots (two-slot design) — the live-pushed global
   *  identity, consumed as the tier between the per-space override and the
   *  public profile. */
  globalUserIcon?: string;
  globalBio?: string;
  // Additional fields preserved opaquely (isKicked, spaceTag, joinedAt, etc).
  [extra: string]: unknown;
}

type MemberMap = { [address: string]: MemberRecord };

export function useMembersWithPublicProfileFallback(
  members: MemberMap,
  visibleAddresses: string[]
): MemberMap {
  // Fetch every visible sender's public profile (the only source of
  // primary_username + globalDisplayName), not just members missing a name.
  // Bounded to visible senders, never the whole roster; cached 1h.
  const addressesToFetch = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const addr of visibleAddresses) {
      if (!addr || seen.has(addr)) continue;
      seen.add(addr);
      out.push(addr);
    }
    return out;
  }, [visibleAddresses]);

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
      const local = members[addr];
      // Roster GLOBAL slots (two-slot design) — the live-pushed global identity,
      // the tier between the per-space override and the public profile. Works
      // for non-public users (no public profile). See identity-resolution doc.
      const rosterGlobalName = local?.globalDisplayName as string | undefined;
      const rosterGlobalIcon = (local as { globalUserIcon?: string } | undefined)?.globalUserIcon;
      const rosterGlobalBio = (local as { globalBio?: string } | undefined)?.globalBio;
      // The member's effective GLOBAL identity: prefer the live roster slot,
      // else the public profile. Used both as the render fallback below and
      // (as globalDisplayName) by resolveSpaceMemberName's custom-name compare.
      const effectiveGlobalName = rosterGlobalName || pub?.display_name || undefined;
      // Nothing to add for this member (no public profile AND no roster global
      // slots) — leave the local record untouched.
      if (!pub && !rosterGlobalName && !rosterGlobalIcon && !rosterGlobalBio) return;
      // Per-field precedence: per-space OVERRIDE → roster global slot →
      // public profile.
      merged[addr] = {
        ...(local ?? { address: addr }),
        displayName: local?.displayName || rosterGlobalName || pub?.display_name || undefined,
        userIcon: local?.userIcon || rosterGlobalIcon || pub?.profile_image || undefined,
        bio: (local?.bio as string | undefined) || rosterGlobalBio || pub?.bio || undefined,
        // QNS primary username: only the public profile carries it.
        primaryUsername:
          (local?.primaryUsername as string | undefined) ||
          pub?.primary_username ||
          undefined,
        // The member's global display name, kept SEPARATE from the roster
        // `displayName` so the space resolver can compare the two (custom-name
        // detection). Prefers the live roster global slot over the public one.
        globalDisplayName: effectiveGlobalName,
      };
    });
    result = merged;
  }

  cacheRef.current = { members, addressesToFetch, dataRefs, result };
  return result;
}
