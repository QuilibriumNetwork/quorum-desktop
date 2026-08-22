#!/usr/bin/env node
/**
 * `yarn verify` — run the checks that apply to what changed, and print a
 * verdict readable without reading the diff.
 *
 * Grown in slices: this revision computes the plan from `git diff` instead of
 * a hardcoded one. The step loop itself still only runs desktop's fast tier;
 * cross-repo fan-out and tier selection from `plan.live` land in Task 4.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { stepsFor } from './steps.mjs';
import { runStep } from './runner.mjs';
import { renderReport, verdictOf } from './report.mjs';
import { describeEnvironment } from './environment.mjs';
import { planFromPaths, changedPaths } from './routing.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, '../..');

const argv = process.argv.slice(2);

const execGit = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' });
  } catch {
    return '';
  }
};

// Deviation from the plan's verbatim source, ruled authorized on review
// (2026-08-22): the brief has SIBLINGS default to `resolve(DESKTOP, '..')`,
// which is wrong when verify runs from a linked worktree — there, `..` is the
// `.worktrees/` directory, which holds no sibling repos, not the checkout that
// actually sits next to `quorum-shared`/`quorum-mobile`. `--git-common-dir`
// resolves to the MAIN worktree's `.git` from anywhere (a relative `.git` in
// the main checkout, an absolute path from a linked one — `resolve(DESKTOP,
// ...)` normalises both), so its parent is the main checkout and that parent's
// parent is where the siblings live. In a normal, non-worktree clone this
// collapses back to the brief's `resolve(DESKTOP, '..')`: MEASURED 2026-08-22,
// `git rev-parse --git-common-dir` there returns the relative `.git`, so
// `dirname` lands back on DESKTOP itself and the two paths agree.
const mainCheckout = (() => {
  const commonDir = execGit(DESKTOP, ['rev-parse', '--git-common-dir']).trim();
  return commonDir ? dirname(resolve(DESKTOP, commonDir)) : DESKTOP;
})();

/**
 * Where the sibling repos live. Overridable ONLY so the degrade-loudly path can
 * be tested by pointing at an empty directory. The alternative — renaming a real
 * checkout to simulate its absence — leaves a repo renamed if the run dies
 * halfway, which is not a risk worth taking to test an error message.
 */
const reposRootArg = argv.find((a) => a.startsWith('--repos-root='));
const SIBLINGS = reposRootArg
  ? resolve(reposRootArg.split('=')[1])
  : resolve(mainCheckout, '..');

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
for (const step of stepsFor('desktop', DESKTOP, 'fast')) {
  results.push(await runStep(step));
}

console.log('\n' + renderReport({ env, plan, results }) + '\n');
process.exit(verdictOf(results, plan) === 'FAIL' ? 1 : 0);
