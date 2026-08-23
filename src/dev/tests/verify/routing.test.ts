import { describe, it, expect } from 'vitest';
import {
  planFromPaths,
  changedPaths,
  mainCheckoutFrom,
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
