// Shared send-gate for identity announcements.
//
// Two callers today: the per-partner DM push (`dmProfileGate.ts`) and the
// per-space bootstrap announce (`spaceProfileGate.ts`). They differ only in
// where the record is keyed and how long they wait between attempts; the rules
// below — cap, expiry, migration, in-flight claim — are identical and each one
// was paid for with a live failure on the DM side. Keeping ONE implementation
// is the point: the three subtleties documented here are exactly the kind that
// get silently dropped by a copy-paste.
//
// The shape of the rule:
//
//   never sent / identity changed → send (a rename resets the count)
//   attempts exhausted            → never again, until the identity changes
//   otherwise                     → send once the minimum gap has elapsed
//
// Healing a lost identity is a FINITE job. An uncapped gate keeps paying to say
// nothing new, forever, on every pair — cost that scales with the user base
// rather than with the problem. A gate with no expiry at all is the opposite
// failure: one lost frame becomes permanent and silent, because the sender
// recorded a success the receiver never saw.
//
// See .agents/tasks/2026-08-01-identity-announce-cadence-research.md

import { logger } from '@quilibrium/quorum-shared';

export interface ProfileSendGateConfig {
  /** localStorage key namespace. Must be unique per gate. */
  storagePrefix: string;
  /** Log tag, e.g. `[DMProfile]`. */
  logPrefix: string;
  /**
   * Minimum gap between two sends of the SAME identity to the same peer.
   *
   * A floor, not a cadence: after `maxSendsPerIdentity` the gate closes for
   * good regardless of how much time passes. Its only job is to stop the
   * attempts landing inside one bad-network window, which would waste the
   * whole allowance on a single outage.
   */
  minGapMs: number;
  /** How many times an UNCHANGED identity is ever sent to one peer. */
  maxSendsPerIdentity: number;
}

interface GateRecord {
  sig: string;
  at: number;
  /** Sends of THIS signature to this peer so far. Capped at maxSendsPerIdentity. */
  attempts: number;
}

/**
 * Canonical signature of a wire payload: an explicit sorted key order, so it
 * never depends on insertion order.
 *
 * Field PRESENCE matters as well as value — an avatar-only push and a name-only
 * push are different messages and must not gate each other — so callers decide
 * which keys to include and this only canonicalises what it is handed.
 */
export const canonicalProfileSignature = (
  fields: Record<string, string>
): string =>
  JSON.stringify(
    Object.keys(fields)
      .sort()
      .map((k) => [k, fields[k]])
  );

/**
 * Fold a string into a compact hex digest.
 *
 * FNV-1a over two offset accumulators. NOT a security boundary — this is a
 * change detector, and its only failure mode is a collision, which reads as
 * "the identity did not change" and costs one skipped re-announce. Callers that
 * cannot tolerate that (no other repair path) should store the full signature
 * instead; see the note in `spaceProfileGate.ts` for why spaces can.
 */
export const compactSignature = (value: string): string => {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b + c, 0x85ebca6b) ^ (b >>> 13);
  }
  return (
    (a >>> 0).toString(16).padStart(8, '0') +
    (b >>> 0).toString(16).padStart(8, '0')
  );
};

export interface ProfileSendGate {
  /**
   * Should we send this payload to this peer right now?
   *
   * `now` is injectable so the gap and the cap are testable without faking the
   * clock.
   */
  shouldSend(
    selfAddress: string,
    peerKey: string,
    signature: string,
    now?: number
  ): boolean;
  /**
   * Claim a send synchronously, BEFORE awaiting it. Must be paired with
   * `release` in a `finally` so a failed send does not wedge the peer shut
   * until reload.
   */
  claim(selfAddress: string, peerKey: string, signature: string): void;
  /** Release an in-flight claim, whether the send succeeded or threw. */
  release(selfAddress: string, peerKey: string, signature: string): void;
  /**
   * Record a successful send, advancing the attempt counter. Call ONLY after
   * the send resolves, so a failure leaves the gate open and the next connect
   * retries. Storage failures are non-fatal (the gate simply stays open).
   *
   * A send of a DIFFERENT signature restarts the count at 1: the cap is per
   * identity-version, not per peer for all time, so a rename gets its own full
   * set of attempts.
   */
  record(
    selfAddress: string,
    peerKey: string,
    signature: string,
    now?: number
  ): void;
}

