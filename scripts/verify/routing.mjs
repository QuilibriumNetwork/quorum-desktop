#!/usr/bin/env node
/**
 * Decide what to run from what changed.
 *
 * The live-tier trigger is an ALLOWLIST of provably safe paths, not a denylist
 * of dangerous ones, and the direction is the whole design. A denylist rots
 * silently: someone adds a receive path, nobody lists it, live coverage lapses
 * and there is no signal. An allowlist rots loudly — it costs an unnecessary
 * fifteen minutes, which is visible the moment it happens.
 *
 * Paths arrive prefixed with their repo: `desktop/src/...`, `shared/src/...`.
 */
import { dirname, resolve } from 'node:path';

/**
 * Safe: cannot change what goes on the wire or what comes off it.
 *
 * Every pattern here must match a path that actually exists in one of the three
 * repos. A pattern that matches nothing is not harmless — it reads as coverage
 * that isn't there, and hides the real directory it was meant to name. MEASURED
 * 2026-08-23 by classifying every tracked file in all three repos: the original
 * `src/locales/` matched ZERO files anywhere, while desktop's real translation
 * catalogues live under `src/i18n/<locale>/` and were all routing to the live
 * tier — roughly 100 files paying six minutes of real-relay traffic to change a
 * translated string.
 */
const SAFE = [
  /\.md$/,
  /\.mdx$/,
  /\.s?css$/,
  /^[^/]+\/\.agents\//,
  /^[^/]+\/\.claude\//,
  /^[^/]+\/public\//,
  // Only files INSIDE a locale folder. `src/i18n/i18n.ts` and
  // `src/i18n/locales.ts` sit at that directory's root and are real code, so
  // the trailing `[^/]+\/` is load-bearing: it requires a locale segment.
  /^[^/]+\/src\/(i18n|locales)\/[^/]+\//,
  /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
];

/**
 * Safe ONLY when nothing riskier is in the same diff. A component cannot reach
 * the wire on its own, but a diff that touches a component and a service is not
 * a UI change with a service file in it — it is a service change.
 *
 * The three repos do NOT share a layout, and assuming they did was the second
 * measured gap. Desktop and shared put source under `src/`; quorum-mobile has
 * no `src/` directory at all (MEASURED: zero tracked files under `mobile/src/`).
 * So the `src/`-prefixed patterns silently covered desktop only, leaving
 * mobile's 208 components, its 173 icon components under `assets/icons/`, and
 * its whole harness unclassified — 74% of that repo routing to a live tier that
 * cannot observe any of it.
 */
const SAFE_ALONE = [
  // Desktop + shared. `src/primitives/` is shared's home for the same UI
  // primitives desktop re-exports, so it is the same category as components.
  /^[^/]+\/src\/components\//,
  /^[^/]+\/src\/primitives\//,
  // Everything under `src/dev/tests/` EXCEPT the harness. The harness is the
  // live tier's own instrument — `spaceState.ts`, the scenario files, the bot
  // helpers — so a change there is precisely the change that needs a live run
  // to mean anything. Excluding it from the safe list is not conservatism, it
  // is the only way the gate can check its own measuring equipment.
  /^[^/]+\/src\/dev\/tests\/(?!harness\/)/,
  // quorum-mobile's flat layout.
  /^[^/]+\/components\//,
  /^[^/]+\/assets\//,
  /^[^/]+\/dev\/harness\//,
  /^[^/]+\/__tests__\//,
  // Native build config. MEASURED: `android/` and `ios/` hold no `.js`/`.ts`
  // at all (png, webp, xml, json, swift, plist, gradle, kt), so they cannot
  // change any JavaScript path the live tier drives.
  /^[^/]+\/(android|ios)\//,
];

const REPO_OF = (path) => path.split('/')[0];

export function planFromPaths(paths) {
  const reasons = [];
  const touched = new Set(paths.map(REPO_OF).filter(Boolean));

  // Channel A: desktop symlinks shared and mobile pins the published copy, so a
  // shared change is the only one that fans out on its own.
  const repos = [];
  if (touched.has('shared')) repos.push('shared', 'desktop', 'mobile');
  else {
    if (touched.has('desktop')) repos.push('desktop');
    if (touched.has('mobile')) repos.push('mobile');
  }

  const risky = paths.filter(
    (p) => !SAFE.some((r) => r.test(p)) && !SAFE_ALONE.some((r) => r.test(p))
  );
  const live = risky.length > 0;
  if (live) {
    reasons.push(`(not on the safe list: ${risky.slice(0, 3).join(', ')})`);
    if (risky.length > 3) reasons.push(`(… and ${risky.length - 3} more)`);
  } else if (paths.length) {
    reasons.push('(every changed path is on the safe list — fast tier only)');
  }

  // WHICH live arms can observe this change, as opposed to WHETHER any can.
  //
  // The live tier is desktop-only: every arm is a desktop vitest scenario, and
  // only the two cross-client runners (`run-cross.mjs`, `run-config-cross.mjs`)
  // reach into quorum-mobile at all — READ 2026-08-23, `grep -rl quorum-mobile
  // src/dev/tests/harness/` returns those two plus the scenarios they drive and
  // the README. So when the ONLY risky paths are mobile's, the four same-client
  // arms load no changed code whatsoever. Running them is not caution, it is
  // six minutes of real-relay traffic that could not have gone red.
  //
  // This is narrower than it looks and deliberately so. A shared change puts
  // `shared/…` in `risky`, so it is never mobile-only; a diff touching both
  // repos is never mobile-only. The rule fires only when every risky path is
  // physically incapable of reaching desktop's process.
  const mobileOnly = live && risky.every((p) => REPO_OF(p) === 'mobile');
  const liveScope = mobileOnly ? 'cross-only' : 'all';
  if (mobileOnly) {
    reasons.push(
      '(only quorum-mobile changed — running the cross-client arms; the four ' +
        'same-client arms load no mobile code and cannot observe it)'
    );
  }

  return { repos: [...new Set(repos)], live, liveScope, reasons, skipped: [] };
}

