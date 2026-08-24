/**
 * The DM init-session ledger.
 *
 * The property under test is WHICH WAY IT FAILS. Every uncertain path must
 * answer "not the same session", because the opposite answer keeps a session
 * the peer has abandoned and kills the conversation in one direction with no
 * error anyone can see.
 *
 * ⚠️ The fail-safe tests here make `localStorage` GENUINELY THROW, via a spy on
 * `Storage.prototype` — the same technique `dmRevealLedger.unit.test.ts` uses,
 * and for the same reason: a fake store that cannot throw leaves the safety
 * branch unreachable from any test while appearing covered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '@quilibrium/quorum-shared';
import {
  recordInitSession,
  isSameInitSession,
  forgetInitSessions,
  __resetInitSessionLedgerWarnForTests,
} from '@/utils/dmInitSessionLedger';

const CONV = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imAAAA/QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imAAAA';
const OTHER_CONV = 'QmThemThemKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imCCCC/QmThemThemKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imCCCC';
const TAG = 'QmDeviceOneKpYZKYuFu2J49zHXnA8vZtEqHMtpB4im1111';
const OTHER_TAG = 'QmDeviceTwoKpYZKYuFu2J49zHXnA8vZtEqHMtpB4im2222';
const EPH_A = 'aa11bb22cc33dd44';
const EPH_B = 'ff99ee88dd77cc66';

beforeEach(() => {
  localStorage.clear();
  __resetInitSessionLedgerWarnForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  __resetInitSessionLedgerWarnForTests();
});

describe('dmInitSessionLedger', () => {
  it('recognises a re-announcement of the session it recorded', () => {
    recordInitSession(CONV, TAG, EPH_A);
    expect(isSameInitSession(CONV, TAG, EPH_A)).toBe(true);
  });

  it('does NOT recognise a different ephemeral — that is a genuinely new session', () => {
    recordInitSession(CONV, TAG, EPH_A);
    expect(isSameInitSession(CONV, TAG, EPH_B)).toBe(false);
  });

  it('answers false when nothing was ever recorded', () => {
    expect(isSameInitSession(CONV, TAG, EPH_A)).toBe(false);
  });

  it('scopes records per peer device, not per conversation', () => {
    recordInitSession(CONV, TAG, EPH_A);
    expect(isSameInitSession(CONV, OTHER_TAG, EPH_A)).toBe(false);
  });

  it('scopes records per conversation', () => {
    recordInitSession(CONV, TAG, EPH_A);
    expect(isSameInitSession(OTHER_CONV, TAG, EPH_A)).toBe(false);
  });

  it('a later install replaces the recorded ephemeral', () => {
    recordInitSession(CONV, TAG, EPH_A);
    recordInitSession(CONV, TAG, EPH_B);
    expect(isSameInitSession(CONV, TAG, EPH_B)).toBe(true);
    // The old one must stop matching, or a redelivered envelope from the
    // session we just replaced would be treated as a re-announcement of the
    // one we now hold.
    expect(isSameInitSession(CONV, TAG, EPH_A)).toBe(false);
  });

  it('forgetInitSessions clears every device of one conversation and nothing else', () => {
    recordInitSession(CONV, TAG, EPH_A);
    recordInitSession(CONV, OTHER_TAG, EPH_B);
    recordInitSession(OTHER_CONV, TAG, EPH_A);

    forgetInitSessions(CONV);

    expect(isSameInitSession(CONV, TAG, EPH_A)).toBe(false);
    expect(isSameInitSession(CONV, OTHER_TAG, EPH_B)).toBe(false);
    expect(isSameInitSession(OTHER_CONV, TAG, EPH_A)).toBe(true);
  });

  describe('fail direction', () => {
    it.each([
      ['empty conversationId', '', TAG, EPH_A],
      ['empty tag', CONV, '', EPH_A],
      ['empty ephemeral', CONV, TAG, ''],
    ])('refuses to record or match with an %s', (_label, conv, tag, eph) => {
      recordInitSession(conv, tag, eph);
      expect(isSameInitSession(conv, tag, eph)).toBe(false);
    });

    it('a read that throws answers "not the same session"', () => {
      recordInitSession(CONV, TAG, EPH_A);
      expect(isSameInitSession(CONV, TAG, EPH_A)).toBe(true); // control

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage unavailable');
      });
      expect(isSameInitSession(CONV, TAG, EPH_A)).toBe(false);
    });

    it('a write that throws does not throw out of recordInitSession', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      expect(() => recordInitSession(CONV, TAG, EPH_A)).not.toThrow();
      // Nothing stored, so the next envelope takes the replace-the-session
      // path — the behaviour that shipped before this ledger existed.
      vi.restoreAllMocks();
      expect(isSameInitSession(CONV, TAG, EPH_A)).toBe(false);
    });

    it('reports a storage failure once, not once per envelope', () => {
      // The point of the throttle: a broken store makes this ledger answer
      // "different session" forever, which silently restores the old bug. That
      // must be visible — but `isSameInitSession` runs on every init envelope,
      // so an unthrottled warn would bury its own signal.
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage unavailable');
      });
      for (let i = 0; i < 20; i++) isSameInitSession(CONV, TAG, EPH_A);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('a failing sweep does not throw out of forgetInitSessions', () => {
      recordInitSession(CONV, TAG, EPH_A);
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('storage unavailable');
      });
      expect(() => forgetInitSessions(CONV)).not.toThrow();
    });
  });

  describe('key injectivity', () => {
    /**
     * A hand-rolled `${conversationId}:${tag}` key is NOT injective: the pair
     * below collides under it, and a collision would report one peer device's
     * session as another's. The JSON-array encoding cannot produce it.
     */
    it('two different (conversation, tag) pairs cannot collide', () => {
      recordInitSession('A', 'B:C', EPH_A);
      expect(isSameInitSession('A:B', 'C', EPH_A)).toBe(false);
    });
  });
});