export const createProfileSendGate = (
  config: ProfileSendGateConfig
): ProfileSendGate => {
  const { storagePrefix, logPrefix, minGapMs, maxSendsPerIdentity } = config;

  /**
   * Attempts credited to a record written before the cap existed.
   *
   * One below the cap leaves exactly ONE more try for peers that are broken
   * right now, then it closes. Going straight to the cap would abandon them;
   * going to 0 would replay the whole ladder for every peer already fine.
   */
  const migratedAttempts = Math.max(0, maxSendsPerIdentity - 1);

  const gateKey = (selfAddress: string, peerKey: string): string =>
    `${storagePrefix}:${selfAddress}:${peerKey}`;

  const writeRecord = (
    selfAddress: string,
    peerKey: string,
    record: GateRecord
  ): void => {
    try {
      localStorage.setItem(gateKey(selfAddress, peerKey), JSON.stringify(record));
    } catch (err) {
      logger.warn(`${logPrefix} gate write failed — will re-send next connect`, {
        err,
      });
    }
  };

  /**
   * Upgrade a pre-cap record, and PERSIST the upgrade.
   *
   * ⚠️ `at` is re-anchored to NOW, deliberately, never the stored value.
   * Records carry a timestamp up to a full interval old, so keeping it would
   * put every existing peer instantly past the gap and fire the entire fleet on
   * the first connect after deploy. Re-anchoring spreads the one remaining
   * attempt across whenever each user next opens the app.
   *
   * The write matters as much as the value: without it the upgrade is
   * recomputed on every read, so `now - at` is always ~0 and the record can
   * never age out — which is exactly how the pre-cap code left legacy
   * bare-signature records permanently gated shut.
   */
  const migrateRecord = (
    selfAddress: string,
    peerKey: string,
    sig: string,
    now: number
  ): GateRecord => {
    const migrated: GateRecord = { sig, at: now, attempts: migratedAttempts };
    writeRecord(selfAddress, peerKey, migrated);
    return migrated;
  };

  const readRecord = (
    selfAddress: string,
    peerKey: string,
    now: number
  ): GateRecord | null => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(gateKey(selfAddress, peerKey));
    } catch (err) {
      // Storage unavailable — fail OPEN. A redundant identity push is harmless;
      // a missed one leaves the peer stuck on a placeholder.
      logger.warn(`${logPrefix} gate read failed — treating as not-yet-sent`, {
        err,
      });
      return null;
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        typeof (parsed as GateRecord).sig === 'string'
      ) {
        // Only `sig` is required to recognise the object form. `at` and
        // `attempts` are validated below rather than in this guard, so a record
        // whose numbers are unusable still migrates with its REAL signature
        // instead of falling through to the bare-signature branch and having
        // the whole JSON blob mistaken for one.
        const sig = (parsed as GateRecord).sig;
        const at = (parsed as GateRecord).at;
        const attempts = (parsed as GateRecord).attempts;
        // Shape 1 of 2: `{sig, at}` — the pre-cap format, no attempt counter.
        //
        // `Number.isInteger` / `Number.isFinite`, not `typeof === 'number'`:
        // NaN and Infinity are both numbers, and either breaks the gate
        // silently — a NaN `attempts` defeats the cap (`NaN >= 3` is false, so
        // it sends forever) and a NaN `at` wedges the gap shut. Note NaN and
        // Infinity both serialise to `null` through JSON, so this also covers a
        // record that was written while one of them was in play.
        if (!Number.isFinite(at) || !Number.isInteger(attempts) || attempts < 0) {
          return migrateRecord(selfAddress, peerKey, sig, now);
        }
        return { sig, at, attempts };
      }
    } catch {
      // Not JSON at all — fall through to the legacy branch.
    }
    // Shape 2 of 2: the ORIGINAL format stored a BARE SIGNATURE string. Note
    // that a signature is itself valid JSON (an array), so it parses cleanly —
    // which is exactly why the shape check above matters more than the
    // try/catch.
    return migrateRecord(selfAddress, peerKey, raw, now);
  };

  // In-flight claims, process-local. The persisted record is only written AFTER
  // the send resolves (a real crypto + network round trip), so two overlapping
  // broadcast runs — the startup timer and a reconnect timer can overlap by
  // design — would both read "not yet sent" and both transmit. Claiming
  // synchronously here closes that window. Not persisted: a reload legitimately
  // means nothing is in flight.
  const inFlight = new Set<string>();
  const claimKey = (
    selfAddress: string,
    peerKey: string,
    signature: string
  ): string => `${gateKey(selfAddress, peerKey)}|${signature}`;

  return {
    shouldSend(selfAddress, peerKey, signature, now = Date.now()) {
      if (inFlight.has(claimKey(selfAddress, peerKey, signature))) return false;
      const record = readRecord(selfAddress, peerKey, now);
      if (!record) return true;
      // A changed identity is not a retry — it is new information, so it
      // ignores both the gap and the cap, and starts its own count.
      if (record.sig !== signature) return true;
      // The cap. Checked BEFORE the gap so a converged peer short-circuits
      // without any arithmetic, and so the intent reads in order: "have we said
      // this enough times already?" then "has it been long enough?".
      if (record.attempts >= maxSendsPerIdentity) return false;
      return now - record.at >= minGapMs;
    },

    claim(selfAddress, peerKey, signature) {
      inFlight.add(claimKey(selfAddress, peerKey, signature));
    },

    release(selfAddress, peerKey, signature) {
      inFlight.delete(claimKey(selfAddress, peerKey, signature));
    },

    record(selfAddress, peerKey, signature, now = Date.now()) {
      const previous = readRecord(selfAddress, peerKey, now);
      const attempts =
        previous && previous.sig === signature ? previous.attempts + 1 : 1;
      writeRecord(selfAddress, peerKey, { sig: signature, at: now, attempts });
    },
  };
};
