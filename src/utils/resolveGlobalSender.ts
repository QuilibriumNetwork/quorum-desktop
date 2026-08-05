import type { channel } from '@quilibrium/quilibrium-js-sdk-channels';

/**
 * Member shape consumed by the notification panel's name resolution
 * (`resolveSpaceMemberName`). Mirrors the per-space `mapSenderToUser` output so
 * the global panel can reuse the same render path. `globalDisplayName` comes
 * from the roster's global slot (not a public-profile fetch); `primaryUsername`
 * stays optional as it is unenriched here.
 */
export interface ResolvedGlobalSender {
  address: string;
  displayName?: string;
  userIcon?: string;
  primaryUsername?: string;
  globalDisplayName?: string;
}

type SpaceMemberRow = channel.UserProfile & {
  isKicked?: boolean;
  /** Roster GLOBAL slots (two-slot model) — the tier between the per-space
   *  override and the public profile. */
  global_display_name?: string;
  global_user_icon?: string;
};

/**
 * Pure core: given a map of spaceId -> roster (as returned by
 * `messageDB.getSpaceMembers`), build a synchronous resolver
 * `(spaceId, senderId) -> ResolvedGlobalSender`. Unknown sender/space falls back
 * to an address-only object so name resolvers show the address suffix.
 *
 * Pure (no React, no IndexedDB) so it is unit-testable in isolation; the
 * `useGlobalSenderResolver` hook wires the async fetch around it.
 */
export function buildGlobalSenderMap(
  membersBySpace: Record<string, SpaceMemberRow[]>,
): (spaceId: string, senderId: string) => ResolvedGlobalSender {
  const bySpace = new Map<string, Map<string, ResolvedGlobalSender>>();
  for (const [spaceId, rows] of Object.entries(membersBySpace)) {
    const map = new Map<string, ResolvedGlobalSender>();
    for (const row of rows) {
      // Same precedence as useMembersWithPublicProfileFallback: override wins
      // when non-empty, else the global slot. `globalDisplayName` is kept
      // SEPARATE so resolveSpaceMemberName can compare the two.
      const global = row.global_display_name || undefined;
      map.set(row.user_address, {
        address: row.user_address,
        displayName: row.display_name || global,
        userIcon: row.user_icon || row.global_user_icon || undefined,
        globalDisplayName: global,
      });
    }
    bySpace.set(spaceId, map);
  }

  return (spaceId: string, senderId: string): ResolvedGlobalSender => {
    return bySpace.get(spaceId)?.get(senderId) ?? { address: senderId };
  };
}
