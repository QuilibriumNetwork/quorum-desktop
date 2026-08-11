// Degraded-resolution diagnostic — the instrument half of the fix.
//
// Every bug in this class (the operator's own name falling to their address
// in the nav rail; Kick/Mute/Block showing an address for a member whose
// name the SPACE roster has, just not this provider) has one signature: a
// name resolved to the truncated-address fallback. That moment is
// observable, and until now nobody was watching for it — the operator found
// all three by clicking around by hand, one surface at a time.
//
// WHAT THIS COUNTS, deliberately narrower than "the address rendered":
//
// A truncated address is the CORRECT answer for a genuinely unknown member
// (a sender who left, a lurker never fetched) — reporting every one of those
// would make this cry wolf and get ignored within a day. What actually needs
// a human's attention is the OTHER shape: a source existed somewhere, but
// THIS PROVIDER could not see it, because it was built with the wrong scope
// (an empty roster, a missing locallyKnownNames entry). The resolver itself
// cannot always tell the two apart — it only ever sees what its own
// `IdentitySources` holds — so this classifies as best it can and labels the
// uncertain middle case rather than silently picking a side:
//
//   'self-no-local-source'    — the address IS the viewer's own. A device
//                                always knows its own display name (see
//                                `selfLocalNameEntry`), so self falling
//                                through to an address is near-certainly a
//                                provider that forgot to feed it — not a
//                                genuinely-unknown member. DEGRADED.
//   'space-roster-not-loaded' — a spaceId was given but this provider's
//                                `rostersBySpace` has no entry for that
//                                space at all (as opposed to an entry that
//                                simply has no row for this address) — the
//                                structural signature of "mounted above the
//                                real data", exactly Kick/Mute/Block's
//                                original shape. DEGRADED.
//   'no-source-anywhere'      — neither of the above applies: the roster
//                                for this scope WAS loaded and simply has no
//                                row, or there is no space scope at all
//                                (a DM/global surface) and no local name was
//                                ever fed in. This is very likely a genuinely
//                                unknown member — reported, but NOT flagged
//                                degraded and NOT warned to the console, so
//                                the signal stays legible.
//
// This is imperfect by construction (documented above and in
// .agents/docs/features/identity-resolution-and-profile-sync.md, "Why the
// component tests could not catch this class") — a provider CAN be missing
// data in a shape this heuristic doesn't recognise. Where it is unsure, it
// reports rather than stays silent, per the design brief: prefer reporting
// both over reporting neither.
//
// ONE GAP CONSIDERED AND DELIBERATELY LEFT OPEN: this classifies
// `rostersBySpace` (via `spaceRosterLoaded`'s `hasOwnProperty` check) but has
// no equivalent signal for `locallyKnownNames` — an address absent from
// `locallyKnownNames` because a provider never passed the prop at all is
// indistinguishable here from one absent because the provider passed it and
// genuinely has no local name for that address; both collapse into the same
// `identity.globalName === null`. A sentinel on the prop (`undefined` = never
// fed, `{}` = fed and empty) would make that structurally detectable, the
// same way a missing `rostersBySpace` key already is.
//
// Not built: `IdentityScopeProvider` now MERGES with an enclosing scope
// instead of replacing it (see that file's own comment on `parent`), so "a
// provider never passed `locallyKnownNames`" is no longer a degraded state —
// it inherits whatever an ancestor (ultimately the root, which always
// carries every DM partner's local name) already knows, same as any other
// tier. A sentinel would now flag "correctly inheriting from an ancestor" as
// if it were the old bug, which is a false alarm under the new architecture,
// not a useful signal. The residual case merging does NOT cover — an
// address knowable only in a sibling scope with no shared ancestor bearing
// the data — is a different shape (a genuinely separate scope, not a
// provider that forgot a prop) and isn't what this gap was ever about.
//
// PRODUCTION FOOTPRINT: gated on `process.env.NODE_ENV === 'production'` at
// the top of every exported function that does real work, mirroring
// `src/dev/dm-doctor/warningCounters.ts` and `src/utils/selfOverrideTripwire.ts`
// — Vite statically replaces `process.env.NODE_ENV` in the client bundle, so
// this whole branch is dead code in a production build, not merely
// runtime-skipped. Everything is additionally wrapped in try/catch:
// diagnostics must never break a render, no matter what.
//
// This module lives in `src/identity/` (not `src/dev/`) because it is called
// from the resolver hooks themselves (`useResolvedMemberName`,
// `useNameResolver`), which run in production. `src/dev/identity-coverage`
// (dev-only, excluded from production builds) imports FROM here to display
// the session counters — that direction is fine; the reverse would not be.

