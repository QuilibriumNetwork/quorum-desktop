// Deciding whether the roster pull converged.
//
// `requestSync` is fire-once-per-connect and the member half travels as ONE
// payload, so losing a single frame loses the entire roster with no partial
// result and no retry until relaunch. Measured 2026-08-02: the same two clients
// ran the same join twice; the first delivered ZERO member rows, the second
// delivered 71.
//
// Peers already tell us what they hold (`memberCount` on `sync-info`), so this
// compares that against what we actually persisted and decides whether to ask
// again. These tests pin both edges:
//
//   too eager    → a client that is already converged re-asks forever, and each
//                  re-ask is a broadcast plus a directed exchange, paid once per
//                  space
//   too cautious → the catastrophic case (1 row against an advertised 78) is
//                  never noticed and the user stares at truncated addresses
//                  until they relaunch
//
// See 2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md under .agents/issues/

import { describe, it, expect } from 'vitest';
import {
  createRosterConvergenceTracker,
  MIN_ROSTER_SHORTFALL,
  MAX_ROSTER_REASKS,
  ROSTER_REASK_COOLDOWN_MS,
  ROSTER_REASK_WINDOW_MS,
} from '../../../utils/rosterConvergence';

const SPACE = 'QmZM3AKwKfMp';
const T0 = 1_750_000_000_000;

const tracker = () => createRosterConvergenceTracker();

describe('noticing a shortfall', () => {
  // THE case this exists for: the member payload was lost, so we hold only our
  // own row while a peer advertised a full roster.
  it('asks again when a whole payload was clearly lost', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);
  });

  it('stays quiet once the roster is close to what was on offer', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk(SPACE, 72, T0).ask).toBe(false);
  });

  // The exact 2026-08-02 numbers: the responder resolved 78 and the receiver
  // persisted 71. That ~7 gap is structural and has its own causes; re-asking
  // over it would be a permanent traffic drip against a peer already giving us
  // everything it has.
  it('tolerates the known structural gap between resolved and persisted', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk(SPACE, 71, T0).ask).toBe(false);
  });

  it('treats exactly the threshold as worth another ask', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 100, T0);

    expect(t.shouldReAsk(SPACE, 100 - MIN_ROSTER_SHORTFALL, T0).ask).toBe(true);
    expect(t.shouldReAsk(SPACE, 100 - MIN_ROSTER_SHORTFALL + 1, T0).ask).toBe(false);
  });

  it('never asks when we already hold more than anyone offered', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 72, T0);

    // User A's real case: 79 rows locally, synced against a 72-member peer.
    expect(t.shouldReAsk(SPACE, 79, T0).ask).toBe(false);
  });

  // Nothing to fall short of. Asking again would be asking into the void.
  it('does not ask when no peer ever advertised anything', () => {
    expect(tracker().shouldReAsk(SPACE, 1, T0).ask).toBe(false);
  });

  it('does not ask for a space it has never heard of', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk('a-different-space', 0, T0).ask).toBe(false);
  });
});

// ⚠️ An ABSOLUTE shortfall alone is blind exactly where most spaces begin.
// Every threshold here was tuned against a ~78-member community; a twelve-member
// space missing three quarters of its roster produces a shortfall of 9, which
// slips under a purely absolute rule and is silently declared healthy.
describe('small spaces', () => {
  it('asks again when most of a small roster is missing', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 12, T0);

    // 3 of 12 — the absolute shortfall is only 9, below MIN_ROSTER_SHORTFALL.
    expect(9).toBeLessThan(MIN_ROSTER_SHORTFALL);
    expect(t.shouldReAsk(SPACE, 3, T0).ask).toBe(true);
  });

  it('leaves a small roster alone once it is nearly complete', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 12, T0);

    expect(t.shouldReAsk(SPACE, 11, T0).ask).toBe(false);
  });

  it('still tolerates the structural gap at community scale', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    // 71 of 78 is 91% held — the proportional rule must NOT drag this back in.
    expect(t.shouldReAsk(SPACE, 71, T0).ask).toBe(false);
  });

  it('notices a total loss in a tiny space', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 4, T0);

    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);
  });
});

