import {
  hasReservedQnsSuffix,
  resolveDisplayName as resolveSharedDisplayName,
} from '@quilibrium/quorum-shared';
import { realDisplayNameOrUndefined } from './identityPlaceholder';

/**
 * A stored name that would forge the verified-QNS marker is not a name.
 *
 * Shared's `resolveDisplayName` enforces this for every tier it resolves, so
 * `resolveMemberName` below inherits it for free. `resolveSpaceMemberName` does
 * NOT — it implements the ladder itself and returns before ever reaching
 * shared, except in the all-empty case where there is nothing left to forge.
 *
 * That gap mattered: `resolveSpaceMemberName` is what messages, mentions,
 * reactions, notifications, pinned messages and the channel view all call, so
 * the shared guard covered DMs and left every space context exposed. A display
 * name of `alice.q` renders identically to a name somebody registered and
 * elected primary — `isQnsVerified` is computed and never rendered, so the
 * suffix is the only signal a viewer gets.
 *
 * Applied BEFORE the roster-vs-global echo comparison, not after. A forged
 * roster name must not merely lose to the global name, it must not participate:
 * were it compared raw, `roster !== global` would read as a deliberate
 * per-space name and return the forged string outright.
 *
 * The real fix is to make this function delegate to shared like its sibling
 * does, so there is one ladder rather than two. That is a larger change; this
 * closes the hole in the meantime.
 */
const unreserved = (value: string): string =>
  value && hasReservedQnsSuffix(value) ? '' : value;

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
      // The stored `'Unknown User'` literal is a placeholder, not a name.
      // Demote it here — the single choke point every name surface goes
      // through — so the ladder continues to QNS and then the truncated
      // address instead of rendering the placeholder verbatim. Without this
      // the sidebar showed "Unknown User" while the header, which demoted it
      // inline, showed the address for the very same row.
      display_name: realDisplayNameOrUndefined(member.displayName),
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
  const roster = unreserved((member.displayName ?? '').trim());
  const global = unreserved((member.globalDisplayName ?? '').trim());
  const qns = unreserved((member.primaryUsername ?? '').trim());

  // A roster name that DIFFERS from the global one is a deliberate per-space
  // override and outranks everything.
  if (roster && roster !== global) {
    return { name: roster, isQnsVerified: false };
  }

  if (qns) return { name: qns, isQnsVerified: true };

  // The global slot is a real TIER, not just a comparator.
  //
  // It used to be neither returned nor fallen back to: callers reached the right
  // answer only when they happened to pass an ALREADY-MERGED displayName from
  // useMembersWithPublicProfileFallback. Callers passing the raw roster field —
  // the member sidebar is one — got a truncated address instead.
  //
  // That was latent while every roster row carried a stamped override. Once the
  // override is correctly empty (its normal state under the two-slot model), it
  // renders as an address for everyone. Closing it here rather than at each call
  // site, so no surface can miss the tier again.
  if (global) return { name: global, isQnsVerified: false };

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
