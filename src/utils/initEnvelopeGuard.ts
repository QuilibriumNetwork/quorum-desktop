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
 * Absolute age bound — the fallback for when we hold NO rows for the tag.
 *
 * Rule 1 ("no existing rows -> not stale") left a hole exactly where we are most
 * vulnerable: a session RESET deletes every row, so for a moment there is nothing
 * to compare against and ANY redelivered envelope is accepted. The server
 * redelivers anything whose ack-by-delete failed, so old init envelopes sit on
 * the inbox indefinitely - observed live 2026-07-25 replacing a just-reset
 * session with envelopes 94,125 seconds (26 hours) old, and the master report saw
 * 60-day-old ones.
 *
 * ## Why this is scoped to the no-rows case (changed 2026-07-27)
 *
 * It used to run FIRST and UNCONDITIONALLY, on the stated assumption that "a
 * legitimate init envelope is seconds old". **That assumption only holds while
 * the receiver is online**, and the cost of it being wrong was measured:
 *
 *   STALE init envelope IGNORED  age=1057s
 *   envelopeTimestamp  = 1785137056356
 *   newestRowTimestamp = 1785136882458     <- envelope is 174s NEWER
 *
 * A peer reset and sent while the desktop was closed. The envelope was newer than
 * every row it would have replaced — so rules 2 and 3 both accept it — and it was
 * destroyed anyway for being 17.6 minutes old, taking its message with it (the
 * refusal path deletes the frame server-side). That is the "away for a while,
 * come back broken" report, reproduced deliberately.
 *
 * Wall-clock age is simply the wrong test whenever we have something better, and
 * when rows exist we do: **a zombie is OLDER than the rows it would replace, a
 * legitimate re-init is NEWER.** Rules 2 and 3 encode exactly that, and they got
 * the measured case right. So the absolute bound now applies only where there is
 * nothing to compare against, which is what its own rationale above describes.
 *
 * Both observed zombie scenarios stay refused: envelopes killing FRESH sessions
 * are older than those rows (rule 3), and the just-reset case has no rows (this
 * bound).
 *
 * KNOWN RESIDUAL GAP: a redelivered zombie that is newer than our own stale rows
 * is now accepted — it needs us to have had no traffic on the session since
 * before the zombie was minted. Fixing that properly means remembering which
 * envelope timestamps we have already processed, independently of the session
 * rows, rather than inferring it from age. Recorded rather than papered over.
 */
export const INIT_ENVELOPE_MAX_AGE_MS = 10 * 60_000;

/**
 * How far ahead of us an envelope may be stamped before we refuse it outright.
 *
 * A timestamp far in the future wins every recency comparison below, so a single
 * bad one would install itself and then block every legitimate re-init after it —
 * nothing can ever be "newer". Server-assigned stamps should never be ahead of us
 * by more than clock skew.
 */
export const INIT_ENVELOPE_MAX_FUTURE_SKEW_MS = 5 * 60_000;

export function isStaleInitEnvelope(
  envelopeTimestamp: number,
  existingRowTimestamps: number[],
  toleranceMs: number = INIT_ENVELOPE_STALENESS_TOLERANCE_MS,
  now: number = Date.now(),
  maxAgeMs: number = INIT_ENVELOPE_MAX_AGE_MS
): boolean {
  // Stamped implausibly far ahead of us — see INIT_ENVELOPE_MAX_FUTURE_SKEW_MS.
  if (envelopeTimestamp - now > INIT_ENVELOPE_MAX_FUTURE_SKEW_MS) return true;

  // Nothing to compare against, so wall-clock age is the only signal we have.
  if (existingRowTimestamps.length === 0) {
    return now - envelopeTimestamp > maxAgeMs;
  }

  // Rule 2: exact replay of the envelope that created a row we still hold.
  // Init-created rows are saved with the envelope's own timestamp.
  if (existingRowTimestamps.includes(envelopeTimestamp)) return true;

  // Rule 3: older than what we already hold, beyond clock skew => zombie.
  // Deliberately NOT age-bounded: an envelope newer than every row it would
  // replace is a legitimate re-init however old the wall clock says it is.
  const newest = Math.max(...existingRowTimestamps);
  return envelopeTimestamp < newest - toleranceMs;
}
