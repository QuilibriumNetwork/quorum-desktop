// Merge rules for a DM partner's identity (display name + avatar) arriving on
// an incoming frame, applied against what we already have stored on the
// conversation row.
//
// THE RULE: an EMPTY incoming field means "absent", never "clear it".
//
// This is not a style preference — `??` here is a live data-loss bug. The
// persist guard (`hasProfileContent`) is truthy, so a frame carrying a real
// display_name but a blank user_icon (any partner who has not set an avatar)
// passes the guard and reaches the merge. With `??`, that blank overwrites a
// perfectly good stored icon, because `'' ?? x` is `''`.
//
// A deliberate clear is expressed elsewhere and never as an empty field on an
// ordinary frame: `dm-update-profile` carries explicit intent, and its handler
// (MessageService.handleDMProfileUpdate) is likewise truthy-guarded. Mobile
// applies the same `||` semantics on its equivalent merge
// (quorum-mobile context/WebSocketContext.tsx ~4740).
//
// See 2026-08-01-dm-partner-identity-lost-on-established-sessions.md under .agents/issues/

/** The identity fields carried on a decrypted frame / SDK `UserProfile`. */
export interface IncomingPartnerProfile {
  display_name?: string;
  user_icon?: string;
}

/**
 * True when an incoming profile carries anything worth persisting. Mirrors the
 * merge's own notion of "present": whitespace-free emptiness is absence.
 */
export const hasProfileContent = (
  profile?: IncomingPartnerProfile
): boolean => Boolean(profile?.display_name || profile?.user_icon);

/**
 * Prefer a non-empty incoming profile field over the stored one.
 *
 * Overloaded so a caller merging against a guaranteed-present stored value
 * (an existing conversation row) gets `string` back rather than
 * `string | undefined`.
 */
export function preferIncomingProfileField(
  incoming: string | undefined,
  stored: string
): string;
export function preferIncomingProfileField(
  incoming: string | undefined,
  stored: string | undefined
): string | undefined;
export function preferIncomingProfileField(
  incoming: string | undefined,
  stored: string | undefined
): string | undefined {
  return incoming || stored;
}
