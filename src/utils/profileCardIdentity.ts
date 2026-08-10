import {
  resolveMemberName,
  resolveSpaceMemberName,
  type ResolvedMemberName,
} from './resolveMemberName';

/**
 * The profile card's identity rules, extracted so they can be tested without
 * mounting a component with sixteen hooks.
 *
 * The card is the one name surface that may have to FETCH to do its job. Every
 * other surface is handed an already-enriched member; the card can be opened
 * from the member sidebar, which deliberately never fetches per-member profiles
 * (roster-wide fetch storm), so it tops up on demand for the one member on
 * screen.
 */

export interface ProfileCardUser {
  address: string;
  displayName?: string | null;
  primaryUsername?: string | null;
  globalDisplayName?: string | null;
}

/** The public-profile fields the card tops up from. */
export interface FetchedPublicProfile {
  primary_username?: string | null;
  display_name?: string | null;
}

/**
 * Should the card fetch this user's public profile?
 *
 * **It must not exclude your own profile, and it used to.** The exclusion read
 * as obviously safe — surely we know our own identity — but we do not:
 * `currentPasskeyInfo` is the device-local auth record and carries no
 * `primary_username`. Nothing else supplied one either.
 *
 * The damage was doubled by the fact that ONE fetch feeds TWO fields. Skipping
 * it cost the card both:
 *
 *   - `primary_username`, so there was no ".q" to promote; and
 *   - `display_name`, the GLOBAL name, which is what the space resolver
 *     compares the roster name against. With it absent, `roster !== global`
 *     trivially held and the roster name was returned as though it were a
 *     deliberate per-space choice.
 *
 * So your own card showed your global name while every other member's card
 * showed their ".q" — from the same code, on the same screen.
 *
 * The cost of not excluding it is nil in practice: your own public profile is
 * the same 1h-cached `publicProfileQueryKey` that the channel and the user
 * settings modal already fetch.
 */
export function profileCardNeedsProfileFetch(user: ProfileCardUser): boolean {
  return !user.primaryUsername;
}

/**
 * Merge what the caller passed with what was fetched, then resolve.
 *
 * `spaceId` decides the ladder: inside a space a deliberate per-space name
 * outranks the ".q"; outside one there is no per-space tier at all.
 */
export function resolveProfileCardName(
  user: ProfileCardUser,
  fetched: FetchedPublicProfile | null | undefined,
  { spaceId }: { spaceId?: string } = {},
): ResolvedMemberName {
  const primaryUsername =
    user.primaryUsername || fetched?.primary_username || undefined;
  const globalDisplayName =
    user.globalDisplayName || fetched?.display_name || undefined;

  return spaceId
    ? resolveSpaceMemberName({
        address: user.address,
        displayName: user.displayName,
        primaryUsername,
        globalDisplayName,
      })
    : resolveMemberName({
        address: user.address,
        displayName: user.displayName,
        primaryUsername,
      });
}
