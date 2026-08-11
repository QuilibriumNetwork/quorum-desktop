import * as React from 'react';
import { resolveIdentity, type MemberIdentity } from '@quilibrium/quorum-shared';
import { identityFromMaps, useIdentityContext, type IdentitySources } from './identityProvider';
import { recordIfDegraded } from './diagnostics';

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
  /**
   * A label for the degraded-resolution diagnostic (dev builds only — see
   * `src/identity/diagnostics.ts`), so a fallback-to-address report names
   * the surface that rendered it instead of making the operator guess.
   * Optional: when omitted, the diagnostic falls back to a best-effort
   * guess from the call stack. Has no effect on what renders.
   */
  surface?: string;
  /**
   * Opt in to a public-profile fetch for this address. Default `false`: the
   * name resolves from the roster maps already in memory and issues NO
   * network request — a member with no cached profile renders their roster
   * name and no ".q". This only gates whether a request is ISSUED; a
   * profile some other enriched call site already fetched for the same
   * address is still read here, because `identityFromMaps` does not know or
   * care who asked (design decision 3).
   *
   * Only pass `true` on surfaces with bounded cardinality that genuinely
   * need the verified ".q" — bookmarks, notifications, message headers, DM
   * headers, the profile card. A virtualised list of members must NOT: one
   * request per rendered row is exactly the fetch storm the member
   * sidebar's no-fetch policy exists to prevent. See
   * `.agents/issues/.open/2026-08-10-identity-resolution-architecture-design.md`,
   * decision 3.
   */
  enrich?: boolean;
}

/**
 * Shared by `useMemberIdentity` and `useResolvedMemberName` so both get the
 * tiers AND `defaultSpaceId` from a single `useIdentityContext()` read,
 * instead of each hook reading the same context independently.
 *
 * `enrich` gates ONLY the `request()` call, i.e. whether a public-profile
 * fetch is issued for `address` — never the read. `identityFromMaps` (and so
 * the merge/ladder) is unchanged either way; a non-enriching call site still
 * renders a `.q` if the profile happens to already be cached from elsewhere.
 */
function useMemberIdentityAndScope(
  address: string,
  spaceId: string | undefined,
  enrich: boolean,
): { identity: MemberIdentity; defaultSpaceId: string | undefined; sources: IdentitySources } {
  const { sources, defaultSpaceId, request } = useIdentityContext();
  React.useEffect(() => {
    if (enrich) request(address);
  }, [address, enrich, request]);
  const effectiveSpaceId = spaceId ?? defaultSpaceId;
  const identity = React.useMemo(
    () => identityFromMaps(address, effectiveSpaceId, sources),
    [address, effectiveSpaceId, sources],
  );
  return { identity, defaultSpaceId, sources };
}

/** The identity behind a name, for callers that need the tiers. */
export function useMemberIdentity(
  address: string,
  { spaceId, enrich = false }: { spaceId?: string; enrich?: boolean } = {},
): MemberIdentity {
  return useMemberIdentityAndScope(address, spaceId, enrich).identity;
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
  { spaceId, global = false, enrich = false, surface }: UseResolvedNameOptions = {},
): ResolvedMemberName {
  const { identity, defaultSpaceId, sources } = useMemberIdentityAndScope(address, spaceId, enrich);
  const scope = global || !(spaceId ?? defaultSpaceId) ? 'global' : 'space';
  const effectiveSpaceId = spaceId ?? defaultSpaceId;

  // Dev-build-only (see diagnostics.ts) — fires the moment this resolution
  // fell through to the truncated-address fallback. An effect, not an inline
  // call, so it runs after commit (never during render) and re-fires only
  // when the resolved identity/scope actually changes, not on every
  // unrelated re-render of the surface that called this hook.
  React.useEffect(() => {
    recordIfDegraded({ identity, scope, sources, spaceId: effectiveSpaceId, surface });
  }, [identity, scope, sources, effectiveSpaceId, surface]);

  return React.useMemo(
    () => resolveIdentity(identity, { scope }),
    [identity, scope],
  );
}
