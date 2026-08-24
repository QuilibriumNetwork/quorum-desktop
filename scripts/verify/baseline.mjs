#!/usr/bin/env node
/**
 * KNOWN-RED baselines.
 *
 * An entry here is a DEBT MARKER, not permission. It exists only so that
 * breakage that already existed on master before this gate shipped doesn't
 * masquerade as new breakage on every single run. `yarn verify`'s first real
 * run failed on arrival: `shared:typecheck` and `mobile:lint` were both
 * already red on master, yet neither appears in
 * `.agents/issues/.open/2026-08-22-verify-regression-gate-plan.md`'s Measured
 * Baseline table — the step catalogue ran them anyway.
 *
 * It is NOT a budget: nobody should raise a recorded `errors` count to make
 * room for more breakage. The only two edits this file should ever see are
 * lowering a count (progress) or deleting an entry entirely (the bug got
 * fixed). `runner.mjs` enforces the second case itself — a KNOWN_RED step
 * that starts passing again downgrades to a warning instead of a quiet PASS,
 * specifically so a stale entry can't hide here forever.
 */

/**
 * Keyed by step id. `errors` is the MEASURED count at the time the entry was
 * recorded (2026-08-23) — the ceiling a future run is allowed to match or
 * beat, never exceed. `issue` is repo-relative so it reads the same from any
 * clone.
 */
export const KNOWN_RED = {
  'shared:typecheck': {
    errors: 1,
    why: "leftIcon/rightIcon (React.ReactNode) leak a falsy 0/''/0n through the || chain into a View style array slot — TS2769 at Input.native.tsx:164",
    issue: '.agents/issues/.open/2026-08-23-shared-typecheck-zero-in-native-style-union.md',
  },
  'mobile:lint': {
    errors: 302,
    why: '302 pre-existing lint errors on quorum-mobile master, unrelated to any change this gate is meant to catch',
    issue: '.agents/issues/.open/2026-08-23-mobile-lint-302-errors.md',
  },
  // Recorded 2026-08-24, the day quorum-mobile first got a `typecheck` script.
  // These 11 are not new: nothing had ever run tsc over that repo automatically,
  // so they are simply the first measurement. Deliberately left unfixed — 10 sit
  // in `services/calling/`, which has zero test coverage (see report.mjs's
  // NOT_COVERED), so a "fix" there cannot be shown to be safe.
  'mobile:typecheck': {
    errors: 11,
    why: '11 pre-existing type errors, unfixed because 10 are in services/calling/ where nothing can verify a change is safe',
    issue: '.agents/issues/.open/2026-08-24-mobile-typecheck-11-errors.md',
  },
};

/** eslint: "✖ 475 problems (302 errors, 173 warnings)" — pull the errors figure, not the total. */
function eslintErrors(output) {
  const summary = (output.match(/\d+\s+problems?\s+\(([^)]+)\)/) ?? [])[1];
  if (!summary) return null;
  const errors = summary.match(/(\d+)\s+errors?/);
  return errors ? Number(errors[1]) : null;
}

/** tsc: one "error TSxxxx" per reported error — count the lines, don't just check presence. */
function tscErrors(output) {
  const matches = output.match(/error TS\d+/g);
  // 0 matches on a FAILED step means tsc failed some other way (bad config,
  // crash) — that is exactly the unparseable case, not "zero errors", so this
  // must return null rather than 0. Returning 0 here would let an unrelated
  // failure pass as "at baseline".
  return matches && matches.length > 0 ? matches.length : null;
}

const EXTRACTOR_BY_STEP = {
  'shared:typecheck': tscErrors,
  'mobile:lint': eslintErrors,
  'mobile:typecheck': tscErrors,
};

/**
 * Returns null — never throws — when `stepId` has no known shape or the
 * output doesn't match it. A classifier that could fail the run it is meant
 * to be classifying would defeat the entire point of this module.
 */
export function errorCountOf(stepId, output) {
  const extract = EXTRACTOR_BY_STEP[stepId];
  if (!extract) return null;
  try {
    return extract(output ?? '');
  } catch {
    return null;
  }
}
