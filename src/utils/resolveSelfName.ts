import { hasReservedQnsSuffix } from '@quilibrium/quorum-shared';

/**
 * Your OWN name, for surfaces that render you from the live auth profile rather
 * than from a roster row.
 *
 * Sibling of `resolveMemberName`, which is the rule for everybody else. They are
 * separate because the INPUTS are: another member resolves from a stored row
 * (per-space override, global slot, QNS name arriving with their public
 * profile), while your own settings screen has your live `currentPasskeyInfo`
 * plus your own public profile, and no roster row at all. The ORDER is the same,
 * and must stay that way.
 *
 * Ported from mobile's `utils/resolveSelfName.ts`. Only the placeholder is
 * ported so far — desktop's other own-name surfaces are not yet wired to it.
 */

export interface SelfNameInput {
  primaryUsername?: string | null;
  displayName?: string | null;
  /** DEPRECATED alias of `primaryUsername`; nothing writes it any more. */
  username?: string | null;
}

/**
 * The placeholder for a per-space name field (Space Settings → Account).
 *
 * ## A placeholder here is a PROMISE, not decoration
 *
 * Leaving that field empty is the default and means "follow my normal name".
 * The placeholder is how the user is told what that resolves to — so it has to
 * be the name the app would ACTUALLY render, or it is simply untrue. And this
 * is the one screen whose job is to explain the two-slot model, so a placeholder
 * that contradicts it teaches the wrong thing.
 *
 * Desktop's was a static `t`Display Name`` — not a promise at all, just a label
 * repeated inside the box. A user who had elected `alice.q` got no hint that
 * clearing the field would leave them rendered as `alice.q` everywhere.
 *
 * Mobile's equivalent was `displayName || username`, which got it wrong twice:
 * it ranked the global name above the QNS name, and `username` is the
 * deprecated alias of `primaryUsername`. That rung is kept last rather than
 * deleted, so a profile still carrying the old field keeps its placeholder.
 *
 * @param emptyLabel - the caller's copy for "we have no name for you", e.g.
 *   "Your name in this Space". Deliberately the caller's, so it can be a real
 *   instruction rather than a rendered name like "Unnamed" — which would read
 *   as though it were already your name.
 */
export function selfNamePlaceholder(
  // `null` as well as `undefined`: the auth context types its user as nullable,
  // and making every caller narrow it would just move the no-user case out of
  // the one function that already has an answer for it.
  user: SelfNameInput | null | undefined,
  emptyLabel: string,
): string {
  // A QNS name is stored bare and the suffix is presentation, so one that
  // already carries it would render "alice.q.q". Dropping it here matches what
  // `resolveSpaceMemberName` does with the same input, so the placeholder and
  // the name it promises cannot disagree.
  const qns = (user?.primaryUsername ?? '').trim();
  if (qns && !hasReservedQnsSuffix(qns)) return `${qns}.q`;

  // Empty string means "not set at this tier" throughout the identity code, so
  // a whitespace-only name must fall through rather than blank the placeholder.
  //
  // Guarded on this tier too, and not because you can deceive yourself: the
  // placeholder's whole contract is that it names what the app would ACTUALLY
  // render. Every other surface drops a global name ending in ".q" and falls to
  // the address, so promising it here would be false — and the local input
  // validator that normally prevents such a name is exactly the single point of
  // reliance the resolver guard exists to not depend on.
  const global = (user?.displayName ?? '').trim();
  if (global && !hasReservedQnsSuffix(global)) return global;

  return (user?.username ?? '').trim() || emptyLabel;
}
