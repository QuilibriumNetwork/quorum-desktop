// Per-partner dedup gate for the `dm-update-profile` broadcast.
//
// The on-connect rebroadcast fires on EVERY ws.onopen, and every send it makes
// is a real encrypted DM on the wire (plus a push on the receiving device). A
// user with 30 DM partners on a flaky connection would otherwise emit 30
// messages per reconnect, forever, to say nothing new.
//
// The gate records the exact payload last successfully sent to each partner and
// skips a byte-identical resend. Recording happens only AFTER a successful
// send, so a failure leaves the gate open and the next connect retries.
//
// Desktop counterpart of mobile's MMKV gate in
// quorum-mobile/services/dm/dmProfileService.ts.
//
// See .agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md

import { logger } from '@quilibrium/quorum-shared';

const GATE_PREFIX = 'quorum:dm-profile-broadcast';

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
 * from an explicit key order so it never depends on object insertion order.
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

/**
 * The signature last successfully sent to this partner, or null if we have
 * never sent one (or storage is unavailable — in which case we deliberately
 * fail OPEN and re-send, since a redundant identity push is harmless whereas a
 * missed one leaves the partner stuck on a placeholder).
 */
export const readDmProfileGate = (
  selfAddress: string,
  partnerAddress: string
): string | null => {
  try {
    return localStorage.getItem(gateKey(selfAddress, partnerAddress));
  } catch (err) {
    logger.warn('[DMProfile] gate read failed — treating as not-yet-sent', { err });
    return null;
  }
};

/** Record a successful send. Storage failures are non-fatal (gate stays open). */
export const writeDmProfileGate = (
  selfAddress: string,
  partnerAddress: string,
  signature: string
): void => {
  try {
    localStorage.setItem(gateKey(selfAddress, partnerAddress), signature);
  } catch (err) {
    logger.warn('[DMProfile] gate write failed — will re-send next connect', { err });
  }
};
