// The dedup gate has two opposite failure modes, both bad:
//   - too loose  → every reconnect re-sends a real DM to every partner
//   - too strict → the on-connect heal never fires and partners stay stuck
// These tests pin both edges.
//
// Context: .agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  dmProfileSignature,
  readDmProfileGate,
  writeDmProfileGate,
} from '../../../utils/dmProfileGate';

const SELF = 'QmSelfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PARTNER = 'QmPartnerBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const OTHER_PARTNER = 'QmPartnerCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

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

describe('the gate', () => {
  // The heal case: we have never told this partner who we are, so the very
  // first on-connect broadcast MUST go out.
  it('is open for a partner we have never sent to', () => {
    expect(readDmProfileGate(SELF, PARTNER)).toBeNull();
  });

  it('closes for the exact payload already sent', () => {
    const sig = dmProfileSignature({ displayName: 'Bob', userIcon: 'icon' });
    writeDmProfileGate(SELF, PARTNER, sig);
    expect(readDmProfileGate(SELF, PARTNER)).toBe(sig);
  });

  it('reopens when the identity changes', () => {
    writeDmProfileGate(SELF, PARTNER, dmProfileSignature({ displayName: 'Bob' }));
    const renamed = dmProfileSignature({ displayName: 'Roberta' });
    expect(readDmProfileGate(SELF, PARTNER)).not.toBe(renamed);
  });

  it('is per-partner — sending to one does not gate another', () => {
    const sig = dmProfileSignature({ displayName: 'Bob' });
    writeDmProfileGate(SELF, PARTNER, sig);
    expect(readDmProfileGate(SELF, OTHER_PARTNER)).toBeNull();
  });

  it('is per-self-address — a different account starts fresh', () => {
    const sig = dmProfileSignature({ displayName: 'Bob' });
    writeDmProfileGate(SELF, PARTNER, sig);
    expect(readDmProfileGate('QmOtherSelf', PARTNER)).toBeNull();
  });
});