import type { MemberIdentity, IdentityScope } from '@quilibrium/quorum-shared';
import type { IdentitySources } from './identityProvider';

export type DegradedResolutionReason =
  | 'self-no-local-source'
  | 'space-roster-not-loaded'
  | 'no-source-anywhere';

export interface DegradedResolutionEvent {
  /** ISO timestamp of the most recent occurrence of this exact (address,
   *  scope, spaceId, reason) tuple. */
  at: string;
  address: string;
  scope: IdentityScope;
  spaceId?: string;
  /** Caller-supplied label, or a best-effort call-stack hint when none was
   *  given — see `useResolvedMemberName`'s `surface` option. */
  surface: string;
  isSelf: boolean;
  reason: DegradedResolutionReason;
  /** false for 'no-source-anywhere' — reported, but not a provider defect. */
  degraded: boolean;
  /** How many times this exact tuple has fired this session (deduped display,
   *  accurate count — see the module docstring's dedupe note). */
  occurrences: number;
}

export interface IdentityDiagnosticsState {
  /** Every DEGRADED occurrence ever recorded this session, deduped is not
   *  applied here — this is the accurate total the coverage page's headline
   *  number is built from. */
  degradedTotal: number;
  /** Every 'no-source-anywhere' occurrence — reported for visibility, not
   *  counted as a defect. */
  expectedTotal: number;
  /** Most recent distinct events first, capped — see MAX_EVENTS. Each entry
   *  already folds repeats of the same tuple into `occurrences`. */
  events: DegradedResolutionEvent[];
}

const MAX_EVENTS = 100;
// Repeats of the exact same (address, scope, spaceId, reason) within this
// window bump the existing entry's `occurrences`/`at` instead of adding a
// new one and re-warning — a scrolling message list or a re-rendering modal
// would otherwise spam the console and the event list for one real defect.
const DEDUPE_WINDOW_MS = 3000;

let degradedTotal = 0;
let expectedTotal = 0;
const events: DegradedResolutionEvent[] = [];
const listeners = new Set<() => void>();

// `useSyncExternalStore` (the coverage page) requires `getSnapshot()` to
// return the SAME reference until the store actually changes, or React
// re-renders on every call. A snapshot rebuilt inline on every read (a fresh
// `{...spread}`) would violate that silently. Rebuilt only when state
// actually mutates, immediately before `notify()`.
let cachedSnapshot: IdentityDiagnosticsState = { degradedTotal: 0, expectedTotal: 0, events: [] };

function refreshSnapshot(): void {
  cachedSnapshot = { degradedTotal, expectedTotal, events: [...events] };
}

function notify(): void {
  refreshSnapshot();
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // A listener throwing must never break the diagnostic it's listening to.
    }
  });
}

function eventKey(e: Pick<DegradedResolutionEvent, 'address' | 'scope' | 'spaceId' | 'reason'>): string {
  return `${e.address}|${e.scope}|${e.spaceId ?? ''}|${e.reason}`;
}

const present = (s?: string | null): string | null => {
  const t = (s ?? '').trim();
  return t.length ? t : null;
};

/**
 * Best-effort surface identification when the caller passed none: the
 * nearest capitalised (component-shaped) frame in the current call stack.
 * Dev builds are unminified (Vite dev server, and the vitest/jsdom
 * environment these diagnostics are proven against), so this is readable in
 * practice; it is a HINT, not a guarantee, which is why an explicit
 * `surface` always wins when the caller supplies one.
 */
function guessSurfaceFromStack(): string {
  try {
    const stack = new Error().stack ?? '';
    const frames = stack.split('\n').slice(1); // drop "Error" header line
    for (const frame of frames) {
      // Skip frames inside this module and the resolver hooks themselves —
      // they never identify the RENDERING surface, only the plumbing.
      if (/identity[\\/](diagnostics|useResolvedName|useNameResolver|identityProvider)/.test(frame)) {
        continue;
      }
      const match = frame.match(/at (?:new )?([A-Z][A-Za-z0-9_$.]*)/);
      if (match) return match[1];
    }
  } catch {
    // Stack parsing must never throw.
  }
  return 'unknown surface';
}

