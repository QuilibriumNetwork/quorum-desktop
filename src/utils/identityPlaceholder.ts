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
// 2026-06-13-space-members-missing-no-join-row.md under .agents/issues/); this module is
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

const ELLIPSIS = '…';

/**
 * True when `name` is some truncated rendering of `address` — the shape a
 * RESOLVED fallback takes when it gets copy/pasted or round-tripped back into
 * storage (e.g. a `displayName` field seeded from what the UI showed, rather
 * than a name anyone actually set).
 *
 * Deliberately NOT tied to one truncation scheme's exact character counts:
 * this codebase has at least two (`formatAddress`'s default 6/6, and
 * quorum-shared `resolveDisplayName`'s own internal 6/4 fallback), and a
 * third could show up anywhere an address is shortened for display. Instead
 * of hard-coding either, this checks the SHAPE any truncation shares: text,
 * an ellipsis, more text, where the pieces either side of the ellipsis are
 * themselves a genuine prefix/suffix of the real address. That is robust to
 * a truncation format changing or a new one being added, and it is cheap —
 * both inputs are already lowercased by the caller.
 */
const isTruncatedFormOfAddress = (
  lowerName: string,
  lowerAddress: string
): boolean => {
  const idx = lowerName.indexOf(ELLIPSIS);
  if (idx <= 0 || idx >= lowerName.length - 1) return false; // no ellipsis, or nothing on one side of it
  const prefix = lowerName.slice(0, idx);
  const suffix = lowerName.slice(idx + 1);
  return lowerAddress.startsWith(prefix) && lowerAddress.endsWith(suffix);
};

/**
 * True when a stored display name carries no real identity, in any locale.
 *
 * `address`, when supplied, catches the shape that slipped through before:
 * a stored name that IS the member's own address (or a case-different
 * spelling of it, or a truncated rendering of it — see
 * `isTruncatedFormOfAddress`) is not a name, it's the resolver's OWN
 * fallback written back into storage. Rendering it verbatim is worse than
 * falling through to the resolver's fallback a second time, because the
 * resolver truncates and this would not — see
 * `.agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md`.
 *
 * `address` is OPTIONAL: several callers (the identity-coverage audit's
 * `hasRealName`, in particular) classify a value in isolation, with no
 * address in scope at that call site. Those callers still catch the literal
 * placeholder and empty/nullish; only the address-equality/truncation check
 * is skipped when `address` is absent — never a hard requirement, so no
 * existing caller breaks by omission.
 */
export const isPlaceholderDisplayName = (
  name?: string | null,
  address?: string | null
): boolean => {
  if (!name) return true;
  if (name === UNKNOWN_USER_PLACEHOLDER) return true;
  if (name === localisedPlaceholder()) return true;
  const lowerAddress = (address ?? '').trim().toLowerCase();
  if (!lowerAddress) return false;
  const lowerName = name.trim().toLowerCase();
  if (lowerName === lowerAddress) return true;
  return isTruncatedFormOfAddress(lowerName, lowerAddress);
};

/** True when a stored avatar carries no real identity. */
export const isPlaceholderIcon = (icon?: string | null): boolean =>
  !icon || icon === DefaultImages.UNKNOWN_USER;

/**
 * The display name if it is real, else `undefined` — so callers fall through
 * to whatever their next precedence step is (public profile, then address).
 */
export const realDisplayNameOrUndefined = (
  name?: string | null,
  address?: string | null
): string | undefined =>
  isPlaceholderDisplayName(name, address) ? undefined : name!;

/**
 * The avatar if it is real, else `undefined` — so `UserAvatar` degrades to
 * address/name-derived initials rather than rendering a placeholder image.
 */
export const realIconOrUndefined = (
  icon?: string | null
): string | undefined => (isPlaceholderIcon(icon) ? undefined : icon!);
