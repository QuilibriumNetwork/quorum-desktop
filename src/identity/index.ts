export { IdentityScopeProvider, identityFromMaps } from './identityProvider';
export type { RosterNameRow, IdentitySources } from './identityProvider';
export { MemberName } from './MemberName';
export {
  useResolvedName,
  useResolvedMemberName,
  useMemberIdentity,
} from './useResolvedName';
export type { ResolvedMemberName, UseResolvedNameOptions } from './useResolvedName';
// Imperative/bulk resolution for surfaces that build many names outside
// JSX (raw DOM mention pills, a markdown token walk) and so cannot call a
// hook per address. See useNameResolver's docstring before reaching for
// this — a single-address surface should use <MemberName> instead.
export { useNameResolver } from './useNameResolver';
export type { NameResolver, NameResolverOptions } from './useNameResolver';
// Re-exported so a migrating call site never needs a second import from
// quorum-shared just to type a variable or helper parameter holding what
// useMemberIdentity returns, or to name the ladder useResolvedMemberName picks.
export type { MemberIdentity, IdentityScope } from '@quilibrium/quorum-shared';
