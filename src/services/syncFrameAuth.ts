// Is the key that signed a directed sync envelope bound to this space?
//
// WHY THIS IS ITS OWN MODULE, AND NOT INLINE IN MessageService.
//
// `resolveVerifiedSender` runs no cryptography — it is a reverse lookup
// (key → inbox address → member row) that assumes its caller already verified.
// A source guard (`src/dev/tests/services/verifiedSenderRequiresVerification.test.ts`)
// forbids MessageService from importing or calling it at all, because inside
// that 3000-line receive handler a raw identity is one careless line away from
// being treated as proof of authorship. That guard is load-bearing and must not
// be relaxed to accommodate a new caller.
//
// The sync gate needs a genuinely different question: not "WHO signed this",
// but "is this signing key one the space already knows". The answer is a
// BOOLEAN, the identity is deliberately discarded, and the ed448 check runs
// immediately afterwards against the same key. No identity escapes this file —
// which is what makes the guard's invariant ("no sender identity without
// crypto") still hold, and why the guard was EXTENDED to cover this module
// rather than loosened for it.
//
// Reusing the shared matcher rather than re-deriving it here is deliberate too.
// Hand-rolling `deriveInboxAddress` + a member scan would duplicate security
// logic that is expected to evolve (the per-device admission path is recent).
// If shared ever admits a key by some further route, a local copy would silently
// stop recognising legitimate senders — a silent delivery loss, which is the
// failure mode this codebase can least afford.
import { resolveVerifiedSender } from '@quilibrium/quorum-shared';
import type { SpaceMember, SpaceMemberDevice } from '@quilibrium/quorum-shared';

export type SyncSignerVerdict =
  /** The key belongs to a current member (or an admitted device of one). */
  | 'member'
  /** We know of no member but ourselves yet — see the bootstrap note below. */
  | 'bootstrap'
  /** Bound to nobody in this space. Refuse. */
  | 'unbound';

/**
 * Decide whether a sync envelope's signing key may speak for this space.
 *
 * Pure: all state is passed in, so this is unit-testable without a database and
 * without the network. The caller supplies the roster and admitted device keys
 * for the DELIVERING space — never a space named by the frame.
 *
 * ⚠️ This does NOT check a signature, and must never be treated as if it did.
 * It answers a membership question only. The caller verifies the ed448
 * signature against the same key afterwards; both are required.
 */
export function classifySyncFrameSigner(params: {
  publicKeyHex: string;
  members: SpaceMember[];
  deviceKeys: SpaceMemberDevice[];
  selfAddress: string;
}): SyncSignerVerdict {
  const { publicKeyHex, members, deviceKeys, selfAddress } = params;
  if (!publicKeyHex) return 'unbound';

  // ⚠️ The shared lookup is NOT sufficient on its own, and an earlier version of
  // this file wrongly claimed it was. Found by independent review, then confirmed
  // by reading both sites:
  //
  //  - its join-bound path matches on `inbox_address`, so a member whose kick was
  //    recorded by CLEARING that field can never match — safe;
  //  - but its per-device path (`messageAuth.ts:189-196`) resolves through
  //    `device.userAddress` and screens the owning row with `!m.isKicked` ALONE.
  //
  // Those two facts collide, because the live `kick` receive handler records a
  // kick by clearing `inbox_address` and does NOT set `isKicked`
  // (`MessageService.ts:6468-6471`); only the separate `verify-kicked`
  // reconciliation sets that flag. And nothing revokes a kicked member's device
  // admissions — a `revoke-device` statement must be signed by that user's own
  // master key, so no one else can mint one for them.
  //
  // So a member who had a second device admitted before being kicked would keep
  // authorizing sync frames, including `sync-peer-map`, which overwrites the
  // space's ratchet state. The same gap is reachable from the control-message
  // paths and is filed separately — it wants fixing in shared, for every caller.
  //
  // Closed here by never OFFERING a kicked row as a candidate, rather than by
  // resolving and re-screening afterwards. That ordering is deliberate and is
  // the safer of the two: the resolved identity never exists as a value in this
  // module at all, so there is nothing that could later escape it — the property
  // the source guard is trying to protect. An earlier version did resolve first
  // and re-check, and an independent review demonstrated two working
  // constructions that leaked the identity while still passing that guard.
  // Filtering removes the possibility instead of policing it.
  //
  // Note the filter is applied to the LOOKUP only. The bootstrap count below
  // deliberately uses the FULL roster: a kicked member's row still means we know
  // of somebody else, so a kick must not reopen the bootstrap window.
  const activeMembers = members.filter(isActiveMemberRow);
  if (resolveVerifiedSender(publicKeyHex, activeMembers, deviceKeys))
    return 'member';

  // BOOTSTRAP — and the point of it is that it closes itself.
  //
  // A client that has just joined holds exactly ONE member row, its own
  // (`InvitationService.ts:799-805`), and then immediately requests a sync
  // (`:903`). Its roster is precisely what the frames it is waiting for will
  // populate, so requiring the sender to be in that roster already is circular
  // and would deadlock every join.
  //
  // Scoped to "we know of no member but ourselves" rather than to "we asked for
  // a sync": the latter stays true for the whole session, which is the defect
  // being repaired, while this shuts permanently the moment one real member row
  // lands. Nothing a peer can send SHRINKS a roster, so it cannot be reopened.
  //
  // HONEST RESIDUAL: in a space whose only member is us, it never closes.
  const knowsAnotherMember = members.some(
    (m) => memberAddress(m) !== undefined && memberAddress(m) !== selfAddress
  );
  return knowsAnotherMember ? 'unbound' : 'bootstrap';
}

/**
 * A member row's own address.
 *
 * Both spellings exist on these rows and neither is reliably present: shared's
 * `SpaceMember` carries `address`, desktop's stored rows carry `user_address`,
 * and the adapter fills whichever it can (`adapters/indexedDbAdapter.ts:153-158`).
 * Returning `undefined` for a row with neither matters: an addressless row must
 * not be counted as "another member we know", or a single malformed row would
 * silently close the bootstrap window for a client that genuinely needs it.
 *
 * `||` rather than `??`, to match `resolveVerifiedSender`'s own precedence
 * (`messageAuth.ts:180`, `:194`) exactly. With `??` an `address: ''` would stop
 * the fallback to `user_address` while the shared function still took it, and
 * the two would disagree about who a row belongs to.
 */
function memberAddress(m: SpaceMember): string | undefined {
  const candidate =
    (m as { address?: string }).address ||
    (m as { user_address?: string }).user_address;
  return candidate || undefined;
}

/**
 * Is this row a member we should still honour as a signer?
 *
 * Screens BOTH local spellings of a kick, because the two receive paths that
 * record one disagree: `verify-kicked` sets `isKicked`
 * (`MessageService.ts:6714-6731`), while the live `kick` handler clears
 * `inbox_address` (`:6468-6471`) and never sets that flag. Shared's join-bound
 * lookup is safe from the second because it matches ON `inbox_address`; its
 * per-device lookup is not, because it reaches the row through
 * `device.userAddress` instead.
 *
 * Fails CLOSED on a row with no inbox address. The asymmetry is deliberate:
 * wrongly accepting lets a removed member rewrite the space's ratchet state,
 * while wrongly refusing costs one sync frame that the next sync round re-sends.
 */
function isActiveMemberRow(row: SpaceMember): boolean {
  if ((row as { isKicked?: boolean }).isKicked) return false;
  return !!(row as { inbox_address?: string }).inbox_address;
}
