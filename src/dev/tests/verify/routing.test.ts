import { describe, it, expect } from 'vitest';
import { stepsFor } from '../../../../scripts/verify/steps.mjs';
import {
  planFromPaths,
  changedPaths,
  branchBaseRef,
  mainCheckoutFrom,
  liveArmsFor,
  heldBackArms,
  needsMobile,
} from '../../../../scripts/verify/routing.mjs';

describe('planFromPaths', () => {
  it('routes a desktop-only source change to desktop, with the live tier', () => {
    const plan = planFromPaths(['desktop/src/services/SyncService.ts']);
    expect(plan.repos).toEqual(['desktop']);
    expect(plan.live).toBe(true);
  });

  // Channel A: both clients consume shared, so both must run.
  it('routes a shared change to all three repos', () => {
    const plan = planFromPaths(['shared/src/sync/delta.ts']);
    expect(plan.repos).toEqual(['shared', 'desktop', 'mobile']);
  });

  it('routes a mobile-only change to mobile', () => {
    expect(planFromPaths(['mobile/app/index.tsx']).repos).toEqual(['mobile']);
  });

  it('skips the live tier for docs and styles', () => {
    const plan = planFromPaths([
      'desktop/README.md',
      'desktop/.agents/issues/x.md',
      'desktop/src/styles/theme.scss',
    ]);
    expect(plan.live).toBe(false);
  });

  it('skips the live tier for a components-only change', () => {
    expect(planFromPaths(['desktop/src/components/Button.tsx']).live).toBe(false);
  });

  // The allowlist clears a components change only when nothing riskier rode
  // along in the same diff.
  it('runs the live tier when a component AND a service changed together', () => {
    const plan = planFromPaths([
      'desktop/src/components/Button.tsx',
      'desktop/src/services/MessageService.ts',
    ]);
    expect(plan.live).toBe(true);
  });

  // Fail toward running more: an unclassified path is dangerous by default.
  it('runs the live tier for a path nobody has classified', () => {
    expect(planFromPaths(['desktop/src/brand-new-thing/x.ts']).live).toBe(true);
  });

  it('names the file that triggered the live tier', () => {
    const plan = planFromPaths(['desktop/src/services/MessageService.ts']);
    expect(plan.reasons.join(' ')).toContain('MessageService.ts');
  });

  it('routes nothing and skips live for an empty diff', () => {
    const plan = planFromPaths([]);
    expect(plan.repos).toEqual([]);
    expect(plan.live).toBe(false);
  });
});

