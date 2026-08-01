// The send gate has two opposite failure modes, both bad:
//   - too loose  → every reconnect re-sends a real DM to every partner
//   - too strict → a lost frame means the partner NEVER learns our identity
// These tests pin both edges: the expiry that bounds the second one, and the
// CAP that bounds the first one so a converged pair stops paying forever.
//
// Context: .agents/tasks/2026-08-01-identity-announce-cadence-research.md (Step 2)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  dmProfileSignature,
  shouldSendDmProfile,
  recordDmProfileSend,
  claimDmProfileSend,
  releaseDmProfileSend,
  RESEND_INTERVAL_MS,
  MAX_SENDS_PER_IDENTITY,
} from '../../../utils/dmProfileGate';

const SELF = 'QmSelfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PARTNER = 'QmPartnerBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const OTHER_PARTNER = 'QmPartnerCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

const T0 = 1_750_000_000_000;
const SIG = dmProfileSignature({ displayName: 'Bob', userIcon: 'icon' });

beforeEach(() => {
  localStorage.clear();
  // In-flight claims are module-local, so they must be cleared between tests
  // or a claim leaks into the next one.
  releaseDmProfileSend(SELF, PARTNER, SIG);
  releaseDmProfileSend(SELF, OTHER_PARTNER, SIG);
});

describe('dmProfileSignature', () => {
  it('is stable for the same payload regardless of key order', () => {
    expect(dmProfileSignature({ displayName: 'Bob', userIcon: 'icon' })).toBe(
      dmProfileSignature({ userIcon: 'icon', displayName: 'Bob' })
    );
  });

  it('changes when a value changes (a rename must re-broadcast)', () => {
    expect(dmProfileSignature({ displayName: 'Bob' })).not.toBe(
      dmProfileSignature({ displayName: 'Roberta' })
    );
  });

  // Presence matters: an avatar-only push and a name-only push are different
  // messages and must not gate each other out.
  it('distinguishes name-only from avatar-only', () => {
    expect(dmProfileSignature({ displayName: 'Bob' })).not.toBe(
      dmProfileSignature({ userIcon: 'Bob' })
    );
  });

  it('treats an empty field as absent, matching the wire builder', () => {
    expect(dmProfileSignature({ displayName: 'Bob', userIcon: '' })).toBe(
      dmProfileSignature({ displayName: 'Bob' })
    );
  });

  it('treats an explicitly empty bio as present (a deliberate clear)', () => {
    expect(dmProfileSignature({ displayName: 'Bob', bio: '' })).not.toBe(
      dmProfileSignature({ displayName: 'Bob' })
    );
  });
});

