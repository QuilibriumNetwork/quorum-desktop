// "Did I actually write this message?" — answered cryptographically, not by
// asking the message.
//
// ⚠️ THE FIELD YOU WANT TO USE IS A LIE DETECTOR'S FIRST VICTIM.
// `message.content.senderId` is PLAINTEXT the sending client wrote. The Double
// Ratchet proves WHICH SESSION a frame came from; it does not prove anything
// about the JSON inside. A peer running a modified client can put YOUR address
// in `senderId`, and desktop's receive path persists it verbatim — this is a
// known, previously documented property of this codebase (see the DM delete
// authorization note in MessageService.ts, which reaches the same conclusion
// for a different feature).
//
// MEASURED 2026-08-20 (`yarn harness dm-reveal-forgery`), before this module
// existed: a bot that had never been messaged sent ONE ordinary post with
// `content.senderId` set to the victim's own address. It was stored in the
// victim's history, the reveal ledger's history scan read it back as "I have
// messaged this person", and the victim's next profile sweep sent that stranger
// their real display name. One frame, whole feature bypassed.
//
// So anything making a SECURITY decision about authorship must verify a
// signature instead. That is what this module is for.
//
// ── What this proves, and what it does not ────────────────────────────────
//
// PROVES: the message carries an ed448 signature over its own messageId, made
// by the private key matching OUR public key. An attacker cannot manufacture
// one, because they do not have our private key.
//
// DOES NOT PROVE: that the message was authored *in this conversation*. A DM's
// messageId is `SHA-256(nonce + 'post' + senderAddress + text)` and does not
// commit to the conversation, so a signed message of ours that an attacker
// somehow OBTAINED could be replayed into a conversation of theirs. Obtaining
// one is the hard part (our DMs are end-to-end encrypted), but it is not
// impossible — a space co-member can see messages we signed in that space.
// Closing that requires the signature to commit to the conversation, which is a
// wire-format change affecting both clients. Tracked separately; this module
// deliberately does not pretend to solve it.
//
// UNSIGNED MESSAGES NEVER COUNT. Repudiable ("deniable") DMs are unsigned by
// design, and a signing failure is swallowed at send time. For those, this
// returns false and the caller falls back to its own fail-closed behaviour —
// for the reveal ledger that means a partner waits until the next deliberate
// send from this device. That is the safe direction: a missed reveal, never a
// leak.

// `channel_raw`, not `channel`: the ed448 sign/verify primitives live on the
// raw namespace (same import ConfigService.ts uses for signature checks).
import { channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { logger } from '@quilibrium/quorum-shared';

/** The subset of a stored message this check needs. */
export interface SignedMessageLike {
  messageId?: string;
  publicKey?: string;
  signature?: string;
  content?: { senderId?: string };
}

/**
 * Build a predicate that answers "is this message provably authored by us?".
 *
 * @param userPublicKeyHex our own ed448 user public key, hex-encoded — the same
 *   encoding the send path stamps onto `message.publicKey`.
 */
export function createSelfAuthorshipVerifier(
  userPublicKeyHex: string
): (message: unknown) => boolean {
  // No key, no proof. Fail closed rather than degrade to trusting `senderId`.
  if (!userPublicKeyHex) return () => false;

  const publicKeyB64 = Buffer.from(userPublicKeyHex, 'hex').toString('base64');

  return (message) => {
    const m = message as SignedMessageLike;
    // All three are required. `publicKey` matching ours is the cheap
    // pre-filter; the signature is the part an attacker cannot fake, so it is
    // never skipped just because the key looks right.
    if (!m?.messageId || !m.publicKey || !m.signature) return false;
    if (m.publicKey !== userPublicKeyHex) return false;
    try {
      return (
        JSON.parse(
          ch.js_verify_ed448(
            publicKeyB64,
            Buffer.from(m.messageId, 'hex').toString('base64'),
            Buffer.from(m.signature, 'hex').toString('base64')
          )
        ) === true
      );
    } catch (err) {
      // A malformed signature/messageId throws inside the verifier. That is a
      // failed proof, not a reason to trust the message. Debug-level because a
      // hostile peer can trigger this at will and it must not become a way to
      // flood the log.
      logger.debug('[SelfAuthorship] signature check failed', { err });
      return false;
    }
  };
}
