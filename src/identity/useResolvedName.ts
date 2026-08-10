import * as React from 'react';
import { resolveIdentity, type MemberIdentity } from '@quilibrium/quorum-shared';
import { identityFromMaps, useIdentityContext } from './identityProvider';

export interface ResolvedMemberName {
  name: string;
  isQnsVerified: boolean;
}

export interface UseResolvedNameOptions {
  /** Override the surrounding scope. Detached surfaces (bookmarks, the
   *  notification panel) pass their own stored spaceId. */
  spaceId?: string;
  /** Force the global ladder even inside a Space. Rarely needed. */
  global?: boolean;
}

/**
 * Shared by `useMemberIdentity` and `useResolvedMemberName` so both get the
 * tiers AND `defaultSpaceId` from a single `useIdentityContext()` read,
 * instead of each hook reading the same context independently.
 */
function useMemberIdentityAndScope(
  address: string,
  spaceId: string | undefined,
): { identity: MemberIdentity; defaultSpaceId: string | undefined } {
  const { sources, defaultSpaceId, request } = useIdentityContext();
  React.useEffect(() => {
    request(address);
  }, [address, request]);
  const effectiveSpaceId = spaceId ?? defaultSpaceId;
  const identity = React.useMemo(
    () => identityFromMaps(address, effectiveSpaceId, sources),
    [address, effectiveSpaceId, sources],
  );
  return { identity, defaultSpaceId };
}

/** The identity behind a name, for callers that need the tiers. */
export function useMemberIdentity(
  address: string,
  { spaceId }: { spaceId?: string } = {},
): MemberIdentity {
  return useMemberIdentityAndScope(address, spaceId).identity;
}

/** The resolved name as a string, with ".q" when verified. For aria-labels,
 *  tooltips, notification bodies, modal payloads and search-match text. */
export function useResolvedName(
  address: string,
  opts: UseResolvedNameOptions = {},
): string {
  const r = useResolvedMemberName(address, opts);
  return r.isQnsVerified ? `${r.name}.q` : r.name;
}

/** The structured result, for callers that style the suffix. */
export function useResolvedMemberName(
  address: string,
  { spaceId, global = false }: UseResolvedNameOptions = {},
): ResolvedMemberName {
  const { identity, defaultSpaceId } = useMemberIdentityAndScope(address, spaceId);
  const scope = global || !(spaceId ?? defaultSpaceId) ? 'global' : 'space';
  return React.useMemo(
    () => resolveIdentity(identity, { scope }),
    [identity, scope],
  );
}
