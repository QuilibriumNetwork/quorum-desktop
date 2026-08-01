// What a device announces about itself to a space.
//
// Two rules meet here and they pull in opposite directions, which is why both
// need pinning:
//
//   1. A deliberate per-space name MUST travel, or a member who set one would
//      be shown under their global name to anybody bootstrapping a fresh row.
//   2. A global value must NEVER be written into an override field. That was
//      the historical roster-stamping bug: it froze each space to whatever the
//      global was at stamp time and made "clear my per-space name"
//      inexpressible, because clearing it just re-stamped the global back.
//
// Rule 2 is why absence is expressed by OMITTING the field rather than sending
// an empty one — on this wire an omitted field means "no change" and `''` means
// "deliberately cleared, follow global".
//
// See .agents/docs/features/identity-resolution-and-profile-sync.md

import { describe, it, expect } from 'vitest';
import {
  buildSpaceProfileWirePayload,
  hasAnnounceableIdentity,
} from '../../../utils/spaceProfilePayload';

const SELF = 'QmSelfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const GLOBAL = {
  name: 'Ada Lovelace',
  profile_image: 'data:image/jpeg;base64,/9j/GLOBAL',
  bio: 'mathematician',
};

describe('the global slot', () => {
  it('carries the current global identity', () => {
    const p = buildSpaceProfileWirePayload(SELF, undefined, GLOBAL);
    expect(p.globalDisplayName).toBe('Ada Lovelace');
    expect(p.globalUserIcon).toBe('data:image/jpeg;base64,/9j/GLOBAL');
    expect(p.globalBio).toBe('mathematician');
  });

  it('identifies the sender', () => {
    expect(buildSpaceProfileWirePayload(SELF, undefined, GLOBAL).senderId).toBe(
      SELF
    );
    expect(buildSpaceProfileWirePayload(SELF, undefined, GLOBAL).type).toBe(
      'update-profile'
    );
  });

  it('omits a global field the user has not set', () => {
    const p = buildSpaceProfileWirePayload(SELF, undefined, { name: 'Ada' });
    expect('globalUserIcon' in p).toBe(false);
    expect('globalBio' in p).toBe(false);
  });
});

describe('the override slot — rule 2, never stamp the global into it', () => {
  // The normal state post-follow-global: the member row exists but its override
  // fields are empty, meaning "follow global".
  it('omits every override field when no override is set', () => {
    const p = buildSpaceProfileWirePayload(
      SELF,
      { display_name: '', user_icon: '', bio: '' },
      GLOBAL
    );
    expect('displayName' in p).toBe(false);
    expect('userIcon' in p).toBe(false);
    expect('bio' in p).toBe(false);
  });

  it('omits them when there is no member row at all', () => {
    const p = buildSpaceProfileWirePayload(SELF, undefined, GLOBAL);
    expect('displayName' in p).toBe(false);
    expect('userIcon' in p).toBe(false);
  });

  // The regression that would matter most: sending the global name as an
  // override makes every receiver record a fake deliberate override, which
  // then wins over the sender's real global name forever.
  it('does not leak the global name into the override field', () => {
    const p = buildSpaceProfileWirePayload(SELF, undefined, GLOBAL);
    expect(p.displayName).toBeUndefined();
    expect(p.userIcon).toBeUndefined();
    expect(p.globalDisplayName).toBe('Ada Lovelace');
  });
});

describe('the override slot — rule 1, a real per-space identity must travel', () => {
  it('sends a per-space name alongside the global one', () => {
    const p = buildSpaceProfileWirePayload(
      SELF,
      { display_name: 'Ada (this space)' },
      GLOBAL
    );
    expect(p.displayName).toBe('Ada (this space)');
    // Both slots go out: the receiver stores them separately and renders
    // override-else-global, so the global is still learned.
    expect(p.globalDisplayName).toBe('Ada Lovelace');
  });

  it('sends a per-space avatar and bio', () => {
    const p = buildSpaceProfileWirePayload(
      SELF,
      { user_icon: 'data:image/jpeg;base64,/9j/SPACE', bio: 'here, I lurk' },
      GLOBAL
    );
    expect(p.userIcon).toBe('data:image/jpeg;base64,/9j/SPACE');
    expect(p.bio).toBe('here, I lurk');
  });

  // Rows written by different paths disagree about which field holds the
  // avatar, and reading only one of them silently drops a real override.
  it('reads the avatar from profile_image when user_icon is absent', () => {
    const p = buildSpaceProfileWirePayload(
      SELF,
      { profile_image: 'data:image/jpeg;base64,/9j/ALT' },
      GLOBAL
    );
    expect(p.userIcon).toBe('data:image/jpeg;base64,/9j/ALT');
  });

  it('prefers user_icon when both are present', () => {
    const p = buildSpaceProfileWirePayload(
      SELF,
      { user_icon: 'primary', profile_image: 'secondary' },
      GLOBAL
    );
    expect(p.userIcon).toBe('primary');
  });

  it('an override on one field does not drag the others along', () => {
    const p = buildSpaceProfileWirePayload(
      SELF,
      { display_name: 'Ada (this space)' },
      GLOBAL
    );
    expect('userIcon' in p).toBe(false);
    expect('bio' in p).toBe(false);
  });
});

describe('the space tag', () => {
  it('is omitted unless one is supplied', () => {
    expect(
      'spaceTag' in buildSpaceProfileWirePayload(SELF, undefined, GLOBAL)
    ).toBe(false);
  });

  it('rides along when supplied', () => {
    const tag = { letters: 'QQQ', url: 'https://example.test/t', spaceId: 's1' };
    const p = buildSpaceProfileWirePayload(SELF, undefined, GLOBAL, tag);
    expect(p.spaceTag).toEqual(tag);
  });
});

describe('hasAnnounceableIdentity', () => {
  // A fresh account whose config has not synced would otherwise broadcast an
  // all-empty payload — a no-op the receiver ignores, which still spends one of
  // the bootstrap's few attempts.
  it('is false when there is nothing to say', () => {
    const p = buildSpaceProfileWirePayload(SELF, undefined, {});
    expect(hasAnnounceableIdentity(p)).toBe(false);
  });

  it('is true on a global name alone', () => {
    const p = buildSpaceProfileWirePayload(SELF, undefined, { name: 'Ada' });
    expect(hasAnnounceableIdentity(p)).toBe(true);
  });

  it('is true on an avatar alone', () => {
    const p = buildSpaceProfileWirePayload(SELF, undefined, {
      profile_image: 'data:image/jpeg;base64,/9j/X',
    });
    expect(hasAnnounceableIdentity(p)).toBe(true);
  });

  it('is true on a per-space override alone', () => {
    const p = buildSpaceProfileWirePayload(
      SELF,
      { display_name: 'Ada (this space)' },
      {}
    );
    expect(hasAnnounceableIdentity(p)).toBe(true);
  });

  // A bio with no name or avatar is not an identity anybody renders, and it
  // would still cost an attempt.
  it('is false on a bio alone', () => {
    const p = buildSpaceProfileWirePayload(SELF, undefined, { bio: 'hello' });
    expect(hasAnnounceableIdentity(p)).toBe(false);
  });
});
