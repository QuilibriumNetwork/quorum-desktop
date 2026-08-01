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
// The three states, in the order the predicate checks them:
//   never sent / identity changed → send (a rename resets the count)
//   attempts exhausted            → never again, until the identity changes
//   otherwise                     → send once the interval has elapsed
//
// Desktop counterpart of mobile's MMKV gate
// (quorum-mobile/services/dm/dmProfileService.ts). The two are NOT yet in
// parity and diverge in opposite directions: mobile has no expiry and no cap,
// so it sends exactly once ever and a single lost frame is permanent. Bringing
// mobile to the same rule is tracked, and is deliberately not part of this
// change.
//
// See .agents/tasks/2026-08-01-identity-announce-cadence-research.md (Step 2)
// and 2026-08-01-dm-partner-identity-lost-on-established-sessions.md

import { logger } from '@quilibrium/quorum-shared';

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
 *    keeps its stored `at`. See `readRecord`.
 *
 * Rationale and the cost model:
 *   .agents/tasks/2026-08-01-identity-announce-cadence-research.md
 *
 * Do not copy this into the space implementation — spaces already have a
 * receiver-driven member reconciliation and need no cadence (that task, Step 3).
 */
export const MAX_SENDS_PER_IDENTITY = 3;

/**
 * Attempts credited to a record written before this cap existed.
 *
 * 2 leaves exactly ONE more try for pairs that are broken right now, then the
 * cap closes. Going straight to MAX would abandon them; going to 0 would replay
 * the whole ladder for every pair that is already fine.
 */
const MIGRATED_ATTEMPTS = MAX_SENDS_PER_IDENTITY - 1;

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
  /** Sends of THIS signature to this partner so far. Capped at MAX_SENDS_PER_IDENTITY. */
  attempts: number;
}

const writeRecord = (
  selfAddress: string,
  partnerAddress: string,
  record: GateRecord
): void => {
  try {
    localStorage.setItem(
      gateKey(selfAddress, partnerAddress),
      JSON.stringify(record)
    );
  } catch (err) {
    logger.warn('[DMProfile] gate write failed — will re-send next connect', { err });
  }
};

/**
 * Upgrade a pre-cap record, and PERSIST the upgrade.
 *
 * ⚠️ `at` is re-anchored to NOW, deliberately, never the stored value. Records
 * carry a timestamp up to 24h old, so keeping it would put every existing pair
 * instantly past the interval and fire the entire fleet on the first connect
 * after deploy. Re-anchoring spreads the one remaining attempt across whenever
 * each user next opens the app.
 *
 * The write matters as much as the value: without it the upgrade is recomputed
 * on every read, so `now - at` is always ~0 and the record can never age out —
 * which is exactly how the pre-cap code left legacy bare-signature records
 * permanently gated shut.
 */
const migrateRecord = (
  selfAddress: string,
  partnerAddress: string,
  sig: string,
  now: number
): GateRecord => {
  const migrated: GateRecord = { sig, at: now, attempts: MIGRATED_ATTEMPTS };
  writeRecord(selfAddress, partnerAddress, migrated);
  return migrated;
};

const readRecord = (
  selfAddress: string,
  partnerAddress: string,
  now: number
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
      const sig = (parsed as GateRecord).sig;
      const attempts = (parsed as GateRecord).attempts;
      // Shape 1 of 2: `{sig, at}` — the pre-cap format, no attempt counter.
      if (typeof attempts !== 'number') {
        return migrateRecord(selfAddress, partnerAddress, sig, now);
      }
      return { sig, at: (parsed as GateRecord).at, attempts };
    }
  } catch {
    // Not JSON at all — fall through to the legacy branch.
  }
  // Shape 2 of 2: the ORIGINAL format stored a BARE SIGNATURE string. Note that
  // a signature is itself valid JSON (an array), so it parses cleanly — which is
  // exactly why the shape check above matters more than the try/catch.
  return migrateRecord(selfAddress, partnerAddress, raw, now);
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
): boolean => {
  if (inFlight.has(`${gateKey(selfAddress, partnerAddress)}|${signature}`)) {
    return false;
  }
  const record = readRecord(selfAddress, partnerAddress, now);
  if (!record) return true;
  // A changed identity is not a retry — it is new information, so it ignores
  // both the interval and the cap, and starts its own count (see record*Send).
  if (record.sig !== signature) return true;
  // The cap. Checked BEFORE the interval so a converged pair short-circuits
  // without any arithmetic, and so the intent reads in order: "have we said
  // this enough times already?" then "has it been long enough?".
  if (record.attempts >= MAX_SENDS_PER_IDENTITY) return false;
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
): void => {
  const previous = readRecord(selfAddress, partnerAddress, now);
  const attempts =
    previous && previous.sig === signature ? previous.attempts + 1 : 1;
  writeRecord(selfAddress, partnerAddress, { sig: signature, at: now, attempts });
};
