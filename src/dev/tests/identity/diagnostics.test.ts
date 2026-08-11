/**
 * The instrument half of the identity-resolution fix (see
 * src/identity/diagnostics.ts's own module docstring for the full design
 * rationale). These tests pin the CLASSIFICATION logic directly — the same
 * function `useResolvedMemberName`/`useNameResolver` call after computing
 * `identity`/`scope` — so the "degraded vs expected" distinction is
 * verifiable without mounting a component tree.
 *
 * `recordIfDegraded` is deliberately NOT exported from `@/identity` (only
 * the two resolver hooks call it) — imported directly from the module here,
 * which is the one place outside those two callers allowed to reach for it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MemberIdentity } from '@quilibrium/quorum-shared';
import type { IdentitySources } from '@/identity/identityProvider';
import {
  recordIfDegraded,
  getIdentityDiagnosticsState,
  subscribeIdentityDiagnostics,
  resetIdentityDiagnosticsForTests,
} from '@/identity/diagnostics';

const SELF = 'QmSelfDiagAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const OTHER = 'QmOtherDiagEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpzzzz';
const SPACE = 'space-diag-1';

const emptyIdentity = (address: string): MemberIdentity => ({
  address,
  spaceName: null,
  qnsName: null,
  globalName: null,
});

const namedIdentity = (address: string): MemberIdentity => ({
  address,
  spaceName: null,
  qnsName: null,
  globalName: 'Has A Name',
});

const sourcesWith = (overrides: Partial<IdentitySources> = {}): IdentitySources => ({
  rostersBySpace: {},
  profiles: {},
  selfAddress: SELF,
  selfProfile: null,
  locallyKnownNames: {},
  ...overrides,
});

describe('recordIfDegraded — classification', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetIdentityDiagnosticsForTests();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // vi.spyOn on a method that is ALREADY a mock (left over from the
    // previous test, since nothing restores it otherwise) returns that SAME
    // mock instance rather than a fresh one — so without this, `warnSpy`'s
    // call count silently accumulates across tests in this file.
    vi.restoreAllMocks();
  });

  it('is a no-op when a real name resolved — the hot path of a working app never touches the log', () => {
    recordIfDegraded({
      identity: namedIdentity(OTHER),
      scope: 'space',
      sources: sourcesWith(),
      spaceId: SPACE,
    });

    const state = getIdentityDiagnosticsState();
    expect(state.degradedTotal).toBe(0);
    expect(state.expectedTotal).toBe(0);
    expect(state.events).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('flags YOUR OWN identity falling through as degraded — self-no-local-source', () => {
    recordIfDegraded({
      identity: emptyIdentity(SELF),
      scope: 'global',
      sources: sourcesWith({ selfAddress: SELF }),
      surface: 'TestSurface',
    });

    const state = getIdentityDiagnosticsState();
    expect(state.degradedTotal).toBe(1);
    expect(state.expectedTotal).toBe(0);
    expect(state.events[0]).toMatchObject({
      address: SELF,
      isSelf: true,
      reason: 'self-no-local-source',
      degraded: true,
      surface: 'TestSurface',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('TestSurface');
    expect(warnSpy.mock.calls[0][0]).toContain(SELF);
  });

  it('flags a space scope whose rostersBySpace has no entry for that space AT ALL as degraded — space-roster-not-loaded', () => {
    // The exact Kick/Mute/Block pre-fix shape: rostersBySpace={} (no key for
    // ANY space), regardless of which space the action is in.
    recordIfDegraded({
      identity: emptyIdentity(OTHER),
      scope: 'space',
      sources: sourcesWith({ rostersBySpace: {} }),
      spaceId: SPACE,
      surface: 'KickUserModal',
    });

    const state = getIdentityDiagnosticsState();
    expect(state.degradedTotal).toBe(1);
    expect(state.events[0].reason).toBe('space-roster-not-loaded');
    expect(state.events[0].degraded).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT flag a space scope whose roster WAS loaded and simply has no row for this address — no-source-anywhere, not degraded, not warned', () => {
    recordIfDegraded({
      identity: emptyIdentity(OTHER),
      scope: 'space',
      // The space key IS present — an empty object, not an absent one —
      // meaning this provider DID load the roster; the member just isn't
      // in it (a genuinely unknown member, not a provider defect).
      sources: sourcesWith({ rostersBySpace: { [SPACE]: {} } }),
      spaceId: SPACE,
    });

    const state = getIdentityDiagnosticsState();
    expect(state.degradedTotal).toBe(0);
    expect(state.expectedTotal).toBe(1);
    expect(state.events[0]).toMatchObject({ reason: 'no-source-anywhere', degraded: false });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT flag a global (DM) scope with nothing local known — no space roster concept applies there', () => {
    recordIfDegraded({
      identity: emptyIdentity(OTHER),
      scope: 'global',
      sources: sourcesWith(),
      // no spaceId — a DM/global surface.
    });

    const state = getIdentityDiagnosticsState();
    expect(state.degradedTotal).toBe(0);
    expect(state.expectedTotal).toBe(1);
    expect(state.events[0].reason).toBe('no-source-anywhere');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('dedupes repeats of the same (address, scope, spaceId, reason) within the window: one console.warn, accurate occurrences and totals', () => {
    for (let i = 0; i < 3; i++) {
      recordIfDegraded({
        identity: emptyIdentity(SELF),
        scope: 'global',
        sources: sourcesWith({ selfAddress: SELF }),
      });
    }

    const state = getIdentityDiagnosticsState();
    // Totals are NEVER diluted by the dedupe — every call counted.
    expect(state.degradedTotal).toBe(3);
    // But only ONE distinct event, with occurrences folded in.
    expect(state.events).toHaveLength(1);
    expect(state.events[0].occurrences).toBe(3);
    // And only ONE console.warn — the dedupe's whole point.
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a DIFFERENT address does not get folded into another address\'s dedupe entry', () => {
    recordIfDegraded({ identity: emptyIdentity(SELF), scope: 'global', sources: sourcesWith({ selfAddress: SELF }) });
    recordIfDegraded({ identity: emptyIdentity(OTHER), scope: 'global', sources: sourcesWith({ selfAddress: SELF }) });

    const state = getIdentityDiagnosticsState();
    expect(state.events).toHaveLength(2);
    expect(state.degradedTotal).toBe(1); // only SELF is degraded
    expect(state.expectedTotal).toBe(1); // OTHER is a genuinely-unknown member
  });

  it('never throws, even given a malformed sources object', () => {
    expect(() =>
      recordIfDegraded({
        identity: emptyIdentity(OTHER),
        scope: 'space',
        sources: { rostersBySpace: null, profiles: null } as unknown as IdentitySources,
        spaceId: SPACE,
      }),
    ).not.toThrow();
  });
});

describe('subscribeIdentityDiagnostics — live updates for the coverage page', () => {
  beforeEach(() => {
    resetIdentityDiagnosticsForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('notifies subscribers on a new event, and getIdentityDiagnosticsState returns a stable reference between notifications', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeIdentityDiagnostics(listener);

    const before = getIdentityDiagnosticsState();
    // Same reference across repeated reads with no state change in between —
    // required for React's useSyncExternalStore (see diagnostics.ts).
    expect(getIdentityDiagnosticsState()).toBe(before);

    recordIfDegraded({
      identity: emptyIdentity(SELF),
      scope: 'global',
      sources: sourcesWith({ selfAddress: SELF }),
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const after = getIdentityDiagnosticsState();
    expect(after).not.toBe(before);
    expect(after.degradedTotal).toBe(1);

    unsubscribe();
    recordIfDegraded({
      identity: emptyIdentity(SELF),
      scope: 'global',
      sources: sourcesWith({ selfAddress: SELF }),
    });
    expect(listener).toHaveBeenCalledTimes(1); // not called again after unsubscribe
  });
});
