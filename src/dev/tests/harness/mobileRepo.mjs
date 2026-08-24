// Where quorum-mobile is, from wherever desktop happens to be checked out.
//
// Both cross-client orchestrators used to compute this inline as
// `resolve(DESKTOP_REPO, '..', 'quorum-mobile')`. That is correct from the main
// checkout and wrong from a linked worktree, where `..` is just `.worktrees/`
// rather than the directory the sibling repos actually sit in. Both arms then
// failed before doing any work, `yarn verify` skipped them, and every single
// run from a worktree reported `PASS (PARTIAL)` for a reason that had nothing
// to do with the change under test — which is how the one verdict meaning
// "coverage was reduced" becomes noise nobody reads.
//
// `mainCheckoutFrom()` in scripts/verify/routing.mjs already solves exactly
// this bug class. It is reused rather than reimplemented: two copies of a path
// rule is two things to fix, and this one was already fixed once.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mainCheckoutFrom } from '../../../../scripts/verify/routing.mjs';

/**
 * Tri-state on purpose, matching what `mainCheckoutFrom` expects and what
 * scripts/verify/index.mjs already does: stdout on success, `null` on failure.
 * Returning `''` for a failed git call would make an unreadable repo
 * indistinguishable from a main checkout, and it would resolve to a plausible
 * wrong path rather than an obvious one.
 */
const execGit = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' });
  } catch {
    return null;
  }
};

/**
 * `env` and `git` are injectable so this can be tested without a real worktree
 * or a real sibling checkout on disk. Production callers pass neither.
 */
export function resolveMobileRepo(desktopRepo, env = process.env, git = execGit) {
  // The escape hatch both orchestrators' error messages have promised since
  // they were written, and which neither of them read until now. Honoured
  // first: an explicit answer beats an inferred one, and it is the only route
  // that works if the two repos genuinely are not siblings.
  const override = env.HARNESS_MOBILE_REPO;
  if (override) return resolve(override);
  return resolve(mainCheckoutFrom(desktopRepo, git), '..', 'quorum-mobile');
}
