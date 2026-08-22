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

/** Repo-prefixed changed paths, working tree + staged, vs the merge base. */
export function changedPaths(repoName, repoPath, execGit) {
  const out = [
    execGit(repoPath, ['diff', '--name-only', 'HEAD']),
    execGit(repoPath, ['diff', '--name-only', '--staged']),
    execGit(repoPath, ['ls-files', '--others', '--exclude-standard']),
  ].join('\n');
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))].map(
    (p) => `${repoName}/${p}`
  );
}
