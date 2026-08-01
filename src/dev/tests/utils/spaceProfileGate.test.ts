// The space announce is a BOOTSTRAP, not a cadence, and these tests pin the
// difference. Its two failure modes are not symmetric with the DM gate's:
//
//   too loose  → every reconnect re-broadcasts an avatar to EVERY member of
//                every space (bytes scale as spaces × members, the most
//                expensive identity traffic in the app)
//   too strict → a member nobody holds a row for stays a truncated address,
//                because the digest exchange can only reconcile rows that
//                exist and cannot invent one
//
// So: capped like the DM gate, but spaced in minutes rather than days, because
// past the bootstrap the member digest exchange is the repair path.
//
// Context: .agents/tasks/2026-08-01-space-member-identity-announce-on-connect.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  spaceProfileSignature,
  shouldAnnounceSpaceProfile,
  recordSpaceProfileAnnounce,
  claimSpaceProfileAnnounce,
  releaseSpaceProfileAnnounce,
  SPACE_ANNOUNCE_MIN_GAP_MS,
  MAX_SENDS_PER_SPACE_IDENTITY,
} from '../../../utils/spaceProfileGate';
import { shouldSendDmProfile, dmProfileSignature } from '../../../utils/dmProfileGate';

const SELF = 'QmSelfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SPACE = 'space-alpha';
const OTHER_SPACE = 'space-beta';

const T0 = 1_750_000_000_000;
const SIG = spaceProfileSignature({
  globalDisplayName: 'Ada',
  globalUserIcon: 'icon',
});

beforeEach(() => {
  localStorage.clear();
  // In-flight claims live in the gate closure, so they must be cleared between
  // tests or a claim leaks into the next one.
  releaseSpaceProfileAnnounce(SELF, SPACE, SIG);
  releaseSpaceProfileAnnounce(SELF, OTHER_SPACE, SIG);
});

describe('spaceProfileSignature', () => {
  it('is stable for the same payload regardless of key order', () => {
    expect(
      spaceProfileSignature({ globalDisplayName: 'Ada', globalUserIcon: 'i' })
    ).toBe(
      spaceProfileSignature({ globalUserIcon: 'i', globalDisplayName: 'Ada' })
    );
  });

  it('changes when a value changes (a rename must re-announce)', () => {
    expect(spaceProfileSignature({ globalDisplayName: 'Ada' })).not.toBe(
      spaceProfileSignature({ globalDisplayName: 'Ada L.' })
    );
  });

  // The two slots are different information. A per-space override and a global
  // name that happen to share a value are NOT the same announcement, and one
  // must not gate the other out.
  it('distinguishes the override slot from the global slot', () => {
    expect(spaceProfileSignature({ displayName: 'Ada' })).not.toBe(
      spaceProfileSignature({ globalDisplayName: 'Ada' })
    );
  });

  // `''` is a deliberate CLEAR on this wire (revert to follow-global), which is
  // a real change and must not read as "field absent".
  it('distinguishes a cleared override from an omitted one', () => {
    expect(spaceProfileSignature({ displayName: '' })).not.toBe(
      spaceProfileSignature({})
    );
  });

  // It stores a folded digest rather than the payload: the payload carries a
  // base64 avatar, and a verbatim per-space record would put tens of kilobytes
  // of our OWN avatar into localStorage, once per space.
  it('stays compact even for an avatar-sized payload', () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(40_000);
    expect(spaceProfileSignature({ globalUserIcon: big }).length).toBeLessThan(64);
  });

  it('still separates two different avatar-sized payloads', () => {
    const a = 'data:image/jpeg;base64,' + 'A'.repeat(40_000);
    const b = 'data:image/jpeg;base64,' + 'B'.repeat(40_000);
    expect(spaceProfileSignature({ globalUserIcon: a })).not.toBe(
      spaceProfileSignature({ globalUserIcon: b })
    );
  });
});

describe('shouldAnnounceSpaceProfile', () => {
  it('announces when nothing has ever been recorded', () => {
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0)).toBe(true);
  });

  it('does not re-announce the same identity immediately', () => {
    recordSpaceProfileAnnounce(SELF, SPACE, SIG, T0);
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0 + 1000)).toBe(false);
  });

  it('re-announces once the minimum gap has elapsed', () => {
    recordSpaceProfileAnnounce(SELF, SPACE, SIG, T0);
    expect(
      shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0 + SPACE_ANNOUNCE_MIN_GAP_MS)
    ).toBe(true);
  });

  // The whole point of the bootstrap: a changed identity is new information,
  // not a retry, so it ignores both the gap and the cap.
  it('announces a CHANGED identity immediately, even mid-gap', () => {
    recordSpaceProfileAnnounce(SELF, SPACE, SIG, T0);
    const renamed = spaceProfileSignature({
      globalDisplayName: 'Ada L.',
      globalUserIcon: 'icon',
    });
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, renamed, T0 + 1)).toBe(true);
  });

  it('is per-space — announcing to one space does not gate another', () => {
    recordSpaceProfileAnnounce(SELF, SPACE, SIG, T0);
    expect(shouldAnnounceSpaceProfile(SELF, OTHER_SPACE, SIG, T0 + 1)).toBe(true);
  });
});

