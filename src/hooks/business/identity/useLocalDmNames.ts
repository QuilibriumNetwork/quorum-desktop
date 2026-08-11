// useLocalDmNames — every DM partner's LOCALLY-known name (address -> name),
// for any surface's `<IdentityScopeProvider locallyKnownNames={...}>`.
//
// Companion to `useMultiSpaceRosters`: that hook is independently called by
// every detached, multi-space surface (`useRootIdentityScope`, `SearchResults`,
// `GlobalNotificationsModal`, `MessagePreview`, `ReactionsModal`) to build its
// OWN `rostersBySpace`, because a `<IdentityScopeProvider>` mount shadows every
// ancestor provider — nothing merges with what a parent scope already knows.
// `locallyKnownNames` had no equivalent reusable source: before this hook,
// `DirectMessage.tsx` and `DirectMessageContactsList.tsx` each built their own
// address->name map by hand, from the same underlying conversations query, and
// every OTHER surface (the root provider, `SearchResults`) had none at all — a
// DM partner known only from a local `Conversation.displayName` (a peer
// broadcast or a decrypted message frame, no public profile ever published)
// resolved fine inside the two DM surfaces and fell to a truncated address
// everywhere else, including DM search results.
//
// Source: the SAME query key/fetcher `useConversations({ type: 'direct' })`
// already uses (`buildConversationsKey`/`buildConversationsFetcher`), so a
// conversation list already loaded by the DM sidebar is not re-fetched — this
// hook and the sidebar's suspense-backed infinite query share one cache entry.
//
// Deliberately a PLAIN (non-suspense) `useInfiniteQuery`, matching
// `useRootIdentityScope`'s own `spaces` read: this hook is called from
// `useRootIdentityScope`, which runs inside `App.tsx`, ABOVE the Router's
// Suspense boundary — a suspending read there would force every branch
// (onboarding, dev routes, "Connecting", the authenticated app) through a
// fallback-then-remount on first load. `enabled: !!selfAddress` for the same
// reason `useRootIdentityScope`'s spaces read is gated: this runs before
// authentication completes, and `messageDB.getConversations` before a user is
// signed in has nothing to read.
//
// Only the pages already cached/loaded are read — this never calls
// `fetchNextPage()`, so it costs nothing beyond what the DM sidebar's own
// polling already fetches. A DM partner far enough down an unusually large
// conversation list to sit on a page nobody has scrolled to yet is not covered
// here; that is the same bound `DirectMessageContactsList.tsx` already lives
// with for its own rendering.
import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { buildConversationsFetcher } from '../../queries/conversations/buildConversationsFetcher';
import { buildConversationsKey } from '../../queries/conversations/buildConversationsKey';
import { realDisplayNameOrUndefined } from '../../../utils/identityPlaceholder';

const EMPTY_LOCAL_NAMES: Record<string, string> = {};

export interface LocalConversationLike {
  address?: string;
  displayName?: string | null;
}

/**
 * The RULE, extracted so a caller that already has a conversations list in
 * scope for its OWN rendering (`DirectMessageContactsList.tsx` fetches one to
 * render the sidebar itself) can build the identity map from data it already
 * has instead of opening a second `useInfiniteQuery` subscription on the same
 * cache entry. `useLocalDmNames` below is the other caller: for a surface
 * with no conversations list of its own (the root provider, `SearchResults`),
 * it owns the fetch too. Same shape as `realDisplayNameOrUndefined` itself —
 * a pure function two different data-acquisition paths both funnel through,
 * so the placeholder rule only has one place to go wrong.
 */
export function buildLocalDmNames(
  conversations: readonly LocalConversationLike[],
): Record<string, string> {
  const map: Record<string, string> = {};
  let any = false;
  for (const c of conversations) {
    const name = realDisplayNameOrUndefined(c?.displayName);
    if (name && c?.address) {
      map[c.address] = name;
      any = true;
    }
  }
  return any ? map : EMPTY_LOCAL_NAMES;
}

export function useLocalDmNames(
  selfAddress: string | null | undefined,
): Record<string, string> {
  const { messageDB } = useMessageDB();

  const { data } = useInfiniteQuery({
    initialPageParam: undefined as unknown,
    queryKey: buildConversationsKey({ type: 'direct' }),
    queryFn: buildConversationsFetcher({ messageDB, type: 'direct' }),
    enabled: !!selfAddress,
    networkMode: 'always', // IndexedDB, not the network
    getNextPageParam: (lastPage: any) => lastPage?.nextCursor,
    getPreviousPageParam: (firstPage: any) => firstPage?.prevCursor,
  });

  // `data` is `undefined` until the (local, IndexedDB-only) read resolves, and
  // stays `undefined` forever if it fails — both degrade to "no local names",
  // never a throw. See the hook's own docstring, "must not suspend or throw".
  const conversations = useMemo(() => {
    const pages = (data as { pages?: unknown[] } | undefined)?.pages;
    if (!Array.isArray(pages)) return [];
    return pages.flatMap((page) => {
      const list = (page as { conversations?: unknown[] } | undefined)
        ?.conversations;
      return Array.isArray(list) ? list : [];
    });
  }, [data]);

  return useMemo(
    () => buildLocalDmNames(conversations as LocalConversationLike[]),
    [conversations],
  );
}
