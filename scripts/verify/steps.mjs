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
/** ESLint: "✖ 232 problems (0 errors, 232 warnings)" — no match means clean. */
const eslintDetail = (out) =>
  (out.match(/\d+\s+problems?\s+\(([^)]+)\)/) ?? [])[1] ?? '0 errors, 0 warnings';

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
  return [];
}
