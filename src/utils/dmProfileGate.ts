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
// So the gate EXPIRES. An unchanged identity is re-sent at most once per
// RESEND_INTERVAL_MS per partner, which bounds the wire cost to ~1 message per
// partner per day while guaranteeing the identity eventually lands.
//
// Desktop counterpart of mobile's MMKV gate
// (quorum-mobile/services/dm/dmProfileService.ts), plus the expiry, which
// mobile does not have.
//
// See .agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md

import { logger } from '@quilibrium/quorum-shared';

const GATE_PREFIX = 'quorum:dm-profile-broadcast';

/**
 * Re-send an unchanged identity at most this often, per partner.
 *
 * ⚠️ PLACEHOLDER VALUE — chosen to bound an anti-loss retry, not researched.
 * It scales with the user base rather than with the problem: ~12 GB/day at 10k
 * users (20 partners × ~2 destination inboxes × 30 KB avatars), forever.
 *
 * DECIDED 2026-08-01: keep this interval, but CAP the number of retries — stop
 * after 3 sends per (partner, identity-version), until the signature changes.
 * Healing a lost identity is a finite job; repeating it 365×/year per partner is
 * not. ~99% cheaper, with the same convergence.
 *
 * The retry is a TRANSITIONAL SAFETY NET, not architecture. It exists only
 * because a lost frame had no second chance — with reliable delivery, ONE send
 * per identity is enough (which is exactly what mobile already does). As
 * delivery is proven the cap should shrink toward 1. Do not build as if the
 * retry were permanent.
 *
 * Two things not to get wrong:
 *  - Capping is only safe once db.saveMessage stops re-stamping 'Unknown User'
 *    onto the row (src/db/messages.ts:1360-1370). That re-stamp is what
 *    un-converges an already-fixed row. Fix it in the same effort.
 *  - The MIGRATION stampedes the whole fleet on deploy day if a legacy record is
 *    stamped with its stored `at` instead of `Date.now()`.
 *
 * Both are covered in:
 *   .agents/tasks/2026-08-01-identity-announce-cadence-research.md
 *
 * Do not copy this into the space implementation — spaces already have a
 * receiver-driven member reconciliation and need no cadence (that task, Slice 3).
 */
export const RESEND_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

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
 * name-only push are different messages and must not gate each other. Built
 * from an explicit sorted key order so it never depends on insertion order.
 */
export const dmProfileSignature = (payload: DmProfileWirePayload): string => {
  const canonical: Record<string, string> = {};
  if (payload.displayName) canonical.displayName = payload.displayName;
  if (payload.userIcon) canonical.userIcon = payload.userIcon;
  if (payload.bio !== undefined) canonical.bio = payload.bio;
  return JSON.stringify(
    Object.keys(canonical)
      .sort()
      .map((k) => [k, canonical[k]])
  );
};

const gateKey = (selfAddress: string, partnerAddress: string): string =>
  `${GATE_PREFIX}:${selfAddress}:${partnerAddress}`;

interface GateRecord {
  sig: string;
  at: number;
}

const readRecord = (
  selfAddress: string,
  partnerAddress: string
): GateRecord | null => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(gateKey(selfAddress, partnerAddress));
  } catch (err) {
    // Storage unavailable — fail OPEN. A redundant identity push is harmless;
    // a missed one leaves the partner stuck on a placeholder.
    logger.warn('[DMProfile] gate read failed — treating as not-yet-sent', { err });
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as GateRecord).sig === 'string' &&
      typeof (parsed as GateRecord).at === 'number'
    ) {
      return {
        sig: (parsed as GateRecord).sig,
        at: (parsed as GateRecord).at,
      };
    }
  } catch {
    // Not JSON at all — fall through to the legacy branch.
  }
  // Pre-expiry format stored a BARE SIGNATURE string. Note that a signature is
  // itself valid JSON (an array), so it parses cleanly — which is exactly why
  // the shape check above matters more than the try/catch. Stamp it as sent
  // "now" rather than at epoch 0, so upgrading does not make every partner
  // instantly due for a resend on the first connect after deploy.
  return { sig: raw, at: Date.now() };
};

// In-flight claims, process-local. The persisted record is only written AFTER
// encryptAndSendDm resolves (a real crypto + network round trip), so two
// overlapping broadcast runs — the startup timer and a reconnect timer can
// overlap by design — would both read "not yet sent" and both send a real
// encrypted DM to the same partner. Claiming synchronously here closes that
// window. Not persisted: a reload legitimately means nothing is in flight.
const inFlight = new Set<string>();

/**
 * Should we send this payload to this partner right now?
 *
 * True when we have never sent to them, when the identity has changed, or when
 * the last send is older than RESEND_INTERVAL_MS (the anti-loss retry) — and
 * only when no equivalent send is already in flight.
 *
 * `now` is injectable so the expiry is testable without faking the clock.
 */
export const shouldSendDmProfile = (
  selfAddress: string,
  partnerAddress: string,
  signature: string,
  now: number = Date.now()
): boolean => {
  if (inFlight.has(`${gateKey(selfAddress, partnerAddress)}|${signature}`)) {
    return false;
  }
  const record = readRecord(selfAddress, partnerAddress);
  if (!record) return true;
  if (record.sig !== signature) return true;
  return now - record.at >= RESEND_INTERVAL_MS;
};

/**
 * Claim a send synchronously, before awaiting it. Must be paired with
 * `releaseDmProfileSend` in a `finally` so a failed send does not wedge the
 * partner shut until reload.
 */
export const claimDmProfileSend = (
  selfAddress: string,
  partnerAddress: string,
  signature: string
): void => {
  inFlight.add(`${gateKey(selfAddress, partnerAddress)}|${signature}`);
};

/** Release an in-flight claim, whether the send succeeded or threw. */
export const releaseDmProfileSend = (
  selfAddress: string,
  partnerAddress: string,
  signature: string
): void => {
  inFlight.delete(`${gateKey(selfAddress, partnerAddress)}|${signature}`);
};

/**
 * Record a successful send. Call ONLY after the send resolves, so a failure
 * leaves the gate open and the next connect retries.
 * Storage failures are non-fatal (gate simply stays open).
 */
export const recordDmProfileSend = (
  selfAddress: string,
  partnerAddress: string,
  signature: string,
  now: number = Date.now()
): void => {
  try {
    localStorage.setItem(
      gateKey(selfAddress, partnerAddress),
      JSON.stringify({ sig: signature, at: now } satisfies GateRecord)
    );
  } catch (err) {
    logger.warn('[DMProfile] gate write failed — will re-send next connect', { err });
  }
};