// Every path below was taken from a real `git ls-files` in one of the three
// repos on 2026-08-23, not invented — the bug these guard against was a safe
// pattern (`src/locales/`) that named a directory no repo has.
describe('planFromPaths: paths that exist, classified', () => {
  it('clears a translation catalogue, which used to force a live run', () => {
    expect(planFromPaths(['desktop/src/i18n/it/messages.po']).live).toBe(false);
    expect(planFromPaths(['desktop/src/i18n/en/messages.ts']).live).toBe(false);
  });

  // The locale folder is safe; the code that loads locales is not.
  it('still runs live for the i18n loader at that directory root', () => {
    expect(planFromPaths(['desktop/src/i18n/i18n.ts']).live).toBe(true);
    expect(planFromPaths(['desktop/src/i18n/locales.ts']).live).toBe(true);
  });

  it("clears mobile's assets, tests and native build config", () => {
    for (const p of [
      'mobile/assets/icons/IconSend.jsx',
      'mobile/__tests__/migrated/foo.test.ts',
      'mobile/android/app/build.gradle',
      'mobile/ios/Quorum/Info.plist',
    ]) {
      expect(planFromPaths([p]).live, p).toBe(false);
    }
  });

  // Deliberately NOT cleared, and this test asserted the opposite until
  // adversarial review 2026-08-23. Mobile components import services directly
  // and widely — unlike desktop's, where MEASURED it is 7 files out of 196 —
  // so the capability argument that clears a desktop component does not hold
  // there. Mobile's harness is the instrument the two cross-client arms
  // actually run, exactly like desktop's.
  it("does not clear mobile's components or its harness", () => {
    expect(planFromPaths(['mobile/components/Chat/MessageList.tsx']).live).toBe(true);
    expect(planFromPaths(['mobile/dev/harness/dm.scenario.test.ts']).live).toBe(true);
  });

  it("clears shared's primitives, the same category as desktop components", () => {
    expect(planFromPaths(['shared/src/primitives/Button/Button.tsx']).live).toBe(false);
  });

  // The bug this whole carve-out exists for: WebsocketProvider owns the
  // literal `new WebSocket(...)` and was being cleared from the live tier
  // because it happens to live under a directory called `components/`.
  it('runs live for the components that own the transport and the services', () => {
    for (const p of [
      'desktop/src/components/context/WebsocketProvider.tsx',
      'desktop/src/components/context/MessageDB.tsx',
      'desktop/src/components/modals/UserSettingsModal/Security.tsx',
      'desktop/src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx',
    ]) {
      expect(planFromPaths([p]).live, p).toBe(true);
    }
  });

  // The carve-out must stay narrow enough to be worth having.
  it('still clears ordinary presentational components', () => {
    expect(planFromPaths(['desktop/src/components/modals/BlockUserModal.tsx']).live).toBe(false);
    expect(planFromPaths(['desktop/src/components/Button.tsx']).live).toBe(false);
  });

  it('excludes the harness directory from the safe list', () => {
    expect(planFromPaths(['desktop/src/dev/tests/harness/bot.ts']).live).toBe(true);
  });

  it('clears agent and editor config', () => {
    expect(planFromPaths(['desktop/.claude/skills/x/run.cjs']).live).toBe(false);
  });

  // The gate must be able to check its own measuring equipment.
  it('runs live for a change to the harness itself', () => {
    expect(planFromPaths(['desktop/src/dev/tests/harness/spaceState.ts']).live).toBe(true);
    expect(
      planFromPaths(['desktop/src/dev/tests/harness/space-delivery.scenario.test.ts']).live
    ).toBe(true);
  });

  it('still clears unit and component tests, which the fast tier already runs', () => {
    expect(planFromPaths(['desktop/src/dev/tests/components/Button.test.tsx']).live).toBe(false);
    expect(planFromPaths(['desktop/src/dev/tests/verify/routing.test.ts']).live).toBe(false);
  });
});

describe('planFromPaths: liveScope', () => {
  it('narrows to the cross-client arms when only mobile changed', () => {
    const plan = planFromPaths(['mobile/services/space/SpaceService.ts']);
    expect(plan.live).toBe(true);
    expect(plan.liveScope).toBe('cross-only');
    expect(plan.reasons.join(' ')).toContain('cannot observe');
  });

  it('runs every arm when desktop changed', () => {
    expect(planFromPaths(['desktop/src/services/MessageService.ts']).liveScope).toBe('all');
  });

  // A shared change reaches desktop through the symlinked build, so it is never
  // mobile-only however many mobile files ride along with it.
  it('runs every arm when shared changed alongside mobile', () => {
    const plan = planFromPaths([
      'shared/src/sync/service.ts',
      'mobile/services/space/SpaceService.ts',
    ]);
    expect(plan.liveScope).toBe('all');
  });

  it('runs every arm when desktop and mobile changed together', () => {
    const plan = planFromPaths([
      'desktop/src/services/MessageService.ts',
      'mobile/components/Chat/MessageList.tsx',
    ]);
    expect(plan.liveScope).toBe('all');
  });

  // A mobile-safe path is not risky at all, so it cannot be what narrows the
  // scope — the narrowing must come from a mobile path that genuinely triggers
  // the live tier, alongside a desktop path that does not.
  it('is mobile-only even when a safe desktop path is in the same diff', () => {
    const plan = planFromPaths([
      'desktop/README.md',
      'mobile/services/space/SpaceService.ts',
    ]);
    expect(plan.liveScope).toBe('cross-only');
  });

  it('leaves scope at all when nothing forces the live tier', () => {
    expect(planFromPaths(['desktop/README.md']).liveScope).toBe('all');
  });
});

// The six live arms as `steps.mjs` builds them. Ids, not labels, because
// `needsMobile` reads the id.
const LIVE_STEPS = [
  'dm-basic',
  'dm-delivery',
  'space-basic',
  'space-delivery',
  'cross-dm',
  'config-cross',
].map((label) => ({
  id: `desktop:${label}`,
  label,
  // Mirrors steps.mjs. Two arms run on `--all` rather than on every code
  // change, for unrelated reasons: space-basic creates a permanent Space, and
  // cross-dm reports a reproducible loss whose cause is still open.
  ...(label === 'space-basic' || label === 'cross-dm' ? { exhaustiveOnly: true } : {}),
}));

