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

/** Safe: cannot change what goes on the wire or what comes off it. */
const SAFE = [
  /\.md$/,
  /\.mdx$/,
  /\.s?css$/,
  /^[^/]+\/\.agents\//,
  /^[^/]+\/public\//,
  /^[^/]+\/src\/locales\//,
  /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
];

/**
 * Safe ONLY when nothing riskier is in the same diff. A component cannot reach
 * the wire on its own, but a diff that touches a component and a service is not
 * a UI change with a service file in it — it is a service change.
 */
const SAFE_ALONE = [/^[^/]+\/src\/components\//, /^[^/]+\/src\/dev\/tests\//];

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

  return { repos: [...new Set(repos)], live, reasons, skipped: [] };
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
