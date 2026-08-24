/**
 * Where the cross-client arms look for quorum-mobile.
 *
 * Lives in `verify/` rather than beside its subject in `harness/` on purpose:
 * `vitest.config.ts` excludes the harness directory (its setup mocks WebSocket
 * and crypto, which every scenario there needs real), so a test placed next to
 * `mobileRepo.mjs` would only run under `yarn harness` — a live-tier command.
 * This guard is worth having in the fast tier, because what it protects is the
 * gate's ability to run its two cross-client arms at all.
 *
 * The bug being pinned: both orchestrators resolved mobile as
 * `resolve(DESKTOP_REPO, '..', 'quorum-mobile')`, which is right from the main
 * checkout and wrong from a linked worktree. The failure was not subtle — both
 * arms died instantly — but its CONSEQUENCE was, because the gate skipped them
 * and printed `PASS (PARTIAL)` on every run, for a reason unrelated to the
 * change under test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveMobileRepo } from '../harness/mobileRepo.mjs';

const norm = (p: string) => p.replace(/\\/g, '/');

describe('resolveMobileRepo', () => {
  // A linked worktree's `--git-common-dir` is an ABSOLUTE path into the main
  // checkout's .git — MEASURED against this real worktree, same as
  // routing.test.ts's mainCheckoutFrom cases.
  const worktreeGit = () => 'E:/repo/quorum-desktop/.git\n';
  const mainGit = () => '.git\n';

  it('finds mobile beside the MAIN checkout when run from a linked worktree', () => {
    const desktop = 'E:/repo/quorum-desktop/.worktrees/secondary';
    expect(norm(resolveMobileRepo(desktop, {}, worktreeGit))).toBe('E:/repo/quorum-mobile');
  });

  it('does not look inside .worktrees/ — the bug this replaced', () => {
    const desktop = 'E:/repo/quorum-desktop/.worktrees/secondary';
    const result = norm(resolveMobileRepo(desktop, {}, worktreeGit));
    expect(result).not.toContain('.worktrees');
  });

  it('is unchanged from a normal, non-worktree clone', () => {
    const desktop = 'E:/repo/quorum-desktop';
    expect(norm(resolveMobileRepo(desktop, {}, mainGit))).toBe('E:/repo/quorum-mobile');
  });

  it('honours HARNESS_MOBILE_REPO, the escape hatch the error messages promise', () => {
    const desktop = 'E:/repo/quorum-desktop';
    const env = { HARNESS_MOBILE_REPO: 'D:/elsewhere/quorum-mobile' };
    expect(norm(resolveMobileRepo(desktop, env, mainGit))).toBe('D:/elsewhere/quorum-mobile');
  });

  it('does not consult git at all when the override is set', () => {
    let called = 0;
    const counting = () => {
      called += 1;
      return '.git\n';
    };
    resolveMobileRepo('E:/repo/quorum-desktop', { HARNESS_MOBILE_REPO: 'D:/elsewhere' }, counting);
    expect(called).toBe(0);
  });

  it('treats an empty HARNESS_MOBILE_REPO as unset', () => {
    // An exported-but-empty variable is how a shell says "unset", and taking it
    // literally would resolve mobile to the process cwd — a path that exists,
    // so the failure would be a confusing wrong-repo error rather than a
    // missing-repo one.
    const desktop = 'E:/repo/quorum-desktop';
    expect(norm(resolveMobileRepo(desktop, { HARNESS_MOBILE_REPO: '' }, mainGit))).toBe(
      'E:/repo/quorum-mobile'
    );
  });

  // `--repos-root=` is a CLI flag, so it beats an ambient variable. It exists
  // to point the gate at an empty directory and prove the degrade-loudly path,
  // which cannot work if a stray env var in the operator's shell wins.
  it('lets an explicit siblings root beat the environment override', () => {
    const out = resolveMobileRepo(
      'E:/repo/quorum-desktop',
      { HARNESS_MOBILE_REPO: 'D:/elsewhere/quorum-mobile' },
      mainGit,
      'E:/empty'
    );
    expect(norm(out)).toBe('E:/empty/quorum-mobile');
  });

  it('lets an explicit siblings root beat the inferred sibling', () => {
    const out = resolveMobileRepo('E:/repo/quorum-desktop', {}, mainGit, 'E:/empty');
    expect(norm(out)).toBe('E:/empty/quorum-mobile');
  });

  it('falls back to the sibling guess when git fails', () => {
    // Fail-open, matching mainCheckoutFrom: with no git there is no better
    // answer available, and the old behaviour is still right for the common
    // (non-worktree) case.
    const desktop = 'E:/repo/quorum-desktop';
    expect(norm(resolveMobileRepo(desktop, {}, () => null))).toBe('E:/repo/quorum-mobile');
  });
});

/**
 * The path rule must stay in ONE place.
 *
 * Reusing `mainCheckoutFrom` fixed today's two callers; it does not stop a
 * third script from being written next month with the same plausible-looking
 * `resolve(DESKTOP_REPO, '..')` in it. This derives the caller list from disk
 * so a new one is covered the moment it exists, rather than the next time
 * somebody remembers this file.
 */
