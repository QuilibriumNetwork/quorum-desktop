// "Which X3DH session is the one we currently hold for this peer device?"
//
// An InitializationEnvelope arriving on our DEVICE inbox is not necessarily a
// NEW session. Both clients RE-ANNOUNCE an existing session by wrapping its
// still-advancing ratchet in a fresh init envelope, and they do it on EVERY
// send until the peer's reply confirms the session:
//
//   - desktop, via `DoubleRatchetInboxEncryptForceSenderInit` (same
//     receiving_inbox, same tag, advancing ratchet — no new X3DH);
//   - mobile, via `buildReinitEnvelopeSend` (quorum-mobile
//     hooks/chat/useSendDirectMessage.ts), which reuses the session's STORED
//     X3DH ephemeral for exactly this reason.
//
// The receiver could not tell those apart from a genuinely new session, so it
// tore its session down and rebuilt it on every one. MEASURED 2026-08-24 over a
// 3-round cross-client run: 8 replacements, 7 distinct receiving inboxes, and
// the peer's next message stranded on an address whose row had just been
// deleted ("DM frame for unknown inbox — no encryption state, retained
// unread").
//
// ## Why the ephemeral public key is a SOUND discriminator, not a heuristic
//
// X3DH derives the session key from (sender ephemeral private, sender identity,
// our identity, our signed pre-key). Three of those four are fixed for a given
// pair of devices, so the ephemeral is the only thing that varies: the SAME
// ephemeral necessarily yields the SAME session key, and therefore the same
// session. A genuinely new session — a reinstall, a reset, a second device —
// runs `generateX448()` again and cannot collide.
//
// So this is an equality test on a value that already fully determines the
// answer. It is not "these look similar, probably the same".
//
// ## Why a separate ledger rather than a field on the encryption-state row
//
// Because the row is REWRITTEN, whole, by four other paths that know nothing
// about init envelopes — the send path (MessageService `submitMessage`), both
// conversation-inbox receive branches, and the offline action queue. Any field
// added to the row is silently erased the first time we reply, which is exactly
// when we most need it. This ledger is touched only by the init path, so
// nothing can wipe it by accident.
//
// ## Fail direction: UNKNOWN means "not the same session"
//
// Deliberately asymmetric, because the two errors are not equally bad:
//
//   - saying "different" when it was the same  -> we replace the session, which
//     is precisely the behaviour that shipped for months. Costs a message.
//   - saying "same" when it was different      -> we KEEP a session the peer has
//     abandoned, and the conversation goes dead in one direction until someone
//     resets it. Costs everything after it.
//
// So every uncertainty (no record, storage unreachable, malformed input) reads
// as "different" and takes the old replace-the-session path.
//
// Desktop-only: mobile stores its own ephemeral on the row itself, where its
// row-writing paths preserve it.

import { logger } from '@quilibrium/quorum-shared';

/**
 * localStorage namespace. Sits beside `quorum:dm-reveal` — same mechanism,
 * separate namespace, because the two answer unrelated questions.
 */
const STORAGE_PREFIX = 'quorum:dm-init-session';

function isUsableIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Storage failures are reported ONCE per session, not once per frame.
 *
 * They have to be reported at all: a systematically unreadable store makes this
 * ledger answer "different session" forever, which silently restores the exact
 * bug it was written to remove. But `isSameInitSession` runs on every init
 * envelope, so an unconditional warn would bury the log it is trying to make
 * visible.
 */
let storageFailureReported = false;
function reportStorageFailure(what: string, conversationId: string, err: unknown): void {
  if (storageFailureReported) return;
  storageFailureReported = true;
  logger.warn(
    `[DMInitSessionLedger] ${what} failed — re-announcements will replace the session until storage recovers (reported once)`,
    { conversation: conversationId.slice(0, 16), err }
  );
}

/** Test seam: let a test observe the once-per-session warn more than once. */
export function __resetInitSessionLedgerWarnForTests(): void {
  storageFailureReported = false;
}

/**
 * INVARIANT: key(conversationId, tag) must be INJECTIVE, for the same reason
 * `dmRevealLedger` spells out at length — a hand-rolled `${a}:${b}` template is
 * not injective over arbitrary strings, and a collision here would report one
 * peer device's session as another's. JSON-array encoding is injective by
 * construction from the JSON grammar.
 */
const key = (conversationId: string, tag: string): string =>
  `${STORAGE_PREFIX}:${JSON.stringify([conversationId, tag])}`;

/** The structural prefix of every key(conversationId, <anything>). */
const conversationPrefix = (conversationId: string): string =>
  `${STORAGE_PREFIX}:[${JSON.stringify(conversationId)},`;

/**
 * Remember that the session we just installed for this peer device was derived
 * from this X3DH ephemeral.
 *
 * Call ONLY where a session is actually installed. Recording an ephemeral we
 * did not install would make the next re-announcement of it look like ours.
 */
export function recordInitSession(
  conversationId: string,
  tag: string,
  ephemeralPublicKey: string
): void {
  if (
    !isUsableIdentifier(conversationId) ||
    !isUsableIdentifier(tag) ||
    !isUsableIdentifier(ephemeralPublicKey)
  ) {
    return;
  }
  try {
    localStorage.setItem(key(conversationId, tag), ephemeralPublicKey);
  } catch (err) {
    // Quota, private mode, storage disabled. Not fatal: the NEXT init envelope
    // simply fails to match and takes the old replace-the-session path, which
    // is what shipped before this ledger existed.
    reportStorageFailure('write', conversationId, err);
  }
}

/**
 * Is this init envelope a re-announcement of the session we already hold for
 * this peer device?
 *
 * `false` on anything unknown — see the fail-direction note at the top.
 */
export function isSameInitSession(
  conversationId: string,
  tag: string,
  ephemeralPublicKey: string
): boolean {
  if (
    !isUsableIdentifier(conversationId) ||
    !isUsableIdentifier(tag) ||
    !isUsableIdentifier(ephemeralPublicKey)
  ) {
    return false;
  }
  try {
    return localStorage.getItem(key(conversationId, tag)) === ephemeralPublicKey;
  } catch (err) {
    // Reported, not silent. An unreadable store answers "different session" for
    // every envelope from here on, which is precisely the pre-fix behaviour —
    // and a degradation back into a fixed bug must never be inferable only from
    // the absence of a log line.
    reportStorageFailure('read', conversationId, err);
    return false;
  }
}

/**
 * Forget every recorded session for a conversation.
 *
 * Called wherever the encryption states themselves are wiped (a
 * `delete-conversation` reset). Leaving a record behind after the rows are gone
 * would not cause a wrong answer today — the re-announcement branch also
 * requires a surviving row — but a ledger that outlives what it describes is a
 * trap for the next change, so it is cleared at the same moment.
 */
export function forgetInitSessions(conversationId: string): void {
  if (!isUsableIdentifier(conversationId)) return;
  try {
    const prefix = conversationPrefix(conversationId);
    // Collect first, then remove: removing during iteration reindexes
    // localStorage and silently skips entries.
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch (err) {
    // Storage unreachable. Reads already fail safe, so nothing is left in a
    // wrong state — but it is still the same underlying fault, and reporting it
    // here means a clear-only failure cannot pass unnoticed.
    reportStorageFailure('clear', conversationId, err);
  }
}
