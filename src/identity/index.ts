export { IdentityScopeProvider, identityFromMaps } from './identityProvider';
export type { RosterNameRow, IdentitySources } from './identityProvider';
export { MemberName } from './MemberName';
export {
  useResolvedName,
  useResolvedMemberName,
  useMemberIdentity,
} from './useResolvedName';
export type { ResolvedMemberName, UseResolvedNameOptions } from './useResolvedName';
// Re-exported so a migrating call site never needs a second import from
// quorum-shared just to type a variable or helper parameter holding what
// useMemberIdentity returns, or to name the ladder useResolvedMemberName picks.
export type { MemberIdentity, IdentityScope } from '@quilibrium/quorum-shared';
