/**
 * A mention pill's name must obey the same ladder as the message body.
 *
 * A pill's name is derived in two places — the composer builds one when you pick
 * from the autocomplete, the editor rebuilds every pill from the stored
 * `@<address>` tokens when you click edit. Only the composer resolved; the
 * editor read `user.displayName` raw. Three things followed, and the first is a
 * hole in the forged-`.q` guard shipped in 06c38370d:
 *
 *   1. a display name ending in ".q" reached the screen unguarded
 *   2. a real ".q" disappeared the moment you clicked edit
 *   3. an unknown sender rendered the literal "Unknown User" where the message
 *      body shows a truncated address
 *
 * These pin `resolveMentionPillName`, the single rule both now call. Reverting
 * it to `user.displayName || 'Unknown User'` turns the first four red.
 */

import { describe, it, expect } from 'vitest';
import { resolveMentionPillName } from '../../../utils/mentionPillDom';

const ADDRESS = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

describe('resolveMentionPillName — a pill cannot forge the verified .q marker', () => {
  it('drops a display name ending in .q', () => {
    // The attack, at the surface the guard did not reach. `.q` is the only
    // signal a viewer gets, so this rendered identically to a registered name.
    const name = resolveMentionPillName({
      address: ADDRESS,
      displayName: 'alice.q',
      globalDisplayName: 'Mallory',
    });
    expect(name).not.toBe('alice.q');
    expect(name).toBe('Mallory');
  });

  it('drops a forged name in a DM too, where there is no per-space tier', () => {
    const name = resolveMentionPillName(
      { address: ADDRESS, displayName: 'alice.q' },
      { isDm: true }
    );
    expect(name).not.toBe('alice.q');
  });
});

describe('resolveMentionPillName — a real .q survives into the editor', () => {
  it('renders the QNS name with its suffix, not the global name', () => {
    // The visible regression: the same pill read "alice.q" in the message and
    // "Alice Smith" the moment you clicked edit.
    const name = resolveMentionPillName({
      address: ADDRESS,
      displayName: 'Alice Smith',
      globalDisplayName: 'Alice Smith',
      primaryUsername: 'alice',
    });
    expect(name).toBe('alice.q');
  });

  it('lets a deliberate per-space name still win, with no suffix', () => {
    // The guard must not cost the override tier its purpose.
    const name = resolveMentionPillName({
      address: ADDRESS,
      displayName: 'Mod Alice',
      globalDisplayName: 'Alice Smith',
      primaryUsername: 'alice',
    });
    expect(name).toBe('Mod Alice');
  });
});

describe('resolveMentionPillName — an unknown sender falls back like the body does', () => {
  it('truncates the address instead of printing "Unknown User"', () => {
    // The DM lookup returns `displayName: undefined` for a sender it does not
    // know, so the old raw read printed a literal that is not a name — while
    // the message body beside it showed the address.
    const name = resolveMentionPillName({ address: ADDRESS });
    expect(name).not.toBe('Unknown User');
    expect(name).toContain('Qm');
  });
});
