// Did the roster pull actually converge? — the DECISION half, kept pure and
// timer-free so it is directly unit-testable. The scheduling lives in
// MessageService.
//
// THE PROBLEM. `requestSync` is fire-once-per-connect. A peer answers with
// `sync-info` advertising how many members it holds, we pick one, and it sends
// the roster as a SINGLE final payload (`quorum-shared/src/sync/service.ts`,
// message chunks first, members in one last payload). Lose that one frame and
// the entire roster exchange is lost — no partial result, no error, and nothing
// tries again until the app is relaunched. The user sits in front of a list of
// truncated addresses with no way to know a retry would fix it.
//
// Measured 2026-08-02: the same two clients, same code, ran the join twice. The
// first run delivered ZERO member rows. The second delivered 71. Nothing about
// the sync logic differed between them.
//
// THE FIX. The peer already tells us what it has — `memberCount` is on the
// `sync-info` payload and we already read and log it. So after a sync we can
// compare that against the rows we actually hold and ask again if we are
// obviously short. No new message type, no wire change, no dependency on the
// transport work.
//
// ⚠️ WHERE THIS IS WIRED IN MATTERS AS MUCH AS WHAT IT DECIDES. The two calls
// that drive it — `noteAdvertisedRoster` and the scheduler — must stay OUTSIDE
// the sync-session expiry gate in `MessageService`'s `sync-info` handler. They
// were inside it until 2026-08-03, which meant a client whose request window
// expired while it drained a reconnect backlog never learned a target and never
// armed a check: this module was silent in precisely the failure it exists for.
// Read the comment at that call site before moving either call.
//
// ⚠️ This is a MITIGATION, not the repair. The real fix is either chunking the
// member half or desktop consuming the send-retention fix that shipped in shared
// 2.1.0-39 (transport item B1). Read `.agents/issues/transport/README.md` before
// deciding this is enough.
//
// ⚠️ OBSERVABILITY. `shouldReAsk` returns a REASON, not a boolean, and the
// caller logs it on every branch. That is not gold-plating: `logger` is a no-op
// in production builds (see
// .agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md),
// so a developer running a dev build is the ONLY audience this code will ever
// have, and giving them "false" with no reason attached reproduces exactly the
// blindness that made the original bug take a session to find.
//
// See 2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md under
// .agents/issues/ (NEXT STEP B). Issues are filed by state and move between
// .open/, the root and .done/, so grep the filename rather than trusting a path.

import { advertisedCount } from '@quilibrium/quorum-shared';

/**
 * How far below a peer's advertised count we tolerate before asking again.
 *
 * ⚠️ Deliberately NOT small. A converged client does not match its peer exactly,
 * and that is expected rather than a bug: in the 2026-08-02 capture the
 * responder resolved 78 members and the receiver persisted 71, a structural gap
 * of ~7 that has its own causes (rows arriving with no address, among others).
 * A threshold under that would re-ask forever against a peer that is already
 * giving us everything it can.
 *
 * Ten sits above the observed noise and still catches what this exists for: the
 * catastrophic case, where a whole payload was lost and we hold 1 row against an
 * advertised 78.
 */
export const MIN_ROSTER_SHORTFALL = 10;

/**
 * Fraction of the best offer we must hold before calling ourselves converged.
 *
 * ⚠️ An ABSOLUTE shortfall alone is blind in a small space, which is where most
 * spaces actually start. A twelve-member space where we hold three rows is
 * missing 75% of its people and renders as a wall of truncated addresses — but
 * the shortfall is 9, under the threshold, so a purely absolute rule would
 * decide everything was fine and never retry.
 *
 * So the two rules are OR'd: ask again if we are short by a lot OR short by a
 * large fraction. 0.75 is set to sit comfortably above the structural gap the
 * absolute threshold was chosen for (71 of 78 is 91% held, well clear) while
 * still catching 3 of 12 (25% held).
 */
export const MIN_ROSTER_COVERAGE = 0.75;

