// Per-space send gate for the on-connect identity announce.
//
// Space identity is PUSH-based: a member's name and avatar exist on your device
// only because somebody announced them. Desktop announced at join and on tag
// rotation and nowhere else, so a member who joined while you were offline never
// got a second chance and rendered as a 6-char address forever.
//
// This gate bounds the fix. It is deliberately NOT the DM gate's shape:
//
//   DM     — 3 attempts, 24h apart. A DM has no reconciliation of any kind, so
//            the retry IS the repair mechanism and is spread over days.
//   Space  — 3 attempts, minutes apart, then never again. Spaces already run a
//            receiver-driven reconciliation (`MemberDigest` → `MemberDelta` on
//            every `requestSync`), so this announce only has to BOOTSTRAP
//            members nobody holds a row for at all. Once a row exists, the
//            digest exchange keeps it correct without any announce.
//
// That is why there is no cadence here and why the spacing is a floor rather
// than an interval: its only job is to stop all three attempts landing inside
// one bad-network window. After the third the gate closes until the identity
// itself changes.
//
// Cost is the reason to care. A space announce is one broadcast for the sender
// but it is READ by every member, so the bytes are `spaces × members` — at
// 5 spaces × 50 members that is several times a daily DM announce, not less.
// An uncapped version would be the most expensive identity traffic in the app.
//
// See 2026-08-01-space-member-identity-announce-on-connect.md under .agents/issues/
// and 2026-08-01-identity-announce-cadence-research.md (Step 3).

import {
  canonicalProfileSignature,
  compactSignature,
  createProfileSendGate,
} from './profileSendGate';

const GATE_PREFIX = 'quorum:space-profile-announce';

/**
 * Floor between two attempts at the SAME identity in one space.
 *
 * Not a cadence — see MAX_SENDS_PER_SPACE_IDENTITY. Five minutes is long enough
 * that a flapping socket cannot burn the whole allowance during a single
 * outage, and short enough that all three attempts fit comfortably inside one
 * ordinary session rather than being spread over days like the DM gate.
 */
export const SPACE_ANNOUNCE_MIN_GAP_MS = 5 * 60 * 1000; // 5 minutes

/**
 * How many times an UNCHANGED identity is ever announced to one space.
 *
 * Matches the DM cap and is sized the same way: residual loss after k tries is
 * p^k, so three leaves 0.34% at p≈0.15 and 0.0008% at p≈0.02. Beyond that the
 * receiver-driven digest sync is the repair path, not more broadcasts.
 *
 * ⚠️ Transitional, like the DM cap. With reliable delivery ONE announce is
 * enough, and this should shrink toward 1 rather than grow.
 */
export const MAX_SENDS_PER_SPACE_IDENTITY = 3;

const gate = createProfileSendGate({
  storagePrefix: GATE_PREFIX,
  logPrefix: '[SpaceProfile]',
  minGapMs: SPACE_ANNOUNCE_MIN_GAP_MS,
  maxSendsPerIdentity: MAX_SENDS_PER_SPACE_IDENTITY,
});

/**
 * Signature of the exact announce payload, folded to a compact digest.
 *
 * Signs whatever it is handed rather than a fixed field list, so a field added
 * to the wire later cannot silently fall outside the change detection — which
 * would read as "identity unchanged" and never be announced.
 *
 * Unlike the DM gate this does NOT store the payload verbatim. The payload
 * contains a base64 avatar, and a per-space record holding one would put tens of
 * kilobytes per space into localStorage — for the user's OWN avatar, repeated.
 *
 * The cost of folding is a hash collision reading as "identity unchanged", i.e.
 * one skipped re-announce. Spaces can absorb that where DMs could not: the
 * member digest exchange repairs a stale row on the next `requestSync`, so a
 * missed announce is not a permanent failure here.
 */
export const spaceProfileSignature = (
  payload: Record<string, unknown>
): string => {
  const canonical: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    // Present-but-empty is meaningful on this wire (`''` = clear the override),
    // so the test is `!== undefined`, not truthiness.
    if (value === undefined) continue;
    canonical[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return compactSignature(canonicalProfileSignature(canonical));
};

/**
 * Should we announce this identity to this space right now?
 *
 * True when we have never announced there, when the identity has CHANGED (which
 * resets the counter), or when the last announce is older than
 * SPACE_ANNOUNCE_MIN_GAP_MS AND we are under MAX_SENDS_PER_SPACE_IDENTITY. Only
 * when no equivalent announce is already in flight.
 *
 * `now` is injectable so the gap and the cap are testable without faking the
 * clock.
 */
export const shouldAnnounceSpaceProfile = (
  selfAddress: string,
  spaceId: string,
  signature: string,
  now: number = Date.now()
): boolean => gate.shouldSend(selfAddress, spaceId, signature, now);

/**
 * Claim an announce synchronously, before awaiting it. Must be paired with
 * `releaseSpaceProfileAnnounce` in a `finally`.
 *
 * The startup timer and the reconnect timer can overlap by design, and the
 * persisted record is only written once the send resolves — so without this
 * both runs read "not yet announced" and both broadcast.
 */
export const claimSpaceProfileAnnounce = (
  selfAddress: string,
  spaceId: string,
  signature: string
): void => gate.claim(selfAddress, spaceId, signature);

/** Release an in-flight claim, whether the announce succeeded or threw. */
export const releaseSpaceProfileAnnounce = (
  selfAddress: string,
  spaceId: string,
  signature: string
): void => gate.release(selfAddress, spaceId, signature);

/**
 * Record a successful announce, advancing the attempt counter. Call ONLY after
 * the send resolves, so a failure leaves the gate open and the next connect
 * retries.
 */
export const recordSpaceProfileAnnounce = (
  selfAddress: string,
  spaceId: string,
  signature: string,
  now: number = Date.now()
): void => gate.record(selfAddress, spaceId, signature, now);