describe('shouldSendDmProfile', () => {
  // The heal case: we have never told this partner who we are, so the very
  // first push MUST go out.
  it('sends to a partner we have never sent to', () => {
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0)).toBe(true);
  });

  it('does not re-send the same identity on the next connect', () => {
    recordDmProfileSend(SELF, PARTNER, SIG, T0);
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0 + 60_000)).toBe(false);
  });

  it('sends immediately when the identity changed', () => {
    recordDmProfileSend(SELF, PARTNER, SIG, T0);
    const renamed = dmProfileSignature({ displayName: 'Roberta', userIcon: 'icon' });
    expect(shouldSendDmProfile(SELF, PARTNER, renamed, T0 + 1)).toBe(true);
  });

  // The anti-loss retry. Without this, a single dropped frame leaves the
  // partner on a placeholder permanently — observed live 2026-08-01.
  it('re-sends an unchanged identity once the interval has elapsed', () => {
    recordDmProfileSend(SELF, PARTNER, SIG, T0);
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0 + RESEND_INTERVAL_MS - 1)).toBe(false);
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0 + RESEND_INTERVAL_MS)).toBe(true);
  });

  it('is per-partner — sending to one does not gate another', () => {
    recordDmProfileSend(SELF, PARTNER, SIG, T0);
    expect(shouldSendDmProfile(SELF, OTHER_PARTNER, SIG, T0)).toBe(true);
  });

  it('is per-self-address — a different account starts fresh', () => {
    recordDmProfileSend(SELF, PARTNER, SIG, T0);
    expect(shouldSendDmProfile('QmOtherSelf', PARTNER, SIG, T0)).toBe(true);
  });

  // The persisted record is only written AFTER the network send resolves, so
  // two overlapping broadcast runs (the startup timer and a reconnect timer can
  // overlap by design) would both read "not yet sent" and both transmit a real
  // encrypted DM. The in-flight claim closes that window.
  it('does not double-send while an identical send is in flight', () => {
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0)).toBe(true);
    claimDmProfileSend(SELF, PARTNER, SIG);
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0)).toBe(false);
  });

  it('reopens after the claim is released, so a failed send retries', () => {
    claimDmProfileSend(SELF, PARTNER, SIG);
    releaseDmProfileSend(SELF, PARTNER, SIG);
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0)).toBe(true);
  });

  it('claims are per-partner — one in flight does not block another', () => {
    claimDmProfileSend(SELF, PARTNER, SIG);
    expect(shouldSendDmProfile(SELF, OTHER_PARTNER, SIG, T0)).toBe(true);
  });

  // Upgrade path: the pre-expiry format stored a bare signature string with no
  // timestamp. It must not be read as "sent at epoch 0", which would make every
  // partner instantly due for a resend on the first connect after deploy.
  it('does not stampede on a legacy bare-signature record', () => {
    localStorage.setItem(`quorum:dm-profile-broadcast:${SELF}:${PARTNER}`, SIG);
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0)).toBe(false);
  });

  it('still honours a changed identity over a legacy record', () => {
    localStorage.setItem(`quorum:dm-profile-broadcast:${SELF}:${PARTNER}`, SIG);
    const renamed = dmProfileSignature({ displayName: 'Roberta' });
    expect(shouldSendDmProfile(SELF, PARTNER, renamed, T0)).toBe(true);
  });
});

// The cap is the whole point of this gate's second revision. Without it a
// converged pair pays RESEND_INTERVAL_MS forever — 365 sends a year, per
// partner, to say nothing new.
describe('shouldSendDmProfile — the retry cap', () => {
  /** Walk the gate the way the send loop does: check, then record if it said yes. */
  const runConnect = (at: number, sig = SIG): boolean => {
    const send = shouldSendDmProfile(SELF, PARTNER, sig, at);
    if (send) recordDmProfileSend(SELF, PARTNER, sig, at);
    return send;
  };

  it('sends exactly MAX_SENDS_PER_IDENTITY times, then never again', () => {
    const sent: number[] = [];
    // One connect per day for a fortnight — far past the cap.
    for (let day = 0; day < 14; day++) {
      if (runConnect(T0 + day * RESEND_INTERVAL_MS)) sent.push(day);
    }
    expect(sent).toEqual([0, 1, 2]);
    expect(sent.length).toBe(MAX_SENDS_PER_IDENTITY);
  });

  it('a flapping connection cannot burn the attempts in one session', () => {
    expect(runConnect(T0)).toBe(true);
    // 200 reconnects inside the interval must all be no-ops.
    for (let i = 1; i <= 200; i++) {
      expect(runConnect(T0 + i * 1000)).toBe(false);
    }
    // ...and the second real attempt is still available a day later.
    expect(runConnect(T0 + RESEND_INTERVAL_MS)).toBe(true);
  });

  it('a rename resets the count and gets its own full set of attempts', () => {
    for (let day = 0; day < 5; day++) runConnect(T0 + day * RESEND_INTERVAL_MS);
    expect(runConnect(T0 + 5 * RESEND_INTERVAL_MS)).toBe(false); // exhausted

    const renamed = dmProfileSignature({ displayName: 'Roberta', userIcon: 'icon' });
    const sent: number[] = [];
    for (let day = 5; day < 15; day++) {
      if (runConnect(T0 + day * RESEND_INTERVAL_MS, renamed)) sent.push(day);
    }
    expect(sent).toEqual([5, 6, 7]);
  });

  it('the cap is per-partner — one exhausted partner does not gate another', () => {
    for (let day = 0; day < 5; day++) runConnect(T0 + day * RESEND_INTERVAL_MS);
    expect(shouldSendDmProfile(SELF, OTHER_PARTNER, SIG, T0)).toBe(true);
  });
});

