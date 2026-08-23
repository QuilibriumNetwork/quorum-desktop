#!/usr/bin/env node
/**
 * Run one step: stream its output live AND capture it, so a human watching sees
 * progress while the report still gets a detail line.
 *
 * `shell: true` matches the existing cross-runners (`run-config-cross.mjs`) and
 * is what makes `yarn` resolve on Windows.
 */
import { spawn } from 'node:child_process';
import { KNOWN_RED, errorCountOf } from './baseline.mjs';

/**
 * Steps whose failure is known to be load-sensitive rather than deterministic.
 * A step listed here gets exactly ONE retry, and a pass on that retry is
 * reported FLAKY — never PASS. Keep this list short and justified; every entry
 * is a test that should eventually be fixed rather than tolerated. Like
 * KNOWN_RED, this is a debt marker, not permission: an entry stays only as
 * long as its load-sensitivity is real and unfixed, and should be deleted the
 * moment that stops being true.
 *
 * `desktop:unit` is here because `src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts`
 * and the websocket pickup test are documented in `vitest.config.ts` as
 * intermittently load-sensitive.
 *
 * `desktop:space-delivery` is here from Task 12's own dogfooding (2026-08-23):
 * MEASURED to pass reliably standalone at ~95s (matching Tasks 8-9's baseline),
 * but to fail — genuinely execute and lose the race, not the opaque spawn-level
 * failure `runner.mjs`'s missing `'error'` handler was masking that same day —
 * when run as the fourth live arm immediately after three other real scenarios
 * with no idle gap. `index.mjs` now puts a settle gap between live-tier steps
 * to address the cause; this entry is the backstop for whatever gap turns out
 * not to cover. Remove it once the underlying load-sensitivity is confirmed
 * gone, the same way a KNOWN_RED entry gets deleted once its bug is fixed.
 *
 * RETRYABLE and KNOWN_RED (baseline.mjs) are deliberately independent sets.
 * Neither current KNOWN_RED entry is retryable, and that ordering matters:
 * `runStep` resolves retries FIRST and only classifies known-red AFTER, on
 * whichever attempt is final. A step that were both would otherwise risk a
 * retry laundering its baseline failure into a false green before
 * known-red classification ever saw it.
 */
export const RETRYABLE = new Set(['desktop:unit', 'desktop:space-delivery']);

function once(step) {
  return new Promise((resolveRun) => {
    const startedAt = Date.now();
    let output = '';
    let settled = false;
    const child = spawn(step.cmd, step.args, {
      cwd: step.cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const tee = (chunk) => {
      const text = String(chunk);
      output += text;
      process.stdout.write(text);
    };
    child.stdout.on('data', tee);
    child.stderr.on('data', tee);
    // A hard spawn-level failure (couldn't launch the process at all — ENOENT,
    // EACCES, the OS refusing to create it under resource pressure) emits
    // 'error' instead of ever producing stdio. Recorded as a deferred Minor in
    // Task 1 and left unfixed, this is what turned Task 12's four live-arm
    // failures into an opaque `FAIL, 0s, no detail` indistinguishable from a
    // real assertion failure (2026-08-23) — diagnosing it required a synthetic
    // spawn-loop script outside the gate entirely, which should never have
    // been necessary. Folding the error text into `output` is what the
    // existing detail extractors and the printed report already know how to
    // surface, so this needed no changes anywhere else.
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      output += `[verify] spawn error: ${err.message}\n`;
      resolveRun({ code: 1, output, ms: Date.now() - startedAt });
    });
    // 'close', not 'exit': 'exit' can fire before stdio has flushed, silently
    // truncating the captured output that every detail extractor reads.
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      resolveRun({ code: code ?? 1, output, ms: Date.now() - startedAt });
    });
  });
}

/**
 * `plan` is optional so `runStep` stays callable in isolation (as the
 * classifyKnownRed tests do, indirectly, by not needing it at all); when
 * given, a KNOWN_RED step that unexpectedly passes pushes a warning there —
 * see classifyKnownRed's `staleWarning`.
 */
