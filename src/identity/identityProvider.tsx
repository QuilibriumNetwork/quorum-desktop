import * as React from 'react';
import { useQueries } from '@tanstack/react-query';
import type { MemberIdentity } from '@quilibrium/quorum-shared';
import { QuorumApiClient, isHandledFetchError } from '../api/baseTypes';
import type { PublicProfileResponse } from '../api/baseTypes';
import { publicProfileQueryKey } from '../hooks/business/user/useUserPublicProfile';

// Stable reference for callers that pass no `locallyKnownNames` (every Space
// surface) — a fresh `{}` literal on every render would invalidate the
// provider's `sources`/`value` memo on every render for those callers.
const EMPTY_LOCAL_NAMES: Record<string, string> = {};

/** The roster fields the identity needs. Mirrors SpaceMemberRow's name slots. */
export interface RosterNameRow {
  display_name?: string | null;
  global_display_name?: string | null;
}

export interface IdentitySources {
  /** spaceId -> address -> roster row. Local, from messageDB.getSpaceMembers. */
  rostersBySpace: Record<string, Record<string, RosterNameRow>>;
  /** address -> public profile. The ONLY source of primary_username. */
  profiles: Record<string, PublicProfileResponse | null>;
  selfAddress: string | null;
  selfProfile: PublicProfileResponse | null;
  /**
   * address -> a name known LOCALLY, with no network round-trip. Fed by a
   * caller that already has this in memory — today that's a DM's
   * `Conversation.displayName` (learned from a peer broadcast or a decrypted
   * message frame; see `.agents/issues/2026-08-01-dm-partner-identity-lost-on-established-sessions.md`).
   * Spaces have a roster instead and pass `{}` here.
   *
   * LAST `globalName` tier, after the roster global slot and the fetched
   * profile: a published profile is authoritative when present, the local
   * name is what the peer told you directly (still real, just unverified),
   * and a truncated address is the fallback only when NOTHING knows a name.
   * This is design constraint 5 — DM identity must render from what's
   * already local, without waiting on a fetch — stated as data instead of
   * as a per-surface special case.
   */
  locallyKnownNames: Record<string, string>;
}

const nn = (v?: string | null): string | null => {
  const t = (v ?? '').trim();
  return t.length ? t : null;
};

/**
 * Self's entry for `IdentitySources.locallyKnownNames` — the device's own
 * `currentPasskeyInfo.displayName`, used ONLY as the LAST `globalName`
 * source, below the roster global slot and the published profile.
 *
 * Why this exists: self's identity deliberately stopped reading from
 * `currentPasskeyInfo` as a PRIMARY source (it carries no QNS name — see
 * `identityFromMaps`'s `isSelf` branch), which fixed four real bugs. But that
 * left self with only the fetched public profile as a name source, and
 * desktop never publishes a primary username — so a user whose public
 * profile carries no `display_name` had NO name source at all and fell to a
 * truncated address, in their own nav rail and their own DM messages. This
 * is the same shape as a DM partner's `locallyKnownNames` entry (see that
 * field's own docstring): a name known locally, with no network round-trip,
 * used as a last resort before the address — it can never supply a `.q`,
 * because a device display name is not a QNS name.
 *
 * Returns the stable `{}` reference when there is nothing to contribute, so
 * a caller building a provider's `locallyKnownNames` doesn't invalidate its
 * own memo on every render passing an entry that resolves to empty.
 */
export function selfLocalNameEntry(
  address: string | null | undefined,
  displayName: string | null | undefined,
): Record<string, string> {
  const name = nn(displayName);
  if (!address || !name) return EMPTY_LOCAL_NAMES;
  return { [address]: name };
}

/**
 * Pure tier assembly. Kept separate from React so the merge is unit-testable
 * and so a virtualised list can resolve 200 rows from maps already in memory
 * without registering 200 query observers (design constraint 1).
 */
export function identityFromMaps(
  address: string,
  spaceId: string | undefined,
  sources: IdentitySources,
): MemberIdentity {
  const row = spaceId ? sources.rostersBySpace[spaceId]?.[address] : undefined;
  const isSelf = !!sources.selfAddress && sources.selfAddress === address;
  // Self's identity comes from its own public profile. `currentPasskeyInfo` is
  // the device-local auth record and carries no QNS name.
  const profile = isSelf ? sources.selfProfile : (sources.profiles[address] ?? null);

  return {
    address,
    // Only a real space context can have a per-space nickname.
    spaceName: nn(row?.display_name),
    qnsName: nn(profile?.primary_username),
    // Prefer the live roster global slot, then the published profile, then a
    // name known only locally (no fetch) — never a second, parallel lookup
    // path; this is the one place the tiers merge.
    globalName:
      nn(row?.global_display_name) ??
      nn(profile?.display_name) ??
      nn(sources.locallyKnownNames[address]),
  };
}