/**
 * Classify and (if warranted) record one resolution. Call AFTER computing
 * `identity`/`scope` exactly as `resolveIdentity` will see them — this does
 * not re-derive the ladder, it just asks "did every tier come up empty?".
 *
 * No-op (returns immediately) whenever a real name resolved, so the hot path
 * of an app that's working correctly never touches the event log at all.
 */
export function recordIfDegraded(input: {
  identity: MemberIdentity;
  scope: IdentityScope;
  sources: IdentitySources;
  spaceId?: string;
  surface?: string;
}): void {
  if (process.env.NODE_ENV === 'production') return;
  try {
    const { identity, scope, sources, spaceId } = input;
    const hasSource =
      !!present(identity.qnsName) ||
      !!present(identity.globalName) ||
      (scope === 'space' && !!present(identity.spaceName));
    if (hasSource) return; // resolved to a real name — nothing to report.

    const isSelf = !!sources.selfAddress && sources.selfAddress === identity.address;
    const spaceRosterLoaded =
      !spaceId || Object.prototype.hasOwnProperty.call(sources.rostersBySpace, spaceId);

    let reason: DegradedResolutionReason;
    let degraded: boolean;
    if (isSelf) {
      reason = 'self-no-local-source';
      degraded = true;
    } else if (!spaceRosterLoaded) {
      reason = 'space-roster-not-loaded';
      degraded = true;
    } else {
      reason = 'no-source-anywhere';
      degraded = false;
    }

    const surface = present(input.surface) ?? guessSurfaceFromStack();
    const key = eventKey({ address: identity.address, scope, spaceId, reason });
    const now = new Date();
    const nowIso = now.toISOString();

    if (degraded) degradedTotal += 1;
    else expectedTotal += 1;

    const existingIndex = events.findIndex(
      (e) => eventKey(e) === key && now.getTime() - Date.parse(e.at) < DEDUPE_WINDOW_MS,
    );
    if (existingIndex !== -1) {
      const existing = events[existingIndex];
      existing.at = nowIso;
      existing.occurrences += 1;
      notify();
      return; // Already warned for this tuple within the window — stay quiet.
    }

    const event: DegradedResolutionEvent = {
      at: nowIso,
      address: identity.address,
      scope,
      spaceId,
      surface,
      isSelf,
      reason,
      degraded,
      occurrences: 1,
    };
    events.unshift(event);
    if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;

    if (degraded) {
      const why =
        reason === 'self-no-local-source'
          ? 'this is YOUR OWN identity — a device always knows its own name, so this provider is missing a source it should have'
          : "this provider's roster for that space was never loaded (mounted above the real data), not that the member is unknown";
      console.warn(
        `[IdentityResolution] ${surface} rendered ${identity.address} as a truncated address, but ${why}. ` +
          `See getIdentityDiagnosticsState() or /dev/identity-coverage.`,
      );
    }

    notify();
  } catch {
    // Diagnostics must never break a render.
  }
}

/** Read-only snapshot for the /dev/identity-coverage page (or a console
 *  paste: `window.__identityDiagnostics?.()`). Returns the SAME reference
 *  until the state actually changes — required for `useSyncExternalStore`,
 *  see `cachedSnapshot`'s comment. */
export function getIdentityDiagnosticsState(): IdentityDiagnosticsState {
  return cachedSnapshot;
}

/** Subscribe to changes (new event, or a repeat bumping `occurrences`).
 *  Returns an unsubscribe function. Used by the coverage page via
 *  `useSyncExternalStore` so the counter updates live while clicking
 *  around, with no polling and no "take a snapshot" step. */
export function subscribeIdentityDiagnostics(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Test-only: reset all counters and listeners between test cases. */
export function resetIdentityDiagnosticsForTests(): void {
  degradedTotal = 0;
  expectedTotal = 0;
  events.length = 0;
  refreshSnapshot();
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __identityDiagnostics?: () => IdentityDiagnosticsState }).__identityDiagnostics =
    getIdentityDiagnosticsState;
}
