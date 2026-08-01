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

  // The literal is stored in English at write time, so the check must NOT be
  // translated — a row written before a language switch must still be seen as
  // a placeholder.
  it('matches the English literal exactly, not a translation', () => {
    expect(isPlaceholderDisplayName('Utente sconosciuto')).toBe(false);
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
