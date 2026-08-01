// Pins the merge semantics for a DM partner's identity arriving on an incoming
// frame. The rule is one word — EMPTY MEANS ABSENT — and the whole point of
// these tests is that flipping `||` back to `??` (which reads as an equivalent
// tidy-up) turns a blank avatar into silent data loss.
//
// Context: .agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md

import { describe, it, expect } from 'vitest';
import {
  hasProfileContent,
  preferIncomingProfileField,
} from '../../../utils/conversationProfile';

describe('preferIncomingProfileField', () => {
  it('takes a real incoming value over the stored one (partner renamed)', () => {
    expect(preferIncomingProfileField('Bob', 'Unknown User')).toBe('Bob');
  });

  it('keeps the stored value when the incoming field is undefined', () => {
    expect(preferIncomingProfileField(undefined, 'Bob')).toBe('Bob');
  });

  // THE REGRESSION. `'' ?? stored` is `''` — with `??` this test fails and a
  // partner who simply never set an avatar wipes the icon we already had.
  it('keeps the stored value when the incoming field is an empty string', () => {
    expect(preferIncomingProfileField('', 'data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA'
    );
  });

  it('returns undefined only when neither side has anything', () => {
    expect(preferIncomingProfileField(undefined, undefined)).toBeUndefined();
    expect(preferIncomingProfileField('', undefined)).toBeUndefined();
  });

  it('fills an absent stored value from the incoming one (first identity ever seen)', () => {
    expect(preferIncomingProfileField('Bob', undefined)).toBe('Bob');
  });
});

describe('hasProfileContent', () => {
  it('is true when either field carries something', () => {
    expect(hasProfileContent({ display_name: 'Bob' })).toBe(true);
    expect(hasProfileContent({ user_icon: 'data:image/png;base64,AAAA' })).toBe(true);
  });

  it('is false for an absent, empty, or fully blank profile', () => {
    expect(hasProfileContent(undefined)).toBe(false);
    expect(hasProfileContent({})).toBe(false);
    expect(hasProfileContent({ display_name: '', user_icon: '' })).toBe(false);
  });

  // The guard and the merge must agree: anything that passes the guard must be
  // able to change at least one field, or we persist a no-op write.
  it('agrees with the merge — a passing profile always changes something', () => {
    const incoming = { display_name: 'Bob', user_icon: '' };
    expect(hasProfileContent(incoming)).toBe(true);
    expect(preferIncomingProfileField(incoming.display_name, 'Unknown User')).toBe('Bob');
    // ...while the blank icon leaves the stored one alone.
    expect(preferIncomingProfileField(incoming.user_icon, 'stored-icon')).toBe('stored-icon');
  });
});