describe('the cap — an unchanged identity is announced a bounded number of times', () => {
  const advance = (n: number) => T0 + n * SPACE_ANNOUNCE_MIN_GAP_MS;

  it('allows exactly MAX_SENDS_PER_SPACE_IDENTITY announces', () => {
    let sent = 0;
    for (let i = 0; i < 20; i++) {
      const at = advance(i);
      if (shouldAnnounceSpaceProfile(SELF, SPACE, SIG, at)) {
        recordSpaceProfileAnnounce(SELF, SPACE, SIG, at);
        sent++;
      }
    }
    expect(sent).toBe(MAX_SENDS_PER_SPACE_IDENTITY);
  });

  it('stays shut however long we wait — this is a cap, not a cadence', () => {
    for (let i = 0; i < MAX_SENDS_PER_SPACE_IDENTITY; i++) {
      recordSpaceProfileAnnounce(SELF, SPACE, SIG, advance(i));
    }
    const aYear = T0 + 365 * 24 * 60 * 60 * 1000;
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, SIG, aYear)).toBe(false);
  });

  // Without this a rename after the cap closes would never reach anybody.
  it('a rename gets its own full allowance', () => {
    for (let i = 0; i < MAX_SENDS_PER_SPACE_IDENTITY; i++) {
      recordSpaceProfileAnnounce(SELF, SPACE, SIG, advance(i));
    }
    const renamed = spaceProfileSignature({ globalDisplayName: 'Ada L.' });

    let sent = 0;
    for (let i = 10; i < 30; i++) {
      const at = advance(i);
      if (shouldAnnounceSpaceProfile(SELF, SPACE, renamed, at)) {
        recordSpaceProfileAnnounce(SELF, SPACE, renamed, at);
        sent++;
      }
    }
    expect(sent).toBe(MAX_SENDS_PER_SPACE_IDENTITY);
  });

  // A flapping socket fires the announce repeatedly within seconds. Without the
  // gap floor the whole allowance would be spent inside one outage — three
  // frames that all fail together buy nothing over one.
  it('a reconnect storm cannot burn the allowance in one window', () => {
    let sent = 0;
    for (let i = 0; i < 50; i++) {
      const at = T0 + i * 1000; // 50 reconnects, one second apart
      if (shouldAnnounceSpaceProfile(SELF, SPACE, SIG, at)) {
        recordSpaceProfileAnnounce(SELF, SPACE, SIG, at);
        sent++;
      }
    }
    expect(sent).toBe(1);
  });
});

describe('in-flight claims', () => {
  // The startup timer and a reconnect timer overlap by design, and the record
  // is written only once the send resolves — so without a synchronous claim
  // both runs read "not yet announced" and both broadcast.
  it('a claimed announce blocks a concurrent duplicate', () => {
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0)).toBe(true);
    claimSpaceProfileAnnounce(SELF, SPACE, SIG);
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0)).toBe(false);
  });

  it('releasing re-opens it, so a FAILED send is retried next connect', () => {
    claimSpaceProfileAnnounce(SELF, SPACE, SIG);
    releaseSpaceProfileAnnounce(SELF, SPACE, SIG);
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0)).toBe(true);
  });

  it('a claim on one space does not block another', () => {
    claimSpaceProfileAnnounce(SELF, SPACE, SIG);
    expect(shouldAnnounceSpaceProfile(SELF, OTHER_SPACE, SIG, T0)).toBe(true);
  });
});

describe('corrupt and legacy records', () => {
  const key = `quorum:space-profile-announce:${SELF}:${SPACE}`;

  it('a record with an unusable timestamp still recognises its signature', () => {
    localStorage.setItem(key, JSON.stringify({ sig: SIG, at: null, attempts: 0 }));
    // Migrated with its REAL signature and one attempt left, re-anchored to now
    // — so it is gated immediately rather than firing on the spot.
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0)).toBe(false);
    expect(
      shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0 + SPACE_ANNOUNCE_MIN_GAP_MS)
    ).toBe(true);
  });

  it('a NaN attempts counter cannot defeat the cap', () => {
    localStorage.setItem(
      key,
      JSON.stringify({ sig: SIG, at: T0, attempts: Number.NaN })
    );
    let sent = 0;
    for (let i = 0; i < 20; i++) {
      const at = T0 + i * SPACE_ANNOUNCE_MIN_GAP_MS;
      if (shouldAnnounceSpaceProfile(SELF, SPACE, SIG, at)) {
        recordSpaceProfileAnnounce(SELF, SPACE, SIG, at);
        sent++;
      }
    }
    expect(sent).toBeLessThanOrEqual(MAX_SENDS_PER_SPACE_IDENTITY);
  });

  it('garbage in storage fails OPEN rather than wedging the space shut', () => {
    localStorage.setItem(key, 'not json at all');
    // Treated as a legacy bare signature for a DIFFERENT identity, so ours
    // reads as changed and announces.
    expect(shouldAnnounceSpaceProfile(SELF, SPACE, SIG, T0)).toBe(true);
  });
});

// The two gates share an implementation, so a namespace collision would be
// invisible until a DM push silently suppressed a space announce.
describe('isolation from the DM gate', () => {
  it('a DM send to an address does not gate a space of the same id', () => {
    const dmSig = dmProfileSignature({ displayName: 'Ada', userIcon: 'icon' });
    recordSpaceProfileAnnounce(SELF, SPACE, SIG, T0);
    expect(shouldSendDmProfile(SELF, SPACE, dmSig, T0)).toBe(true);
  });

  it('the two gates use different storage keys', () => {
    recordSpaceProfileAnnounce(SELF, SPACE, SIG, T0);
    const keys = Object.keys(localStorage);
    expect(keys.some((k) => k.startsWith('quorum:space-profile-announce'))).toBe(
      true
    );
    expect(keys.some((k) => k.startsWith('quorum:dm-profile-broadcast'))).toBe(
      false
    );
  });
});
