#!/usr/bin/env node
/**
 * `yarn verify` — run the checks that apply to what changed, and print a
 * verdict readable without reading the diff.
 *
 * Grown in slices: this revision fans the plan out across all three repos and
 * refuses to report a bare PASS on a reduced run. Tier selection from
 * `plan.live` (running the live tier, not just fast) still lands later.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { stepsFor } from './steps.mjs';
import { runStep } from './runner.mjs';
import { renderReport, verdictOf } from './report.mjs';
import { describeEnvironment } from './environment.mjs';
import { planFromPaths, changedPaths, mainCheckoutFrom } from './routing.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, '../..');

const argv = process.argv.slice(2);

// Deviation from the plan's verbatim source, ruled authorized on review
// (2026-08-22): returns `null` on failure instead of `''`, mirroring
// `environment.mjs`'s `git()`. `changedPaths()` and `mainCheckoutFrom()` in
// routing.mjs both depend on this tri-state: collapsing "command failed" into
// the same `''` a clean/no-op result produces would make an unreadable repo
// look identical to an untouched one, which is the exact silent-rot failure
// mode this gate's allowlist design exists to avoid (see routing.mjs's header).
const execGit = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' });
  } catch {
    return null;
  }
};

/**
 * Where the sibling repos live. Overridable ONLY so the degrade-loudly path can
 * be tested by pointing at an empty directory. The alternative — renaming a real
 * checkout to simulate its absence — leaves a repo renamed if the run dies
 * halfway, which is not a risk worth taking to test an error message.
 *
 * `mainCheckoutFrom` spawns a `git rev-parse` subprocess; the ternary short-
 * circuits it whenever `--repos-root=` is given, since the override makes its
 * result irrelevant. No point paying for a subprocess whose answer is discarded.
 */
const reposRootArg = argv.find((a) => a.startsWith('--repos-root='));
const SIBLINGS = reposRootArg
  ? resolve(reposRootArg.split('=')[1])
  : resolve(mainCheckoutFrom(DESKTOP, execGit), '..');

const REPOS = {
  desktop: DESKTOP,
  shared: resolve(SIBLINGS, 'quorum-shared'),
  mobile: resolve(SIBLINGS, 'quorum-mobile'),
};

const allPaths = Object.entries(REPOS)
  .filter(([, path]) => existsSync(path))
  .flatMap(([name, path]) => changedPaths(name, path, execGit));

const plan = planFromPaths(allPaths);

// An explicit request beats inference; a diff-less run would otherwise do nothing.
if (argv.includes('--all')) {
  plan.repos = ['desktop', 'shared', 'mobile'];
  plan.live = true;
  plan.reasons = ['(--all: every repo, every tier)'];
}
if (argv.includes('--fast')) {
  plan.live = false;
  plan.reasons.push('(--fast: live tier skipped by request)');
}
if (plan.repos.length === 0) {
  plan.repos = ['desktop'];
  plan.reasons.push('(no changes detected — desktop fast tier as a baseline)');
}

const env = await describeEnvironment(DESKTOP);

const results = [];

// Shared is built FIRST when it is in the plan. Desktop consumes shared through
// its built dist, so skipping this means desktop silently tests the PREVIOUS
// build and reports a green describing code nobody changed.
if (plan.repos.includes('shared') && existsSync(REPOS.shared)) {
  const [buildStep] = stepsFor('shared', REPOS.shared, 'fast').filter(
    (s) => s.label === 'build'
  );
  if (buildStep) results.push(await runStep(buildStep, plan));
}

for (const repo of plan.repos) {
  const path = REPOS[repo];
  if (!existsSync(path)) {
    plan.skipped.push(
      `quorum-${repo} not found at ../quorum-${repo} — ${repo.toUpperCase()} COVERAGE SKIPPED`
    );
    continue;
  }
  for (const step of stepsFor(repo, path, 'fast')) {
    // Already run above; do not pay for it twice.
    if (repo === 'shared' && step.label === 'build' && results.some((r) => r.id === step.id))
      continue;
    results.push(await runStep(step, plan));
  }
}

// Channel A is asymmetric and the asymmetry is invisible: mobile resolves the
// PUBLISHED shared package, so a local shared edit never reaches it.
if (plan.repos.includes('shared') && plan.repos.includes('mobile')) {
  plan.skipped.push(
    'shared changed, but mobile resolves the published @quilibrium/quorum-shared — ' +
      'mobile is NOT testing your change. Publish and bump before trusting it.'
  );
}

if (plan.skipped.length) {
  plan.skipped.push('This does NOT clear a change that touches shared or the wire.');
}

console.log('\n' + renderReport({ env, plan, results }) + '\n');

// --strict is for when you want the full net or nothing: a reduced run stops
// being an answer and becomes a failure.
const verdict = verdictOf(results, plan);
const strict = argv.includes('--strict');
const failed = verdict === 'FAIL' || (strict && verdict !== 'PASS');
process.exit(failed ? 1 : 0);
