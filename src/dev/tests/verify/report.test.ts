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

  // Changed 2026-08-24, deliberately. A KNOWN-RED step RAN and returned the
  // tracked result, so nothing was proved less — PARTIAL must mean "this run
  // proved less than a full run", and nothing else. Before this, quorum-shared
  // (1 known type error) and quorum-mobile (302 known lint errors) made EVERY
  // cross-repo change report PARTIAL for reasons unrelated to it, which left
  // the operator adjudicating warning lines to answer the question the verdict
  // exists to answer.
  it('is PASS when the only red steps are known-broken on main', () => {
    expect(verdictOf([step('PASS'), step('KNOWN-RED')], FULL_PLAN)).toBe('PASS');
  });

  // The escape hatch must not become a blanket. Everything that genuinely
  // reduces coverage still outranks it.
  it('is FAIL when a step failed and another is KNOWN-RED', () => {
    expect(verdictOf([step('FAIL'), step('KNOWN-RED')], FULL_PLAN)).toBe('FAIL');
  });

  it('prefers FLAKY over KNOWN-RED', () => {
    expect(verdictOf([step('FLAKY'), step('KNOWN-RED')], FULL_PLAN)).toBe('FLAKY');
  });

  it('is still PARTIAL when something was skipped alongside a KNOWN-RED', () => {
    expect(verdictOf([step('KNOWN-RED'), step('SKIP')], FULL_PLAN)).toBe('PASS (PARTIAL)');
  });

  it('is still PARTIAL when the plan recorded a skip alongside a KNOWN-RED', () => {
    const plan = { ...FULL_PLAN, skipped: ['mobile resolves the published shared package'] };
    expect(verdictOf([step('KNOWN-RED')], plan)).toBe('PASS (PARTIAL)');
  });

  // Getting WORSE than the recorded baseline is not KNOWN-RED at all — the
  // classifier leaves it FAIL. Pinned here as well as in runner.test.ts,
  // because it is the single assumption the change above rests on: if a
  // regression could hide behind a baseline, none of this would be safe.
  it('does not hide a step whose failure count exceeds its baseline', () => {
    const worse = classifyKnownRed(
      'mobile:lint',
      'FAIL',
      '✖ 476 problems (303 errors, 173 warnings)'
    );
    expect(worse.status).toBe('FAIL');

    // Control, in the same test so the two can never drift apart. Without it,
    // a classifier that returned FAIL for EVERYTHING would satisfy the
    // assertion above while quietly breaking the whole KNOWN-RED mechanism.
    const atBaseline = classifyKnownRed(
      'mobile:lint',
      'FAIL',
      '✖ 475 problems (302 errors, 173 warnings)'
    );
    expect(atBaseline.status).toBe('KNOWN-RED');
  });
});

/**
 * `plan.notes` is advisory and must never reach the verdict.
 *
 * The distinction it encodes: `plan.skipped` means THIS RUN PROVED LESS, and
 * forces PASS (PARTIAL). `notes` is housekeeping the run happened to notice —
 * a stale exemption, a debt count that improved. Both are worth printing;
 * only one is a reduction in coverage.
 */
