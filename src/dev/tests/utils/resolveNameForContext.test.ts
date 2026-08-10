/**
 * One answer to "which ladder applies here?".
 *
 * A DM has no per-space tier, so the QNS name outranks the plain display name
 * there; in a space a deliberate per-space name outranks both. That choice was
 * hand-written at three call sites (the message body, the mention pills, the
 * message preview) — which is how the two pill builders came to disagree in the
 * first place. These pin the shared answer, and with it the MessagePreview
 * header, whose own render path is otherwise unreachable today.
 */

import { describe, it, expect } from 'vitest';
import { resolveNameForContext, formatResolvedName } from '../../../utils/resolveMemberName';

const ADDRESS = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

describe('resolveNameForContext — space context', () => {
  it('lets a deliberate per-space name outrank the .q', () => {
    const r = resolveNameForContext({
      address: ADDRESS,
      displayName: 'Mod Alice',
      globalDisplayName: 'Alice Smith',
      primaryUsername: 'alice',
    });
    expect(r.name).toBe('Mod Alice');
    expect(r.isQnsVerified).toBe(false);
  });

  it('shows the .q when the roster name is only the global name echoed at join', () => {
    const r = resolveNameForContext({
      address: ADDRESS,
      displayName: 'Alice Smith',
      globalDisplayName: 'Alice Smith',
      primaryUsername: 'alice',
    });
    expect(formatResolvedName(r)).toBe('alice.q');
  });

  it('drops a forged suffix rather than rendering it', () => {
    const r = resolveNameForContext({
      address: ADDRESS,
      displayName: 'mallory.q',
      globalDisplayName: 'Mallory',
    });
    expect(r.name).toBe('Mallory');
    expect(r.isQnsVerified).toBe(false);
  });
});

describe('resolveNameForContext — DM context', () => {
  it('lets the .q outrank the display name, since there is no per-space tier', () => {
    // The whole reason the flag exists: this same input resolves differently
    // in a space, where "Alice Smith" would read as a deliberate override.
    const r = resolveNameForContext(
      { address: ADDRESS, displayName: 'Alice Smith', primaryUsername: 'alice' },
      { isDm: true },
    );
    expect(formatResolvedName(r)).toBe('alice.q');
  });

  it('drops a forged suffix here too', () => {
    const r = resolveNameForContext(
      { address: ADDRESS, displayName: 'mallory.q' },
      { isDm: true },
    );
    expect(r.name).not.toBe('mallory.q');
  });
});

describe('resolveNameForContext — the fallback belongs to the resolver', () => {
  it('truncates the address when no tier has a name, in both contexts', () => {
    // Callers must never supply their own fallback; both surfaces that used to
    // (the editor pills, the preview header) produced a different string than
    // the message body beside them.
    for (const isDm of [false, true]) {
      const r = resolveNameForContext({ address: ADDRESS }, { isDm });
      expect(r.name).toContain('Qm');
      expect(r.isQnsVerified).toBe(false);
    }
  });
});