describe('liveArmsFor', () => {
  const labels = (plan: unknown) =>
    liveArmsFor(plan, LIVE_STEPS).map((s: { label: string }) => s.label);

  it('runs nothing when the live tier is off', () => {
    expect(labels(planFromPaths(['desktop/README.md']))).toEqual([]);
  });

  // space-basic and cross-dm are absent: both wait for --all, for unrelated
  // reasons (a permanent Space, and an open loss finding).
  it('runs every per-change arm for a desktop change', () => {
    expect(labels(planFromPaths(['desktop/src/services/MessageService.ts']))).toEqual([
      'dm-basic',
      'dm-delivery',
      'space-delivery',
      'config-cross',
    ]);
  });

  // Reduced to one arm while cross-dm is held back. That is a real narrowing
  // of mobile-only coverage and it is stated on the run, not absorbed quietly:
  // config-cross is the only arm left that loads mobile code.
  it('runs only the in-scope cross-client arm for a mobile-only change', () => {
    expect(labels(planFromPaths(['mobile/services/space/SpaceService.ts']))).toEqual([
      'config-cross',
    ]);
  });

  // Defensive: a plan built before liveScope existed, or hand-made by a test,
  // must fail toward running MORE — the same direction as the allowlist.
  it('treats a missing liveScope as every arm', () => {
    expect(labels({ live: true })).toHaveLength(4);
  });

  it('releases the held-back arms only when the plan is exhaustive', () => {
    const perChange = planFromPaths(['desktop/src/services/MessageService.ts']);
    expect(labels(perChange)).not.toContain('space-basic');
    expect(labels(perChange)).not.toContain('cross-dm');
    const exhaustive = labels({ ...perChange, exhaustive: true });
    expect(exhaustive).toContain('space-basic');
    expect(exhaustive).toContain('cross-dm');
  });
});

describe('heldBackArms', () => {
  const labels = (plan: unknown) =>
    heldBackArms(plan, LIVE_STEPS).map((s: { label: string }) => s.label);

  // The report prints these, so holding an arm back cannot become a silent gap.
  it('names the arms a per-change run left out', () => {
    expect(labels(planFromPaths(['desktop/src/services/MessageService.ts']))).toEqual([
      'space-basic',
      'cross-dm',
    ]);
  });

  it('names nothing on an exhaustive run, because nothing was held back', () => {
    const plan = planFromPaths(['desktop/src/services/MessageService.ts']);
    expect(labels({ ...plan, exhaustive: true })).toEqual([]);
  });

  it('names nothing when the live tier never runs', () => {
    expect(labels(planFromPaths(['desktop/README.md']))).toEqual([]);
  });

  // A mobile-only run never reaches space-basic in the first place, so it is
  // out of scope rather than held back — reporting it would be misleading.
  // cross-dm IS in scope for such a run (it loads mobile code), so it is
  // genuinely held back and must be named.
  it('names only the in-scope arm for a mobile-only run', () => {
    expect(labels(planFromPaths(['mobile/services/space/SpaceService.ts']))).toEqual(['cross-dm']);
  });

  it('identifies exactly the two arms that spawn quorum-mobile', () => {
    expect(LIVE_STEPS.filter(needsMobile).map((s) => s.label)).toEqual([
      'cross-dm',
      'config-cross',
    ]);
  });
});

