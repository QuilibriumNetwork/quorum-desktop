import {
  resolveIdentity,
  type MemberIdentity,
  type IdentityScope,
} from '@quilibrium/quorum-shared';
import { realDisplayNameOrUndefined } from './identityPlaceholder';

export interface ResolvedMemberName {
  /** The readable name to display. Never empty (falls back to the address). */
  name: string;
  /** True only when `name` is the QNS username — render with the ".q" suffix. */
  isQnsVerified: boolean;
}

/**
 * TEMPORARY desktop adapter over the shared rule.
 *
 * Exists only so the ~24 existing call sites keep compiling while they migrate
 * to `src/identity`. Deleted in Phase E — do NOT add new callers, the eslint
 * ratchet will reject them.
 */
const nullable = (v?: string | null): string | null => {
  const t = (v ?? '').trim();
  return t.length ? t : null;
};

const toIdentity = (m: {
  address: string;
  displayName?: string | null;
  primaryUsername?: string | null;
  globalDisplayName?: string | null;
  spaceOverrideName?: string | null;
}): MemberIdentity => ({
  address: m.address,
  spaceName: nullable(m.spaceOverrideName ?? m.displayName),
  qnsName: nullable(m.primaryUsername),
  globalName: nullable(m.globalDisplayName),
});

const run = (identity: MemberIdentity, scope: IdentityScope): ResolvedMemberName =>
  resolveIdentity(identity, { scope });

export function resolveMemberName(
  member: { displayName?: string | null; primaryUsername?: string | null; address: string },
  opts: { spaceOverrideName?: string | null } = {},
): ResolvedMemberName {
  // The stored `'Unknown User'` literal (in any active locale) is a
  // placeholder, not a name — demote it here, the single choke point every DM
  // /global-context name surface goes through, so the ladder falls through to
  // QNS and then the truncated address instead of rendering it verbatim. This
  // is what keeps the conversation header and the DM sidebar agreeing about an
  // unidentified partner; see
  // .agents/issues/2026-08-01-dm-partner-identity-lost-on-established-sessions.md.
  const globalName = nullable(realDisplayNameOrUndefined(member.displayName));

  // `spaceOverrideName` is dead — MEASURED by grep 2026-08-10, no caller passes
  // it. Mapped to the SPACE tier anyway rather than folded into globalName,
  // because folding it would invert the ladder for any caller that started
  // using it: an override is the most-specific tier, and the global name is the
  // comparator it is checked against. Getting that backwards is the exact
  // defect this whole change exists to make impossible.
  const override = nullable(opts.spaceOverrideName);
  if (override) {
    return run(
      {
        address: member.address,
        spaceName: override,
        qnsName: nullable(member.primaryUsername),
        globalName,
      },
      'space',
    );
  }

  return run(
    {
      address: member.address,
      // Global scope has no per-space tier; the caller's displayName IS the
      // global name here.
      spaceName: null,
      qnsName: nullable(member.primaryUsername),
      globalName,
    },
    'global',
  );
}

export interface NameResolvableUser {
  displayName?: string;
  primaryUsername?: string;
  globalDisplayName?: string;
  address?: string;
  userIcon?: string;
}

export function resolveSpaceMemberName(member: {
  displayName?: string | null;
  primaryUsername?: string | null;
  globalDisplayName?: string | null;
  address: string;
}): ResolvedMemberName {
  return run(toIdentity(member), 'space');
}

export function resolveNameForContext(
  user: {
    displayName?: string | null;
    primaryUsername?: string | null;
    globalDisplayName?: string | null;
    address: string;
  },
  { isDm = false }: { isDm?: boolean } = {},
): ResolvedMemberName {
  return isDm ? resolveMemberName(user) : resolveSpaceMemberName(user);
}

/**
 * Flatten a resolved name to a plain string for non-JSX contexts. Appends ".q"
 * when the name is the verified QNS username.
 */
export function formatResolvedName(resolved: ResolvedMemberName): string {
  return resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name;
}
