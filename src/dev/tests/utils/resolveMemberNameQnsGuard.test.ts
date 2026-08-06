/**
 * The forged-`.q` guard on the SPACE name resolver.
 *
 * `.q` is a trust marker and the only signal a viewer gets — `isQnsVerified` is
 * computed on both clients and rendered by neither. The validator that forbids
 * a display name ending in `.q` runs on local text input and nowhere on
 * receive, so a modified client can broadcast one and every honest recipient
 * renders it identically to a name somebody registered and elected primary.
 *
 * `quorum-shared` enforces this inside `resolveDisplayName`, which
 * `resolveMemberName` delegates to. `resolveSpaceMemberName` does not delegate
 * — it implements the ladder itself and returns before reaching shared — so it
 * inherited nothing. It is also the function that messages, mentions,
 * reactions, notifications, pinned messages and the channel view all call, so
 * the practical state was: guarded in DMs, unguarded in every space context.
 *
 * These cases pin that closed. The first one is the whole attack.
 */

import { describe, it, expect } from 'vitest';
import { resolveMemberName, resolveSpaceMemberName } from '../../../utils/resolveMemberName';

const ADDRESS = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

describe('resolveSpaceMemberName — a name cannot forge the verified .q marker', () => {
  it('drops a roster display name ending in .q', () => {
    // The attack. Before the guard this returned "alice.q" with
    // isQnsVerified false — and since the suffix is what the viewer reads,
    // it was indistinguishable from the real thing on screen.
    const r = resolveSpaceMemberName({
      address: ADDRESS,
      displayName: 'alice.q',
      globalDisplayName: 'Mallory',
    });
    expect(r.name).not.toBe('alice.q');
    expect(r.name).toBe('Mallory');
    expect(r.isQnsVerified).toBe(false);
  });

  it('drops a forged roster name BEFORE the echo comparison', () => {
    // The ordering that makes the guard work. Compared raw, a forged roster
    // name differs from the global one, which reads as a deliberate per-space
    // name — so it would be returned outright rather than demoted.
    const r = resolveSpaceMemberName({
      address: ADDRESS,
      displayName: 'alice.q',
      globalDisplayName: 'Mallory',
      primaryUsername: 'mallory',
    });
    expect(r.name).toBe('mallory');
    expect(r.isQnsVerified).toBe(true);
  });

  it('drops a forged global name', () => {
    const r = resolveSpaceMemberName({
      address: ADDRESS,
      globalDisplayName: 'alice.q',
    });
    expect(r.name).not.toBe('alice.q');
    expect(r.isQnsVerified).toBe(false);
  });

  it('drops a primary_username that already carries the suffix', () => {
    // A QNS name is stored bare; the suffix is presentation. One arriving with
    // it would otherwise render "alice.q.q".
    const r = resolveSpaceMemberName({
      address: ADDRESS,
      primaryUsername: 'alice.q',
      globalDisplayName: 'Mallory',
    });
    expect(r.name).toBe('Mallory');
    expect(r.isQnsVerified).toBe(false);
  });

  it('folds confusable Unicode dots', () => {
    // U+FF0E fullwidth full stop. A hand-rolled endsWith('.q') misses it, which
    // is why this delegates to shared's helper rather than checking locally.
    const r = resolveSpaceMemberName({
      address: ADDRESS,
      displayName: 'alice．q',
      globalDisplayName: 'Mallory',
    });
    expect(r.name).toBe('Mallory');
  });

  it('leaves a legitimate per-space name alone', () => {
    // The guard must not cost the tier its whole purpose.
    const r = resolveSpaceMemberName({
      address: ADDRESS,
      displayName: 'Mod Alice',
      globalDisplayName: 'Alice',
      primaryUsername: 'alice',
    });
    expect(r.name).toBe('Mod Alice');
    expect(r.isQnsVerified).toBe(false);
  });

  it('leaves a mid-name dot alone, because it cannot look verified', () => {
    const r = resolveSpaceMemberName({ address: ADDRESS, displayName: 'jane.doe' });
    expect(r.name).toBe('jane.doe');
  });

  it('still lets a real .q win over the global name', () => {
    const r = resolveSpaceMemberName({
      address: ADDRESS,
      globalDisplayName: 'Alice',
      primaryUsername: 'alice',
    });
    expect(r.name).toBe('alice');
    expect(r.isQnsVerified).toBe(true);
  });
});

describe('resolveMemberName — inherits the guard from shared', () => {
  it('drops a display name ending in .q', () => {
    // Not a new rule here, but pinned so a future refactor away from shared
    // cannot silently reopen the DM half of the same hole.
    const r = resolveMemberName({ address: ADDRESS, displayName: 'alice.q' });
    expect(r.name).not.toBe('alice.q');
    expect(r.isQnsVerified).toBe(false);
  });
});