describe('changedPaths', () => {
  // A failed git read (corrupted repo, index lock, permission error) must
  // never look like "nothing changed" — that would silently suppress both
  // fan-out and the live-tier trigger for a repo nobody could actually check.
  it('treats a failed git read as changed, never as a clean tree', () => {
    const failingExecGit = () => null;
    const paths = changedPaths('desktop', '/fake/desktop', failingExecGit);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].startsWith('desktop/')).toBe(true);
  });

  it('the failure path is unclassified, so it forces the live tier', () => {
    const failingExecGit = () => null;
    const paths = changedPaths('desktop', '/fake/desktop', failingExecGit);
    const plan = planFromPaths(paths);
    expect(plan.live).toBe(true);
    expect(plan.repos).toEqual(['desktop']);
  });

  it('a single failing call is enough — not all the others need to fail', () => {
    // Only `ls-files` fails; every other call "succeeds" with empty output.
    const partiallyFailingExecGit = (_cwd, args) =>
      args[0] === 'ls-files' ? null : args[0] === 'diff' ? '' : 'origin/main\n';
    const paths = changedPaths('mobile', '/fake/mobile', partiallyFailingExecGit);
    expect(paths[0]).toContain('unreadable');
    expect(planFromPaths(paths).live).toBe(true);
  });

  it('returns real paths when every git call succeeds', () => {
    const paths = changedPaths(
      'desktop',
      '/fake/desktop',
      fakeGit({ worktree: 'src/services/X.ts' })
    );
    expect(paths).toEqual(['desktop/src/services/X.ts']);
  });
});

/**
 * A git double covering every call `changedPaths` makes. Written as one fake
 * rather than per-test one-liners because the branch-diff support added a
 * second round of calls, and a fake that answers only the ones a given test
 * cares about returns `''` for the rest — which reads as "ran fine, nothing
 * changed" and would hide exactly the bug these tests exist to pin.
 */
function fakeGit({
  worktree = '',
  branch = '',
  base = 'origin/main',
  mergeBase = 'abc123',
}: {
  worktree?: string;
  branch?: string;
  base?: string | null;
  mergeBase?: string | null;
} = {}) {
  return (_cwd: string, args: string[]) => {
    if (args[0] === 'symbolic-ref') return base === null ? null : `${base}\n`;
    if (args[0] === 'rev-parse') return base === null ? null : `${base}\n`;
    if (args[0] === 'merge-base') return mergeBase === null ? null : `${mergeBase}\n`;
    if (args[0] === 'ls-files') return '';
    if (args[0] === 'diff' && args[2]?.includes('..')) return branch ? `${branch}\n` : '';
    if (args[0] === 'diff') return worktree ? `${worktree}\n` : '';
    return '';
  };
}

/**
 * The hole this closes: commit your work, run the gate on a clean tree, and it
 * reported "no changes detected" and ran zero live arms. MEASURED on the branch
 * that introduced these tests — 31 files changed versus main, none of them seen.
 * The normal flow is commit, then verify, then open a PR, so the gate was
 * silently useless at exactly the moment it was supposed to matter.
 */
describe('changedPaths: the branch, not just the working tree', () => {
  it('sees a committed change with a clean working tree', () => {
    const paths = changedPaths(
      'desktop',
      '/fake/desktop',
      fakeGit({ branch: 'src/services/MessageService.ts' })
    );
    expect(paths).toEqual(['desktop/src/services/MessageService.ts']);
    expect(planFromPaths(paths).live).toBe(true);
  });

  it('merges branch commits with uncommitted work, without duplicating', () => {
    const paths = changedPaths(
      'desktop',
      '/fake/desktop',
      fakeGit({ branch: 'src/services/A.ts', worktree: 'src/services/A.ts' })
    );
    expect(paths).toEqual(['desktop/src/services/A.ts']);
  });

  // On the base branch with a clean tree there is nothing under review, and
  // the gate must NOT invent work to do.
  it('reports nothing on the base branch with a clean tree', () => {
    expect(changedPaths('desktop', '/fake/desktop', fakeGit())).toEqual([]);
  });

  it('forces the live tier when no base branch can be resolved', () => {
    const paths = changedPaths('desktop', '/fake/desktop', fakeGit({ base: null }));
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain('no base branch');
    expect(planFromPaths(paths).live).toBe(true);
  });

  it('forces the live tier when there is no merge base with it', () => {
    const paths = changedPaths('desktop', '/fake/desktop', fakeGit({ mergeBase: null }));
    expect(paths[0]).toContain('no merge base');
    expect(planFromPaths(paths).live).toBe(true);
  });

  // `(unknown)` is the literal string git prints when the remote HEAD was
  // never set. Using it as a ref name yields `origin/(unknown)` and errors
  // that read as repo corruption.
  // `--short` strips only `refs/remotes/`, NOT the remote name, so the shape
  // real git produces is `origin/(unknown)`. An earlier version of both the
  // guard and this test used the bare `(unknown)`, which real git never
  // returns — so the test passed while exercising a case that cannot occur.
  // Adversarial review 2026-08-23.
  it('does not treat git\'s "(unknown)" placeholder as a branch name', () => {
    for (const placeholder of ['origin/(unknown)\n', '(unknown)\n']) {
      const execGit = (_cwd: string, args: string[]) =>
        args[0] === 'symbolic-ref'
          ? placeholder
          : args[0] === 'rev-parse'
            ? 'origin/main\n'
            : '';
      expect(branchBaseRef('/fake/desktop', execGit), placeholder).toBe('origin/main');
    }
  });

  it('returns null when no candidate base ref exists at all', () => {
    expect(branchBaseRef('/fake/desktop', () => null)).toBeNull();
  });
});

