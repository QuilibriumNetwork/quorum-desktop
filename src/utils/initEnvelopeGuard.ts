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

export function isStaleInitEnvelope(
  envelopeTimestamp: number,
  existingRowTimestamps: number[],
  toleranceMs: number = INIT_ENVELOPE_STALENESS_TOLERANCE_MS
): boolean {
  if (existingRowTimestamps.length === 0) return false;
  if (existingRowTimestamps.includes(envelopeTimestamp)) return true;
  const newest = Math.max(...existingRowTimestamps);
  return envelopeTimestamp < newest - toleranceMs;
}
