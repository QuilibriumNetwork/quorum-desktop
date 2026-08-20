/**
 * The `dm-update-profile` dialect parser.
 *
 * The bug this pins: desktop tested `raw.type` only, mobile's envelope carries
 * no top-level `type`, so a mobile rename matched nothing, the intercept
 * returned false, and the frame was PERSISTED as a message in the conversation
 * (MessageService.ts — intercept at ~:907, saveMessage at ~:4222).
 *
 * The negative cases matter as much as the positive ones: this parser sits in
 * front of every decrypted DM payload on the receive path, so a false positive
 * would silently swallow real messages.
 */
import { describe, it, expect } from 'vitest';
import { parseDmProfileUpdate } from '@/utils/dmProfileWire';

const SENDER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imAAAA';

describe('parseDmProfileUpdate — both dialects', () => {
  it('parses the FLAT dialect (what desktop sends)', () => {
    expect(
      parseDmProfileUpdate({
        type: 'dm-update-profile',
        senderId: SENDER,
        displayName: 'Ada',
        userIcon: 'icon-a',
        bio: 'hi',
      })
    ).toEqual({
      senderId: SENDER,
      displayName: 'Ada',
      userIcon: 'icon-a',
      bio: 'hi',
      primaryUsername: undefined,
    });
  });

  it('parses the WRAPPED dialect (what mobile sends)', () => {
    // Shape copied from quorum-mobile/services/dm/dmProfileService.ts:99 —
    // a full Message envelope, synthetic messageId, NO top-level `type`.
    expect(
      parseDmProfileUpdate({
        messageId: 'dm-profile-3f2b1c',
        channelId: SENDER,
        spaceId: SENDER,
        createdDate: 1_700_000_000_000,
        content: {
          type: 'dm-update-profile',
          senderId: SENDER,
          displayName: 'Ada Mobile',
          userIcon: 'icon-m',
        },
      })
    ).toEqual({
      senderId: SENDER,
      displayName: 'Ada Mobile',
      userIcon: 'icon-m',
      bio: undefined,
      primaryUsername: undefined,
    });
  });

  it('WRAPPED wins when both shapes are present on one object', () => {
    // `content` is the authored payload; the top level is envelope plumbing.
    const parsed = parseDmProfileUpdate({
      type: 'dm-update-profile',
      senderId: SENDER,
      displayName: 'from-top-level',
      content: {
        type: 'dm-update-profile',
        senderId: SENDER,
        displayName: 'from-content',
      },
    });
    expect(parsed?.displayName).toBe('from-content');
  });

  it('carries primaryUsername through both dialects', () => {
    expect(
      parseDmProfileUpdate({
        type: 'dm-update-profile',
        senderId: SENDER,
        primaryUsername: 'ada.q',
      })?.primaryUsername
    ).toBe('ada.q');
    expect(
      parseDmProfileUpdate({
        content: { type: 'dm-update-profile', senderId: SENDER, primaryUsername: 'ada.q' },
      })?.primaryUsername
    ).toBe('ada.q');
  });

  it("preserves '' as a deliberate un-election rather than dropping it", () => {
    // Presence-exact. If this ever reads by truthiness, clearing a primary name
    // on one client silently never clears it on the other.
    const parsed = parseDmProfileUpdate({
      type: 'dm-update-profile',
      senderId: SENDER,
      primaryUsername: '',
      bio: '',
    });
    expect(parsed?.primaryUsername).toBe('');
    expect(parsed?.bio).toBe('');
  });
});

describe('parseDmProfileUpdate — everything else must NOT match', () => {
  // This parser runs in front of every decrypted DM payload. A false positive
  // here does not merely mis-apply a profile: it CONSUMES the frame, so a real
  // message would vanish without a trace.
  const nonMatches: [string, unknown][] = [
    ['delivery-ack', { type: 'delivery-ack', senderId: SENDER, messageIds: ['a'] }],
    ['read-ack', { type: 'read-ack', senderId: SENDER, upToMessageId: 'a', upToTimestamp: 1 }],
    ['typing-start', { type: 'typing-start', senderId: SENDER }],
    ['typing-stop', { type: 'typing-stop', senderId: SENDER }],
    ['an ordinary post', { messageId: 'abc', content: { type: 'post', senderId: SENDER, text: 'hello' } }],
    ['a space update-profile', { type: 'update-profile', senderId: SENDER, displayName: 'Ada' }],
    ['empty object', {}],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'dm-update-profile'],
    ['a number', 42],
    ['an array', [{ type: 'dm-update-profile' }]],
    ['content present but not an object', { content: 'dm-update-profile' }],
    ['content of the wrong type', { content: { type: 'post', senderId: SENDER } }],
  ];

  it.each(nonMatches)('returns null for %s', (_label, input) => {
    expect(parseDmProfileUpdate(input)).toBeNull();
  });
});

describe('parseDmProfileUpdate — hostile field types are dropped, not forwarded', () => {
  // The payload is attacker-controllable: it is whatever decrypted. A non-string
  // in an identity slot must never reach the conversation row.
  it('drops non-string fields to undefined instead of passing them through', () => {
    const parsed = parseDmProfileUpdate({
      type: 'dm-update-profile',
      senderId: { toString: () => SENDER },
      displayName: 12345,
      userIcon: ['icon'],
      bio: { nested: true },
      primaryUsername: null,
    });
    expect(parsed).toEqual({
      senderId: undefined,
      displayName: undefined,
      userIcon: undefined,
      bio: undefined,
      primaryUsername: undefined,
    });
  });
});
