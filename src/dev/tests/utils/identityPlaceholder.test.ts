// Pins the "we don't know who this is yet" rule. Three surfaces used to carry
// their own copy of it and drifted apart, which is why the DM sidebar showed
// "Unknown User" with a "?" avatar while the header showed "QmYVto…LjDd" with
// a "Q" avatar for the SAME row.
//
// Context: 2026-08-01-dm-partner-identity-lost-on-established-sessions.md under .agents/issues/

import { describe, it, expect } from 'vitest';
import {
  UNKNOWN_USER_PLACEHOLDER,
  isPlaceholderDisplayName,
  isPlaceholderIcon,
  realDisplayNameOrUndefined,
  realIconOrUndefined,
} from '../../../utils/identityPlaceholder';
import { DefaultImages } from '../../../utils';

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

// The integration that actually caused the reported bug used to be
// `resolveMemberName` (deleted with the rest of `utils/resolveMemberName` —
// see .agents/issues/.open/2026-08-10-identity-resolution-architecture-design.md).
// The demotion now happens upstream of `src/identity`: callers that build
// `locallyKnownNames`/roster rows (DirectMessage.tsx, DirectMessageContactsList.tsx)
// call `realDisplayNameOrUndefined`/`realIconOrUndefined` directly (see the
// "demotion helpers" tests above) before those values ever reach
// `identityFromMaps`, so there is no second integration point left to pin here.