interface IdentityContextValue {
  sources: IdentitySources;
  /** Scope for call sites that do not pass a spaceId. */
  defaultSpaceId?: string;
  /** Ask for an address to be fetched if it is not already cached. */
  request: (address: string) => void;
}

const IdentityContext = React.createContext<IdentityContextValue | null>(null);

export const useIdentityContext = (): IdentityContextValue => {
  const ctx = React.useContext(IdentityContext);
  if (!ctx) {
    throw new Error(
      'useResolvedName/<MemberName> used outside <IdentityScopeProvider>. Wrap the route.',
    );
  }
  return ctx;
};

export const IdentityScopeProvider: React.FunctionComponent<{
  /** The Space this subtree lives in, if any. Absent for DMs and global views. */
  spaceId?: string;
  /** spaceId -> roster, already loaded by the caller (local IndexedDB read). */
  rostersBySpace: Record<string, Record<string, RosterNameRow>>;
  selfAddress: string | null;
  /** See `IdentitySources.locallyKnownNames`. Optional — Space surfaces have
   *  no local-name source and simply don't pass it. */
  locallyKnownNames?: Record<string, string>;
  children: React.ReactNode;
}> = ({ spaceId, rostersBySpace, selfAddress, locallyKnownNames = EMPTY_LOCAL_NAMES, children }) => {
  // Addresses that asked for a profile and are not in a roster-only render.
  const [requested, setRequested] = React.useState<ReadonlySet<string>>(new Set());
  const request = React.useCallback((address: string) => {
    if (!address) return;
    setRequested((prev) => (prev.has(address) ? prev : new Set(prev).add(address)));
  }, []);

  const addresses = React.useMemo(() => Array.from(requested), [requested]);

  const queries = useQueries({
    queries: addresses.map((address) => ({
      queryKey: publicProfileQueryKey(address),
      queryFn: async (): Promise<PublicProfileResponse | null> => {
        try {
          const response = await new QuorumApiClient().getPublicProfile(address);
          return response.data;
        } catch (error: unknown) {
          if (isHandledFetchError(error) && error.status === 404) return null;
          throw error;
        }
      },
      staleTime: 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
    })),
  });

  // `useQueries` returns a fresh array every render, so build the map from the
  // stable per-query data refs and memo on those — a naive dep on `queries`
  // invalidates every render and cascades through every consumer.
  const dataKey = queries.map((q) => q?.data ?? null);
  // Fingerprint on `dataUpdatedAt`, not on data presence: `setQueryData` (e.g.
  // useUserSettings.ts's self-profile-edit write) replaces the cached object
  // at an address that is ALREADY loaded — non-null before and after, so a
  // presence/truthy flag can't see the change. `dataUpdatedAt` is bumped by
  // every `setQueryData` write, so it is content-sensitive; it stays the same
  // number across renders where nothing changed, so it doesn't reintroduce
  // the fresh-array-every-render hazard the comment above guards against; and
  // joining it into one string keeps the deps array a constant two elements
  // regardless of how many addresses are requested (no variable-length spread).
  const updatedAtKey = queries.map((q) => q?.dataUpdatedAt ?? 0).join('|');
  const profiles = React.useMemo(() => {
    const map: Record<string, PublicProfileResponse | null> = {};
    addresses.forEach((a, i) => {
      map[a] = dataKey[i] ?? null;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, updatedAtKey]);

  const selfProfile = selfAddress ? (profiles[selfAddress] ?? null) : null;

  React.useEffect(() => {
    if (selfAddress) request(selfAddress);
  }, [selfAddress, request]);

  const value = React.useMemo<IdentityContextValue>(
    () => ({
      sources: { rostersBySpace, profiles, selfAddress, selfProfile, locallyKnownNames },
      defaultSpaceId: spaceId,
      request,
    }),
    [rostersBySpace, profiles, selfAddress, selfProfile, locallyKnownNames, spaceId, request],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
};