/**
 * Extra sync rounds allowed per space per window.
 *
 * Two, because the cost is not free — each re-ask is a broadcast `sync-request`
 * plus a directed exchange, and a user in ten spaces pays it ten times over.
 * Two covers a single lost frame (the failure actually observed) without
 * turning an unreachable peer into a standing drip of traffic.
 */
export const MAX_ROSTER_REASKS = 2;

/** Minimum gap between two re-asks for the same space. */
export const ROSTER_REASK_COOLDOWN_MS = 60 * 1000;

/**
 * After this long the attempt count resets and a space may try again.
 *
 * Without it the cap would be permanent for the lifetime of the tab: a client
 * that legitimately could not converge at 09:00 — because the only peer holding
 * those members was offline — would never retry when that peer came back.
 */
export const ROSTER_REASK_WINDOW_MS = 15 * 60 * 1000;

export interface RosterConvergenceConfig {
  minShortfall: number;
  minCoverage: number;
  maxReAsks: number;
  cooldownMs: number;
  windowMs: number;
}

/**
 * Why we are or are not asking again.
 *
 * ⚠️ A bare boolean was the first version and it was a mistake worth not
 * repeating. Four materially different situations — nobody ever answered, we
 * converged, we are out of budget, we are cooling down — collapsed into one
 * silent `false`, and the caller's response was a bare `return` with no log.
 * The single most actionable case ("we KNOW you are 70 rows short, we are just
 * out of attempts until the window rolls") was the least visible.
 *
 * That is the same shape as the bug this whole module exists to fix: the sync
 * path logged nothing about what it received, so a full session went into
 * diagnosing it. Do not flatten this back into a boolean.
 */
export type ReAskDecision =
  | { ask: true; target: number; shortfall: number }
  | {
      ask: false;
      reason: 'no-target' | 'converged' | 'cap-reached' | 'cooling-down';
      /** Best offer seen, when there was one — for the log line. */
      target?: number;
    };

export interface RosterConvergenceState {
  /** The highest member count any peer advertised for this space. */
  bestAdvertised: number;
  /** Re-asks spent in the current window. */
  reAsks: number;
  lastReAskAt: number;
  windowStartedAt: number;
}

export interface RosterConvergenceTracker {
  /**
   * Record what a peer says it holds. Ignores absent or nonsensical counts.
   *
   * Returns whether a usable target was actually recorded. The caller needs
   * that to decide whether arming a convergence check buys anything: with no
   * target `shouldReAsk` can only ever answer `no-target`, so arming would
   * spend a timer and a database read reaching a foregone conclusion.
   */
  noteAdvertisedRoster(spaceId: string, memberCount: unknown, now?: number): boolean;
  /** Are we obviously short of the best roster on offer, and allowed to ask again? */
  shouldReAsk(spaceId: string, localMemberCount: number, now?: number): ReAskDecision;
  /** Record that a re-ask was sent. Call this ONLY after actually sending one. */
  noteReAsk(spaceId: string, now?: number): void;
  /** Drop a space's state — on leave, or when its sync session is torn down. */
  forget(spaceId: string): void;
  /** Read-only, for tests and diagnostics. */
  peek(spaceId: string): Readonly<RosterConvergenceState> | null;
}

