// The DM reveal ledger: "this device's user has DELIBERATELY messaged this
// partner at least once."
//
// This is the product's DM privacy rule made storable:
//
//   The SENDER's identity IS shown to the receiver. It is the RECEIVER's
//   identity that stays hidden until they reply — unless they already had
//   previous conversations or sessions with the same sender.
//
// Three consequences, each load-bearing:
//
//   1. Initiating is itself the consent. Messaging or calling someone reveals
//      you to them. Intended, not a leak.
//   2. The asymmetry is the point. They do not see YOU back until you
//      deliberately engage. A reply, or answering a call, is that act.
//   3. Consent belongs to the RELATIONSHIP, not the session. Once you have
//      ever deliberately messaged someone, any new device of theirs is
//      answered without asking you again.
//
// The failure mode all of it prevents: a spammer harvesting your identity by
// merely messaging or ringing you. Your client answers automatic frames on its
// own (delivery receipts, read acks, ICE candidates, hangups), so if any of
// them carried identity, being contacted would be enough to unmask you.
// The invariant: AN AUTOMATIC FRAME REVEALS NOTHING, EVER.
//
// Set ONLY by deliberate sends. Never by receipts, typing, or any automatic
// frame. Consulted by every identity emission: the broadcast sweep, the
// reveal-on-send trigger, and the inbound-new-session auto-announce.
//
// ⚠️ FAILS CLOSED. A storage error, a malformed identifier, any uncertainty
// reads as "not revealed". This is deliberately the OPPOSITE posture from
// `profileSendGate` / `dmProfileGate`, which fail OPEN because their worst
// case is a harmless duplicate push; ours is a privacy leak. DO NOT UNIFY
// THEM — both are correct for their own risk.
//
// Per-device by design. A device that never sent here treats the partner as
// unrevealed until `ensureRevealBootstrap` finds a self-authored message in
// local history. Worst case a friend waits for one reply from THIS device;
// never a leak.
//
// Desktop counterpart of quorum-mobile/services/dm/dmRevealLedger.ts.

import { logger } from '@quilibrium/quorum-shared';

/**
 * localStorage namespace. Sits beside `quorum:dm-profile-broadcast` (the send
 * gate) — same mechanism, separate namespace, because the two answer different
 * questions and must never share a record.
 */
const STORAGE_PREFIX = 'quorum:dm-reveal';

/**
 * An empty string is never a real address, and treating it as one would let two
 * unrelated bad calls (e.g. an address read before auth finished resolving)
 * collide on the exact same ledger key. Rejected at every entry point rather
 * than assuming callers only ever pass a real address — the one thing this
 * module cannot afford is discovering that assumption was wrong from a leak
 * instead of from a refusal.
 */
function isUsableIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * INVARIANT: key(self, partner) must be INJECTIVE — two different (self,
 * partner) pairs must never produce the same stored key, or a reveal recorded
 * for one pair would read back as `true` for an unrelated pair. That is a
 * fail-OPEN path in the one module whose entire purpose is to fail CLOSED.
 *
 * A hand-rolled `${self}:${partner}` template is NOT injective over arbitrary
 * strings: self="A", partner="B:C" and self="A:B", partner="C" both produce
 * "A:B:C". Real addresses are base58 multihashes, which exclude ':', so that
 * was not exploitable today — but NOTHING ENFORCES IT, and an unenforced
 * assumption about caller input is exactly the class of bug this module exists
 * to close off rather than repeat.
 *
 * JSON-array encoding is injective for arbitrary strings BY CONSTRUCTION: an
 * unescaped '"' always closes a JSON string, and JSON.stringify on an array
 * joins elements with a literal ',' outside any string's quotes, so the
 * boundary between self and partner can never be ambiguous. Proved by the JSON
 * grammar, not by scanning input for a forbidden character — a validator has
 * to enumerate every dangerous character and stays only as safe as that
 * enumeration; this has none to enumerate.
 */
const key = (self: string, partner: string): string =>
  `${STORAGE_PREFIX}:${JSON.stringify([self, partner])}`;

