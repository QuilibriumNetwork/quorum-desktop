import { describe, expect, it } from 'vitest';
import {
  FRAME_RETRY_MAX_ATTEMPTS,
  FRAME_RETRY_TTL_MS,
  UndecryptableFrameTracker,
  frameKey,
} from '../../../utils/frameRetry';

const NOW = 1_784_979_000_000;

describe('frameKey', () => {
  it('distinguishes two frames that share a timestamp', () => {
    // The defect this exists for: server timestamps are NOT unique, so frame
    // identity must come from content.
    expect(frameKey('QmInbox', '{"envelope":"aaa"}')).not.toBe(
      frameKey('QmInbox', '{"envelope":"bbb"}')
    );
  });

  it('is stable for the same frame on the same inbox', () => {
    expect(frameKey('QmInbox', '{"envelope":"aaa"}')).toBe(
      frameKey('QmInbox', '{"envelope":"aaa"}')
    );
  });

  it('separates identical payloads arriving on different inboxes', () => {
    expect(frameKey('QmA', 'same')).not.toBe(frameKey('QmB', 'same'));
  });
});

describe('UndecryptableFrameTracker', () => {
  it('keeps a frame for retry instead of deleting it on first failure', () => {
    const t = new UndecryptableFrameTracker();
    // This is the whole point: a frame that fails now may decrypt once the
    // ratchet advances and stores the skipped keys.
    expect(t.recordFailure('f1', NOW)).toBe(false);
  });

  it('gives up once the attempt budget is spent', () => {
    const t = new UndecryptableFrameTracker();
    for (let i = 1; i < FRAME_RETRY_MAX_ATTEMPTS; i++) {
      expect(t.recordFailure('f1', NOW)).toBe(false);
    }
    expect(t.recordFailure('f1', NOW)).toBe(true); // budget exhausted -> delete
  });

  it('gives up once the frame is older than the TTL, even with attempts left', () => {
    const t = new UndecryptableFrameTracker();
    expect(t.recordFailure('f1', NOW)).toBe(false);
    expect(t.recordFailure('f1', NOW + FRAME_RETRY_TTL_MS)).toBe(true);
  });

  it('forgets a frame once it finally decrypts, so its budget resets', () => {
    const t = new UndecryptableFrameTracker();
    t.recordFailure('f1', NOW);
    t.recordFailure('f1', NOW);
    t.clear('f1');
    expect(t.size()).toBe(0);
    expect(t.recordFailure('f1', NOW)).toBe(false); // fresh budget
  });

  it('tracks frames independently', () => {
    const t = new UndecryptableFrameTracker();
    for (let i = 1; i < FRAME_RETRY_MAX_ATTEMPTS; i++) t.recordFailure('f1', NOW);
    expect(t.recordFailure('f2', NOW)).toBe(false); // f1's budget must not affect f2
  });

  it('stays bounded under a flood of distinct undecryptable frames', () => {
    const t = new UndecryptableFrameTracker(FRAME_RETRY_MAX_ATTEMPTS, FRAME_RETRY_TTL_MS, 50);
    for (let i = 0; i < 5000; i++) t.recordFailure(`ghost-${i}`, NOW);
    expect(t.size()).toBeLessThanOrEqual(50);
  });
});
