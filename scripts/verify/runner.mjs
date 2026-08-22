#!/usr/bin/env node
/**
 * Run one step: stream its output live AND capture it, so a human watching sees
 * progress while the report still gets a detail line.
 *
 * `shell: true` matches the existing cross-runners (`run-config-cross.mjs`) and
 * is what makes `yarn` resolve on Windows.
 */
import { spawn } from 'node:child_process';

/**
 * Steps whose failure is known to be load-sensitive rather than deterministic.
 * A step listed here gets exactly ONE retry, and a pass on that retry is
 * reported FLAKY — never PASS. Keep this list short and justified; every entry
 * is a test that should eventually be fixed rather than tolerated.
 *
 * `desktop:unit` is here because `src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts`
 * and the websocket pickup test are documented in `vitest.config.ts` as
 * intermittently load-sensitive.
 */
export const RETRYABLE = new Set(['desktop:unit']);

function once(step) {
  return new Promise((resolveRun) => {
    const startedAt = Date.now();
    let output = '';
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
    child.on('exit', (code) =>
      resolveRun({ code: code ?? 1, output, ms: Date.now() - startedAt })
    );
  });
}

export async function runStep(step) {
  const base = { id: step.id, label: step.label, repo: step.repo, tier: step.tier };
  console.log(`\n[verify] ── ${step.repo} ${step.label} ──`);

  const first = await once(step);
  if (first.code === 0) {
    return { ...base, status: 'PASS', ms: first.ms, detail: safeDetail(step, first.output) };
  }

  if (!RETRYABLE.has(step.id)) {
    return { ...base, status: 'FAIL', ms: first.ms, detail: safeDetail(step, first.output) };
  }

  console.log(`[verify] ${step.id} failed; retrying ONCE (known load-sensitive)`);
  const second = await once(step);
  const ms = first.ms + second.ms;
  if (second.code === 0) {
    return {
      ...base,
      status: 'FLAKY',
      ms,
      detail: `${safeDetail(step, second.output)}  (failed once, passed on retry)`,
    };
  }
  return { ...base, status: 'FAIL', ms, detail: safeDetail(step, second.output) };
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
