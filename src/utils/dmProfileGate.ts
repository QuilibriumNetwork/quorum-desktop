// Per-partner send gate for the `dm-update-profile` broadcast.
//
// The identity push runs on every connect, and every send it makes is a real
// encrypted DM on the wire (plus a push on the receiving device). A user with
// 30 DM partners on a flaky connection would otherwise emit 30 messages per
// reconnect, forever, to say nothing new. So: skip a byte-identical resend.
//
// BUT a pure "sent once, never again" gate makes convergence depend on a
// single frame arriving. This transport is documented-unreliable, and the
// failure is permanent and silent: the sender believes the partner knows who
// they are, the partner renders a placeholder forever, and nothing retries.
// Observed live on 2026-08-01 — a closed gate on one side while the other side
// still showed "Unknown User".
//
// So the gate EXPIRES — but only a BOUNDED number of times. An unchanged
// identity is re-sent at most once per RESEND_INTERVAL_MS, at most
// MAX_SENDS_PER_IDENTITY times, per partner. Healing a lost identity is a
// finite job; the first version of this gate had no cap and so kept paying 365
// sends a year per pair to say nothing new.
//
// The rules themselves — cap, expiry, legacy-record migration, in-flight claim
// — live in `profileSendGate.ts` and are shared with the space announce. What
// stays here is DM-specific: the storage namespace, the interval, and what
// counts as the payload.
//
// Desktop counterpart of mobile's MMKV gate
// (quorum-mobile/services/dm/dmProfileService.ts).
//
// See 2026-08-01-identity-announce-cadence-research.md under .agents/issues/ (Step 2)
// and 2026-08-01-dm-partner-identity-lost-on-established-sessions.md

import {
  canonicalProfileSignature,
  createProfileSendGate,
} from './profileSendGate';

const GATE_PREFIX = 'quorum:dm-profile-broadcast';

/** Minimum gap between two sends of the SAME identity to the same partner. */
export const RESEND_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * How many times an UNCHANGED identity is ever sent to one partner.
 *
 * Healing a lost identity is a FINITE job. The interval above used to have no
 * cap, so a converged pair kept paying 365 sends a year to say nothing new —
 * cost that scaled with the user base rather than with the problem (~12 GB/day
 * at 10k users × 20 partners × ~2 destination inboxes × 30 KB avatars).
 *
 * Three attempts is sized from measured transport loss: residual after k tries
 * is p^k, so at p≈0.15 (desktop today, before it consumes send retention) three
 * leaves 0.34%, and at p≈0.02 it leaves 0.0008%. Attempts 4..365 buy nothing.
 *
 * ⚠️ This retry is a TRANSITIONAL SAFETY NET, not architecture. It exists only
 * because a lost frame had no second chance; with reliable delivery ONE send per
 * identity is enough. As delivery is proven the cap should shrink toward 1 — a
 * flat interval is wrong at every loss rate, and MOST wrong once the transport
 * works. Do not build as if the retry were permanent.
 *
 * Two things not to get wrong:
 *  - Capping is only safe because db.saveMessage no longer re-stamps
 *    'Unknown User' over a real name (fixed 2026-08-01). That re-stamp was what
 *    un-converged an already-healed row; with a cap and no fix, such a row would
 *    stay broken forever.
 *  - The MIGRATION stampedes the whole fleet on deploy day if a legacy record
 *    keeps its stored `at`. See `migrateRecord` in `profileSendGate.ts`.
 *
 * Rationale and the cost model:
 *   2026-08-01-identity-announce-cadence-research.md under .agents/issues/
 *
 * ⚠️ Do not reuse this INTERVAL for spaces. Spaces already have a
 * receiver-driven member reconciliation (`MemberDigest` → `MemberDelta`), so
 * their announce is a bootstrap rather than a cadence and spaces it far more
 * tightly — see `spaceProfileGate.ts`. The cap is shared; the interval is not.
 */
export const MAX_SENDS_PER_IDENTITY = 3;

const gate = createProfileSendGate({
  storagePrefix: GATE_PREFIX,
  logPrefix: '[DMProfile]',
  minGapMs: RESEND_INTERVAL_MS,
  maxSendsPerIdentity: MAX_SENDS_PER_IDENTITY,
});

/** The identity fields that actually go on the wire. */
export interface DmProfileWirePayload {
  displayName?: string;
  userIcon?: string;
  bio?: string;
}

/**
 * Canonical signature of the exact wire payload.
 *
 * Field PRESENCE matters as well as value: an avatar-only push and a
 * name-only push are different messages and must not gate each other.
 *
 * Note `bio` alone tests `!== undefined` rather than truthiness — an empty bio
 * is a deliberate CLEAR on the wire, so it has to be distinguishable from an
 * omitted one. Names and avatars have no such "clear" semantics here.
 */
export const dmProfileSignature = (payload: DmProfileWirePayload): string => {
  const canonical: Record<string, string> = {};
  if (payload.displayName) canonical.displayName = payload.displayName;
  if (payload.userIcon) canonical.userIcon = payload.userIcon;
  if (payload.bio !== undefined) canonical.bio = payload.bio;
  return canonicalProfileSignature(canonical);
};

/**
 * Should we send this payload to this partner right now?
 *
 * True when we have never sent to them, when the identity has CHANGED (which
 * resets the counter — new bytes genuinely have to be pushed), or when the last
 * send is older than RESEND_INTERVAL_MS AND we are still under
 * MAX_SENDS_PER_IDENTITY. Only when no equivalent send is already in flight.
 *
 * `now` is injectable so the interval and the cap are testable without faking
 * the clock.
 */
export const shouldSendDmProfile = (
  selfAddress: string,
  partnerAddress: string,
  signature: string,
  now: number = Date.now()
): boolean => gate.shouldSend(selfAddress, partnerAddress, signature, now);

/**
 * Claim a send synchronously, before awaiting it. Must be paired with
 * `releaseDmProfileSend` in a `finally` so a failed send does not wedge the
 * partner shut until reload.
 */
export const claimDmProfileSend = (
  selfAddress: string,
  partnerAddress: string,
  signature: string
): void => gate.claim(selfAddress, partnerAddress, signature);

/** Release an in-flight claim, whether the send succeeded or threw. */
export const releaseDmProfileSend = (
  selfAddress: string,
  partnerAddress: string,
  signature: string
): void => gate.release(selfAddress, partnerAddress, signature);

/**
 * Record a successful send, advancing the attempt counter. Call ONLY after the
 * send resolves, so a failure leaves the gate open and the next connect retries.
 * Storage failures are non-fatal (gate simply stays open).
 *
 * A send of a DIFFERENT signature restarts the count at 1: the cap is per
 * identity-version, not per partner for all time, so a rename gets its own full
 * set of attempts.
 */
export const recordDmProfileSend = (
  selfAddress: string,
  partnerAddress: string,
  signature: string,
  now: number = Date.now()
): void => gate.record(selfAddress, partnerAddress, signature, now);

/**
 * Forget this partner's gate record.
 *
 * Called when a partner shows up with a genuinely NEW session (a reinstall, a
 * second device). The stored record describes sessions that no longer exist, so
 * an exhausted cap would gag the one announce the new device actually needs.
 * See `ProfileSendGate.clear` for why this is not a general escape hatch.
 */
export const clearDmProfileSendState = (
  selfAddress: string,
  partnerAddress: string
): void => gate.clear(selfAddress, partnerAddress);
