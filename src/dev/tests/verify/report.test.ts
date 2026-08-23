import { describe, it, expect } from 'vitest';
import { verdictOf, renderReport } from '../../../../scripts/verify/report.mjs';
import { classifyKnownRed } from '../../../../scripts/verify/runner.mjs';
import { KNOWN_RED, errorCountOf } from '../../../../scripts/verify/baseline.mjs';

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

  // KNOWN-RED is a reduction like SKIP: it must never read as a bare PASS.
  it('is PASS (PARTIAL) when a step is KNOWN-RED and nothing failed', () => {
    expect(verdictOf([step('PASS'), step('KNOWN-RED')], FULL_PLAN)).toBe('PASS (PARTIAL)');
  });

  it('is FAIL when a step failed and another is KNOWN-RED', () => {
    expect(verdictOf([step('FAIL'), step('KNOWN-RED')], FULL_PLAN)).toBe('FAIL');
  });

  it('prefers FLAKY over KNOWN-RED', () => {
    expect(verdictOf([step('FLAKY'), step('KNOWN-RED')], FULL_PLAN)).toBe('FLAKY');
  });
});

describe('renderReport', () => {
  it('prints the known-red row with its reason and its issue reference', () => {
    const results = [
      step('KNOWN-RED', {
        id: 'mobile:lint',
        repo: 'mobile',
        label: 'lint',
        detail: `302 errors (known-red, baseline 302) — ${KNOWN_RED['mobile:lint'].issue}`,
      }),
    ];
    const output = renderReport({ env: null, plan: FULL_PLAN, results });
    expect(output).toContain('KNOWN-RED');
    expect(output).toContain('302 errors');
    expect(output).toContain(KNOWN_RED['mobile:lint'].issue);
  });
});

describe('errorCountOf', () => {
  it('pulls the errors figure (not the total) out of an eslint summary', () => {
    expect(errorCountOf('mobile:lint', '✖ 475 problems (302 errors, 173 warnings)')).toBe(302);
  });

  it('counts "error TS" lines for a tsc shape', () => {
    const output = [
      'src/a.ts(1,1): error TS2769: nope',
      'src/b.ts(2,2): error TS2322: nope either',
    ].join('\n');
    expect(errorCountOf('shared:typecheck', output)).toBe(2);
  });

  it('returns null when the output matches no known shape (eslint)', () => {
    expect(errorCountOf('mobile:lint', 'Segmentation fault (core dumped)')).toBeNull();
  });

  // Same guarantee, tsc shape: a step that failed for a reason other than
  // reported type errors (crash, bad tsconfig) must not silently read as "0
  // errors" — see baseline.mjs's tscErrors for why it returns null, not 0,
  // on zero "error TS" matches.
  it('returns null when the output matches no known shape (tsc)', () => {
    expect(errorCountOf('shared:typecheck', 'FATAL ERROR: JavaScript heap out of memory')).toBeNull();
  });

  it('returns null for a step id with no recorded shape', () => {
    expect(errorCountOf('desktop:lint', '✖ 1 problems (1 errors, 0 warnings)')).toBeNull();
  });
});

describe('classifyKnownRed', () => {
  // Row 1: fails, at or under the recorded baseline -> KNOWN-RED.
  it('downgrades a FAIL to KNOWN-RED when the parsed count equals the baseline', () => {
    const output = '✖ 475 problems (302 errors, 173 warnings)';
    const result = classifyKnownRed('mobile:lint', 'FAIL', output);
    expect(result.status).toBe('KNOWN-RED');
    expect(result.detail).toContain('302 errors');
    expect(result.detail).toContain(KNOWN_RED['mobile:lint'].issue);
  });

  it('downgrades a FAIL to KNOWN-RED when the parsed count is under the baseline', () => {
    const output = '✖ 300 problems (250 errors, 50 warnings)';
    expect(classifyKnownRed('mobile:lint', 'FAIL', output).status).toBe('KNOWN-RED');
  });

  it('downgrades the tsc shape at its baseline of 1', () => {
    const output = 'src/primitives/Input/Input.native.tsx(164,11): error TS2769: nope';
    expect(classifyKnownRed('shared:typecheck', 'FAIL', output).status).toBe('KNOWN-RED');
  });

  // Row 2: fails, over the baseline -> FAIL. Getting worse IS new breakage.
  it('keeps FAIL when the parsed count exceeds the baseline', () => {
    const output = '✖ 480 problems (310 errors, 170 warnings)';
    expect(classifyKnownRed('mobile:lint', 'FAIL', output).status).toBe('FAIL');
  });

  it('keeps FAIL for the tsc shape when its count exceeds baseline', () => {
    const output = [
      'src/a.ts(1,1): error TS2769: nope',
      'src/b.ts(2,2): error TS2322: nope either',
    ].join('\n');
    expect(classifyKnownRed('shared:typecheck', 'FAIL', output).status).toBe('FAIL');
  });

  // Row 3: fails, unparseable -> FAIL. Never assume an unreadable failure is the known one.
  it('keeps FAIL when the count cannot be parsed (eslint shape)', () => {
    const output = 'Segmentation fault (core dumped)';
    expect(classifyKnownRed('mobile:lint', 'FAIL', output).status).toBe('FAIL');
  });

  it('keeps FAIL when the count cannot be parsed (tsc shape)', () => {
    const output = 'FATAL ERROR: JavaScript heap out of memory';
    expect(classifyKnownRed('shared:typecheck', 'FAIL', output).status).toBe('FAIL');
  });

  // A parsed-but-zero count is a distinct case from "unparseable" — the
  // extractor worked, and honestly reported that eslint found no rule
  // errors — but the step still failed. Since KNOWN_RED's baseline for this
  // step is a positive number, a real recurrence of the tracked failure can
  // never parse to 0. A non-zero exit with 0 parsed errors is therefore
  // evidence of something ELSE (a --max-warnings gate, a wrapper script
  // exiting non-zero for its own reasons) — not the known failure — and must
  // fail the same way an unparseable one does.
  it('keeps FAIL when the step failed but the parsed error count is 0', () => {
    const output = '✖ 5 problems (0 errors, 5 warnings)';
    expect(classifyKnownRed('mobile:lint', 'FAIL', output).status).toBe('FAIL');
  });

  // Row 4: passes -> PASS, plus a warning that the exemption is stale.
  it('reports a stale-exemption warning when a known-red step passes', () => {
    const result = classifyKnownRed('mobile:lint', 'PASS', '');
    expect(result.status).toBe('PASS');
    expect(result.staleWarning).toContain('mobile:lint');
    expect(result.staleWarning).toContain(KNOWN_RED['mobile:lint'].issue);
  });

  // A step not in KNOWN_RED is completely unaffected.
  it('leaves a step outside KNOWN_RED unchanged', () => {
    expect(classifyKnownRed('desktop:lint', 'FAIL', 'anything')).toEqual({ status: 'FAIL' });
  });

  // A retry that turns red into green already reports FLAKY, never PASS (see
  // runner.mjs's RETRYABLE). Known-red classification must not relabel that
  // as either a quiet PASS or a KNOWN-RED — a flake is not the known failure.
  it('never launders a FLAKY into KNOWN-RED or PASS', () => {
    expect(classifyKnownRed('mobile:lint', 'FLAKY', 'irrelevant').status).toBe('FLAKY');
  });
});
