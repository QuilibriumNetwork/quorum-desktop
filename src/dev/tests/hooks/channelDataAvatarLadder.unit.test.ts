import { describe, it, expect } from 'vitest';
import { DefaultImages } from '@/utils';

/**
 * The avatar ladder `useChannelData` applies when it flattens roster rows.
 *
 * Kept as a standalone spec of the RULE rather than a render test: the rule is
 * what regressed, and it regressed because it lived at the call site instead of
 * one place. Mirrors the implementation in useChannelData.ts.
 */
function pickAvatar(icon: string | undefined): string | undefined {
  if (!icon) return undefined;
  return icon.includes(DefaultImages.UNKNOWN_USER) ? undefined : icon;
}
const ladder = (override?: string, global?: string) =>
  pickAvatar(override) ?? pickAvatar(global);

const OVERRIDE = 'data:image/png;base64,OVERRIDE';
const GLOBAL = 'data:image/png;base64,GLOBAL';

describe('useChannelData avatar ladder — override → global → initials', () => {
  it('falls back to the global avatar when there is no per-space override', () => {
    // The regression this exists for: with the override correctly empty (its
    // normal state under the two-slot model), an override-only read renders no
    // avatar at all. Measured on a real account.
    expect(ladder('', GLOBAL)).toBe(GLOBAL);
    expect(ladder(undefined, GLOBAL)).toBe(GLOBAL);
  });

  it('prefers a deliberate per-space override over the global avatar', () => {
    expect(ladder(OVERRIDE, GLOBAL)).toBe(OVERRIDE);
  });

  it('treats the UNKNOWN_USER placeholder as absent at EVERY rung', () => {
    // Passing it on would render a broken-looking default instead of initials.
    expect(ladder(DefaultImages.UNKNOWN_USER, GLOBAL)).toBe(GLOBAL);
    expect(ladder(OVERRIDE, DefaultImages.UNKNOWN_USER)).toBe(OVERRIDE);
    expect(ladder(DefaultImages.UNKNOWN_USER, DefaultImages.UNKNOWN_USER)).toBeUndefined();
  });

  it('returns undefined when there is no avatar anywhere, so initials engage', () => {
    expect(ladder(undefined, undefined)).toBeUndefined();
    expect(ladder('', '')).toBeUndefined();
  });
});
