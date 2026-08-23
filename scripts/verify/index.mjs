#!/usr/bin/env node
/**
 * `yarn verify` — run the checks that apply to what changed, and print a
 * verdict readable without reading the diff.
 *
 * Grown in slices: this revision fans the plan out across all three repos,
 * refuses to report a bare PASS on a reduced run, and (as of Task 12) runs the
 * live tier from `plan.live` — six arms driving real bots against a real
 * relay, not just the fast tier.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { stepsFor } from './steps.mjs';
import { runStep, skipped } from './runner.mjs';
import { renderReport, verdictOf, buildReceipt, writeReceiptSafely, clearReceipt } from './report.mjs';
import { describeEnvironment } from './environment.mjs';
import {
  planFromPaths,
  changedPaths,
  mainCheckoutFrom,
  liveArmsFor,
  needsMobile,
} from './routing.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, '../..');
const RECEIPT = resolve(DESKTOP, '.verify-receipt.json');
const startedAt = Date.now();

const argv = process.argv.slice(2);

// Sits here deliberately: after argv, before any step runs. Reading the
// receipt must never itself trigger a multi-minute run.
if (argv.includes('--show-receipt')) {
  try {
    console.log(readFileSync(RECEIPT, 'utf8'));
    process.exit(0);
  } catch {
    console.error('[verify] no receipt yet — run `yarn verify` first.');
    process.exit(1);
  }
}

// Invalidate any receipt from a PREVIOUS run before this one does anything
// else. Without this, a process that dies before reaching the write at the
// end (Ctrl+C, an uncaught exception in a step, a CI timeout) would leave
// that old receipt on disk looking like it describes the run that just
// aborted — the exact "reported as done" failure the receipt exists to
// prevent, just arriving through interruption instead of a skipped step.
// Must run AFTER the --show-receipt block above, or `--show-receipt` would
// delete the very receipt it is about to print.
//
// If the clear itself fails (AV lock, permissions) and this run then aborts
// before reaching the write at the end, the old receipt survives — the same
// failure this call exists to prevent, just re-entered through the one I/O
// path a silent failure here wouldn't have covered. Surfaced the same way
// the write path surfaces its own failure, for the same reason: this must
// not flip the exit code (an unrelated I/O error must not turn a real PASS
// into a reported FAIL), but it must not be silent either.
const clearResult = clearReceipt(RECEIPT);
if (!clearResult.ok) {
  console.error(
    `[verify] could not clear the previous receipt: ${clearResult.error.message} — ` +
      'if this run does not finish, any receipt left on disk is from a PREVIOUS run and must not be trusted.'
  );
}

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
  // Explicit, not inherited: `--all` means every arm, so it must override a
  // `cross-only` scope the diff would otherwise have inferred.
  plan.liveScope = 'all';
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

// `--explain` answers "what would this run, and why" without running any of
// it. Two reasons it earns its place rather than being a convenience:
//
//   1. The routing decides how many minutes a `yarn verify` costs, and until
//      now the only way to find out was to pay them. A question you cannot ask
//      cheaply does not get asked.
//   2. It is the only cheap CONTROL for the live-arm selection below. Proving
//      that a mobile-only diff drops the four same-client arms means nothing
//      unless you can also see a desktop diff keep them, and doing that for
//      real costs six minutes of relay traffic and a permanent Space. This
//      prints both answers in milliseconds.
//
// Placed after the argv overrides so it explains the run you actually asked
// for, and before `describeEnvironment` so it stays fast.
if (argv.includes('--explain')) {
  const arms = liveArmsFor(plan, stepsFor('desktop', REPOS.desktop, 'live')).map((s) => s.label);
  console.log(`  ROUTED     ${plan.repos.join(' + ') || 'nothing'}`);
  console.log(`  TIER       ${plan.live ? 'fast + live' : 'fast'}`);
  console.log(`  LIVE ARMS  ${arms.join(', ') || '(none)'}`);
  for (const reason of plan.reasons) console.log(`             ${reason}`);
  process.exit(0);
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

// A settle gap between real-relay live arms. MEASURED 2026-08-23 (Task 12):
// `space-delivery` passed reliably alone (~95s, matching Tasks 8-9's own
// baseline) but genuinely executed and failed when run as the fourth live arm
// immediately after three other real scenarios with no gap — diagnosed as
// load/contention against the shared relay, not a scenario bug (ruled out:
// standalone invocation with the exact command the gate uses; ruled out: a
// generic spawn-count ceiling, via a 20-call synthetic spawn loop that showed
// no degradation). This value is a deliberately modest, not precisely-tuned,
// gap — `desktop:space-delivery` in `RETRYABLE` (runner.mjs) is the backstop
// for whatever it doesn't cover.
const LIVE_STEP_GAP_MS = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// `run-cross.mjs` and `run-config-cross.mjs` are plain Node scripts, not part
// of scripts/verify/, and independently resolve mobile as
// `resolve(DESKTOP, '..', 'quorum-mobile')` — correct from the main checkout,
// wrong from a linked worktree (there, `DESKTOP/..` is just `.worktrees/`).
// This predicts the exact path those scripts will compute so we can skip
// BEFORE paying for a spawn we already know fails, rather than after.
// MEASURED 2026-08-23: both scripts fail with this identical error whether
// run through this orchestrator or standalone — a pre-existing bug, not a
// sequencing artifact. Tracked:
// .agents/issues/.open/2026-08-23-cross-client-harness-scripts-resolve-mobile-wrong-from-worktree.md
const crossScriptMobilePath = resolve(DESKTOP, '..', 'quorum-mobile');

// Live tier: six arms driving real bots against a real relay. Desktop-only —
// see steps.mjs — because that is where every scenario (including the two
// cross-client ones) actually lives.
// `liveArmsFor` drops the arms routing decided cannot observe this change.
// They are OMITTED rather than emitted as SKIP — exactly as a docs-only diff
// omits the whole live tier and still earns a bare PASS. A SKIP row would
// report PASS (PARTIAL) on every mobile-only change, and a warning that fires
// when nothing is wrong stops being read. The routing reason line above the
// table says what was left out and why.
if (plan.live) {
  let ranPreviousLiveStep = false;
  for (const step of liveArmsFor(plan, stepsFor('desktop', REPOS.desktop, 'live'))) {
    // The two cross-client arms need mobile; the rest do not. Skipping via
    // `skipped()` (not silently omitting the row) is what keeps a reduced run
    // from ever printing a bare PASS — SKIP is in report.mjs's SEVERITY list.
    // This is the opposite case from the omission above: mobile being absent
    // is an accident, not a plan, so it must be loud.
    if (needsMobile(step) && !existsSync(REPOS.mobile)) {
      results.push(skipped(step, 'quorum-mobile not found — cross-client arm skipped'));
      continue;
    }
    if (needsMobile(step) && !existsSync(crossScriptMobilePath)) {
      results.push(
        skipped(
          step,
          `${step.label} resolves mobile at ${crossScriptMobilePath} (worktree-relative, not ` +
            'the real sibling) and fails there even though quorum-mobile is present — see ' +
            '.agents/issues/.open/2026-08-23-cross-client-harness-scripts-resolve-mobile-wrong-from-worktree.md'
        )
      );
      continue;
    }
    // Only wait after a step that actually touched the relay — a skip never
    // did, so there is nothing to settle from.
    if (ranPreviousLiveStep) await sleep(LIVE_STEP_GAP_MS);
    results.push(await runStep(step, plan));
    ranPreviousLiveStep = true;
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

const verdict = verdictOf(results, plan);

const receiptResult = writeReceiptSafely(
  RECEIPT,
  buildReceipt({ env, plan, results, verdict, startedAt, finishedAt: Date.now() })
);
if (!receiptResult.ok) {
  // writeReceiptSafely already cleared any stale file; this deliberately
  // does not change THIS run's exit code — see the function's header in
  // report.mjs for why an I/O error here must not masquerade as a test
  // failure (or a test failure be masked by one).
  console.error(`[verify] could not write receipt: ${receiptResult.error.message}`);
}

// --strict is for when you want the full net or nothing: a reduced run stops
// being an answer and becomes a failure.
const strict = argv.includes('--strict');
const failed = verdict === 'FAIL' || (strict && verdict !== 'PASS');
process.exit(failed ? 1 : 0);
