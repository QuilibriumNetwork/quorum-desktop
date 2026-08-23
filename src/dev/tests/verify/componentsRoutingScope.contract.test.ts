/**
 * Source-level contract: every file under `src/components/` that reaches past
 * the view layer must be routed to the live tier.
 *
 * `scripts/verify/routing.mjs` clears most of `src/components/` from the live
 * tier on the stated grounds that "a component cannot reach the wire on its
 * own". That is a claim about CAPABILITY, and a directory name is not
 * capability. Until adversarial review caught it on 2026-08-23 the pattern
 * cleared `src/components/context/WebsocketProvider.tsx`, which owns the
 * literal `new WebSocket(...)` — so a change to the transport itself skipped
 * every live arm and still printed a clean PASS.
 *
 * The fix was a carve-out for the three subtrees that import services. A
 * carve-out written by hand is a hole that reopens the first time somebody
 * adds an import somewhere else, silently, with a green run to reassure them.
 * This test is what makes that loud instead: it re-derives the set of
 * service-touching component files from the source on every fast-tier run and
 * fails if any of them is one the routing would clear.
 *
 * If this goes red, do NOT delete the offending import to make it pass. Either
 * move the service call out of the component, or add that subtree to the
 * carve-out in `routing.mjs` — the point is that the decision gets made rather
 * than defaulted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { planFromPaths } from '../../../../scripts/verify/routing.mjs';

const COMPONENTS = join(process.cwd(), 'src', 'components');

/**
 * An import that leaves the view layer. Deliberately broad: `services/` and
 * `api/` are where the wire lives, and a relative depth prefix (`../../`) is
 * how a component reaches them.
 */
const REACHES_PAST_VIEW = /from\s+['"][^'"]*\/(services|api)\//;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('routing scope for src/components', () => {
  const offenders = sourceFiles(COMPONENTS).filter((f) =>
    REACHES_PAST_VIEW.test(readFileSync(f, 'utf8'))
  );

  // A guard whose input set is empty is a guard that cannot fail. If the regex
  // ever stops matching (an import style changes, the folder moves), this
  // catches it before the real assertion below silently passes on nothing.
  it('finds the service-importing components it is meant to police', () => {
    expect(offenders.length).toBeGreaterThan(0);
  });

  it('routes every service-importing component to the live tier', () => {
    const cleared = offenders
      .map((f) => `desktop/${relative(process.cwd(), f).split(sep).join('/')}`)
      .filter((p) => !planFromPaths([p]).live);

    expect(
      cleared,
      'These files under src/components/ import a service or the api layer, so ' +
        'they can change what goes on the wire — but routing.mjs clears them ' +
        'from the live tier, meaning a change to them would print a PASS ' +
        'having run no real-relay arm at all. Add the subtree to the ' +
        "components carve-out in routing.mjs's SAFE_ALONE, or move the service " +
        'call out of the component.'
    ).toEqual([]);
  });

  // The carve-out must stay a carve-out. If it widened to the whole tree the
  // assertion above would still pass, having given up all the speed it exists
  // for — and nothing else would notice.
  it('still clears ordinary presentational components', () => {
    expect(planFromPaths(['desktop/src/components/modals/BlockUserModal.tsx']).live).toBe(false);
    expect(planFromPaths(['desktop/src/components/user/UserProfile.tsx']).live).toBe(false);
  });
});

/**
 * The same contract for the harness, derived from disk rather than from a
 * hardcoded directory name.
 *
 * `routing.mjs` excludes `src/dev/tests/harness/` from the safe list by name,
 * so the gate can check its own measuring equipment. A review round proposed
 * tightening that exclusion's regex against sibling directories like
 * `harnessing/`; mutation testing showed both the old and new forms treat such
 * a sibling identically, so the regex change fixed nothing and a test asserting
 * it would have been vacuous. The real risk it was reaching for is different
 * and worth guarding: if the scenarios ever MOVE — a rename, a split into
 * subfolders — the name-based exclusion silently stops covering them and every
 * scenario file becomes ordinary test code that skips the live tier.
 *
 * So this asserts the property directly against the files that exist.
 */
describe('routing scope for the harness', () => {
  const SCENARIOS = join(process.cwd(), 'src', 'dev', 'tests');

  const scenarioFiles = sourceFiles(SCENARIOS).filter((f) =>
    f.endsWith('.scenario.test.ts')
  );

  it('finds the scenario files it is meant to police', () => {
    expect(scenarioFiles.length).toBeGreaterThan(30);
  });

  it('routes every live scenario file to the live tier, wherever it lives', () => {
    const cleared = scenarioFiles
      .map((f) => `desktop/${relative(process.cwd(), f).split(sep).join('/')}`)
      .filter((p) => !planFromPaths([p]).live);

    expect(
      cleared,
      'These harness scenarios are cleared from the live tier, so editing one ' +
        'would print a PASS without ever running it. The exclusion in ' +
        "routing.mjs's SAFE_ALONE is keyed on the directory name — if the " +
        'scenarios moved, update it to match where they are now.'
    ).toEqual([]);
  });
});
