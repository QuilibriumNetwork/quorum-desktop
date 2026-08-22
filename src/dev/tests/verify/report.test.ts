import { describe, it, expect } from 'vitest';
import { verdictOf } from '../../../../scripts/verify/report.mjs';

const step = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'x',
  label: 'x',
  repo: 'desktop',
  tier: 'fast',
  status,
  ms: 1,
  detail: '',
  ...extra,
});

const FULL_PLAN = { repos: ['desktop'], live: false, reasons: [], skipped: [] };

describe('verdictOf', () => {
  it('is PASS when every step passed and nothing was skipped', () => {
    expect(verdictOf([step('PASS'), step('PASS')], FULL_PLAN)).toBe('PASS');
  });

  it('is FAIL when any step failed, even if others were skipped', () => {
    const plan = { ...FULL_PLAN, skipped: ['mobile absent'] };
    expect(verdictOf([step('PASS'), step('FAIL')], plan)).toBe('FAIL');
  });

  // A retry that turns red into green must never read as PASS. This is the
  // whole reason FLAKY is a verdict rather than a log line.
  it('is FLAKY when a step only passed on retry and nothing failed', () => {
    expect(verdictOf([step('PASS'), step('FLAKY')], FULL_PLAN)).toBe('FLAKY');
  });

  it('is PASS (PARTIAL) when a step was skipped', () => {
    expect(verdictOf([step('PASS'), step('SKIP')], FULL_PLAN)).toBe('PASS (PARTIAL)');
  });

  it('is PASS (PARTIAL) when the plan itself recorded a skip', () => {
    const plan = { ...FULL_PLAN, skipped: ['quorum-mobile not found'] };
    expect(verdictOf([step('PASS')], plan)).toBe('PASS (PARTIAL)');
  });

  // Ordering matters: a run that both failed and was partial is a FAIL.
  it('prefers FAIL over FLAKY and over PARTIAL', () => {
    expect(verdictOf([step('FAIL'), step('FLAKY'), step('SKIP')], FULL_PLAN)).toBe('FAIL');
  });
});
