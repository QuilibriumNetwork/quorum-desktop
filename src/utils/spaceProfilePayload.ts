// Builds the `update-profile` payload a device announces to a space.
//
// Pure on purpose: this is where the two-slot rule is actually enforced, and it
// is the rule most likely to be quietly broken by a later edit. Keeping it out
// of MessageService means it can be pinned by tests that need no DB, no keys
// and no network.
//
// See .agents/docs/features/identity-resolution-and-profile-sync.md

import type { BroadcastSpaceTag } from '@quilibrium/quorum-shared';

/** The fields of our own member row that decide the override slot. */
export interface OwnSpaceMemberFields {
  display_name?: string;
  user_icon?: string;
  profile_image?: string;
  bio?: string;
}

/** The fields of the global config that decide the global slot. */
export interface GlobalProfileFields {
  name?: string;
  profile_image?: string;
  bio?: string;
}

// A type alias rather than an interface, deliberately: only an alias gets an
// implicit index signature, which is what lets the whole payload be handed to
// the signature helper as a `Record<string, unknown>` instead of being
// re-listed field by field (and drifting).
export type SpaceProfileWireFields = {
  type: 'update-profile';
  senderId: string;
  displayName?: string;
  userIcon?: string;
  bio?: string;
  globalDisplayName?: string;
  globalUserIcon?: string;
  globalBio?: string;
  spaceTag?: BroadcastSpaceTag | null;
};

/**
 * TWO SLOTS, deliberately kept apart.
 *
 * - **Override slot** (`displayName`/`userIcon`/`bio`) — a deliberate per-space
 *   identity, read from our own member row. Sent only when one really exists;
 *   otherwise OMITTED, which the receiver's merge reads as "no change" and its
 *   render falls back to the global slot.
 * - **Global slot** (`global*`) — our current global identity.
 *
 * Never stamp a global value into an override field. That was the historical
 * bug: it froze each space to whatever the global was at stamp time, made
 * "clear my per-space name" inexpressible, and let a user's own devices race
 * each other for the roster. An empty override field means FOLLOW GLOBAL, and
 * that distinction only survives if this function omits rather than fills.
 *
 * Conversely, the override IS sent when it exists — a member who set a
 * per-space name expects spacemates to see that name, so an announce carrying
 * only the global slot would show the wrong one to anybody bootstrapping a row.
 *
 * `resolvedTag` is THREE-STATE, matching the wire semantics the receiver applies
 * (see `resolveInboundSpaceTag`):
 *
 * - `undefined` → **omit the field**: "I have nothing to say about the tag".
 *   What every caller but one passes. The on-connect announce and the global
 *   profile save are not talking about tags, and if their silence read as a
 *   clear they would strip every member's tag on every reconnect.
 * - `null` → **the tombstone**: the tag was deleted and somebody has to say so.
 *   Only the tag-rotation rebroadcast passes this, because it is the only caller
 *   that fires *because* the tag changed.
 * - an object → set it.
 */
export const buildSpaceProfileWirePayload = (
  selfAddress: string,
  ownMember: OwnSpaceMemberFields | undefined,
  config: GlobalProfileFields,
  resolvedTag?: BroadcastSpaceTag | null
): SpaceProfileWireFields => {
  const nameOverride = ownMember?.display_name || undefined;
  // The member avatar lives on `user_icon` (the typed UserProfile field), but
  // some rows also carry `profile_image` from other write paths, so read both.
  const iconOverride =
    ownMember?.user_icon || ownMember?.profile_image || undefined;
  const bioOverride = ownMember?.bio || undefined;

  const globalName = config.name || undefined;
  const globalIcon = config.profile_image || undefined;
  const globalBioVal = config.bio || undefined;

  return {
    type: 'update-profile',
    senderId: selfAddress,
    ...(nameOverride !== undefined ? { displayName: nameOverride } : {}),
    ...(iconOverride !== undefined ? { userIcon: iconOverride } : {}),
    ...(bioOverride !== undefined ? { bio: bioOverride } : {}),
    ...(globalName !== undefined ? { globalDisplayName: globalName } : {}),
    ...(globalIcon !== undefined ? { globalUserIcon: globalIcon } : {}),
    ...(globalBioVal !== undefined ? { globalBio: globalBioVal } : {}),
    // `!== undefined`, not truthiness: `null` is a deliberate tombstone and has
    // to reach the wire, where truthiness would silently drop it.
    ...(resolvedTag !== undefined ? { spaceTag: resolvedTag } : {}),
  };
};

/**
 * Is there anything worth announcing?
 *
 * A fresh account whose config has not synced yet would otherwise broadcast an
 * all-empty payload: a wire no-op the receiver ignores, which still costs one
 * of the bootstrap's few attempts.
 */
export const hasAnnounceableIdentity = (
  payload: SpaceProfileWireFields
): boolean =>
  Boolean(
    payload.displayName ||
      payload.userIcon ||
      payload.globalDisplayName ||
      payload.globalUserIcon
  );