describe('the mobile path is computed in exactly one place', () => {
  const HARNESS = join(process.cwd(), 'src', 'dev', 'tests', 'harness');
  const GATE = join(process.cwd(), 'scripts', 'verify');

  /** The one file allowed to name the repo. */
  const OWNER = join(GATE, 'routing.mjs');

  // Two directories, and the breadth of BOTH was bought the hard way.
  //
  // MEASURED 2026-08-24: the first version scanned only `.mjs` under the
  // harness, passed clean, and missed `config-cross.scenario.test.ts` and
  // `config-from-mobile.scenario.test.ts`, which carried the identical bug —
  // so fixing the orchestrators alone would have moved the failure one layer
  // down while this guard reported everything fine.
  //
  // Adversarial review then found the other half: `scripts/verify/index.mjs`
  // computed its own sibling path, so with `HARNESS_MOBILE_REPO` set, the gate
  // would diff one checkout, find it present, run the arms — and the arms
  // would test a different one. A green run that never executed the code that
  // triggered it. The gate is scanned here for the same reason the harness is.
  const scan = (dir: string, pattern: RegExp) =>
    readdirSync(dir)
      .filter((f) => pattern.test(f) && join(dir, f) !== OWNER)
      .map((f) => ({ name: f, src: readFileSync(join(dir, f), 'utf8') }));

  const scripts = [
    ...scan(HARNESS, /\.(mjs|ts)$/).filter((s) => s.name !== 'mobileRepo.mjs'),
    ...scan(GATE, /\.mjs$/),
  ];

  // Files that RESOLVE the repo, as opposed to merely naming it. Keyed on the
  // constant every caller declares, because "mentions quorum-mobile" is too
  // broad to be a rule: `dm-cross.scenario.test.ts` and `rendezvous.ts` both
  // discuss the mobile side in prose and neither one resolves a path.
  const DECLARES_MOBILE_REPO = /const\s+MOBILE_REPO\s*=/;
  const resolvers = scripts.filter((s) => DECLARES_MOBILE_REPO.test(s.src));

  /**
   * How a path to the repo gets BUILT, as opposed to merely named. A quoted
   * literal is a path segment; the same word inside a template literal is
   * prose in an error message, and both orchestrators legitimately have that.
   *
   * Textual, not AST-aware, so it also fires on a COMMENT that quotes the old
   * expression. That is deliberate rather than a limitation: a comment holding
   * the broken line verbatim is the most likely way it gets pasted back into
   * code. If this trips on prose, reword the prose.
   */
  const BUILDS_A_PATH = /['"]quorum-mobile['"]/;

  // A guard whose input set is empty cannot fail. `arrayContaining` rather
  // than an exact list so a legitimate fifth caller does not fail HERE, on a
  // bookkeeping assertion, instead of on the two real ones below.
  it('finds the scripts it is meant to police', () => {
    expect(resolvers.map((s) => s.name).sort()).toEqual(
      expect.arrayContaining([
        'config-cross.scenario.test.ts',
        'config-from-mobile.scenario.test.ts',
        'run-config-cross.mjs',
        'run-cross.mjs',
      ])
    );
  });

  it('routes every mobile-path lookup through resolveMobileRepo', () => {
    const offenders = resolvers
      .filter((s) => !/const\s+MOBILE_REPO\s*=\s*resolveMobileRepo\(/.test(s.src))
      .map((s) => s.name);

    expect(
      offenders,
      'These harness files declare MOBILE_REPO without calling ' +
        'resolveMobileRepo. From a linked worktree a hand-rolled path lands ' +
        'in .worktrees/ and the file fails before doing any work. Import ' +
        'the helper from ./mobileRepo.mjs instead.'
    ).toEqual([]);
  });

  it('builds no path to quorum-mobile of its own', () => {
    // The assertion above catches a caller that stopped using the helper. This
    // one catches a caller that still imports it and hand-rolls the path
    // anyway — MEASURED 2026-08-24, an earlier version of this guard keyed on
    // the identifier appearing ANYWHERE in the file, and a leftover import
    // line was enough to keep it green with the bug fully restored.
    const offenders = scripts.filter((s) => BUILDS_A_PATH.test(s.src)).map((s) => s.name);

    expect(
      offenders,
      'These files assemble a path to quorum-mobile themselves. That ' +
        'expression belongs in scripts/verify/routing.mjs and nowhere else. A ' +
        'second copy is a second answer, and the gate and the arms it spawns ' +
        'then disagree about which checkout is under test.'
    ).toEqual([]);
  });

  it('finds that literal in routing.mjs, which is where it belongs', () => {
    // Control for the assertion above: proves the pattern can match at all.
    // Without this, deleting the owner's path expression would make the guard
    // vacuously green — every file would be clean because no file built a path.
    expect(BUILDS_A_PATH.test(readFileSync(OWNER, 'utf8'))).toBe(true);
  });

  // The gate half of the scan, named explicitly. `index.mjs` is the file that
  // actually regressed, so if it ever drops out of the scan set — a rename, a
  // move into a subdirectory — this fails rather than silently covering less.
  it('is actually scanning the gate, not just the harness', () => {
    expect(scripts.map((s) => s.name)).toContain('index.mjs');
  });
});
