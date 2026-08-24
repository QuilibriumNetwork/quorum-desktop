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
 * `PASS (PARTIAL)` means exactly one thing: **this run proved LESS than a full
 * run would have.** Nothing else may trigger it. The verdict has to answer
 * "can I ship this?", and a word that fires when the answer is yes stops being
 * read at all.
 *
 * KNOWN-RED is deliberately NOT in the list below, and that is a change from
 * the original design (2026-08-24). A KNOWN-RED row is a step that RAN and
 * returned exactly the tracked, pre-existing result — no worse. Nothing was
 * proved less, so it is not a reduction. Treating it as one had a measured
 * cost: quorum-shared carries 1 known type error and quorum-mobile 302 known
 * lint errors, both already on main, so EVERY cross-repo change reported
 * PARTIAL for reasons that had nothing to do with it. The operator was left
 * adjudicating three warning lines on every run to answer a question the
 * verdict was supposed to answer for them.
 *
 * The signal is not lost. A KNOWN-RED row still prints in the table with its
 * count, its baseline and its issue link; the verdict block says how many there
 * were; and `classifyKnownRed` only downgrades a failure whose count is at or
 * below the recorded baseline — 303 lint errors where 302 were recorded is a
 * FAIL, loudly. Getting WORSE still stops the run. Staying exactly as broken as
 * main does not.
 *
 * Worst-first: a run that both failed and was partial is a FAIL, and a run that
 * only went green on a retry is never a PASS.
 */
const SEVERITY = ['FAIL', 'FLAKY', 'SKIP'];

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
  const liveLabel =
    plan.liveScope === 'cross-only' ? 'fast + live (cross-client arms only)' : 'fast + live';
  lines.push(`  TIER      ${plan.live ? liveLabel : 'fast'}`);
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
  // Counted on the verdict line, not only in the table. A KNOWN-RED row no
  // longer downgrades the verdict, so without this a clean-looking PASS could
  // sit above two failing steps with nothing on the headline acknowledging
  // them. The rows above carry the counts, baselines and issue links.
  const knownRed = results.filter((r) => r.status === 'KNOWN-RED');
  if (knownRed.length) {
    lines.push(
      `           ${knownRed.length} step(s) already broken on main, unchanged: ` +
        `${knownRed.map((r) => r.label).join(', ')} — not caused by this change`
    );
  }
  for (const s of plan.skipped ?? []) lines.push(`           ⚠ ${s}`);
  // Advisory only, and marked differently on purpose. `⚠` lines are the ones
  // that made the verdict PARTIAL and the reader has to adjudicate; `ℹ` lines
  // are housekeeping the run noticed (a stale exemption, a debt count that
  // improved) and cost the verdict nothing. Same glyph for both would put the
  // reader back to reading every line to find out which kind it is.
  for (const n of plan.notes ?? []) lines.push(`           ℹ ${n}`);
  lines.push('─────────────────────────────────────────────────────────');
  return lines.join('\n');
}

/**
 * Stated on every run, so a PASS can never be read as more than it is.
 * Ranked by silence, not size: a gap nobody would ever notice outranks one
 * they'd hit on the next click, because loud failures take care of
 * themselves. Measured in `.agents/docs/regression-coverage-map.md` — update
 * both together when coverage actually changes.
 */
export const NOT_COVERED = [
  'role/permission gating — untested; the harness cannot even build one yet',
  'authorization — 10 forgery/scope scenarios exist, none of them runs here',
  'pin, an honoured mute & DM profile updates — sent, never confirmed to land',
  'calling — zero coverage of all 9 WebRTC message types',
  'no end-to-end or integration test exists',
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
    plan: {
      repos: plan.repos,
      live: plan.live,
      // Recorded because a `cross-only` run omits four arms without emitting a
      // SKIP row for them, so the step list alone cannot tell a reader whether
      // an arm was absent by plan or by accident.
      liveScope: plan.liveScope ?? 'all',
      skipped: plan.skipped ?? [],
      // Recorded too, so `--show-receipt` can answer "did the mint guard hold
      // anything back on this machine?" without re-running the gate.
      notes: plan.notes ?? [],
    },
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
