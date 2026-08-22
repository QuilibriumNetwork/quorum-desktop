// The sync gate's membership predicate.
//
// These cases are here rather than in the networked harness because two bots on
// a live relay cannot cheaply produce a revoked device admission, a malformed
// member row, or a roster that has been kicked down to nothing — and those are
// exactly the states where a membership rule fails open or fails silently.
//
// The harness proves the gate works end to end
// (`space-sync-owner-key-forgery`); this proves the rule underneath it is the
// rule we think it is.
import { describe, it, expect } from 'vitest';
import { deriveInboxAddress } from '@quilibrium/quorum-shared';
import type { SpaceMember, SpaceMemberDevice } from '@quilibrium/quorum-shared';
import { classifySyncFrameSigner } from '../../../services/syncFrameAuth';

const SELF = 'QmSelfMemberAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PEER = 'QmPeerMemberBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

/** Any hex string works — the derivation is a hash, not a key operation. */
const PEER_KEY = 'aa'.repeat(57);
const STRANGER_KEY = 'bb'.repeat(57);
const DEVICE_KEY = 'cc'.repeat(57);

const member = (over: Partial<SpaceMember> = {}): SpaceMember =>
  ({
    user_address: PEER,
    address: PEER,
    inbox_address: deriveInboxAddress(PEER_KEY),
    ...over,
  }) as unknown as SpaceMember;

const self = (over: Partial<SpaceMember> = {}): SpaceMember =>
  ({
    user_address: SELF,
    address: SELF,
    inbox_address: 'QmSelfInboxCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    ...over,
  }) as unknown as SpaceMember;

const classify = (
  publicKeyHex: string,
  members: SpaceMember[],
  deviceKeys: SpaceMemberDevice[] = []
) =>
  classifySyncFrameSigner({
    publicKeyHex,
    members,
    deviceKeys,
    selfAddress: SELF,
  });

describe('classifySyncFrameSigner', () => {
  it("accepts a current member's own signing key", () => {
    expect(classify(PEER_KEY, [self(), member()])).toBe('member');
  });

  it('refuses a key belonging to nobody in the space', () => {
    expect(classify(STRANGER_KEY, [self(), member()])).toBe('unbound');
  });

  it('refuses an empty key rather than treating it as unknown-but-fine', () => {
    expect(classify('', [self(), member()])).toBe('unbound');
  });

  describe('a kicked member stops being able to sign for the space', () => {
    // Two representations exist locally and BOTH must exclude. `verify-kicked`
    // sets isKicked (MessageService.ts, verify-kicked handler); the `kick`
    // handler instead clears inbox_address. A rule that only knew about one of
    // them would keep honouring a removed member's frames.
    it('when the kick was recorded as isKicked', () => {
      expect(classify(PEER_KEY, [self(), member({ isKicked: true } as never)])).toBe(
        'unbound'
      );
    });

    it('when the kick was recorded by clearing inbox_address', () => {
      expect(classify(PEER_KEY, [self(), member({ inbox_address: '' } as never)])).toBe(
        'unbound'
      );
    });
  });

  describe('per-device admissions', () => {
    const device = (over: Partial<SpaceMemberDevice> = {}): SpaceMemberDevice =>
      ({
        inboxAddress: deriveInboxAddress(DEVICE_KEY),
        userAddress: PEER,
        revoked: false,
        ...over,
      }) as unknown as SpaceMemberDevice;

    it("accepts a second device's key once its admission has been stored", () => {
      expect(classify(DEVICE_KEY, [self(), member()], [device()])).toBe('member');
    });

    it('refuses a revoked device', () => {
      expect(
        classify(DEVICE_KEY, [self(), member()], [device({ revoked: true })])
      ).toBe('unbound');
    });

    it('refuses an admission whose owning member has been kicked (isKicked)', () => {
      expect(
        classify(
          DEVICE_KEY,
          [self(), member({ isKicked: true } as never)],
          [device()]
        )
      ).toBe('unbound');
    });

    it('refuses an admission whose owner was kicked by CLEARING inbox_address', () => {
      // THE CASE THAT WAS MISSED, found by independent review.
      //
      // The earlier version of these tests checked both kick spellings against
      // the join-bound path only, and this combination — kicked the way the LIVE
      // `kick` handler actually records it (`MessageService.ts:6468-6471`, which
      // clears `inbox_address` and never sets `isKicked`), plus an admitted second
      // device — slipped through every one of them. Shared's device path screens
      // the owning row with `!m.isKicked` alone (`messageAuth.ts:190-193`), so it
      // resolved the kicked member as current.
      //
      // A removed member could therefore have gone on signing `sync-peer-map`
      // frames, which overwrite the space's ratchet state.
      expect(
        classify(
          DEVICE_KEY,
          [self(), member({ inbox_address: '' } as never)],
          [device()]
        )
      ).toBe('unbound');
    });

    it('refuses when the owning row is a bare kick tombstone', () => {
      // `verify-kicked` upserts `{user_address, inbox_address: '', isKicked: true}`
      // for a member it never had a row for. Belt and braces: neither spelling
      // alone should be load-bearing.
      expect(
        classify(
          DEVICE_KEY,
          [
            self(),
            {
              user_address: PEER,
              inbox_address: '',
              isKicked: true,
            } as unknown as SpaceMember,
          ],
          [device()]
        )
      ).toBe('unbound');
    });

    it('falls through to bootstrap — not to member — when the owning row is absent', () => {
      // Documented rather than asserted as a security property: with only our own
      // row present the bootstrap window is open anyway, so the admission is not
      // what admits this frame. Worth pinning so a future change that makes an
      // ownerless admission resolve to `member` is visible.
      expect(classify(DEVICE_KEY, [self()], [device()])).toBe('bootstrap');
    });
  });

  describe('the bootstrap window', () => {
    it('is OPEN while we know of no member but ourselves', () => {
      expect(classify(STRANGER_KEY, [self()])).toBe('bootstrap');
    });

    it('is OPEN on a completely empty roster', () => {
      expect(classify(STRANGER_KEY, [])).toBe('bootstrap');
    });

    it('is CLOSED as soon as one other member is known', () => {
      expect(classify(STRANGER_KEY, [self(), member()])).toBe('unbound');
    });

    it('is CLOSED by a kicked other member too — a kick does not reopen it', () => {
      // Otherwise removing the last other member would hand an ex-member a fresh
      // window in which any key is accepted.
      expect(
        classify(STRANGER_KEY, [self(), member({ isKicked: true } as never)])
      ).toBe('unbound');
    });

    it('is NOT closed by a row carrying no address at all', () => {
      // A malformed/partial row must not count as "another member we know".
      // Counting it would slam the window shut on a client that genuinely still
      // needs it, and the symptom would be a join that never receives anything.
      expect(
        classify(STRANGER_KEY, [
          self(),
          { inbox_address: '' } as unknown as SpaceMember,
        ])
      ).toBe('bootstrap');
    });
  });
});