export async function runStep(step, plan) {
  const base = { id: step.id, label: step.label, repo: step.repo, tier: step.tier };
  console.log(`\n[verify] ── ${step.repo} ${step.label} ──`);

  const first = await once(step);
  if (first.code === 0) {
    return finish(step, plan, { ...base, status: 'PASS', ms: first.ms }, first.output);
  }

  if (!RETRYABLE.has(step.id)) {
    return finish(step, plan, { ...base, status: 'FAIL', ms: first.ms }, first.output);
  }

  console.log(`[verify] ${step.id} failed; retrying ONCE (known load-sensitive)`);
  const second = await once(step);
  const ms = first.ms + second.ms;
  if (second.code === 0) {
    const result = finish(step, plan, { ...base, status: 'FLAKY', ms }, second.output);
    return { ...result, detail: `${result.detail}  (failed once, passed on retry)` };
  }
  return finish(step, plan, { ...base, status: 'FAIL', ms }, second.output);
}

/**
 * Computes the ordinary detail line, then lets classifyKnownRed override
 * status/detail using that same attempt's output — see the RETRYABLE comment
 * above for why every call site passes the FINAL attempt, never the first.
 * classifyKnownRed only ever overrides a FAIL, so it can't collide with the
 * "(failed once, passed on retry)" suffix the FLAKY caller appends after this
 * returns — that suffix only ever decorates a passthrough result.
 */
function finish(step, plan, result, output) {
  const detail = safeDetail(step, output);
  const classified = classifyKnownRed(step.id, result.status, output);
  if (classified.staleWarning) plan?.skipped?.push(classified.staleWarning);
  return { ...result, status: classified.status, detail: classified.detail ?? detail };
}

/**
 * Applies the KNOWN_RED table (see baseline.mjs's header) to one step's
 * already-finished result. Pure and side-effect free — it returns data for
 * the caller to act on rather than mutating `plan` itself — specifically so
 * all four rows of the table can be unit tested without spawning a process.
 *
 *   status  | count vs baseline        -> new status | why
 *   FAIL    | 0 < count <= baseline    -> KNOWN-RED   | pre-existing, already tracked
 *   FAIL    | count >  baseline        -> FAIL         | it got worse: that IS new breakage
 *   FAIL    | count unparseable OR 0   -> FAIL         | never assume an unreadable — or irrelevant — failure is the known one
 *   PASS    | (n/a)                    -> PASS         | + staleWarning: the exemption must be deleted
 *
 * A step not in KNOWN_RED, or whose status is neither FAIL nor PASS (i.e.
 * FLAKY), passes through unchanged. FLAKY in particular must never be
 * relabelled KNOWN-RED or PASS: a retry that only went green by luck is not
 * the tracked, bounded failure this table exists to recognize.
 *
 * A parsed count of exactly 0 is deliberately treated the same as
 * unparseable (`null`), not as "at or under baseline". Every KNOWN_RED entry
 * records a POSITIVE baseline, so a genuine recurrence of the tracked
 * failure can never parse to 0 — a failing step that nonetheless reports 0
 * errors is evidence of something else entirely (an eslint --max-warnings
 * gate, a wrapper exiting non-zero on its own terms), and treating that as
 * "the known failure" would silently absorb an unrelated regression into the
 * exemption. This check is intentionally centralized here rather than pushed
 * into each extractor in baseline.mjs: the "0 on a failing step is
 * suspicious" rule doesn't depend on eslint vs tsc vs whatever comes next,
 * so putting it here protects every future extractor by default instead of
 * requiring each one to independently remember it.
 */
export function classifyKnownRed(id, status, output) {
  const baseline = KNOWN_RED[id];
  if (!baseline) return { status };

  if (status === 'PASS') {
    return {
      status,
      staleWarning:
        `${id} passed, but it is listed in baseline.mjs's KNOWN_RED as a tracked ` +
        `failure (${baseline.issue}) — that exemption is now stale and must be ` +
        'deleted, or it will silently hide a future regression',
    };
  }

  if (status !== 'FAIL') return { status };

  const count = errorCountOf(id, output);
  if (count !== null && count > 0 && count <= baseline.errors) {
    return {
      status: 'KNOWN-RED',
      detail: `${count} errors (known-red, baseline ${baseline.errors}) — ${baseline.issue}`,
    };
  }
  return { status };
}

export function skipped(step, reason) {
  return {
    id: step.id,
    label: step.label,
    repo: step.repo,
    tier: step.tier,
    status: 'SKIP',
    ms: 0,
    detail: '',
    skipReason: reason,
  };
}

/** A detail extractor must never be able to fail the run it is describing. */
function safeDetail(step, output) {
  try {
    return step.detail(output);
  } catch {
    return '';
  }
}