/**
 * The structural prefix of every key(self, <anything>).
 *
 * Safe for `startsWith` for the same injectivity reason: `JSON.stringify(self)`
 * is unique to that exact string, so this prefix cannot be produced by any
 * other self and a scoped sweep cannot silently widen into a broader one.
 */
const selfPrefix = (self: string): string =>
  `${STORAGE_PREFIX}:[${JSON.stringify(self)},`;

/**
 * In-memory memo so a hot path (the broadcast sweep, a list render) never
 * re-reads localStorage for the same pair twice in one session.
 *
 * Positive AND negative memos are safe because `recordReveal` updates both
 * layers, and a failed READ is deliberately never memoized (see below) so a
 * transient storage failure cannot pin a pair to `false` for the session.
 */
const memo = new Map<string, boolean>();

/** Test seam: drop the in-memory layer so a test observes real storage. */
export function __resetRevealMemoForTests(): void {
  memo.clear();
}

/**
 * Has this device's user deliberately messaged this partner?
 *
 * Fail-CLOSED read: unusable identifiers and storage errors both answer
 * `false`. A `false` here is never persisted, so a later deliberate send still
 * flips it.
 */
export function hasRevealedTo(selfAddress: string, partnerAddress: string): boolean {
  if (!isUsableIdentifier(selfAddress) || !isUsableIdentifier(partnerAddress)) return false;
  const k = key(selfAddress, partnerAddress);
  const m = memo.get(k);
  if (m !== undefined) return m;
  try {
    const v = localStorage.getItem(k) != null;
    memo.set(k, v);
    return v;
  } catch {
    // Fail CLOSED, and deliberately NOT memoized: a transient storage failure
    // must not pin this pair to "stranger" for the rest of the session.
    return false;
  }
}

/**
 * Record consent. Call ONLY from a deliberate user act — a send, a reply, an
 * answered call. Never from a receipt, a typing signal, or any frame the
 * client emits on its own.
 */
export function recordReveal(
  selfAddress: string,
  partnerAddress: string,
  now: number
): void {
  // A malformed identifier can never be a real relationship — refuse the write
  // rather than store a record under a key nothing legitimate can look up by
  // its real address.
  if (!isUsableIdentifier(selfAddress) || !isUsableIdentifier(partnerAddress)) return;
  const k = key(selfAddress, partnerAddress);
  try {
    localStorage.setItem(k, JSON.stringify({ at: now }));
    memo.set(k, true);
  } catch (err) {
    // Storage failed (quota, private mode, disabled): memo only. The reveal
    // re-derives from message history next launch — the send that set it IS
    // the history. Logged because a systematic failure would otherwise degrade
    // every device to bootstrap-only reveals with no signal that anything is
    // wrong. Address truncated: a raw one is identity-bearing, and debug logs
    // get pasted into issues and chats.
    memo.set(k, true);
    logger.warn(
      `[DMRevealLedger] write failed for ${partnerAddress.slice(0, 16)} — reveal stays memo-only this session`,
      { err }
    );
  }
}

/**
 * Forget consent. With `partnerAddress` omitted, clears every record for
 * `selfAddress`.
 */
export function clearReveal(selfAddress: string, partnerAddress?: string): void {
  // A malformed self can hold no legitimate record (recordReveal refuses to
  // write one under it), so refuse outright rather than compute a prefix sweep
  // from it. Over-clearing would be safe for privacy but not for correctness —
  // it would destroy real consent records for a self that never held any
  // degenerate ones — and a flat refusal is simpler to reason about than
  // trusting the prefix math to stay narrow for every malformed input, now and
  // after future edits.
  if (!isUsableIdentifier(selfAddress)) return;
  try {
    if (isUsableIdentifier(partnerAddress)) {
      const k = key(selfAddress, partnerAddress);
      localStorage.removeItem(k);
      memo.delete(k);
      return;
    }
    const prefix = selfPrefix(selfAddress);
    // Collect first, then remove: removing during iteration reindexes
    // localStorage and silently skips entries.
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
    for (const k of Array.from(memo.keys())) {
      if (k.startsWith(prefix)) memo.delete(k);
    }
  } catch {
    // Storage unreachable — drop the memo so nothing keeps answering `true`
    // from a layer we can no longer clear. Fails toward "stranger", as always.
    memo.clear();
  }
}