export function createRosterConvergenceTracker(
  config: RosterConvergenceConfig = {
    minShortfall: MIN_ROSTER_SHORTFALL,
    minCoverage: MIN_ROSTER_COVERAGE,
    maxReAsks: MAX_ROSTER_REASKS,
    cooldownMs: ROSTER_REASK_COOLDOWN_MS,
    windowMs: ROSTER_REASK_WINDOW_MS,
  }
): RosterConvergenceTracker {
  const { minShortfall, minCoverage, maxReAsks, cooldownMs, windowMs } = config;
  const states = new Map<string, RosterConvergenceState>();

  /**
   * Start a new window: fresh attempts, and — importantly — a fresh TARGET.
   *
   * ⚠️ `bestAdvertised` must be cleared here, not carried over. It was a
   * monotonic high-water mark in the first version, which meant that once any
   * peer had ever advertised 90 members, 90 was the target for the rest of the
   * tab's life. If that peer then went offline for good, the shortfall could
   * never close, and the client would spend its full allowance every window
   * forever — the exact standing drip of traffic the cap exists to prevent.
   *
   * Clearing it makes the target only ever as good as a CURRENT offer: the next
   * `sync-info` from a peer that is actually here repopulates it, and if nobody
   * is there to answer, there is correctly nothing to fall short of.
   */
  const rollWindow = (state: RosterConvergenceState, now: number): void => {
    if (now - state.windowStartedAt >= windowMs) {
      state.windowStartedAt = now;
      state.reAsks = 0;
      state.lastReAskAt = 0;
      state.bestAdvertised = 0;
    }
  };

  return {
    noteAdvertisedRoster(spaceId, memberCount, now = Date.now()) {
      // Shared with `selectBestCandidate` on purpose: both sides have to apply
      // the same floor AND the same ceiling to a peer's self-reported count.
      // An absurd value here would set a target that can never be reached, so
      // the check below would spend its whole allowance every window forever.
      const count = advertisedCount(memberCount as number | undefined | null);
      if (count === 0) return false;

      const existing = states.get(spaceId);
      if (!existing) {
        states.set(spaceId, {
          bestAdvertised: count,
          reAsks: 0,
          lastReAskAt: 0,
          windowStartedAt: now,
        });
        return true;
      }
      rollWindow(existing, now);
      // Keep the BEST offer seen, not the latest. Several peers answer one
      // request and they hold different amounts; the target is the fullest
      // roster available, not whichever client happened to reply last.
      if (count > existing.bestAdvertised) existing.bestAdvertised = count;
      return true;
    },

    shouldReAsk(spaceId, localMemberCount, now = Date.now()) {
      const state = states.get(spaceId);
      // No peer ever advertised anything, so there is no target to fall short
      // of. Asking again would be asking into the void.
      if (!state) return { ask: false, reason: 'no-target' };

      rollWindow(state, now);

      // The window just rolled and cleared the target, or every offer we ever
      // saw was garbage. Either way there is no CURRENT peer to fall short of.
      if (state.bestAdvertised === 0) return { ask: false, reason: 'no-target' };

      const target = state.bestAdvertised;
      const ourCount = Number.isFinite(localMemberCount) ? localMemberCount : 0;
      const shortfall = target - ourCount;

      // Two rules, OR'd. The absolute one catches a lost payload in a large
      // space; the proportional one catches the same loss in a small space,
      // where the absolute gap is tiny but the roster is mostly missing.
      const shortByALot = shortfall >= minShortfall;
      const shortByALargeFraction = ourCount < target * minCoverage;
      if (!shortByALot && !shortByALargeFraction) {
        return { ask: false, reason: 'converged', target };
      }

      if (state.reAsks >= maxReAsks) return { ask: false, reason: 'cap-reached', target };
      if (state.reAsks > 0 && now - state.lastReAskAt < cooldownMs) {
        return { ask: false, reason: 'cooling-down', target };
      }

      // ⚠️ There is deliberately NO "did the last re-ask gain anything?" guard.
      // It is tempting and it is wrong: the failure this exists for is "we
      // received nothing at all", so a round that gained zero rows is precisely
      // the case that must be allowed to retry. The cap and the cooldown are
      // what bound the cost, not a progress check.
      return { ask: true, target, shortfall };
    },

    noteReAsk(spaceId, now = Date.now()) {
      const state = states.get(spaceId);
      if (!state) return;
      rollWindow(state, now);
      state.reAsks += 1;
      state.lastReAskAt = now;
    },

    forget(spaceId) {
      states.delete(spaceId);
    },

    peek(spaceId) {
      return states.get(spaceId) ?? null;
    },
  };
}