// Deploy day. Both legacy shapes must land on "one more try, a day from now",
// never "everyone sends immediately".
describe('migration from a pre-cap record', () => {
  const KEY = `quorum:dm-profile-broadcast:${SELF}:${PARTNER}`;

  // The trap: these records carry a timestamp up to 24h old. Keeping it would
  // put every existing pair instantly past the interval, so the whole fleet
  // fires on the first connect after deploy.
  it('re-anchors a {sig, at} record to now instead of firing immediately', () => {
    const longAgo = T0 - 10 * RESEND_INTERVAL_MS;
    localStorage.setItem(KEY, JSON.stringify({ sig: SIG, at: longAgo }));
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0)).toBe(false);
  });

  it('re-anchors a legacy bare-signature record the same way', () => {
    localStorage.setItem(KEY, SIG);
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0)).toBe(false);
  });

  // The migration must PERSIST, or `now - at` is recomputed as ~0 on every read
  // and the record can never age out — which is how the pre-cap code left
  // bare-signature records permanently shut.
  it('persists the upgrade, so the record can still age out', () => {
    localStorage.setItem(KEY, SIG);
    shouldSendDmProfile(SELF, PARTNER, SIG, T0);

    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored).toMatchObject({ sig: SIG, at: T0 });
    expect(typeof stored.attempts).toBe('number');

    // A day later the one remaining attempt is genuinely due.
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0 + RESEND_INTERVAL_MS)).toBe(true);
  });

  // A number that is not a usable count. `typeof NaN === 'number'`, so a naive
  // shape check lets these through — and then `NaN >= MAX` is false, which
  // defeats the cap silently and sends forever.
  it.each([
    ['NaN attempts', { sig: SIG, at: T0, attempts: NaN }],
    ['Infinity attempts', { sig: SIG, at: T0, attempts: Infinity }],
    ['negative attempts', { sig: SIG, at: T0, attempts: -5 }],
    ['fractional attempts', { sig: SIG, at: T0, attempts: 1.5 }],
    ['NaN at', { sig: SIG, at: NaN, attempts: 1 }],
  ])('re-migrates a corrupt record rather than trusting it (%s)', (_label, bad) => {
    localStorage.setItem(KEY, JSON.stringify(bad));
    // Re-migrated, so it is anchored at now and NOT immediately due...
    expect(shouldSendDmProfile(SELF, PARTNER, SIG, T0)).toBe(false);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(Number.isInteger(stored.attempts)).toBe(true);
    expect(Number.isFinite(stored.at)).toBe(true);
    // ...and the cap still bites rather than sending forever.
    const sent: number[] = [];
    for (let day = 0; day < 10; day++) {
      const at = T0 + day * RESEND_INTERVAL_MS;
      if (shouldSendDmProfile(SELF, PARTNER, SIG, at)) {
        recordDmProfileSend(SELF, PARTNER, SIG, at);
        sent.push(day);
      }
    }
    expect(sent.length).toBeLessThanOrEqual(MAX_SENDS_PER_IDENTITY);
  });

  it('grants exactly ONE more attempt, then closes', () => {
    localStorage.setItem(KEY, JSON.stringify({ sig: SIG, at: T0 - RESEND_INTERVAL_MS }));
    const sent: number[] = [];
    for (let day = 0; day < 10; day++) {
      const at = T0 + day * RESEND_INTERVAL_MS;
      if (shouldSendDmProfile(SELF, PARTNER, SIG, at)) {
        recordDmProfileSend(SELF, PARTNER, SIG, at);
        sent.push(day);
      }
    }
    expect(sent).toEqual([1]);
  });
});
