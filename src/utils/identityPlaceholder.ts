// The "we don't know who this is yet" rule, in one place.
//
// `'Unknown User'` and the default avatar are PLACEHOLDERS written into storage
// when no identity is known — they are not a name and not a picture. Treating
// them as real values is what made the DM sidebar and the conversation header
// disagree: the header demoted them and fell through to the truncated address,
// the sidebar rendered them literally, so the same row read as "Unknown User"
// with a "?" avatar in one place and "QmYVto…LjDd" with a "Q" avatar in the
// other.
//
// The literal is stored in English at write time (MessageService /
// NewDirectMessageModal), so it is matched as a constant here and deliberately
// NOT run through the i18n macro — a translated UI must still recognise a row
// written before the language changed.
//
// Spaces have the same class of placeholder problem (see
// .agents/bugs/2026-06-13-space-members-missing-no-join-row.md); this module is
// the intended home for that rule too if it is fixed the same way.

import { DefaultImages } from '../utils';

/** The literal written to a conversation row when no identity is known. */
export const UNKNOWN_USER_PLACEHOLDER = 'Unknown User';

/** True when a stored display name carries no real identity. */
export const isPlaceholderDisplayName = (name?: string | null): boolean =>
  !name || name === UNKNOWN_USER_PLACEHOLDER;

/** True when a stored avatar carries no real identity. */
export const isPlaceholderIcon = (icon?: string | null): boolean =>
  !icon || icon === DefaultImages.UNKNOWN_USER;

/**
 * The display name if it is real, else `undefined` — so callers fall through
 * to whatever their next precedence step is (public profile, then address).
 */
export const realDisplayNameOrUndefined = (
  name?: string | null
): string | undefined => (isPlaceholderDisplayName(name) ? undefined : name!);

/**
 * The avatar if it is real, else `undefined` — so `UserAvatar` degrades to
 * address/name-derived initials rather than rendering a placeholder image.
 */
export const realIconOrUndefined = (
  icon?: string | null
): string | undefined => (isPlaceholderIcon(icon) ? undefined : icon!);
