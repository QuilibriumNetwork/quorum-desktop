// The harness's adapter onto the one mobile-path rule.
//
// The rule itself lives in `scripts/verify/routing.mjs`, beside
// `mainCheckoutFrom()`, because the GATE needs it too: `index.mjs` decides
// whether to run the cross-client arms based on where it thinks quorum-mobile
// is, and if that disagrees with where the spawned scripts actually look, a run
// can go green having tested a different checkout than the one it diffed. Read
// that function's header for the full account.
//
// All this file adds is the impure half — a real `git` and the real
// environment — so the rule can stay dependency-injected and testable.
import { execFileSync } from 'node:child_process';
import { resolveMobileRepo as resolveWith } from '../../../../scripts/verify/routing.mjs';

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
 * or a real sibling checkout on disk. Production callers in the harness pass
 * neither.
 *
 * Every remaining argument is forwarded rather than enumerated. Naming them
 * here means this wrapper silently swallows the next one somebody adds, which
 * it did: `siblingsRoot` was dropped on the floor for the length of one test
 * run, and the symptom was two precedence tests failing for a reason that had
 * nothing to do with precedence.
 */
export function resolveMobileRepo(desktopRepo, env = process.env, git = execGit, ...rest) {
  return resolveWith(desktopRepo, env, git, ...rest);
}
