/**
 * The dev-only QNS overlay.
 *
 * Tested despite being dev-only because it is an INSTRUMENT: everything an
 * operator concludes about where `.q` names render is downstream of it. An
 * overlay that quietly failed open ("no fake applied") would read on screen as
 * "this surface does not show `.q` names" — a false negative that sends someone
 * hunting a bug in the render path that does not exist.
 *
 * These cases mirror mobile's `__tests__/fakeQns.test.ts` deliberately. The
 * tool's whole purpose is comparing what the two clients render for the same
 * member, which only means anything if both cores behave identically. If a case
 * here changes, change it there.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyFakeQns,
  clearFakeQns,
  deriveFakeQName,
  setFakeQnsEntry,
  setFakeQnsState,
  type FakeablePublicProfile,
} from '../../fake-qns/fakeQnsCore';

const A = 'QmAlice1111111111111111111111111111111111';
const B = 'QmBob22222222222222222222222222222222222222';

const realProfile: FakeablePublicProfile = {
  display_name: 'Real Name',
  profile_image: 'img',
  bio: 'real bio',
  timestamp: 500,
  signature: 'sig',
};

beforeEach(() => clearFakeQns());

describe('applyFakeQns — inert unless enabled', () => {
  it('passes a real profile through untouched when disabled', () => {
    setFakeQnsState({ enabled: false, giveEveryoneAName: true });
    expect(applyFakeQns(A, realProfile)).toBe(realProfile);
  });

  it('passes a 404 through untouched when disabled', () => {
    setFakeQnsState({ enabled: false, giveEveryoneAName: true });
    expect(applyFakeQns(A, null)).toBeNull();
  });

  it('leaves a profile alone when enabled but no rule matches', () => {
    setFakeQnsState({ enabled: true });
    expect(applyFakeQns(A, realProfile)).toBe(realProfile);
  });
});

describe('applyFakeQns — give everyone a name', () => {
  beforeEach(() => setFakeQnsState({ enabled: true, giveEveryoneAName: true }));

  it('adds a .q to a real profile without clobbering its other fields', () => {
    const out = applyFakeQns(A, realProfile);
    expect(out?.primary_username).toBe(deriveFakeQName(A));
    expect(out?.display_name).toBe('Real Name');
    expect(out?.bio).toBe('real bio');
    expect(out?.profile_image).toBe('img');
  });

  it('SYNTHESIZES a profile for someone who has none', () => {
    // The case that makes the tool usable at all: a test account's spacemates
    // usually have no published profile, so decorating only existing ones would
    // decorate nothing.
    const out = applyFakeQns(A, null);
    expect(out).not.toBeNull();
    expect(out?.primary_username).toBe(deriveFakeQName(A));
  });

  it('gives different addresses different names, stably', () => {
    expect(deriveFakeQName(A)).not.toBe(deriveFakeQName(B));
    expect(deriveFakeQName(A)).toBe(deriveFakeQName(A));
  });

  it('derives the same name mobile would, so the clients stay comparable', () => {
    // Hard-coded rather than recomputed: a test that mirrors the implementation
    // would pass through any change to it, which is exactly what must not
    // happen to a value shared with another repo.
    expect(deriveFakeQName('QmAlice1111111111111111111111111111111111')).toBe(
      'qaalic'
    );
  });

  it('never fakes over a REAL published .q', () => {
    const out = applyFakeQns(A, { ...realProfile, primary_username: 'genuine' });
    expect(out?.primary_username).toBe('genuine');
  });

  it('stamps a fresh timestamp so a faked global name is not lost to the merge', () => {
    const before = Date.now();
    const out = applyFakeQns(A, realProfile);
    expect(out!.timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('applyFakeQns — private profiles', () => {
  it('returns nothing for every address when all-private is on', () => {
    setFakeQnsState({ enabled: true, allProfilesPrivate: true });
    expect(applyFakeQns(A, realProfile)).toBeNull();
  });

  it('all-private outranks give-everyone-a-name', () => {
    setFakeQnsState({
      enabled: true,
      allProfilesPrivate: true,
      giveEveryoneAName: true,
    });
    expect(applyFakeQns(A, realProfile)).toBeNull();
  });

  it('marks a single address private, leaving others alone', () => {
    setFakeQnsState({ enabled: true, giveEveryoneAName: true });
    setFakeQnsEntry(A, { private: true });
    expect(applyFakeQns(A, realProfile)).toBeNull();
    expect(applyFakeQns(B, realProfile)?.primary_username).toBe(
      deriveFakeQName(B)
    );
  });
});

describe('applyFakeQns — per-address entries', () => {
  it('an explicit entry wins over the everyone rule', () => {
    setFakeQnsState({ enabled: true, giveEveryoneAName: true });
    setFakeQnsEntry(A, { primaryUsername: 'pinned' });
    expect(applyFakeQns(A, realProfile)?.primary_username).toBe('pinned');
  });

  it('an entry with only a global name gets no .q, even under the everyone rule', () => {
    // Otherwise there is no way to build the control arm — a member who has a
    // global name and NO `.q`, to prove the `.q` is what is winning elsewhere.
    setFakeQnsState({ enabled: true, giveEveryoneAName: true });
    setFakeQnsEntry(A, { displayName: 'Only Global' });
    const out = applyFakeQns(A, realProfile);
    expect(out?.primary_username).toBeUndefined();
    expect(out?.display_name).toBe('Only Global');
  });

  it('matches the address case-insensitively', () => {
    setFakeQnsState({ enabled: true });
    setFakeQnsEntry(A.toUpperCase(), { primaryUsername: 'pinned' });
    expect(applyFakeQns(A, realProfile)?.primary_username).toBe('pinned');
  });
});
