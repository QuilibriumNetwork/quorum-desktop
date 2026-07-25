/**
 * Staleness guard for Double Ratchet init envelopes.
 *
 * An init envelope replaces the receiver's session for its device tag,
 * unconditionally. The server redelivers any frame whose ack-by-delete
 * failed (502s observed live), so stale init envelopes act as mines: on a
 * reconnect they are replayed and each one silently replaces the CURRENT
 * healthy session with a resurrected zombie the sender no longer holds —
 * confirmed live 2026-07-17 with redelivered envelopes up to 60 days old.
 *
 * Rules (pure, unit-tested, extractable to quorum-shared):
 * 1. No existing session rows for the tag → not stale (first init).
 * 2. Envelope timestamp EXACTLY equals an existing row's timestamp → stale.
 *    Init-created rows are saved with the envelope's own timestamp, so an
 *    exact match means this very envelope was already processed and is now
 *    being redelivered; re-installing it would rewind the ratchet.
 * 3. Envelope older than the newest existing row by more than the
 *    tolerance → stale. The tolerance absorbs clock-domain skew (rows
 *    updated by sends carry local Date.now(); envelope timestamps are
 *    server-assigned) without weakening the guard — observed zombies are
 *    hours to weeks older, far beyond any plausible skew.
 *
 * A genuine session reset always produces an envelope NEWER than every
 * row it replaces, so legitimate re-inits pass rules 2 and 3 untouched.
 */
export const INIT_ENVELOPE_STALENESS_TOLERANCE_MS = 120_000;

/**
 * Absolute age bound, applied even when we hold NO rows for the tag.
 *
 * Rule 1 below ("no existing rows -> not stale") left a hole exactly where we
 * are most vulnerable: a session RESET deletes every row, so for a moment there
 * is nothing to compare against and ANY redelivered envelope is accepted. The
 * server redelivers anything whose ack-by-delete failed, so old init envelopes
 * sit on the inbox indefinitely - observed live 2026-07-25 replacing a
 * just-reset session with envelopes 94,125 seconds (26 hours) old, and the
 * master report saw 60-day-old ones. The zombie installs itself as the session,
 * the peer's real traffic no longer matches, and the reset the user just
 * performed is silently undone.
 *
 * A legitimate init envelope is seconds old. Ten minutes is five times the skew
 * tolerance and still refuses everything observed.
 */
export const INIT_ENVELOPE_MAX_AGE_MS = 10 * 60_000;

export function isStaleInitEnvelope(
  envelopeTimestamp: number,
  existingRowTimestamps: number[],
  toleranceMs: number = INIT_ENVELOPE_STALENESS_TOLERANCE_MS,
  now: number = Date.now(),
  maxAgeMs: number = INIT_ENVELOPE_MAX_AGE_MS
): boolean {
  // Rule 0: absolute age. Holds even with no rows — see INIT_ENVELOPE_MAX_AGE_MS.
  if (now - envelopeTimestamp > maxAgeMs) return true;
  if (existingRowTimestamps.length === 0) return false;
  if (existingRowTimestamps.includes(envelopeTimestamp)) return true;
  const newest = Math.max(...existingRowTimestamps);
  return envelopeTimestamp < newest - toleranceMs;
}
