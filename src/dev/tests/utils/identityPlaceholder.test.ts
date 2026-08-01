// Pins the "we don't know who this is yet" rule. Three surfaces used to carry
// their own copy of it and drifted apart, which is why the DM sidebar showed
// "Unknown User" with a "?" avatar while the header showed "QmYVto…LjDd" with
// a "Q" avatar for the SAME row.
//
// Context: .agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md

import { describe, it, expect } from 'vitest';
import {
  UNKNOWN_USER_PLACEHOLDER,
  isPlaceholderDisplayName,
  isPlaceholderIcon,
  realDisplayNameOrUndefined,
  realIconOrUndefined,
} from '../../../utils/identityPlaceholder';
import { DefaultImages } from '../../../utils';
import { resolveMemberName } from '../../../utils/resolveMemberName';

const ADDRESS = 'QmYVtoS6E7T4TL4pSomethingSomethingLjDd';

describe('isPlaceholderDisplayName', () => {
  it('treats the stored literal, empty and nullish as placeholders', () => {
    expect(isPlaceholderDisplayName(UNKNOWN_USER_PLACEHOLDER)).toBe(true);
    expect(isPlaceholderDisplayName('')).toBe(true);
    expect(isPlaceholderDisplayName(undefined)).toBe(true);
    expect(isPlaceholderDisplayName(null)).toBe(true);
  });

  it('treats a real name as real', () => {
    expect(isPlaceholderDisplayName('GattoPardo')).toBe(false);
  });

  // Rows are written with the Lingui `t` macro, which evaluates at the ACTIVE
  // locale — so an Italian user's new DM row holds "Utente sconosciuto", and
  // the check has to consult the current locale's spelling too. Lingui THROWS
  // if no locale is activated, and this suite runs without one, which is
  // exactly the early-startup condition the app can hit. So this asserts the
  // safety contract: consulting the locale must never throw out of an identity
  // check, it must degrade to the English literal.
  it('does not throw when no locale is activated', () => {
    expect(() => isPlaceholderDisplayName('anything')).not.toThrow();
    expect(isPlaceholderDisplayName(UNKNOWN_USER_PLACEHOLDER)).toBe(true);
  });

  it('does not treat an unrelated name as a placeholder', () => {
    expect(isPlaceholderDisplayName('Utente Reale')).toBe(false);
  });
});

describe('isPlaceholderIcon', () => {
  it('treats the default image, empty and nullish as placeholders', () => {
    expect(isPlaceholderIcon(DefaultImages.UNKNOWN_USER)).toBe(true);
    expect(isPlaceholderIcon('')).toBe(true);
    expect(isPlaceholderIcon(undefined)).toBe(true);
  });

  it('treats a real avatar as real', () => {
    expect(isPlaceholderIcon('data:image/png;base64,AAAA')).toBe(false);
  });
});

describe('demotion helpers', () => {
  it('return undefined for placeholders so callers fall through', () => {
    expect(realDisplayNameOrUndefined(UNKNOWN_USER_PLACEHOLDER)).toBeUndefined();
    expect(realIconOrUndefined(DefaultImages.UNKNOWN_USER)).toBeUndefined();
  });

  it('pass real values through untouched', () => {
    expect(realDisplayNameOrUndefined('GattoPardo')).toBe('GattoPardo');
    expect(realIconOrUndefined('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA'
    );
  });
});

// The integration that actually caused the reported bug: every name surface
// goes through resolveMemberName, so demoting there is what makes the sidebar
// and the header agree.
describe('resolveMemberName treats the placeholder as no name', () => {
  it('falls through to the address instead of rendering the placeholder', () => {
    const resolved = resolveMemberName({
      address: ADDRESS,
      displayName: UNKNOWN_USER_PLACEHOLDER,
    });
    expect(resolved.name).not.toBe(UNKNOWN_USER_PLACEHOLDER);
    expect(resolved.isQnsVerified).toBe(false);
  });

  it('still prefers a real name', () => {
    expect(
      resolveMemberName({ address: ADDRESS, displayName: 'GattoPardo' }).name
    ).toBe('GattoPardo');
  });

  it('lets the QNS name win over the placeholder', () => {
    const resolved = resolveMemberName({
      address: ADDRESS,
      displayName: UNKNOWN_USER_PLACEHOLDER,
      primaryUsername: 'gattopardo',
    });
    expect(resolved.name).toBe('gattopardo');
    expect(resolved.isQnsVerified).toBe(true);
  });
});