describe('plan.notes vs plan.skipped', () => {
  it('does not let a note downgrade a clean PASS', () => {
    const results = [step('PASS', { id: 'desktop:unit', repo: 'desktop', label: 'unit' })];
    const plan = { ...FULL_PLAN, skipped: [], notes: ['mobile:lint is down to 298 errors'] };
    expect(verdictOf(results, plan)).toBe('PASS');
  });

  // CONTROL: the same shape on the OTHER channel must still downgrade, or the
  // test above would pass just as well against a verdict function that ignored
  // both lists.
  it('still downgrades for a skip, proving the two channels differ', () => {
    const results = [step('PASS', { id: 'desktop:unit', repo: 'desktop', label: 'unit' })];
    const plan = { ...FULL_PLAN, skipped: ['a whole repo was unreachable'], notes: [] };
    expect(verdictOf(results, plan)).toBe('PASS (PARTIAL)');
  });

  it('prints notes and skips under different markers', () => {
    const results = [step('PASS', { id: 'desktop:unit', repo: 'desktop', label: 'unit' })];
    const output = renderReport({
      env: null,
      plan: { ...FULL_PLAN, skipped: ['coverage was reduced'], notes: ['debt improved'] },
      results,
    });
    expect(output).toContain('⚠ coverage was reduced');
    expect(output).toContain('ℹ debt improved');
  });

  it('renders a plan with no notes field at all', () => {
    // Every caller today supplies one, but `verdictOf`/`renderReport` are the
    // two functions a future caller is most likely to hand a hand-rolled plan.
    const results = [step('PASS', { id: 'desktop:unit', repo: 'desktop', label: 'unit' })];
    const plan = { ...FULL_PLAN, skipped: [] };
    delete (plan as { notes?: string[] }).notes;
    expect(() => renderReport({ env: null, plan, results })).not.toThrow();
    expect(verdictOf(results, plan)).toBe('PASS');
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

  // A KNOWN-RED row no longer downgrades the verdict, so the headline has to
  // acknowledge it explicitly. Without this line a reader sees a clean PASS
  // sitting directly above two failing steps and nothing connecting the two.
  it('names the known-broken steps on the verdict line, and still says PASS', () => {
    const results = [
      step('PASS', { id: 'desktop:unit', repo: 'desktop', label: 'unit' }),
      step('KNOWN-RED', { id: 'mobile:lint', repo: 'mobile', label: 'lint' }),
      step('KNOWN-RED', { id: 'mobile:typecheck', repo: 'mobile', label: 'typecheck' }),
    ];
    const output = renderReport({ env: null, plan: FULL_PLAN, results });

    expect(output).toContain('VERDICT  PASS');
    expect(output).not.toContain('PASS (PARTIAL)');
    expect(output).toContain('2 step(s) already broken on main, unchanged');
    expect(output).toContain('lint, typecheck');
    expect(output).toContain('not caused by this change');
  });

  it('says nothing about known-broken steps when there are none', () => {
    const output = renderReport({
      env: null,
      plan: FULL_PLAN,
      results: [step('PASS', { label: 'unit' })],
    });
    expect(output).not.toContain('already broken on main');
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
    expect(errorCountOf('mobile:typecheck', output)).toBe(2);
  });

  it('returns null when the output matches no known shape (eslint)', () => {
    expect(errorCountOf('mobile:lint', 'Segmentation fault (core dumped)')).toBeNull();
  });

  // Same guarantee, tsc shape: a step that failed for a reason other than
  // reported type errors (crash, bad tsconfig) must not silently read as "0
  // errors" — see baseline.mjs's tscErrors for why it returns null, not 0,
  // on zero "error TS" matches.
  it('returns null when the output matches no known shape (tsc)', () => {
    expect(errorCountOf('mobile:typecheck', 'FATAL ERROR: JavaScript heap out of memory')).toBeNull();
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

  it('downgrades the tsc shape at or under its baseline of 11', () => {
    const output = 'src/primitives/Input/Input.native.tsx(164,11): error TS2769: nope';
    expect(classifyKnownRed('mobile:typecheck', 'FAIL', output).status).toBe('KNOWN-RED');
  });

  // Row 2: fails, over the baseline -> FAIL. Getting worse IS new breakage.
  it('keeps FAIL when the parsed count exceeds the baseline', () => {
    const output = '✖ 480 problems (310 errors, 170 warnings)';
    expect(classifyKnownRed('mobile:lint', 'FAIL', output).status).toBe('FAIL');
  });

  it('keeps FAIL for the tsc shape when its count exceeds baseline', () => {
    // Built from the baseline rather than hardcoded, so this cannot silently
    // stop testing anything when the count is ratcheted down. It went stale
    // exactly that way once: the fixture was two errors against a baseline of
    // 1, and when the tsc-shaped entry became `mobile:typecheck` (baseline 11)
    // two errors was suddenly UNDER it, so the test asserted the opposite of
    // its own name.
    const over = KNOWN_RED['mobile:typecheck'].errors + 1;
    const output = Array.from(
      { length: over },
      (_, i) => `src/f${i}.ts(${i + 1},1): error TS2769: nope`
    ).join('\n');
    expect(classifyKnownRed('mobile:typecheck', 'FAIL', output).status).toBe('FAIL');

    // Control: one fewer must be KNOWN-RED, or "exceeds" is untested.
    const atBaseline = output.split('\n').slice(0, over - 1).join('\n');
    expect(classifyKnownRed('mobile:typecheck', 'FAIL', atBaseline).status).toBe('KNOWN-RED');
  });

  // Row 3: fails, unparseable -> FAIL. Never assume an unreadable failure is the known one.
  it('keeps FAIL when the count cannot be parsed (eslint shape)', () => {
    const output = 'Segmentation fault (core dumped)';
    expect(classifyKnownRed('mobile:lint', 'FAIL', output).status).toBe('FAIL');
  });

  it('keeps FAIL when the count cannot be parsed (tsc shape)', () => {
    const output = 'FATAL ERROR: JavaScript heap out of memory';
    expect(classifyKnownRed('mobile:typecheck', 'FAIL', output).status).toBe('FAIL');
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

  // Row 4: passes -> PASS, plus a note that the exemption is stale.
  //
  // Delivered as `note`, not `staleWarning`, since 2026-08-24. The rename is the
  // point: `runner.mjs` routes notes to `plan.notes`, which prints but does not
  // touch the verdict, whereas the old field went to `plan.skipped` and forced
  // PASS (PARTIAL). A step going GREEN must never make the run report worse —
  // that is the same rule that stopped KNOWN-RED rows downgrading the verdict.
  it('reports a stale-exemption note when a known-red step passes', () => {
    const result = classifyKnownRed('mobile:lint', 'PASS', '');
    expect(result.status).toBe('PASS');
    expect(result.note).toContain('mobile:lint');
    expect(result.note).toContain(KNOWN_RED['mobile:lint'].issue);
  });

  // Row 2: improved but not fixed -> still KNOWN-RED, plus a ratchet note.
  //
  // This is what makes a PARTIAL fix safe to leave in place. Fixing 4 of
  // mobile's 302 lint errors keeps the run green at 298 with no edit to
  // baseline.mjs required, so nobody has to remember anything to avoid a red —
  // but the recorded ceiling is still 302, so drifting back up would pass
  // unnoticed. The note asks for the one-word edit that locks the gain in.
  it('asks for the baseline to be lowered when the count improves', () => {
    const result = classifyKnownRed(
      'mobile:lint',
      'FAIL',
      '✖ 400 problems (298 errors, 102 warnings)'
    );
    expect(result.status).toBe('KNOWN-RED');
    expect(result.note).toContain('298');
    expect(result.note).toContain('302');
    expect(result.note).toContain('baseline.mjs');
  });

  // CONTROL for the test above: at exactly the baseline there is nothing to
  // lock in, so there must be no note. Without this, a note printed on every
  // ordinary run would read as an action item and be trained away.
  it('stays silent when the count is exactly at baseline', () => {
    const result = classifyKnownRed(
      'mobile:lint',
      'FAIL',
      '✖ 475 problems (302 errors, 173 warnings)'
    );
    expect(result.status).toBe('KNOWN-RED');
    expect(result.note).toBeUndefined();
  });

  // A step not in KNOWN_RED is completely unaffected.
  it('leaves a step outside KNOWN_RED unchanged', () => {
    expect(classifyKnownRed('desktop:lint', 'FAIL', 'anything')).toEqual({ status: 'FAIL' });
  });

  /**
   * A baseline entry with no extractor is a silent no-op.
   *
   * `errorCountOf` returns null for an unknown step id, and a null count falls
   * through to plain FAIL — so the entry sits in the table looking like an
   * exemption while doing nothing at all, and the step it names hard-fails every
   * run. Nothing else in the suite would notice: the entry is present, the
   * classifier is correct, and only the pairing is missing. That is precisely
   * the kind of gap that survives review, so it gets a test rather than a
   * comment.
   */
  it('has a working extractor for every KNOWN_RED entry', () => {
    // Output shaped like each tool's real summary, so this exercises the actual
    // extractor rather than asserting a lookup table against itself.
    const sample = (id: string, n: number) =>
      id.endsWith(':lint')
        ? `✖ ${n + 100} problems (${n} errors, 100 warnings)`
        : Array.from({ length: n }, (_, i) => `f.ts(${i + 1},1): error TS2322: nope`).join('\n');

    for (const [id, entry] of Object.entries(KNOWN_RED)) {
      const result = classifyKnownRed(id, 'FAIL', sample(id, entry.errors));
      expect(result.status, `${id}: no extractor in baseline.mjs — the entry does nothing`).toBe(
        'KNOWN-RED'
      );
      // And it must still fail when it gets worse, per-entry, not just in aggregate.
      expect(
        classifyKnownRed(id, 'FAIL', sample(id, entry.errors + 1)).status,
        `${id}: exceeding its baseline must FAIL`
      ).toBe('FAIL');
    }
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

  // A silent clearReceipt has no observable failure to assert against — this
  // is what makes the start-of-run clear failure mode (see index.mjs)
  // testable at all. Mirrors 'does not propagate an exception when the
  // write throws' from writeReceiptSafely's tests, for the same reason:
  // both functions guard the same invariant and must expose failure the
  // same way.
  it('reports a not-ok result carrying the error when removal fails', () => {
    const fsOps = {
      rmSync: vi.fn(() => {
        throw new Error('EPERM: operation not permitted');
      }),
    };
    const result = clearReceipt(PATH, fsOps);
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toContain('EPERM');
  });
});
