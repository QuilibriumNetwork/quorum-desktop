import { describe, it, expect, vi } from 'vitest';
import {
  verdictOf,
  renderReport,
  buildReceipt,
  writeReceiptSafely,
  clearReceipt,
} from '../../../../scripts/verify/report.mjs';
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

describe('buildReceipt', () => {
  const args = {
    env: { deps: [{ name: 'desktop', summary: 'abc1234  clean', warnings: [] }] },
    plan: { repos: ['desktop'], live: false, reasons: [], skipped: [] },
    results: [
      { id: 'desktop:unit', label: 'unit', repo: 'desktop', tier: 'fast', status: 'PASS', ms: 1000, detail: '1680 passed' },
    ],
    verdict: 'PASS',
    startedAt: 1000,
    finishedAt: 4000,
  };

  it('records the verdict, the steps and the duration', () => {
    const r = buildReceipt(args);
    expect(r.verdict).toBe('PASS');
    expect(r.durationMs).toBe(3000);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].id).toBe('desktop:unit');
  });

  // The point of the receipt: "was this run against THIS code?" must be a
  // checkable fact rather than a claim.
  it('records the environment summaries so the commit is recoverable', () => {
    expect(buildReceipt(args).environment[0].summary).toContain('abc1234');
  });

  it('records the plan, so a partial run cannot be replayed as a full one', () => {
    const partial = { ...args, plan: { ...args.plan, skipped: ['mobile absent'] } };
    expect(buildReceipt(partial).plan.skipped).toEqual(['mobile absent']);
  });

  // A KNOWN-RED step must be recorded faithfully, not filtered or normalized
  // to FAIL/PASS — a receipt that hid a known-red row would defeat the point
  // of the receipt (see the module's header comment in report.mjs).
  it('records a KNOWN-RED step status verbatim, not filtered or normalized', () => {
    const withKnownRed = {
      ...args,
      results: [
        ...args.results,
        {
          id: 'mobile:lint',
          label: 'lint',
          repo: 'mobile',
          tier: 'fast',
          status: 'KNOWN-RED',
          ms: 500,
          detail: '302 errors (known-red, baseline 302) — issue-123',
        },
      ],
    };
    const r = buildReceipt(withKnownRed);
    const knownRedStep = r.steps.find((s) => s.id === 'mobile:lint');
    expect(knownRedStep.status).toBe('KNOWN-RED');
    expect(knownRedStep.detail).toContain('302 errors');
  });
});

// Both functions take an injectable `fsOps` specifically so they can be unit
// tested without touching the real filesystem or importing index.mjs (which
// executes its whole pipeline at import time).
describe('writeReceiptSafely', () => {
  const PATH = '/tmp/.verify-receipt.json';

  // Would fail under an implementation that serializes differently (e.g.
  // forgets JSON.stringify's indentation arg, or writes the raw object) or
  // that calls rmSync on the success path by mistake.
  it('writes the expected JSON on a successful write', () => {
    const fsOps = { writeFileSync: vi.fn(), rmSync: vi.fn() };
    const result = writeReceiptSafely(PATH, { verdict: 'PASS' }, fsOps);
    expect(result.ok).toBe(true);
    expect(fsOps.writeFileSync).toHaveBeenCalledWith(PATH, JSON.stringify({ verdict: 'PASS' }, null, 2));
    expect(fsOps.rmSync).not.toHaveBeenCalled();
  });

  // Would fail under an implementation that only logs/reports the write
  // failure without also removing whatever partial or stale file is on
  // disk — the exact gap that let a previous run's receipt survive.
  it('leaves no receipt on disk when the write throws', () => {
    const fsOps = {
      writeFileSync: vi.fn(() => {
        throw new Error('disk full');
      }),
      rmSync: vi.fn(),
    };
    writeReceiptSafely(PATH, { verdict: 'PASS' }, fsOps);
    expect(fsOps.rmSync).toHaveBeenCalledWith(PATH, { force: true });
  });

  // Would fail under an implementation that lets the write error propagate
  // instead of catching it — which is exactly what would flip index.mjs's
  // exit code for a reason unrelated to the actual verify verdict.
  it('does not propagate an exception when the write throws', () => {
    const fsOps = {
      writeFileSync: vi.fn(() => {
        throw new Error('disk full');
      }),
      rmSync: vi.fn(),
    };
    let result;
    expect(() => {
      result = writeReceiptSafely(PATH, { verdict: 'PASS' }, fsOps);
    }).not.toThrow();
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('clearReceipt', () => {
  const PATH = '/tmp/.verify-receipt.json';

  // Would fail under an implementation that no-ops instead of actually
  // calling through to rmSync.
  it('removes an existing receipt', () => {
    const fsOps = { rmSync: vi.fn() };
    clearReceipt(PATH, fsOps);
    expect(fsOps.rmSync).toHaveBeenCalledWith(PATH, { force: true });
  });

  // Mirrors the real rmSync({ force: true }) contract (no throw when the
  // file is already gone), but exercises clearReceipt's OWN try/catch rather
  // than relying on that real contract — an implementation missing the
  // wrapper would let this throw straight out to the caller.
  it('does not throw when the underlying removal fails', () => {
    const fsOps = {
      rmSync: vi.fn(() => {
        throw new Error('EPERM: operation not permitted');
      }),
    };
    expect(() => clearReceipt(PATH, fsOps)).not.toThrow();
  });
});
