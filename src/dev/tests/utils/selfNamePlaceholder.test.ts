/**
 * The per-space name field's placeholder is a PROMISE.
 *
 * Leaving the field empty means "follow my normal name", and the placeholder is
 * how the user is told what that resolves to. Desktop's was a static
 * "Display Name" — a label repeated inside its own box, promising nothing — on
 * the one screen whose job is to explain the two-slot model.
 *
 * These pin the ladder it must follow. Reverting `selfNamePlaceholder` to
 * `displayName || emptyLabel` turns the first two red.
 */

import { describe, it, expect } from 'vitest';
import { selfNamePlaceholder } from '../../../utils/resolveSelfName';

const EMPTY = 'Your name in this Space';

describe('selfNamePlaceholder — promises the name the app would actually render', () => {
  it('promises the .q name over the global name', () => {
    // The inversion. Every surface renders this user as "alice.q", so a
    // placeholder saying "Alice Smith" tells them clearing the field gives
    // them a name they will never see.
    expect(
      selfNamePlaceholder({ primaryUsername: 'alice', displayName: 'Alice Smith' }, EMPTY),
    ).toBe('alice.q');
  });

  it('carries the .q suffix, because that is what renders', () => {
    expect(selfNamePlaceholder({ primaryUsername: 'alice' }, EMPTY)).toBe('alice.q');
  });

  it('falls back to the global name when no .q is elected', () => {
    // Holding no primary name is a legitimate state, not an error.
    expect(selfNamePlaceholder({ displayName: 'Alice Smith' }, EMPTY)).toBe('Alice Smith');
  });

  it('does not double-suffix a primary username that already carries .q', () => {
    // Same input, same answer as resolveSpaceMemberName — the placeholder and
    // the name it promises must not disagree.
    expect(
      selfNamePlaceholder({ primaryUsername: 'alice.q', displayName: 'Alice Smith' }, EMPTY),
    ).toBe('Alice Smith');
  });

  it('falls through a whitespace-only name rather than promising blank', () => {
    expect(selfNamePlaceholder({ displayName: '   ' }, EMPTY)).toBe(EMPTY);
  });

  it('does not promise a global name that ends in .q', () => {
    // Every other surface drops such a name and renders the address instead,
    // so promising it here would be false. The local input validator normally
    // prevents one — and relying on that alone is precisely what the resolver
    // guard exists not to do.
    expect(selfNamePlaceholder({ displayName: 'mallory.q' }, EMPTY)).toBe(EMPTY);
  });

  it('uses the caller copy when there is no name, and never invents one', () => {
    expect(selfNamePlaceholder(null, EMPTY)).toBe(EMPTY);
    expect(selfNamePlaceholder(undefined, EMPTY)).toBe(EMPTY);
    expect(selfNamePlaceholder({}, EMPTY)).toBe(EMPTY);
  });

  it('still honours the deprecated username alias as a last resort', () => {
    // Nothing writes it any more; kept so a profile carrying the old field
    // does not lose its placeholder entirely.
    expect(selfNamePlaceholder({ username: 'legacy' }, EMPTY)).toBe('legacy');
  });
});
