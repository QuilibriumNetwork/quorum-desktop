// useRootIdentityScope — real data for the APP-ROOT <IdentityScopeProvider>
// (mounted in App.tsx, above the Router, above every Space/DM provider).
//
// Before this hook existed, the root provider shipped with a permanent
// `rostersBySpace={}` and no `locallyKnownNames` for self. That is invisible
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

  const locallyKnownNames = useMemo(
    () => selfLocalNameEntry(selfAddress, selfDisplayName),
    [selfAddress, selfDisplayName],
  );

  return { rostersBySpace, locallyKnownNames };
}
