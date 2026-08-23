import { describe, it, expect } from 'vitest';
import {
  planFromPaths,
  changedPaths,
  mainCheckoutFrom,
  liveArmsFor,
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

  it("clears mobile's flat layout: components, assets, harness, tests, native", () => {
    for (const p of [
      'mobile/components/Chat/MessageList.tsx',
      'mobile/assets/icons/IconSend.jsx',
      'mobile/dev/harness/dm.scenario.test.ts',
      'mobile/__tests__/migrated/foo.test.ts',
      'mobile/android/app/build.gradle',
      'mobile/ios/Quorum/Info.plist',
    ]) {
      expect(planFromPaths([p]).live, p).toBe(false);
    }
  });

  it("clears shared's primitives, the same category as desktop components", () => {
    expect(planFromPaths(['shared/src/primitives/Button/Button.tsx']).live).toBe(false);
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
].map((label) => ({ id: `desktop:${label}`, label }));

describe('liveArmsFor', () => {
  const labels = (plan: unknown) =>
    liveArmsFor(plan, LIVE_STEPS).map((s: { label: string }) => s.label);

  it('runs nothing when the live tier is off', () => {
    expect(labels(planFromPaths(['desktop/README.md']))).toEqual([]);
  });

  it('runs every arm for a desktop change', () => {
    expect(labels(planFromPaths(['desktop/src/services/MessageService.ts']))).toEqual([
      'dm-basic',
      'dm-delivery',
      'space-basic',
      'space-delivery',
      'cross-dm',
      'config-cross',
    ]);
  });

  it('runs only the two cross-client arms for a mobile-only change', () => {
    expect(labels(planFromPaths(['mobile/services/space/SpaceService.ts']))).toEqual([
      'cross-dm',
      'config-cross',
    ]);
  });

  // Defensive: a plan built before liveScope existed, or hand-made by a test,
  // must fail toward running MORE — the same direction as the allowlist.
  it('treats a missing liveScope as every arm', () => {
    expect(labels({ live: true })).toHaveLength(6);
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

  it('a single failing call is enough — not all three need to fail', () => {
    // Only `ls-files` fails; the two `diff` calls "succeed" with empty output.
    const partiallyFailingExecGit = (_cwd, args) =>
      args[0] === 'ls-files' ? null : '';
    const paths = changedPaths('mobile', '/fake/mobile', partiallyFailingExecGit);
    expect(planFromPaths(paths).live).toBe(true);
  });

  it('returns real paths when every git call succeeds', () => {
    const succeedingExecGit = (_cwd, args) =>
      args[0] === 'diff' && args.includes('HEAD') ? 'src/services/X.ts\n' : '';
    const paths = changedPaths('desktop', '/fake/desktop', succeedingExecGit);
    expect(paths).toEqual(['desktop/src/services/X.ts']);
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