// The caller logs this reason on every branch. Four materially different
// situations used to collapse into one silent `false`, and the most actionable
// of them ("we know you are short, we are out of budget") was the least visible.
describe('saying WHY', () => {
  it('reports no-target when nobody ever answered', () => {
    expect(tracker().shouldReAsk(SPACE, 1, T0)).toMatchObject({
      ask: false,
      reason: 'no-target',
    });
  });

  it('reports converged, with the target, when we are close enough', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk(SPACE, 72, T0)).toMatchObject({
      ask: false,
      reason: 'converged',
      target: 78,
    });
  });

  it('reports cooling-down between attempts', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);
    t.noteReAsk(SPACE, T0);

    expect(t.shouldReAsk(SPACE, 1, T0 + 1000)).toMatchObject({
      ask: false,
      reason: 'cooling-down',
      target: 78,
    });
  });

  // THE one worth logging: still short, but out of attempts.
  it('reports cap-reached while still short', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);
    for (let i = 0; i < MAX_ROSTER_REASKS; i++) {
      t.noteReAsk(SPACE, T0 + i * ROSTER_REASK_COOLDOWN_MS);
    }

    expect(t.shouldReAsk(SPACE, 1, T0 + ROSTER_REASK_COOLDOWN_MS * 3)).toMatchObject({
      ask: false,
      reason: 'cap-reached',
      target: 78,
    });
  });

  it('carries the target and the shortfall when it does ask', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk(SPACE, 1, T0)).toMatchObject({
      ask: true,
      target: 78,
      shortfall: 77,
    });
  });
});

describe('which offer we aim at', () => {
  // Several peers answer one request holding different amounts. The target is
  // the fullest roster available, not whoever replied last.
  it('targets the best offer, not the most recent one', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 90, T0);
    t.noteAdvertisedRoster(SPACE, 72, T0 + 1);

    expect(t.peek(SPACE)?.bestAdvertised).toBe(90);
    // 80 is comfortably converged against 72 but 10 short of 90.
    expect(t.shouldReAsk(SPACE, 80, T0 + 2).ask).toBe(true);
  });

  it('accepts a better offer arriving later', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 72, T0);
    t.noteAdvertisedRoster(SPACE, 90, T0 + 1);

    expect(t.peek(SPACE)?.bestAdvertised).toBe(90);
  });

  // These arrive from a client we do not control. NaN is the dangerous one:
  // every comparison against it is false, so a shortfall would silently never
  // be detected.
  it.each([
    ['absent', undefined],
    ['null', null],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['negative', -5],
    ['a string', '78'],
    ['zero', 0],
  ])('ignores a %s member count rather than trusting it', (_label, value) => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, value, T0);

    expect(t.peek(SPACE)).toBeNull();
    expect(t.shouldReAsk(SPACE, 0, T0).ask).toBe(false);
  });

  it('keeps a good offer when a garbage one follows it', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);
    t.noteAdvertisedRoster(SPACE, NaN, T0 + 1);

    expect(t.peek(SPACE)?.bestAdvertised).toBe(78);
  });
});

