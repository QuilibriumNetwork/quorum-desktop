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
// MATCHING IS LOCALE-AWARE, AND HAS TO BE. The write sites use the Lingui `t`
// macro (NewDirectMessageModal.tsx, MessageService.ts), which evaluates at the
// ACTIVE LOCALE — so an Italian user's brand-new DM row is persisted as
// "Utente sconosciuto", not "Unknown User". Matching only the English literal
// would treat that as a real name and render it verbatim forever, which is the
// exact bug this module exists to kill, just scoped to non-English users.
//
// So we match BOTH: the English literal (rows written by an English client, or
// before a language switch) AND the current locale's translation. Neither alone
// is sufficient, because a single row's language depends on the locale that was
// active when it was written, which can differ from the one active now.
//
// Spaces have the same class of placeholder problem (see
// .agents/bugs/2026-06-13-space-members-missing-no-join-row.md); this module is
// the intended home for that rule too if it is fixed the same way.

import { t } from '@lingui/core/macro';
import { DefaultImages } from '../utils';

/**
 * The canonical (English) literal. Rows may hold a translation of this instead
 * — always test with `isPlaceholderDisplayName`, never `=== this`.
 */
export const UNKNOWN_USER_PLACEHOLDER = 'Unknown User';

/**
 * The active locale's rendering of the placeholder, or undefined if no locale
 * is activated yet.
 *
 * Lingui THROWS on a translation call before `dynamicActivate` has run, and
 * this predicate is reachable from render paths that can execute during early
 * startup. An identity check must never be the thing that breaks the app, so a
 * missing locale degrades to "English literal only" rather than propagating.
 */
const localisedPlaceholder = (): string | undefined => {
  try {
    return t`Unknown User`;
  } catch {
    return undefined;
  }
};

/** True when a stored display name carries no real identity, in any locale. */
export const isPlaceholderDisplayName = (name?: string | null): boolean =>
  !name || name === UNKNOWN_USER_PLACEHOLDER || name === localisedPlaceholder();

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
