// The send gate has two opposite failure modes, both bad:
//   - too loose  → every reconnect re-sends a real DM to every partner
//   - too strict → a lost frame means the partner NEVER learns our identity
// These tests pin both edges, including the expiry that bounds the second one.
//
// Context: .agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  dmProfileSignature,
  shouldSendDmProfile,
  recordDmProfileSend,
  RESEND_INTERVAL_MS,
} from '../../../utils/dmProfileGate';

const SELF = 'QmSelfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PARTNER = 'QmPartnerBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const OTHER_PARTNER = 'QmPartnerCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

const T0 = 1_750_000_000_000;
const SIG = dmProfileSignature({ displayName: 'Bob', userIcon: 'icon' });

beforeEach(() => {
  localStorage.clear();
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
