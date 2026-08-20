// Wire dialects of the `dm-update-profile` control message.
//
// Two are live on the network today, and both are shipped:
//
//   FLAT     { type: 'dm-update-profile', senderId, displayName, userIcon, bio? }
//            ← what THIS client sends, same family as its flat receipt acks.
//
//   WRAPPED  { messageId: 'dm-profile-<nonce>', content: { type: 'dm-update-profile', … } }
//            ← what mobile sends (quorum-mobile/services/dm/dmProfileService.ts).
//
// The receive path must accept BOTH. Before this parser existed the intercept
// tested `raw.type` only; mobile's envelope has no top-level `type`, so the
// branch was false, the intercept returned false, and the frame fell through to
// `saveMessage` — PERSISTED as a message in the conversation. That is strictly
// worse than the mirror-image failure mobile fixed on its side, which at least
// consumed the frame cleanly.
//
// Which dialect is canonical is a wire decision that has not been made (see
// §Q1 of 2026-08-20-dm-identity-reveal-desktop-and-shared-plan.md). Receivers
// stay liberal regardless of how it goes, so this module is correct either way.
//
// Mirrors quorum-mobile/services/dm/dmProfileWire.ts — keep the two in step.

/**
 * The identity fields a `dm-update-profile` frame can carry, normalised out of
 * whichever dialect it arrived in.
 *
 * Every field is optional and independently absent: an avatar-only push and a
 * name-only push are both legal, and "absent" must stay distinguishable from
 * "empty" so the applier can tell "no change" from "deliberate clear".
 */
export interface DmProfileUpdatePayload {
  senderId?: string;
  displayName?: string;
  userIcon?: string;
  bio?: string;
  /**
   * A `.q` primary name the sender claims. UNVERIFIED — see the applier, which
   * must store it under a claimed-only key and never in a verified slot.
   *
   * Presence-exact: '' is a deliberate un-election and must survive parsing,
   * which is why every field here is read by type and not by truthiness.
   */
  primaryUsername?: string;
}

type AnyRecord = Record<string, unknown>;

/**
 * Read the identity fields off one object.
 *
 * Type-checked per field rather than spread wholesale: the source is an
 * attacker-controllable decrypted payload, so a non-string in any slot must
 * become `undefined` here rather than reach the conversation row and be
 * rendered or persisted as-is.
 */
function fieldsFrom(src: AnyRecord): DmProfileUpdatePayload {
  return {
    senderId: typeof src.senderId === 'string' ? src.senderId : undefined,
    displayName: typeof src.displayName === 'string' ? src.displayName : undefined,
    userIcon: typeof src.userIcon === 'string' ? src.userIcon : undefined,
    bio: typeof src.bio === 'string' ? src.bio : undefined,
    primaryUsername:
      typeof src.primaryUsername === 'string' ? src.primaryUsername : undefined,
  };
}

/**
 * Match a decrypted DM payload against either dialect.
 *
 * Returns the normalised fields, or `null` when this is not a profile update
 * at all (an ordinary post, a receipt ack, a typing signal, `{}`, `null`).
 * `null` means "not mine" — the caller must fall through to its normal
 * pipeline, exactly as before.
 *
 * WRAPPED IS CHECKED FIRST and wins if both shapes are somehow present on one
 * object: `content` is the authored payload, the top level is envelope
 * plumbing, so the authored one is the one to believe.
 */
export function parseDmProfileUpdate(
  decrypted: unknown
): DmProfileUpdatePayload | null {
  if (!decrypted || typeof decrypted !== 'object') return null;
  const msg = decrypted as AnyRecord;

  const content = msg.content as AnyRecord | undefined;
  if (content && typeof content === 'object' && content.type === 'dm-update-profile') {
    return fieldsFrom(content);
  }
  if (msg.type === 'dm-update-profile') {
    return fieldsFrom(msg);
  }
  return null;
}
