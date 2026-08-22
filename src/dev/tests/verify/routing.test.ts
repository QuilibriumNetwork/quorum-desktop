import { describe, it, expect } from 'vitest';
import { planFromPaths } from '../../../../scripts/verify/routing.mjs';

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
