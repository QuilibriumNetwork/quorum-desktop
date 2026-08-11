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

// The CRITICAL regression this fix closes: a stored name that IS the
// member's own address is not a name, it's the resolver's own fallback
// round-tripped into storage. `buildLocalDmNames`/`realDisplayNameOrUndefined`
// used to accept it as real, which then rendered the FULL, UNTRUNCATED
// address on screen — worse than doing nothing, since the resolver's own
// fallback at least truncates. See
// .agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md.
describe('isPlaceholderDisplayName — a name that is the address itself', () => {
  const ADDRESS = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqzzABCDEF';

  it('treats an exact address match as a placeholder', () => {
    expect(isPlaceholderDisplayName(ADDRESS, ADDRESS)).toBe(true);
  });

  it('treats a case-different address match as a placeholder', () => {
    expect(isPlaceholderDisplayName(ADDRESS.toUpperCase(), ADDRESS)).toBe(true);
    expect(isPlaceholderDisplayName(ADDRESS.toLowerCase(), ADDRESS.toUpperCase())).toBe(true);
  });

  it('treats a truncated rendering of the address as a placeholder, both known truncation shapes', () => {
    // quorum-shared resolveDisplayName's own internal fallback shape (6/4).
    expect(isPlaceholderDisplayName(`${ADDRESS.slice(0, 6)}…${ADDRESS.slice(-4)}`, ADDRESS)).toBe(true);
    // formatAddress's default shape (Qm + 6 / 6).
    expect(isPlaceholderDisplayName(`${ADDRESS.slice(0, 8)}…${ADDRESS.slice(-6)}`, ADDRESS)).toBe(true);
  });

  it('does not flag a real name that merely contains an ellipsis unrelated to the address', () => {
    expect(isPlaceholderDisplayName('Hello…World', ADDRESS)).toBe(false);
  });

  it('does not flag a real name as a placeholder just because SOME address is in scope', () => {
    expect(isPlaceholderDisplayName('GattoPardo', ADDRESS)).toBe(false);
  });

  it('without an address in scope, only the literal/empty placeholder rules apply (no false positive on a name that happens to look address-shaped)', () => {
    expect(isPlaceholderDisplayName(ADDRESS)).toBe(false);
    expect(isPlaceholderDisplayName(ADDRESS, undefined)).toBe(false);
    expect(isPlaceholderDisplayName(ADDRESS, null)).toBe(false);
  });

  it('realDisplayNameOrUndefined demotes an address-shaped name the same way', () => {
    expect(realDisplayNameOrUndefined(ADDRESS, ADDRESS)).toBeUndefined();
    expect(realDisplayNameOrUndefined(`${ADDRESS.slice(0, 6)}…${ADDRESS.slice(-4)}`, ADDRESS)).toBeUndefined();
    expect(realDisplayNameOrUndefined('GattoPardo', ADDRESS)).toBe('GattoPardo');
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
