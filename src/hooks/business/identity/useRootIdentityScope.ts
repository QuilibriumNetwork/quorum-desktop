// useRootIdentityScope — real data for the APP-ROOT <IdentityScopeProvider>
// (mounted in App.tsx, above the Router, above every Space/DM provider).
//
// Before this hook existed, the root provider shipped with a permanent
// `rostersBySpace={}` and no `locallyKnownNames` at all. That is invisible
// for almost every surface, because almost every surface mounts its OWN
// scoped provider (Channel, DirectMessage, BookmarksPage, ReactionsModal,
// SearchResults, GlobalNotificationsModal, MessagePreview...) which shadows
// the root entirely — React context resolves to the NEAREST provider, so an
// empty root never mattered to any of them.
//
// It mattered to the handful of surfaces that have no provider of their own
// and render directly from an app-level host ABOVE every Space/DM provider:
// `ModalProvider`'s Kick/Mute/Block confirmations (see
// `.agents/issues/2026-08-10-...`), and the nav rail's own avatar/name (no
// spaceId, so rosters are irrelevant there — see `selfLocalNameEntry`, the
// other half of this fix). Those surfaces have nothing to fall back to but
// the root, so the root has to actually know something.
//
// `locallyKnownNames` now also carries every DM partner's LOCAL conversation
// name (`useLocalDmNames`), not just self's — a DM partner who never
// published a public profile and is in no space roster (a DM contact, not a
// space member) used to resolve fine inside `DirectMessage.tsx`/
// `DirectMessageContactsList.tsx` (which each built this map by hand) and
// fall to a truncated address literally everywhere else, including a
// surface with NO provider of its own. **This is the reusable SOURCE, not a
// context-propagation trick**: exactly like `useMultiSpaceRosters`, any
// OTHER detached surface that mounts its own scoped provider (`SearchResults`
// is the confirmed case — DM search results) must call `useLocalDmNames`
// itself too, because a nested `<IdentityScopeProvider>` still shadows this
// one completely. Fixing this hook alone only reaches app-level-host
// surfaces with no provider of their own, same as bug B.
//
// See .agents/docs/features/identity-resolution-and-profile-sync.md, "Why a
// surface can still fall through with a populated root" for the cost/design
// tradeoffs recorded when this was built.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import {
  buildSpacesFetcher,
  buildSpacesKey,
} from '../../queries/spaces';
import { useMultiSpaceRosters } from './useMultiSpaceRosters';
import { useLocalDmNames } from './useLocalDmNames';
import { selfLocalNameEntry, type RosterNameRow } from '../../../identity';

const EMPTY_SPACES: Space[] = [];

export interface RootIdentityScopeResult {
  rostersBySpace: Record<string, Record<string, RosterNameRow>>;
  locallyKnownNames: Record<string, string>;
}

/**
 * Builds the two data props the root `<IdentityScopeProvider>` needs.
 *
 * Deliberately a PLAIN `useQuery`, not the suspense-backed `useSpaces()`
 * every other caller (Channel, GlobalNotificationsModal, MessagePreview,
 * ReactionsModal, SearchResults) uses. This hook runs inside `App.tsx`,
 * ABOVE the Router's own Suspense boundary, wrapping every branch —
 * onboarding, dev routes, the "Connecting" screen, and the authenticated
 * app. A suspense read here would force ALL FOUR branches through a
 * fallback-then-remount on first load, which is a much bigger behavioural
 * change than "the root now knows the user's rosters" — see the cost note
 * in the report this hook shipped with.
 *
 * A plain `useQuery` instead just re-renders once the (local, IndexedDB-only)
 * read resolves — typically inside a frame, since `messageDB.getSpaces()`
 * touches no network — and shares the exact same query key
 * (`buildSpacesKey({})`) every `useSpaces()` caller already uses, so this
 * never duplicates a fetch: whichever of "root mounts first" or "a Space tab
 * mounts first" runs first just warms the cache for the other.
 *
 * `enabled: !!selfAddress` — this hook runs before authentication completes
 * (App.tsx renders unconditionally), and `messageDB.getSpaces()` before a
 * user is signed in has nothing to read.
 */
export function useRootIdentityScope(
  selfAddress: string | null | undefined,
  selfDisplayName: string | null | undefined,
): RootIdentityScopeResult {
  const { messageDB } = useMessageDB();

  const { data: spaces = EMPTY_SPACES } = useQuery({
    queryKey: buildSpacesKey({}),
    queryFn: buildSpacesFetcher({ messageDB }),
    enabled: !!selfAddress,
    networkMode: 'always', // IndexedDB, not the network
  });

  const spaceIds = useMemo(() => spaces.map((s) => s.spaceId), [spaces]);
  const rostersBySpace = useMultiSpaceRosters(spaceIds);

  // Every DM partner's locally-known name (`useLocalDmNames` — local
  // IndexedDB conversations, no network, shares its query key with the DM
  // sidebar's own read) merged with self's device display name
  // (`selfLocalNameEntry`). Neither address space overlaps in practice (self
  // is never its own DM partner), so the merge order doesn't matter; both
  // sides already return the shared stable empty object when they have
  // nothing to contribute, so this only allocates a new object when the
  // underlying data actually changes.
  const localDmNames = useLocalDmNames(selfAddress);
  const locallyKnownNames = useMemo(() => {
    const selfEntry = selfLocalNameEntry(selfAddress, selfDisplayName);
    if (Object.keys(localDmNames).length === 0) return selfEntry;
    if (Object.keys(selfEntry).length === 0) return localDmNames;
    return { ...localDmNames, ...selfEntry };
  }, [selfAddress, selfDisplayName, localDmNames]);

  return { rostersBySpace, locallyKnownNames };
}