/**
 * Does this live arm spawn quorum-mobile?
 *
 * READ 2026-08-23: `grep -rl quorum-mobile src/dev/tests/harness/` names only
 * `run-cross.mjs`, `run-config-cross.mjs` and the scenarios they drive. Every
 * other arm is a desktop vitest scenario that never loads a line of mobile.
 */
export const needsMobile = (step) => step.id.includes('cross');

/**
 * The live arms a plan can actually learn something from.
 *
 * Deliberately shared by the runner and by `--explain`. If `--explain`
 * re-implemented this filter it would be a second source of truth about what
 * runs, and the moment the two drifted the cheap answer would be the wrong
 * one — a tool for predicting cost that quietly mispredicts is worse than not
 * having it, because it is trusted.
 */
export function liveArmsFor(plan, steps) {
  if (!plan.live) return [];
  const inScope =
    (plan.liveScope ?? 'all') === 'cross-only' ? steps.filter(needsMobile) : steps;
  return plan.exhaustive ? inScope : inScope.filter((s) => !s.exhaustiveOnly);
}

/**
 * Arms that WOULD have run but were held back for cost.
 *
 * Returned so the report can name them on every run. An arm that silently
 * stops running is the failure this whole gate exists to prevent, and "it is
 * documented in AGENTS.md" is not a substitute for the run itself saying so —
 * the person reading a PASS is not usually the person who read the doc.
 */
export function heldBackArms(plan, steps) {
  if (!plan.live || plan.exhaustive) return [];
  const inScope =
    (plan.liveScope ?? 'all') === 'cross-only' ? steps.filter(needsMobile) : steps;
  return inScope.filter((s) => s.exhaustiveOnly);
}

/**
 * Repo-prefixed changed paths, working tree + staged, vs the merge base.
 *
 * Deviation from the plan's verbatim source, ruled authorized on review
 * (2026-08-22): `execGit` is expected to return `null` on a failed command —
 * as opposed to `''` for "ran fine, nothing to report" — mirroring
 * `environment.mjs`'s `git()`. Collapsing the two would let a git failure
 * (corrupted repo, index lock, permission error) read as "this repo has no
 * changes", silently suppressing both its fan-out and the live-tier trigger.
 * That inverts the header comment above: an allowlist has to fail toward
 * running MORE, not less. So an unreadable repo instead contributes one
 * synthetic path that no `SAFE`/`SAFE_ALONE` pattern can match, forcing
 * `live` and naming the repo in the printed reasons exactly like any other
 * risky, unclassified change — because from routing's point of view, that is
 * what it is.
 */
export function changedPaths(repoName, repoPath, execGit) {
  const reads = [
    execGit(repoPath, ['diff', '--name-only', 'HEAD']),
    execGit(repoPath, ['diff', '--name-only', '--staged']),
    execGit(repoPath, ['ls-files', '--others', '--exclude-standard']),
  ];
  if (reads.some((r) => r === null)) {
    return [`${repoName}/<unreadable — git command failed>`];
  }
  const out = reads.join('\n');
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))].map(
    (p) => `${repoName}/${p}`
  );
}

/**
 * Resolve the MAIN checkout root from any worktree, linked or not.
 *
 * Deviation from the plan's verbatim source, ruled authorized on review
 * (2026-08-22): the brief has the caller default siblings to `resolve(desktop,
 * '..')`, which is wrong from a linked worktree — there, `..` is just the
 * `.worktrees/` directory, not the checkout that actually sits next to the
 * sibling repos. `execGit` here is expected to run `git rev-parse
 * --git-common-dir` from `desktop` and return its (untrimmed) stdout, or
 * `null` on failure. A linked worktree gets an ABSOLUTE `.git` path back; the
 * main checkout gets a RELATIVE one (just `.git`), which collapses
 * `dirname(resolve(desktop, commonDir))` right back onto `desktop` itself —
 * that is what makes this a no-op in the shipped, non-worktree case
 * (MEASURED 2026-08-22 in both a linked worktree and the main checkout).
 * A git failure (missing git, not a repo, …) falls back to `desktop` too:
 * there is no better answer available, and failing open here just reproduces
 * the brief's original expression one call site up.
 */
export function mainCheckoutFrom(desktop, execGit) {
  const commonDir = execGit(desktop, ['rev-parse', '--git-common-dir']);
  if (!commonDir) return desktop;
  return dirname(resolve(desktop, commonDir.trim()));
}
