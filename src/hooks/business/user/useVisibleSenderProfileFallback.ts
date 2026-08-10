// useVisibleSenderProfileFallback
//
// Replaces `useMembersWithPublicProfileFallback` (Phase D row 23). That hook
// used to be the NAME source for message rendering; it no longer is — the
// message header (`useResolvedMemberName`), the message body's mention pills
// (`useNameResolver`), the profile card (`useResolvedMemberName`), and the
// mention-pill click handler all resolve a member's DISPLAYED name from
// `src/identity` now, keyed on the address alone, independent of anything
// this hook returns.
//
// What's left, and why this hook still exists instead of being deleted:
//
//   - `userIcon` / `bio` are avatars/bios, never names. `src/identity`
//     deliberately does not resolve them (`MemberName` takes `userIcon` as a
//     caller-supplied prop) — see the identity migration recipe, design
//     constraint 4. Something still has to fetch them; this hook does.
//   - `primaryUsername` / `globalDisplayName` are consumed RAW (not as a
//     merged display string) by `useMentionInput.ts`'s `userMatchesQuery` —
//     mention-autocomplete SEARCH, so typing "@ali" still finds "alice" by
//     her QNS/global name. `useMentionInput.ts` is outside this migration's
//     scope (not one of Phase D rows 22-24) and reads these fields off plain
//     objects, not a hook per candidate, so it cannot call into
//     `src/identity` itself for a whole roster in a loop.
//   - `displayName` is kept too, but ITS public-profile fetch tier is
//     DROPPED — it now reads ONLY the raw roster (`local?.displayName ||
//     rosterGlobalName`, no `pub?.display_name` fallback). Its remaining live
//     consumer is `replaceMentionsWithDisplayNames` (quorum-shared), which
//     builds the small "replying to: ..." preview line above a message —
//     every OTHER surface that used to read `displayName` for real rendering
//     has migrated to `src/identity` and no longer touches this hook's
//     output at all (verified caller-by-caller; the vestigial
//     `primaryUsername`/`globalDisplayName` fields still threaded through
//     `onUserClick` payloads are click-payload leftovers UserProfile.tsx no
//     longer reads either, kept only because dropping them buys nothing).
//
// Why this hook can't just call `src/identity` itself for `displayName`:
// Channel.tsx (the sole caller) builds its `mapSenderToUser` in its own
// function body, which runs BEFORE `<IdentityScopeProvider>` — a DESCENDANT
// of what Channel.tsx returns, not an ancestor of Channel.tsx itself. Calling
// a `src/identity` hook from Channel's top level throws
// ("used outside <IdentityScopeProvider>"); see `ChannelTypingIndicator`
// in Channel.tsx for the existing pattern of splitting out a child component
// specifically to get inside the provider. Restructuring Channel.tsx's
// component boundaries to fix this is out of scope for this row.
//
// IMPORTANT perf note (unchanged from the original): `useQueries` returns a
// fresh array reference every render, so a naive `useMemo([..., queries])`
// would invalidate on every render even when nothing material changed.
// Cache the result manually on a ref instead.
//
// Mirrors mobile's `hooks/useMembersWithPublicProfileFallback.ts` for the
// fields mobile still needs; desktop's own name rendering has moved on.

import { useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { QuorumApiClient, isHandledFetchError } from '../../../api/baseTypes';
import type { PublicProfileResponse } from '../../../api/baseTypes';
import { publicProfileQueryKey } from './useUserPublicProfile';

interface MemberRecord {
  address: string;
  userIcon?: string;
  /** Roster-only fallback ladder now — see file header. NOT a full name
   *  resolution; do not use this for anything a person reads as "who sent
   *  this", only for the legacy reply-heading preview text. */
  displayName?: string;
  /** QNS primary username (no ".q" suffix). Read RAW by
   *  `useMentionInput.ts`'s search matching — not a rendered name. */
  primaryUsername?: string;
  /** The member's global display name, kept SEPARATE from `displayName` so
   *  `useMentionInput.ts` can match a query against it independently. */
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

export function useVisibleSenderProfileFallback(
  members: MemberMap,
  visibleAddresses: string[]
): MemberMap {
  // Fetch every visible sender's public profile — the only source of
  // primary_username, and (with the roster global slot) of userIcon/bio.
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
      const rosterGlobalName = local?.globalDisplayName;
      const rosterGlobalIcon = local?.globalUserIcon;
      const rosterGlobalBio = local?.globalBio;
      // Nothing to add for this member (no public profile AND no roster global
      // slots) — leave the local record untouched.
      if (!pub && !rosterGlobalName && !rosterGlobalIcon && !rosterGlobalBio) return;
      merged[addr] = {
        ...(local ?? { address: addr }),
        // Roster-only now (no `pub?.display_name` tier) — see file header:
        // the only live consumer left is the reply-heading preview text.
        displayName: local?.displayName || rosterGlobalName || undefined,
        userIcon: local?.userIcon || rosterGlobalIcon || pub?.profile_image || undefined,
        bio: (local?.bio as string | undefined) || rosterGlobalBio || pub?.bio || undefined,
        // QNS primary username: only the public profile carries it.
        primaryUsername:
          (local?.primaryUsername as string | undefined) ||
          pub?.primary_username ||
          undefined,
        // Kept SEPARATE from `displayName` for `useMentionInput.ts`'s search
        // matching. Prefers the live roster global slot over the public one.
        globalDisplayName: rosterGlobalName || pub?.display_name || undefined,
      };
    });
    result = merged;
  }

  cacheRef.current = { members, addressesToFetch, dataRefs, result };
  return result;
}
