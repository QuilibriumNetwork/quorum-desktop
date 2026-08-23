#!/usr/bin/env node
/**
 * Render the verdict a reader can act on without reading the diff.
 *
 * The severity ordering is the point of this module. A run that both failed and
 * was partial is a FAIL, and a run that only went green on a retry is never a
 * PASS — a gate that launders a flake into a pass is worse than no gate, because
 * it manufactures confidence rather than merely lacking it.
 */

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

export function renderEnvironment(env) {
  const lines = ['  ENVIRONMENT'];
  for (const d of env.deps) {
    lines.push(`    ${pad(d.name, 9)} ${d.summary}`);
    for (const w of d.warnings) lines.push(`              ⚠ ${w}`);
  }
  lines.push('');
  return lines;
}