describe('bounding the cost', () => {
  it('spends at most MAX_ROSTER_REASKS attempts in one window', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    let sent = 0;
    for (let i = 0; i < 20; i++) {
      const now = T0 + i * ROSTER_REASK_COOLDOWN_MS;
      // Stay strictly inside ONE window — crossing it legitimately grants a
      // fresh allowance, which the "later window" test covers separately.
      if (now - T0 >= ROSTER_REASK_WINDOW_MS) break;
      // The roster never improves — the peer holding those members is gone.
      if (t.shouldReAsk(SPACE, 1, now).ask) {
        t.noteReAsk(SPACE, now);
        sent++;
      }
    }

    expect(sent).toBe(MAX_ROSTER_REASKS);
  });

  // A reconnect storm must not burn the whole allowance in one bad minute.
  it('holds the cooldown between attempts', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);
    t.noteReAsk(SPACE, T0);

    expect(t.shouldReAsk(SPACE, 1, T0 + 1000).ask).toBe(false);
    expect(t.shouldReAsk(SPACE, 1, T0 + ROSTER_REASK_COOLDOWN_MS - 1).ask).toBe(false);
    expect(t.shouldReAsk(SPACE, 1, T0 + ROSTER_REASK_COOLDOWN_MS).ask).toBe(true);
  });

  it('a burst of sync-info answers cannot spend more than one attempt', () => {
    const t = tracker();

    let sent = 0;
    for (let i = 0; i < 30; i++) {
      const now = T0 + i * 100;
      t.noteAdvertisedRoster(SPACE, 78, now);
      if (t.shouldReAsk(SPACE, 1, now).ask) {
        t.noteReAsk(SPACE, now);
        sent++;
      }
    }

    expect(sent).toBe(1);
  });

  // Without this the cap is permanent for the life of the tab, and a client
  // that could not converge at 09:00 never retries when the peer holding those
  // members comes back.
  it('allows a fresh set of attempts in a later window, given a fresh offer', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    for (let i = 0; i < MAX_ROSTER_REASKS; i++) {
      const now = T0 + i * ROSTER_REASK_COOLDOWN_MS;
      expect(t.shouldReAsk(SPACE, 1, now).ask).toBe(true);
      t.noteReAsk(SPACE, now);
    }
    expect(t.shouldReAsk(SPACE, 1, T0 + ROSTER_REASK_COOLDOWN_MS * 3).ask).toBe(false);

    const later = T0 + ROSTER_REASK_WINDOW_MS;
    // A peer that is STILL HERE re-advertises, and the allowance is renewed.
    t.noteAdvertisedRoster(SPACE, 78, later);
    expect(t.shouldReAsk(SPACE, 1, later).ask).toBe(true);
  });

  // ⚠️ THE ANTI-DRIP RULE, and the reason the test above needs a fresh offer.
  //
  // `bestAdvertised` used to be a monotonic high-water mark. Once any peer had
  // ever advertised 78, that was the target for the rest of the tab's life — so
  // if that peer left for good, the shortfall could never close and the client
  // would spend its whole allowance every 15 minutes, forever, against nobody.
  it('forgets the old target when the window rolls, so a departed peer stops driving retries', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);
    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);

    // The 78-member peer is gone and nobody answers any more.
    const later = T0 + ROSTER_REASK_WINDOW_MS;
    const decision = t.shouldReAsk(SPACE, 1, later);

    expect(decision.ask).toBe(false);
    expect(decision).toMatchObject({ reason: 'no-target' });
    expect(t.peek(SPACE)?.bestAdvertised).toBe(0);
  });

  // `now` is supplied by the caller. A machine that adjusts its clock backwards
  // must not wedge the gate open or shut.
  it('does not misbehave when the clock goes backwards', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);
    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);
    t.noteReAsk(SPACE, T0);

    // Cooldown has obviously not elapsed if time went the other way.
    expect(t.shouldReAsk(SPACE, 1, T0 - 60_000).ask).toBe(false);
    // And the window must not be treated as rolled.
    expect(t.peek(SPACE)?.bestAdvertised).toBe(78);
  });

  // A zero-gain round is exactly the failure this exists for — a lost payload —
  // so it must NOT be treated as evidence that asking again is pointless.
  it('still retries after a round that gained nothing', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);
    t.noteReAsk(SPACE, T0);

    expect(t.shouldReAsk(SPACE, 1, T0 + ROSTER_REASK_COOLDOWN_MS).ask).toBe(true);
  });

  it('stops once a re-ask actually worked, without spending the allowance', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);
    t.noteReAsk(SPACE, T0);

    // The retry landed: 1 → 72.
    expect(t.shouldReAsk(SPACE, 72, T0 + ROSTER_REASK_COOLDOWN_MS).ask).toBe(false);
    expect(t.peek(SPACE)?.reAsks).toBe(1);
  });

  it('spends nothing when noteReAsk is not called', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);

    // A caller that decided to ask but failed to send must not be charged.
    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);
    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(true);
    expect(t.peek(SPACE)?.reAsks).toBe(0);
  });

  it('noteReAsk on an unknown space is a no-op rather than a throw', () => {
    const t = tracker();
    expect(() => t.noteReAsk('never-seen', T0)).not.toThrow();
    expect(t.peek('never-seen')).toBeNull();
  });
});

describe('forgetting a space', () => {
  it('drops its state so a later join starts clean', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);
    t.noteReAsk(SPACE, T0);

    t.forget(SPACE);

    expect(t.peek(SPACE)).toBeNull();
    expect(t.shouldReAsk(SPACE, 1, T0).ask).toBe(false);
  });

  it('leaves other spaces alone', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);
    t.noteAdvertisedRoster('other', 90, T0);

    t.forget(SPACE);

    expect(t.peek('other')?.bestAdvertised).toBe(90);
  });
});

describe('spaces are tracked independently', () => {
  it('one space exhausting its allowance does not silence another', () => {
    const t = tracker();
    t.noteAdvertisedRoster(SPACE, 78, T0);
    t.noteAdvertisedRoster('other', 78, T0);

    for (let i = 0; i < MAX_ROSTER_REASKS; i++) {
      t.noteReAsk(SPACE, T0 + i * ROSTER_REASK_COOLDOWN_MS);
    }

    expect(t.shouldReAsk(SPACE, 1, T0 + ROSTER_REASK_COOLDOWN_MS * 3).ask).toBe(false);
    expect(t.shouldReAsk('other', 1, T0 + ROSTER_REASK_COOLDOWN_MS * 3).ask).toBe(true);
  });
});
