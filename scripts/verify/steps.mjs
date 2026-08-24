#!/usr/bin/env node
/**
 * The step catalogue — what each repo runs, and how to pull one readable line
 * out of each tool's output.
 *
 * Detail extractors are deliberately forgiving: a regex that stops matching
 * must degrade to an empty detail, never throw. A cosmetic change to a tool's
 * summary line should cost a blank column, not a failed run.
 */
import { resolve } from 'node:path';

/** Vitest: "Tests  1680 passed (1680)" */
const vitestDetail = (out) => (out.match(/Tests\s+([^\n]+)/) ?? [])[1]?.trim() ?? '';
/** Jest: "Tests:       1222 passed, 1222 total" */
const jestDetail = (out) => (out.match(/Tests:\s+([^\n]+)/) ?? [])[1]?.trim() ?? '';
/**
 * ESLint: "✖ 232 problems (0 errors, 232 warnings)".
 * No match must degrade to '', matching vitestDetail/jestDetail below — NOT a
 * literal '0 errors, 0 warnings'. Eslint can crash or exit without ever
 * printing its summary line, and that failure still lands in a FAIL row; a
 * hardcoded "0 errors" default would print next to that FAIL and read as
 * clean. baseline.mjs's eslintErrors/tscErrors were hardened against exactly
 * this (return null, not 0, on unparseable output) — this is the same fix
 * applied to the cosmetic detail column instead of the classification path.
 */
const eslintDetail = (out) => (out.match(/\d+\s+problems?\s+\(([^)]+)\)/) ?? [])[1] ?? '';

/**
 * Jest can exit 0 while warning that a worker leaked. MEASURED on mobile
 * 2026-08-22. Surfacing it is the point: a leak that goes unmentioned becomes
 * a flake nobody can explain later.
 */
const jestDetailWithLeak = (out) => {
  const base = jestDetail(out);
  const leaked = out.includes('failed to exit gracefully');
  return leaked ? `${base}  ⚠ worker leak` : base;
};

export function stepsFor(repoName, repoPath, tier) {
  const at = (...p) => resolve(repoPath, ...p);
  const mk = (id, label, args, detail) => ({
    id: `${repoName}:${id}`,
    label,
    repo: repoName,
    tier,
    cmd: 'yarn',
    args,
    cwd: at('.'),
    detail,
  });

  if (tier === 'fast') {
    if (repoName === 'desktop')
      return [
        mk('typecheck', 'typecheck', ['tsc', '--noEmit'], () => ''),
        mk('lint', 'lint', ['lint'], eslintDetail),
        mk('unit', 'unit', ['test:run'], vitestDetail),
        // The harness's three OFFLINE scenarios. They belong on the fast tier
        // and nowhere else: `vitest.config.ts` cannot host them (its setup
        // mocks WebSocket and crypto, which these need real, so they were
        // excluded from the unit suite), and the live tier would be absurd for
        // work that touches no relay. Before this they ran nowhere at all.
        //
        // MEASURED 2026-08-23: 15s wall clock, 0 new account files in
        // `.state/`. `integration-check` in particular fails loudly when the
        // harness's own load-bearing seams break — MessageDB opening on
        // fake-indexeddb, and the whole MessageService import graph resolving
        // under the jsdom+lingui pipeline. Without it, that same breakage
        // surfaces as four live arms erroring out three minutes into a run.
        mk(
          'harness-offline',
          'harness-offline',
          ['harness', 'smoke', 'integration-check', 'xpdump-format'],
          vitestDetail
        ),
        mk('build', 'build', ['build'], () => ''),
      ];
    if (repoName === 'shared')
      return [
        mk('typecheck', 'typecheck', ['typecheck'], () => ''),
        mk('unit', 'unit', ['test:run'], vitestDetail),
        mk('build', 'build', ['build'], () => ''),
      ];
    if (repoName === 'mobile')
      return [
        mk('lint', 'lint', ['lint'], eslintDetail),
        mk('unit', 'unit', ['test', '--ci'], jestDetailWithLeak),
      ];
  }

  if (tier === 'live' && repoName === 'desktop') {
    // Desktop-only: every live arm is driven from this repo, including the two
    // cross-client ones, which spawn mobile's scenarios without modifying it.
    const harnessDetail = (out) => (out.includes('PASS') ? 'arms green' : '');
    return [
      mk('dm-basic', 'dm-basic', ['harness', 'dm-basic'], harnessDetail),
      mk('dm-delivery', 'dm-delivery', ['harness', 'dm-delivery'], harnessDetail),
      // `exhaustiveOnly`: runs on `--all`, not on every code change.
      //
      // This is the last arm that creates a permanent, undeletable Space on
      // every run, and unlike `space-delivery` it cannot be fixed by reusing
      // one — creating a space IS its subject. Every other minting arm was
      // either fixed or was never wired in; leaving this one on the per-change
      // tier means the Space count rises with the number of times anyone edits
      // a service file, forever.
      //
      // Creation is also the right thing to exercise rarely. It is a
      // once-per-space path that changes seldom, and the joiner half it shares
      // with `space-delivery`'s create branch still runs whenever a persisted
      // space is unavailable. The report names it as held back on every run
      // that skips it, so this cannot quietly become "nobody ever ran it".
      {
        ...mk('space-basic', 'space-basic', ['harness', 'space-basic'], harnessDetail),
        exhaustiveOnly: true,
        heldBackWhy: 'it creates a permanent, undeletable Space every run',
      },
      mk('space-delivery', 'space-delivery', ['harness', 'space-delivery'], harnessDetail),
      // `exhaustiveOnly` for a different reason than `space-basic`: not cost,
      // but trust. This arm could not run at all until 2026-08-24 (it resolved
      // quorum-mobile wrong from a worktree), and the first thing it did once
      // fixed was report a reproducible message loss — 5 of 6 runs, always the
      // FIRST echo desktop sends, while the opposite direction stayed 20/20.
      //
      // That loss is real as far as it has been measured: desktop's own log
      // says `sent=20/20 received=20 novel decrypt failures=0`, and mobile's
      // counting half is the same instrument that measured mobile↔mobile at
      // 80/80. But the cause is not yet known, and an arm that goes red in
      // most runs for a reason unrelated to the change under test would block
      // every piece of work behind a bug nobody is fixing this week.
      //
      // So it is held back rather than removed, and the report names it on
      // every run that skips it. Release it — delete these two lines — as soon
      // as the tracked issue is resolved either way.
      {
        ...mk('cross-dm', 'cross-dm', ['harness:cross'], harnessDetail),
        exhaustiveOnly: true,
        heldBackWhy:
          'it reports a reproducible cross-client message loss whose cause is not yet known — ' +
          '.agents/issues/.open/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md',
      },
      mk('config-cross', 'config-cross', ['harness:config-cross'], harnessDetail),
    ];
  }
  return [];
}
