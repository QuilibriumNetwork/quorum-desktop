/**
 * The precedence ladder for a bookmarked sender's avatar.
 *
 * Bookmarks no longer carry the avatar — it was 69% of the encrypted config
 * blob (measured 2026-08-05). They carry `senderAddress`, and the avatar is
 * looked up at render. These tests pin two things:
 *
 * 1. the lookup ORDER, which must match the one every other surface uses
 *    (useVisibleSenderProfileFallback), so a bookmark and the message it
 *    points at never disagree about who sent it;
 * 2. that every source actually BELONGS to the sender. A DM conversation
 *    record carries the COUNTERPART's identity, so using it without checking
 *    who sent the message renders the wrong person's face.
 */

import { describe, it, expect, vi } from 'vitest';
import { pickBookmarkSenderIcon } from '@/hooks/business/bookmarks/useBookmarkSenderIcon';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
  usePasskeysContext: () => ({}),
}));

const SENDER = 'QmSender000000000000000000000000000000';
const ME = 'QmSelf00000000000000000000000000000000';

const OVERRIDE = 'data:image/png;base64,OVERRIDE';
const GLOBAL = 'data:image/png;base64,GLOBAL';
const PARTNER = 'data:image/png;base64,PARTNER';
const SELF = 'data:image/png;base64,SELF';
const PUBLIC = 'data:image/png;base64,PUBLIC';

describe('pickBookmarkSenderIcon — order', () => {
  it('prefers a deliberate per-space override over everything', () => {
    expect(
      pickBookmarkSenderIcon(SENDER, {
        memberIcon: OVERRIDE,
        memberGlobalIcon: GLOBAL,
        conversation: { address: SENDER, icon: PARTNER },
        selfIcon: SELF,
        publicProfileIcon: PUBLIC,
      })
    ).toBe(OVERRIDE);
  });

  it('falls to the roster global slot when there is no override', () => {
    expect(
      pickBookmarkSenderIcon(SENDER, {
        memberGlobalIcon: GLOBAL,
        publicProfileIcon: PUBLIC,
      })
    ).toBe(GLOBAL);
  });

  it('uses the DM conversation record when the counterpart is the sender', () => {
    expect(
      pickBookmarkSenderIcon(SENDER, {
        conversation: { address: SENDER, icon: PARTNER },
        publicProfileIcon: PUBLIC,
      })
    ).toBe(PARTNER);
  });

  it('reaches the public profile only when nothing local answered', () => {
    // The public profile is opt-in and off by default, and cached for an hour.
    // Every local source is fresher, so it must stay last.
    expect(pickBookmarkSenderIcon(SENDER, { publicProfileIcon: PUBLIC })).toBe(PUBLIC);
  });

  it('returns undefined when no source has an avatar', () => {
    // Not an error state: UserAvatar renders coloured initials, which is what a
    // sender with no avatar has always shown.
    expect(pickBookmarkSenderIcon(SENDER, {})).toBeUndefined();
  });

  it('treats an empty string as no avatar and keeps descending', () => {
    // Roster fields use '' as a deliberate clear (see the two-slot identity
    // model), so '' must not shadow a lower tier that does have an image.
    expect(
      pickBookmarkSenderIcon(SENDER, {
        memberIcon: '',
        memberGlobalIcon: '',
        publicProfileIcon: PUBLIC,
      })
    ).toBe(PUBLIC);
  });

  it('never returns an empty string', () => {
    expect(
      pickBookmarkSenderIcon(SENDER, {
        memberIcon: '',
        conversation: { address: SENDER, icon: '' },
      })
    ).toBeUndefined();
  });
});

describe('pickBookmarkSenderIcon — the source must belong to the sender', () => {
  // A conversation record is keyed by the PARTNER and carries the PARTNER's
  // identity. Bookmarking your own message in a DM is ordinary, and reading
  // `conversation.icon` blindly puts the other person's face next to your name.
  it('does NOT use the partner avatar for a bookmark of our OWN DM message', () => {
    expect(
      pickBookmarkSenderIcon(ME, {
        conversation: { address: SENDER, icon: PARTNER },
        selfIcon: SELF,
      })
    ).toBe(SELF);
  });

  it('falls all the way through rather than borrowing the partner avatar', () => {
    // Even with nothing else to show, coloured initials beat the wrong face.
    expect(
      pickBookmarkSenderIcon(ME, { conversation: { address: SENDER, icon: PARTNER } })
    ).toBeUndefined();
  });

  it('ignores a group conversation icon, which belongs to no member', () => {
    // A group record has no single counterpart, so `address` matches nobody.
    expect(
      pickBookmarkSenderIcon(SENDER, {
        conversation: { address: undefined, icon: 'data:image/png;base64,GROUP' },
        publicProfileIcon: PUBLIC,
      })
    ).toBe(PUBLIC);
  });

  it('does not match a conversation whose address is missing on both sides', () => {
    // Guard against `undefined === undefined` quietly passing the check.
    expect(
      pickBookmarkSenderIcon('', { conversation: { address: undefined, icon: PARTNER } })
    ).toBeUndefined();
  });

  it('still uses our own avatar for our own message in a SPACE', () => {
    // The space member row is read by (spaceId, senderAddress), so it is always
    // the sender's — self is only the fallback when we hold no row.
    expect(pickBookmarkSenderIcon(ME, { memberIcon: OVERRIDE, selfIcon: SELF })).toBe(
      OVERRIDE
    );
    expect(pickBookmarkSenderIcon(ME, { selfIcon: SELF })).toBe(SELF);
  });
});