/**
 * Pure: does this page of a DM's history contain a message WE PROVABLY authored?
 *
 * ⚠️ `content.senderId` IS NOT EVIDENCE AND IS NOT READ HERE. It is plaintext
 * the sending client writes, and both clients persist it verbatim, so a
 * stranger can put YOUR address on a message they sent you. MEASURED 2026-08-20
 * (`yarn harness dm-reveal-forgery`): one such message flipped the ledger and
 * leaked the victim's real name to the attacker on the next sweep.
 *
 * The only field consulted is `authenticatedSenderId`, stamped at persist time
 * from what the crypto layer authenticated and never taken off the wire (see
 * `Message.authenticatedSenderId` in quorum-shared, and MessageService's
 * `saveMessage`, which overwrites it AFTER the spread so a forged payload value
 * cannot survive).
 *
 * ⚠️ WHY NOT ALSO ACCEPT AN ED448 SIGNATURE, which an earlier revision of this
 * branch used. Because "marker OR signature" is only as strong as its weakest
 * branch, and the signature branch is replayable: a DM messageId is
 * SHA-256(nonce + 'post' + senderAddress + text) and does not commit to the
 * conversation, so a message we signed elsewhere (a space co-member can see
 * those) verifies fine when replanted into a stranger's conversation. Adding it
 * back as an alternative reopens exactly the hole this replaced.
 *
 * ⚠️ ABSENT MEANS UNKNOWN. Rows written before the marker existed carry
 * nothing, so they cannot prove authorship. That is fail-safe by design: the
 * cost is a partner waiting for one more deliberate send from this device, and
 * the alternative is trusting a field an attacker controls.
 */
export function messagesContainSelfAuthored(
  messages: readonly { authenticatedSenderId?: string }[] | undefined,
  selfAddress: string
): boolean {
  if (!isUsableIdentifier(selfAddress) || !Array.isArray(messages)) return false;
  return messages.some((m) => m?.authenticatedSenderId === selfAddress);
}

/**
 * How much history the one-time bootstrap scans. One page, newest-first: a real
 * relationship has a self-authored message in its recent window, and an
 * inbound-only stranger row has none at any depth.
 */
const BOOTSTRAP_SCAN_LIMIT = 200;

/**
 * Ledger check, with one-time derivation from local history for conversations
 * that predate the ledger.
 *
 * DM messages are stored under (spaceId = partner, channelId = partner).
 *
 * ⚠️ This is also what makes the ledger correct PER DEVICE. A message sent
 * from device A syncs to device B, and scanning local history is what lets B
 * answer correctly. Note the limit of the marker here: our own message arriving
 * on B through the partner-keyed session is stamped with the PARTNER, not us,
 * so it does not prove authorship on B. B then waits for its own first
 * deliberate send — the documented per-device posture, and fail-safe.
 *
 * A positive is cached. A NEGATIVE IS NEVER PERSISTED, so a later deliberate
 * send still flips the answer through `recordReveal`.
 */
export async function ensureRevealBootstrap(
  selfAddress: string,
  partnerAddress: string,
  getMessages: (p: {
    spaceId: string;
    channelId: string;
    limit?: number;
  }) => Promise<{ messages: { authenticatedSenderId?: string }[] }>
): Promise<boolean> {
  if (hasRevealedTo(selfAddress, partnerAddress)) return true;
  if (!isUsableIdentifier(selfAddress) || !isUsableIdentifier(partnerAddress)) return false;
  try {
    const { messages } = await getMessages({
      spaceId: partnerAddress,
      channelId: partnerAddress,
      limit: BOOTSTRAP_SCAN_LIMIT,
    });
    if (messagesContainSelfAuthored(messages, selfAddress)) {
      recordReveal(selfAddress, partnerAddress, Date.now());
      return true;
    }
    return false;
  } catch {
    return false; // fail CLOSED
  }
}
