#!/usr/bin/env node
/**
 * Render the verdict a reader can act on without reading the diff.
 *
 * The severity ordering is the point of this module. A run that both failed and
 * was partial is a FAIL, and a run that only went green on a retry is never a
 * PASS — a gate that launders a flake into a pass is worse than no gate, because
 * it manufactures confidence rather than merely lacking it.
 */
import { writeFileSync, rmSync } from 'node:fs';

/**
 * Worst-first. The first status present in the results wins.
 *
 * KNOWN-RED sits below FLAKY: a retry that only went green by luck is a worse
 * signal than a failure that was already tracked and bounded, so a run with
 * both must report FLAKY, not the (arguably more specific-sounding) KNOWN-RED.
 * It sits above SKIP because a KNOWN-RED row is not skipped — it ran, it
 * failed, and it was deliberately classified. Both still render PASS
 * (PARTIAL): the point of the small vocabulary is that a reader only has to
 * learn four words, not five.
 */
const SEVERITY = ['FAIL', 'FLAKY', 'KNOWN-RED', 'SKIP'];

export function verdictOf(results, plan) {
  const present = new Set(results.map((r) => r.status));
  for (const status of SEVERITY) {
    if (!present.has(status)) continue;
    if (status === 'FAIL') return 'FAIL';
    if (status === 'FLAKY') return 'FLAKY';
    return 'PASS (PARTIAL)';
  }
  // A plan can record a skip no step represents — a whole repo that was never
  // reached, for instance. That still forbids a bare PASS.
  return plan.skipped?.length ? 'PASS (PARTIAL)' : 'PASS';
}

const pad = (s, n) => String(s).padEnd(n);
const secs = (ms) => `${Math.round(ms / 1000)}s`;

export function renderReport({ env, plan, results }) {
  const lines = [];
  lines.push('── VERIFY ──────────────────────────────────────────────');
  if (env) lines.push(...renderEnvironment(env));
  lines.push(`  ROUTED    ${plan.repos.join(' + ') || 'nothing'}`);
  lines.push(`  TIER      ${plan.live ? 'fast + live' : 'fast'}`);
  for (const reason of plan.reasons) lines.push(`            ${reason}`);
  lines.push('');
  for (const r of results) {
    const detail = r.status === 'SKIP' ? (r.skipReason ?? '') : r.detail;
    // 10, not 6: 'KNOWN-RED' is 9 characters, the longest status word.
    lines.push(
      `  ${pad(r.repo, 8)} ${pad(r.label, 14)} ${pad(r.status, 10)} ${pad(secs(r.ms), 6)} ${detail}`
    );
  }
  lines.push('');
  lines.push(`  NOT COVERED  ${NOT_COVERED.join(' · ')}`);
  lines.push('');
  const verdict = verdictOf(results, plan);
  lines.push(`  VERDICT  ${verdict}${VERDICT_NOTE[verdict] ?? ''}`);
  for (const s of plan.skipped ?? []) lines.push(`           ⚠ ${s}`);
  lines.push('─────────────────────────────────────────────────────────');
  return lines.join('\n');
}

/**
 * Stated on every run, so a PASS can never be read as more than it is. Update
 * this list when coverage actually changes — see
 * `.agents/docs/regression-coverage-map.md`.
 */
export const NOT_COVERED = [
  'UI rendering',
  'Electron packaging',
  'iOS/Android native builds',
  '153 of 169 components have no test',
];

const VERDICT_NOTE = {
  PASS: ' — nothing regressed in what this covers',
  'PASS (PARTIAL)': ' — reduced scope, see the warnings below',
  FLAKY: ' — a step only passed on retry; do not treat this as green',
  FAIL: ' — see the failing step above',
};

/**
 * A machine-readable record of what ran, against which code.
 *
 * This is not tamper-proof and is not meant to be: the printed block could be
 * fabricated by anything that can print. What it defends against is the
 * realistic failure — a run that was skipped and reported as done — by making
 * "was this run against the current HEAD?" a question with a checkable answer.
 */
export function buildReceipt({ env, plan, results, verdict, startedAt, finishedAt }) {
  return {
    verdict,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: finishedAt - startedAt,
    environment: env?.deps ?? [],
    plan: { repos: plan.repos, live: plan.live, skipped: plan.skipped ?? [] },
    steps: results.map(({ id, status, ms, detail, skipReason }) => ({
      id,
      status,
      ms,
      detail,
      ...(skipReason ? { skipReason } : {}),
    })),
  };
}

// Real node:fs by default; tests inject fakes instead, since `index.mjs`
// (the only other caller) executes its whole pipeline at import time and so
// cannot itself be imported by a test without triggering a multi-minute run.
// Extracting the fs-touching logic here — as a pair of small, pure-shaped
// functions — is what makes it unit-testable at all.
const REAL_FS = { writeFileSync, rmSync };

/**
 * Deletes whatever receipt is currently on disk. `{ force: true }` makes a
 * missing file a no-op; the try/catch is a second layer under that, for the
 * injected-fake case (and any real failure mode odder than ENOENT) — this
 * must never throw, so neither caller has to handle a further failure from
 * the cleanup itself.
 *
 * Returns the same `{ ok }` / `{ ok: false, error }` shape as
 * `writeReceiptSafely`, deliberately: these are the two I/O operations
 * guarding the same invariant (no stale receipt survives on disk), and a
 * caller that can tell success from failure on one must be able to on the
 * other. A removal failure here is not cosmetic — see the start-of-run call
 * in `index.mjs`: if THIS clear fails and the run then aborts before ever
 * reaching `writeReceiptSafely`, the previous run's receipt survives with no
 * signal anything went wrong, which is the exact failure this whole feature
 * exists to prevent.
 */
export function clearReceipt(path, fsOps = REAL_FS) {
  try {
    fsOps.rmSync(path, { force: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Writes the receipt, and never lets the attempt escape as an exception —
 * the receipt is a supplementary record, and letting an unrelated I/O error
 * (full disk, permissions) flip the run's exit code would let it mask, or
 * fake, the real test verdict.
 *
 * On failure, also clears whatever is on disk. Without that, a write failure
 * would leave a STALE receipt from a previous run looking authoritative for
 * a run that didn't actually finish — the same "reported as done" failure
 * the receipt exists to prevent, just arriving through a failed write
 * instead of a skipped step.
 */
export function writeReceiptSafely(path, receipt, fsOps = REAL_FS) {
  try {
    fsOps.writeFileSync(path, JSON.stringify(receipt, null, 2));
    return { ok: true };
  } catch (error) {
    clearReceipt(path, fsOps);
    return { ok: false, error };
  }
}

export function renderEnvironment(env) {
  const lines = ['  ENVIRONMENT'];
  for (const d of env.deps) {
    lines.push(`    ${pad(d.name, 9)} ${d.summary}`);
    for (const w of d.warnings) lines.push(`              ⚠ ${w}`);
  }
  lines.push('');
  return lines;
}