describe('mainCheckoutFrom', () => {
  it('resolves to the main checkout root from a linked worktree', () => {
    // A linked worktree's --git-common-dir is an ABSOLUTE path into the main
    // checkout's .git, exactly as MEASURED against this real worktree.
    const desktop = 'E:/repo/quorum-desktop/.worktrees/secondary';
    const execGit = () => 'E:/repo/quorum-desktop/.git\n';
    const result = mainCheckoutFrom(desktop, execGit).replace(/\\/g, '/');
    expect(result).toBe('E:/repo/quorum-desktop');
  });

  it('is a no-op in a normal, non-worktree clone', () => {
    // The main checkout's --git-common-dir is the RELATIVE '.git' — this is
    // what makes the override collapse back to the brief's original
    // expression in the shipped, non-worktree case.
    const desktop = 'E:/repo/quorum-desktop';
    const execGit = () => '.git\n';
    const result = mainCheckoutFrom(desktop, execGit).replace(/\\/g, '/');
    expect(result).toBe('E:/repo/quorum-desktop');
  });

  it('falls back to the desktop path when git fails', () => {
    const desktop = 'E:/repo/quorum-desktop';
    const execGit = () => null;
    expect(mainCheckoutFrom(desktop, execGit)).toBe(desktop);
  });
});

// LIVE_STEPS above is a hand-written mirror of what steps.mjs builds, which is
// only useful while the two agree. This pins them together: if someone adds an
// arm, renames one, or flips `exhaustiveOnly`, the mirror stops matching and
// every assertion built on it becomes a lie the moment it goes green.
describe('LIVE_STEPS matches the real step catalogue', () => {
  const real = stepsFor('desktop', '/fake/desktop', 'live') as {
    id: string;
    label: string;
    exhaustiveOnly?: boolean;
  }[];

  it('has the same arms, in the same order', () => {
    expect(real.map((s) => s.label)).toEqual(LIVE_STEPS.map((s) => s.label));
  });

  it('agrees on which arms are held back', () => {
    const heldFor = (steps: { label: string; exhaustiveOnly?: boolean }[]) =>
      steps.filter((s) => s.exhaustiveOnly).map((s) => s.label);
    expect(heldFor(real)).toEqual(heldFor(LIVE_STEPS));
    // Stated as a value, not just a comparison: if BOTH sides lost the flag,
    // the equality above would still pass and space-basic would quietly start
    // creating a Space on every code change again.
    expect(heldFor(real)).toEqual(['space-basic', 'cross-dm']);
  });

  it('gives every held-back arm a reason to print', () => {
    // The run says WHY each arm was left out, and the text comes from the step
    // itself because the two held-back arms are held for unrelated causes.
    // `index.mjs` falls back to 'no reason recorded' rather than crashing — so
    // without this, a new held-back arm would ship a HELD BACK line that says
    // nothing, which is the same as not saying it.
    const held = (real as { label: string; exhaustiveOnly?: boolean; heldBackWhy?: string }[])
      .filter((s) => s.exhaustiveOnly)
      .filter((s) => !s.heldBackWhy?.trim());

    expect(
      held.map((s) => s.label),
      'These arms are held back but carry no heldBackWhy, so the run would ' +
        'print a HELD BACK line with no reason on it. Add one in steps.mjs.'
    ).toEqual([]);
  });

  it('agrees on which arms need quorum-mobile', () => {
    expect(real.filter(needsMobile).map((s) => s.label)).toEqual(
      LIVE_STEPS.filter(needsMobile).map((s) => s.label)
    );
  });
});
