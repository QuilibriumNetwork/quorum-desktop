import { resolveDisplayName as resolveSharedDisplayName } from '@quilibrium/quorum-shared';

export interface ResolvedMemberName {
  /** The readable name to display. Never empty (falls back to the address). */
  name: string;
  /** True only when `name` is the QNS username — render with the ".q" suffix. */
  isQnsVerified: boolean;
}

interface ResolvableMember {
  displayName?: string | null;
  primaryUsername?: string | null;
  address: string;
}

/** Fields a `mapSenderToUser`/`resolveSender` result exposes for name resolution. */
export interface NameResolvableUser {
  displayName?: string;
  primaryUsername?: string;
  /** Global name from the public profile; lets resolveSpaceMemberName tell a
   *  per-space name from the global default. */
  globalDisplayName?: string;
  address?: string;
  userIcon?: string;
}

/**
 * Desktop (camelCase) adapter over the shared `resolveDisplayName` rule, the
 * single source of precedence: spaceOverrideName → QNS → displayName → address.
 * For DM/global contexts the QNS name wins over `displayName`; space contexts
 * use `resolveSpaceMemberName`. The ".q" suffix is applied at render
 * (`<ResolvedName>` / `formatResolvedName`), not baked into `name`.
 */
export function resolveMemberName(
  member: ResolvableMember,
  opts: { spaceOverrideName?: string | null } = {},
): ResolvedMemberName {
  const { name, isQnsVerified } = resolveSharedDisplayName(
    {
      address: member.address,
      display_name: member.displayName ?? undefined,
      primary_username: member.primaryUsername ?? undefined,
    },
    { spaceOverrideName: opts.spaceOverrideName },
  );
  return { name, isQnsVerified };
}

/**
 * Resolve a name shown in a SPACE context (roster / effectiveMembers). Use this,
 * not `resolveMemberName`, for any space-sourced name.
 *
 * The roster `displayName` can't say whether it's a deliberate per-space name or
 * just the global name echoed at join. We disambiguate by comparing it to
 * `globalDisplayName` (free — same public-profile fetch that carries the QNS
 * name): differs → deliberate, it wins; equal → QNS name wins; global unknown →
 * keep the roster name. See .agents/docs/features/qns-username-display.md.
 */
export function resolveSpaceMemberName(member: {
  displayName?: string | null;
  primaryUsername?: string | null;
  globalDisplayName?: string | null;
  address: string;
}): ResolvedMemberName {
  const roster = (member.displayName ?? '').trim();
  const global = (member.globalDisplayName ?? '').trim();
  const qns = (member.primaryUsername ?? '').trim();

  if (qns && roster && roster !== global) {
    return { name: roster, isQnsVerified: false };
  }

  return resolveMemberName({
    address: member.address,
    displayName: member.displayName,
    primaryUsername: member.primaryUsername,
  });
}

/**
 * Flatten a resolved name to a plain string for non-JSX contexts (input
 * placeholders, aria-labels, tooltip content, search match text). Appends the
 * ".q" suffix when the name is the verified QNS username. For JSX render sites,
 * prefer the `<ResolvedName>` component so the suffix can be accent-styled.
 */
export function formatResolvedName(resolved: ResolvedMemberName): string {
  return resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name;
}
