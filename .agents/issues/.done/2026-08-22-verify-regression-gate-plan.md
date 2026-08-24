---
type: task
title: 'Implementation plan — `yarn verify` gate, coverage audit, and the top delivery gaps'
status: done
priority: high
created: 2026-08-22
updated: 2026-08-24
area: testing / developer confidence
---

# `yarn verify` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single command that runs the right checks for what changed, across up to three repos, and prints a verdict readable without reading code — plus the missing delivery coverage that makes a green verdict mean something.

**Architecture:** A Node ESM orchestrator in `quorum-desktop/scripts/verify/`, built from pure, unit-testable modules (routing, environment, report) plus a thin process runner. `quorum-shared` and `quorum-mobile` delegate to it and fall back to their own fast tier when it is absent. Two new live scenarios close the measured delivery gaps.

**Tech Stack:** Node 20 ESM (`.mjs`, no new dependencies), Vitest (desktop + shared), Jest (mobile), the existing headless harness in `src/dev/tests/harness/`.

**Design doc:** `2026-08-22-verify-regression-gate-design.md`

## Global Constraints

- **No new runtime or dev dependencies.** Node built-ins only in `scripts/verify/`.
- **Yarn only.** Never `npm`. If `package-lock.json` appears, delete it.
- **This repo is PUBLIC.** No absolute paths through a user profile, no real names, no account addresses in code, comments, fixtures or committed logs. Use repo-relative paths.
- **A reduced run may never print a bare `PASS`.** Any skip downgrades the verdict to `PASS (PARTIAL)`.
- **A retry may never manufacture green.** A step that passes only on retry reports `FLAKY`, a verdict distinct from `PASS`.
- **Every new live arm must be proven able to fail** before it counts. Break the behaviour, see red, restore.
- Comments explain **why**, constraints and non-obvious behaviour. Do not narrate obvious code.

## Measured Baseline (2026-08-22 — do not re-derive)

| Repo | Command | Result | Time |
|---|---|---|---|
| desktop | `yarn tsc --noEmit && yarn lint` | 0 errors, 232 warnings | 49s |
| desktop | `yarn test:run` | 177 files, 1680 pass | 103s |
| shared | `yarn test:run` | 34 files, 756 pass, 2 todo | 5.5s |
| mobile | `yarn test --ci` | 130 suites, 1222 pass | 21s |

Mobile exits 0 but prints `A worker process has failed to exit gracefully`. That is a teardown leak, not a failure; the gate must surface it as a note rather than swallow it.

Dependency wiring, measured:

- `quorum-desktop` → `quorum-shared` via `link:../quorum-shared` (symlink, live)
- `quorum-desktop` → SDK via global `yarn link` → `../quilibrium-js-sdk-channels` @ `2.1.1`, while `package.json` declares the published `^2.1.0-2`
- `quorum-mobile` → `quorum-shared` @ published `2.1.0-45` (frozen copy, NOT the local checkout)

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `scripts/verify/routing.mjs` | changed paths → `{repos, live, reasons}`. Pure. |
| `scripts/verify/environment.mjs` | resolve each dep as linked/published, its version, commit, dirty. |
| `scripts/verify/steps.mjs` | the step catalogue: which command per repo per tier, and each step's detail extractor. |
| `scripts/verify/runner.mjs` | spawn one step, tee output, capture exit code / duration / detail, handle the flaky retry. |
| `scripts/verify/report.mjs` | `(env, plan, results)` → verdict string + receipt object. Pure. |
| `scripts/verify/index.mjs` | entry: flags, orchestration, exit code. |
| `src/dev/tests/verify/routing.test.ts` | unit tests for routing. |
| `src/dev/tests/verify/report.test.ts` | unit tests for verdict logic and rendering. |
| `src/dev/tests/harness/space-delivery.scenario.test.ts` | space content-type delivery arm. |
| `src/dev/tests/harness/dm-delivery.scenario.test.ts` | DM content-type delivery arm. |
| `.agents/docs/regression-coverage-map.md` | the audit: every critical path, covered or not. |

**Modify:** `package.json` (desktop, shared, mobile), `.gitignore` (desktop), `AGENTS.md` (all three), `.agents/AGENTS.md` (desktop).

---

## Branching

**One branch per repo for the whole plan, one PR per repo at the end.** Every
task below commits to that branch — no task commits to a default branch, and no
task opens a PR. Shipping is Task 13.

Branch name in all three repos: `feat/verify-regression-gate`

**Base branches differ, and one repo needs care** (measured 2026-08-22):

| Repo | Default branch | State when this plan was written |
|---|---|---|
| `quorum-desktop` | `main` | clean, on `main` |
| `quorum-shared` | `master` | clean, on `master`, level with origin |
| `quorum-mobile` | `master` | clean, but on `fix/space-profile-wire-timestamp-cannot-pin-the-future`, **2 commits ahead of `origin/master`** |

Mobile's branch **must be cut from `origin/master`, not from the current HEAD.**
Those two commits are unrelated security fixes still in flight; branching from
them would put them in this plan's PR and make it look like this work changed the
receive path.

### Task 0: Create the three branches

- [ ] **Step 1: Desktop**

```bash
cd e:/GitHub/Quilibrium/quorum-desktop
git checkout main && git pull
git checkout -b feat/verify-regression-gate
```

- [ ] **Step 2: Shared**

```bash
cd ../quorum-shared
git checkout master && git pull
git checkout -b feat/verify-regression-gate
```

- [ ] **Step 3: Mobile — from `origin/master`, NOT from the current branch**

```bash
cd ../quorum-mobile
git fetch origin
git checkout -b feat/verify-regression-gate origin/master
```

- [ ] **Step 4: Confirm all three, and confirm mobile is clean of the other work**

```bash
for r in quorum-desktop quorum-shared quorum-mobile; do
  cd "e:/GitHub/Quilibrium/$r" && echo "$r: $(git branch --show-current)"
done
cd ../quorum-mobile && git log --oneline origin/master..HEAD
```

Expected: all three on `feat/verify-regression-gate`, and the mobile log is
**empty** — if it lists the two `fix(spaces)` commits, the branch was cut from
the wrong base. Delete it and redo step 3.

---

## PART A — The gate

### Task 1: A runnable `yarn verify` for desktop's fast tier

The smallest thing that produces a verdict block you can read. No routing, no environment block, no receipt — those land in later tasks. Hardcoded to desktop.

**Files:**
- Create: `scripts/verify/steps.mjs`, `scripts/verify/runner.mjs`, `scripts/verify/report.mjs`, `scripts/verify/index.mjs`
- Create: `src/dev/tests/verify/report.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `steps.mjs` → `DESKTOP_FAST: Step[]` where
    `Step = { id: string, label: string, repo: string, tier: 'fast'|'live', cmd: string, args: string[], cwd: string, detail: (output: string) => string }`
  - `runner.mjs` → `runStep(step: Step): Promise<StepResult>` where
    `StepResult = { id, label, repo, tier, status: 'PASS'|'FAIL'|'FLAKY'|'SKIP', ms: number, detail: string, skipReason?: string }`
  - `report.mjs` → `verdictOf(results: StepResult[], plan): string` and `renderReport({ env, plan, results }): string`

- [ ] **Step 1: Write the failing test for the verdict logic**

Create `src/dev/tests/verify/report.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { verdictOf } from '../../../../scripts/verify/report.mjs';

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
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn vitest --run src/dev/tests/verify/report.test.ts
```

Expected: FAIL — cannot resolve `scripts/verify/report.mjs`.

- [ ] **Step 3: Write `scripts/verify/report.mjs`**

```js
#!/usr/bin/env node
/**
 * Render the verdict a reader can act on without reading the diff.
 *
 * The severity ordering is the point of this module. A run that both failed and
 * was partial is a FAIL, and a run that only went green on a retry is never a
 * PASS — a gate that launders a flake into a pass is worse than no gate, because
 * it manufactures confidence rather than merely lacking it.
 */

/** Worst-first. The first status present in the results wins. */
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
  lines.push(`  TIER      ${plan.live ? 'fast + live' : 'fast'}`);
  for (const reason of plan.reasons) lines.push(`            ${reason}`);
  lines.push('');
  for (const r of results) {
    const detail = r.status === 'SKIP' ? (r.skipReason ?? '') : r.detail;
    lines.push(
      `  ${pad(r.repo, 8)} ${pad(r.label, 14)} ${pad(r.status, 6)} ${pad(secs(r.ms), 6)} ${detail}`
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

export function renderEnvironment(env) {
  const lines = ['  ENVIRONMENT'];
  for (const d of env.deps) {
    lines.push(`    ${pad(d.name, 9)} ${d.summary}`);
    for (const w of d.warnings) lines.push(`              ⚠ ${w}`);
  }
  lines.push('');
  return lines;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
yarn vitest --run src/dev/tests/verify/report.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write `scripts/verify/steps.mjs`**

The commands and their detail extractors. Regexes are written against real output captured 2026-08-22; do not invent them.

```js
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
```

- [ ] **Step 6: Write `scripts/verify/runner.mjs`**

```js
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
```

- [ ] **Step 7: Write `scripts/verify/index.mjs` (desktop fast tier only, for now)**

```js
#!/usr/bin/env node
/**
 * `yarn verify` — run the checks that apply to what changed, and print a
 * verdict readable without reading the diff.
 *
 * Grown in slices: this revision runs desktop's fast tier only. Routing,
 * environment reporting, cross-repo fan-out and the receipt land in later
 * tasks of the same plan.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepsFor } from './steps.mjs';
import { runStep } from './runner.mjs';
import { renderReport, verdictOf } from './report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, '../..');

const plan = { repos: ['desktop'], live: false, reasons: [], skipped: [] };

const results = [];
for (const step of stepsFor('desktop', DESKTOP, 'fast')) {
  results.push(await runStep(step));
}

console.log('\n' + renderReport({ env: null, plan, results }) + '\n');
process.exit(verdictOf(results, plan) === 'FAIL' ? 1 : 0);
```

- [ ] **Step 8: Add the scripts to `package.json`**

In `quorum-desktop/package.json`, add to `"scripts"`:

```json
"verify": "node scripts/verify/index.mjs",
"typecheck": "tsc --noEmit"
```

`typecheck` is added because `validate` bundles typecheck and lint into one command, and the report needs them as separate rows.

- [ ] **Step 9: Run it for real**

```bash
yarn verify
```

Expected: four rows (typecheck, lint, unit, build), all `PASS`, and `VERDICT  PASS`. Against the measured baseline the unit row should read `1680 passed (1680)` and lint `0 errors, 232 warnings`.

- [ ] **Step 10: Commit**

```bash
git add scripts/verify src/dev/tests/verify package.json
git commit -m "feat(verify): run desktop's fast tier and print a readable verdict"
```

---

### Task 2: The environment block

Turns invisible `yarn link` state into a line you can read.

**Files:**
- Create: `scripts/verify/environment.mjs`
- Modify: `scripts/verify/index.mjs`

**Interfaces:**
- Consumes: `renderEnvironment` from `report.mjs` (Task 1).
- Produces: `describeEnvironment(desktopPath): Promise<Env>` where
  `Env = { deps: { name: string, summary: string, warnings: string[] }[] }`

- [ ] **Step 1: Write `scripts/verify/environment.mjs`**

```js
#!/usr/bin/env node
/**
 * Report what this run actually tested against.
 *
 * Local dependency wiring is machine-local and silent. MEASURED 2026-08-22:
 * desktop declares the SDK as a published `^2.1.0-2` but resolves it through a
 * global `yarn link` to a local checkout at 2.1.1, so a teammate cloning this
 * repo tests different code. That difference must appear in the report, or a
 * green run means something different on every machine.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const git = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

function describeDep(desktopPath, name) {
  const modulePath = join(desktopPath, 'node_modules', name);
  if (!existsSync(modulePath)) {
    return { name: shortName(name), summary: 'NOT INSTALLED', warnings: [] };
  }

  const real = realpathSync(modulePath);
  const linked = real !== modulePath;
  const pkg = readJson(join(real, 'package.json'));
  const version = pkg?.version ?? 'unknown';
  const declared =
    readJson(join(desktopPath, 'package.json'))?.dependencies?.[name] ?? '';

  const warnings = [];
  if (!linked) {
    return {
      name: shortName(name),
      summary: `published @ ${version}`,
      warnings,
    };
  }

  const commit = git(real, ['rev-parse', '--short', 'HEAD']) || 'no-git';
  const dirty = git(real, ['status', '--porcelain']) !== '';
  if (dirty) {
    warnings.push('uncommitted changes in this checkout — the result is not reproducible');
  }
  // A `link:` specifier is honest about being local. A semver range is not:
  // it claims the published package while resolving to a working copy.
  if (declared && !declared.startsWith('link:')) {
    warnings.push(
      `package.json declares ${declared} (published) — you are NOT testing that`
    );
  }
  return {
    name: shortName(name),
    summary: `LINKED → ${version} (${commit}${dirty ? ', DIRTY' : ', clean'})`,
    warnings,
  };
}

const shortName = (name) => (name.includes('sdk') ? 'sdk' : 'shared');

export async function describeEnvironment(desktopPath) {
  const commit = git(desktopPath, ['rev-parse', '--short', 'HEAD']) || 'no-git';
  const dirtyFiles = git(desktopPath, ['status', '--porcelain'])
    .split('\n')
    .filter(Boolean).length;

  const deps = [
    {
      name: 'desktop',
      summary: `${commit}${dirtyFiles ? `  ⚠ working tree dirty (${dirtyFiles} files)` : '  clean'}`,
      warnings: [],
    },
    describeDep(desktopPath, '@quilibrium/quorum-shared'),
    describeDep(desktopPath, '@quilibrium/quilibrium-js-sdk-channels'),
  ];
  return { deps };
}
```

- [ ] **Step 2: Wire it into `index.mjs`**

Replace the `env: null` line. Add the import at the top and build `env` before the loop:

```js
import { describeEnvironment } from './environment.mjs';

const env = await describeEnvironment(DESKTOP);
```

and change the render call to `renderReport({ env, plan, results })`.

- [ ] **Step 3: Run and check the block against the measured facts**

```bash
yarn verify
```

Expected in the `ENVIRONMENT` block: `shared  LINKED → 2.1.0-45 (<sha>, clean)` and `sdk  LINKED → 2.1.1 (882d8e1, clean)` with the warning `package.json declares ^2.1.0-2 (published) — you are NOT testing that`.

- [ ] **Step 4: Prove the dirty warning fires**

```bash
cd ../quilibrium-js-sdk-channels && echo "// scratch" >> README.md
cd ../quorum-desktop && yarn verify 2>&1 | grep -A2 "sdk"
```

Expected: `DIRTY` in the summary and the `uncommitted changes` warning. Then revert:

```bash
cd ../quilibrium-js-sdk-channels && git checkout README.md && cd ../quorum-desktop
```

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/environment.mjs scripts/verify/index.mjs
git commit -m "feat(verify): report which shared and SDK code the run tested against"
```

---

### Task 3: Routing from `git diff`

**Files:**
- Create: `scripts/verify/routing.mjs`, `src/dev/tests/verify/routing.test.ts`
- Modify: `scripts/verify/index.mjs`

**Interfaces:**
- Produces: `planFromPaths(paths: string[]): RoutePlan` where
  `RoutePlan = { repos: string[], live: boolean, reasons: string[], skipped: string[] }`.
  Paths are repo-relative and prefixed with the repo name, e.g. `desktop/src/services/SyncService.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/verify/routing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { planFromPaths } from '../../../../scripts/verify/routing.mjs';

describe('planFromPaths', () => {
  it('routes a desktop-only source change to desktop, with the live tier', () => {
    const plan = planFromPaths(['desktop/src/services/SyncService.ts']);
    expect(plan.repos).toEqual(['desktop']);
    expect(plan.live).toBe(true);
  });

  // Channel A: both clients consume shared, so both must run.
  it('routes a shared change to all three repos', () => {
    const plan = planFromPaths(['shared/src/sync/delta.ts']);
    expect(plan.repos).toEqual(['shared', 'desktop', 'mobile']);
  });

  it('routes a mobile-only change to mobile', () => {
    expect(planFromPaths(['mobile/app/index.tsx']).repos).toEqual(['mobile']);
  });

  it('skips the live tier for docs and styles', () => {
    const plan = planFromPaths([
      'desktop/README.md',
      'desktop/.agents/issues/x.md',
      'desktop/src/styles/theme.scss',
    ]);
    expect(plan.live).toBe(false);
  });

  it('skips the live tier for a components-only change', () => {
    expect(planFromPaths(['desktop/src/components/Button.tsx']).live).toBe(false);
  });

  // The allowlist clears a components change only when nothing riskier rode
  // along in the same diff.
  it('runs the live tier when a component AND a service changed together', () => {
    const plan = planFromPaths([
      'desktop/src/components/Button.tsx',
      'desktop/src/services/MessageService.ts',
    ]);
    expect(plan.live).toBe(true);
  });

  // Fail toward running more: an unclassified path is dangerous by default.
  it('runs the live tier for a path nobody has classified', () => {
    expect(planFromPaths(['desktop/src/brand-new-thing/x.ts']).live).toBe(true);
  });

  it('names the file that triggered the live tier', () => {
    const plan = planFromPaths(['desktop/src/services/MessageService.ts']);
    expect(plan.reasons.join(' ')).toContain('MessageService.ts');
  });

  it('routes nothing and skips live for an empty diff', () => {
    const plan = planFromPaths([]);
    expect(plan.repos).toEqual([]);
    expect(plan.live).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn vitest --run src/dev/tests/verify/routing.test.ts
```

Expected: FAIL — cannot resolve `scripts/verify/routing.mjs`.

- [ ] **Step 3: Write `scripts/verify/routing.mjs`**

```js
#!/usr/bin/env node
/**
 * Decide what to run from what changed.
 *
 * The live-tier trigger is an ALLOWLIST of provably safe paths, not a denylist
 * of dangerous ones, and the direction is the whole design. A denylist rots
 * silently: someone adds a receive path, nobody lists it, live coverage lapses
 * and there is no signal. An allowlist rots loudly — it costs an unnecessary
 * fifteen minutes, which is visible the moment it happens.
 *
 * Paths arrive prefixed with their repo: `desktop/src/...`, `shared/src/...`.
 */

/** Safe: cannot change what goes on the wire or what comes off it. */
const SAFE = [
  /\.md$/,
  /\.mdx$/,
  /\.s?css$/,
  /^[^/]+\/\.agents\//,
  /^[^/]+\/public\//,
  /^[^/]+\/src\/locales\//,
  /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
];

/**
 * Safe ONLY when nothing riskier is in the same diff. A component cannot reach
 * the wire on its own, but a diff that touches a component and a service is not
 * a UI change with a service file in it — it is a service change.
 */
const SAFE_ALONE = [/^[^/]+\/src\/components\//, /^[^/]+\/src\/dev\/tests\//];

const REPO_OF = (path) => path.split('/')[0];

export function planFromPaths(paths) {
  const reasons = [];
  const touched = new Set(paths.map(REPO_OF).filter(Boolean));

  // Channel A: desktop symlinks shared and mobile pins the published copy, so a
  // shared change is the only one that fans out on its own.
  const repos = [];
  if (touched.has('shared')) repos.push('shared', 'desktop', 'mobile');
  else {
    if (touched.has('desktop')) repos.push('desktop');
    if (touched.has('mobile')) repos.push('mobile');
  }

  const risky = paths.filter(
    (p) => !SAFE.some((r) => r.test(p)) && !SAFE_ALONE.some((r) => r.test(p))
  );
  const live = risky.length > 0;
  if (live) {
    reasons.push(`(not on the safe list: ${risky.slice(0, 3).join(', ')})`);
    if (risky.length > 3) reasons.push(`(… and ${risky.length - 3} more)`);
  } else if (paths.length) {
    reasons.push('(every changed path is on the safe list — fast tier only)');
  }

  return { repos: [...new Set(repos)], live, reasons, skipped: [] };
}

/** Repo-prefixed changed paths, working tree + staged, vs the merge base. */
export function changedPaths(repoName, repoPath, execGit) {
  const out = [
    execGit(repoPath, ['diff', '--name-only', 'HEAD']),
    execGit(repoPath, ['diff', '--name-only', '--staged']),
    execGit(repoPath, ['ls-files', '--others', '--exclude-standard']),
  ].join('\n');
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))].map(
    (p) => `${repoName}/${p}`
  );
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
yarn vitest --run src/dev/tests/verify/routing.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Wire routing into `index.mjs`**

Replace the hardcoded `plan` with a computed one. Add imports and gather paths from every repo that is present:

```js
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { planFromPaths, changedPaths } from './routing.mjs';

const argv = process.argv.slice(2);

/**
 * Where the sibling repos live. Overridable ONLY so the degrade-loudly path can
 * be tested by pointing at an empty directory. The alternative — renaming a real
 * checkout to simulate its absence — leaves a repo renamed if the run dies
 * halfway, which is not a risk worth taking to test an error message.
 */
const reposRootArg = argv.find((a) => a.startsWith('--repos-root='));
const SIBLINGS = reposRootArg
  ? resolve(reposRootArg.split('=')[1])
  : resolve(DESKTOP, '..');

const REPOS = {
  desktop: DESKTOP,
  shared: resolve(SIBLINGS, 'quorum-shared'),
  mobile: resolve(SIBLINGS, 'quorum-mobile'),
};

const execGit = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' });
  } catch {
    return '';
  }
};

const allPaths = Object.entries(REPOS)
  .filter(([, path]) => existsSync(path))
  .flatMap(([name, path]) => changedPaths(name, path, execGit));

const plan = planFromPaths(allPaths);

// An explicit request beats inference; a diff-less run would otherwise do nothing.
// `argv` is already declared above, with the repos-root override.
if (argv.includes('--all')) {
  plan.repos = ['desktop', 'shared', 'mobile'];
  plan.live = true;
  plan.reasons = ['(--all: every repo, every tier)'];
}
if (argv.includes('--fast')) {
  plan.live = false;
  plan.reasons.push('(--fast: live tier skipped by request)');
}
if (plan.repos.length === 0) {
  plan.repos = ['desktop'];
  plan.reasons.push('(no changes detected — desktop fast tier as a baseline)');
}
```

Keep the step loop on `'desktop'` for now; the fan-out is Task 4.

- [ ] **Step 6: Prove routing works both ways**

```bash
echo "scratch" >> README.md && yarn verify --fast 2>&1 | grep -E "ROUTED|TIER"
```

Expected: `TIER      fast` and a reason naming the safe list. Then:

```bash
git checkout README.md
echo "// scratch" >> src/services/MessageService.ts
yarn verify --fast 2>&1 | grep -E "TIER|not on the safe list"
```

Expected: the reason names `MessageService.ts`. (`--fast` keeps the run short; the routing decision is still printed.) Revert:

```bash
git checkout src/services/MessageService.ts
```

- [ ] **Step 7: Commit**

```bash
git add scripts/verify/routing.mjs src/dev/tests/verify/routing.test.ts scripts/verify/index.mjs
git commit -m "feat(verify): route checks from the diff, failing toward running more"
```

---

### Task 4: Cross-repo fan-out, degrading loudly

**Files:**
- Modify: `scripts/verify/index.mjs`

**Interfaces:**
- Consumes: `stepsFor` (Task 1), `skipped` (Task 1), `planFromPaths` (Task 3).
- Produces: no new exports.

- [ ] **Step 1: Replace the desktop-only loop with a fan-out**

In `index.mjs`, replace the loop from Task 1 with:

```js
const results = [];

// Shared is built FIRST when it is in the plan. Desktop consumes shared through
// its built dist, so skipping this means desktop silently tests the PREVIOUS
// build and reports a green describing code nobody changed.
if (plan.repos.includes('shared') && existsSync(REPOS.shared)) {
  const [buildStep] = stepsFor('shared', REPOS.shared, 'fast').filter(
    (s) => s.label === 'build'
  );
  if (buildStep) results.push(await runStep(buildStep));
}

for (const repo of plan.repos) {
  const path = REPOS[repo];
  if (!existsSync(path)) {
    plan.skipped.push(
      `quorum-${repo} not found at ../quorum-${repo} — ${repo.toUpperCase()} COVERAGE SKIPPED`
    );
    continue;
  }
  for (const step of stepsFor(repo, path, 'fast')) {
    // Already run above; do not pay for it twice.
    if (repo === 'shared' && step.label === 'build' && results.some((r) => r.id === step.id))
      continue;
    results.push(await runStep(step));
  }
}

// Channel A is asymmetric and the asymmetry is invisible: mobile resolves the
// PUBLISHED shared package, so a local shared edit never reaches it.
if (plan.repos.includes('shared') && plan.repos.includes('mobile')) {
  plan.skipped.push(
    'shared changed, but mobile resolves the published @quilibrium/quorum-shared — ' +
      'mobile is NOT testing your change. Publish and bump before trusting it.'
  );
}

if (plan.skipped.length) {
  plan.skipped.push('This does NOT clear a change that touches shared or the wire.');
}
```

- [ ] **Step 2: Add `--strict`**

Before the final `process.exit`:

```js
// --strict is for when you want the full net or nothing: a reduced run stops
// being an answer and becomes a failure.
const verdict = verdictOf(results, plan);
const strict = argv.includes('--strict');
const failed = verdict === 'FAIL' || (strict && verdict !== 'PASS');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Prove the fan-out runs all three repos**

```bash
yarn verify --all --fast
```

Expected: rows for desktop, shared and mobile; `shared build` appears once, before desktop's steps; verdict `PASS (PARTIAL)` with the mobile/published-shared warning, because `--all` puts shared and mobile in the same plan.

- [ ] **Step 4: Prove it degrades loudly when a repo is missing**

Point the run at an empty directory instead of the real siblings. **Nothing is renamed or moved**, so an interrupted run leaves no mess:

```bash
mkdir -p /tmp/no-siblings
yarn verify --all --fast --repos-root=/tmp/no-siblings 2>&1 | tail -20
```

Expected: `VERDICT  PASS (PARTIAL)`, with `⚠ quorum-shared not found …` and `⚠ quorum-mobile not found … COVERAGE SKIPPED`. Confirm the verdict is **not** a bare `PASS` — that is the assertion this step exists for.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/index.mjs
git commit -m "feat(verify): fan out across repos and refuse a bare PASS on a reduced run"
```

---

### Task 5: The receipt

**Files:**
- Modify: `scripts/verify/report.mjs`, `scripts/verify/index.mjs`, `.gitignore`
- Modify: `src/dev/tests/verify/report.test.ts`

**Interfaces:**
- Produces: `buildReceipt({ env, plan, results, verdict, startedAt, finishedAt }): object` in `report.mjs`.

- [ ] **Step 1: Write the failing test**

Append to `src/dev/tests/verify/report.test.ts`:

```ts
import { buildReceipt } from '../../../../scripts/verify/report.mjs';

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
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn vitest --run src/dev/tests/verify/report.test.ts
```

Expected: FAIL — `buildReceipt` is not exported.

- [ ] **Step 3: Add `buildReceipt` to `report.mjs`**

```js
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
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
yarn vitest --run src/dev/tests/verify/report.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Write and read the receipt in `index.mjs`**

Add near the top:

```js
import { writeFileSync, readFileSync } from 'node:fs';
import { buildReceipt } from './report.mjs';

const RECEIPT = resolve(DESKTOP, '.verify-receipt.json');

if (argv.includes('--show-receipt')) {
  try {
    console.log(readFileSync(RECEIPT, 'utf8'));
    process.exit(0);
  } catch {
    console.error('[verify] no receipt yet — run `yarn verify` first.');
    process.exit(1);
  }
}
```

Note: this block must sit **after** `argv` is defined and **before** any step runs. Then, just before the exit:

```js
writeFileSync(
  RECEIPT,
  JSON.stringify(
    buildReceipt({ env, plan, results, verdict, startedAt, finishedAt: Date.now() }),
    null,
    2
  )
);
```

with `const startedAt = Date.now();` set at the top of the script.

- [ ] **Step 6: Ignore the receipt**

Append to `.gitignore`:

```
# Local verify receipts. Machine-specific, regenerated every run.
.verify-receipt.json
```

- [ ] **Step 7: Prove it round-trips**

```bash
yarn verify --fast && yarn verify --show-receipt | head -20
git status --porcelain | grep verify-receipt && echo "LEAK — receipt is tracked" || echo "ok: receipt ignored"
```

Expected: JSON with `verdict`, `environment`, `plan`, `steps`; and `ok: receipt ignored`.

- [ ] **Step 8: Commit**

```bash
git add scripts/verify src/dev/tests/verify .gitignore
git commit -m "feat(verify): write a receipt recording what ran against which code"
```

---

### Task 6: Delegating wrappers for shared and mobile

**Files:**
- Create: `../quorum-shared/scripts/verify.mjs`, `../quorum-mobile/scripts/verify.mjs`
- Modify: `../quorum-shared/package.json`, `../quorum-mobile/package.json`

**Interfaces:**
- Consumes: `quorum-desktop/scripts/verify/index.mjs`.
- Produces: `yarn verify` in each of the two repos.

- [ ] **Step 1: Write the wrapper (identical in both repos)**

Create `scripts/verify.mjs` in `quorum-shared` and in `quorum-mobile`:

```js
#!/usr/bin/env node
/**
 * Delegate to the shared orchestrator in quorum-desktop.
 *
 * If that checkout is absent this does NOT fail. Someone who cloned one repo
 * still gets a useful answer from their own fast tier — they simply cannot get
 * a bare PASS, because a single-repo run cannot clear a change that crosses the
 * wire or rides on shared. Same rule as a missing sibling in the orchestrator.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
// The override exists so the fallback path below can be tested by pointing at a
// path that does not exist. Renaming a real checkout to prove an error message
// leaves a repo renamed if the run dies halfway.
const ORCHESTRATOR =
  process.env.VERIFY_ORCHESTRATOR ??
  resolve(REPO, '../quorum-desktop/scripts/verify/index.mjs');
const passthrough = process.argv.slice(2);

if (existsSync(ORCHESTRATOR)) {
  spawn('node', [ORCHESTRATOR, ...passthrough], {
    cwd: resolve(REPO, '../quorum-desktop'),
    shell: true,
    stdio: 'inherit',
  }).on('exit', (code) => process.exit(code ?? 1));
} else {
  console.log('[verify] quorum-desktop not found — running this repo\'s fast tier only.');
  const child = spawn('yarn', ['test:run'], { cwd: REPO, shell: true, stdio: 'inherit' });
  child.on('exit', (code) => {
    console.log('');
    console.log('  VERDICT  PASS (PARTIAL) — orchestrator not found, single-repo fast tier only');
    console.log('           ⚠ This does NOT clear a change that touches shared or the wire.');
    process.exit(code ?? 1);
  });
}
```

In `quorum-mobile/scripts/verify.mjs`, change the fallback command from
`['test:run']` to `['test', '--ci']`, because mobile runs Jest and has no
`test:run` script. Everything else is identical.

- [ ] **Step 2: Add the script to both package.json files**

In `quorum-shared/package.json` and `quorum-mobile/package.json`, add to `"scripts"`:

```json
"verify": "node scripts/verify.mjs"
```

- [ ] **Step 3: Prove delegation works**

```bash
cd ../quorum-shared && yarn verify --fast 2>&1 | tail -15
cd ../quorum-mobile && yarn verify --fast 2>&1 | tail -15
cd ../quorum-desktop
```

Expected: both produce the orchestrator's verdict block, not a bare test run.

- [ ] **Step 4: Prove the fallback works**

Point the wrapper at an orchestrator path that does not exist. **Nothing is renamed**, so an interrupted run leaves no mess:

```bash
cd ../quorum-shared
VERIFY_ORCHESTRATOR=/nonexistent/verify.mjs yarn verify 2>&1 | tail -6
cd ../quorum-desktop
```

Expected: `PASS (PARTIAL) — orchestrator not found, single-repo fast tier only`, plus the "does NOT clear a change that touches shared or the wire" warning. Confirm it is **not** a bare `PASS`.

- [ ] **Step 5: Commit in both repos**

```bash
cd ../quorum-shared && git add scripts/verify.mjs package.json \
  && git commit -m "feat(verify): delegate to the cross-repo gate, degrading to a local fast tier"
cd ../quorum-mobile && git add scripts/verify.mjs package.json \
  && git commit -m "feat(verify): delegate to the cross-repo gate, degrading to a local fast tier"
cd ../quorum-desktop
```

---

## PART B — The coverage audit

### Task 7: Measure what is actually covered, and write it down

The gate is only worth its verdict if the `NOT COVERED` list is true. This task produces the document that keeps it true, and it is **measurement, not estimation** — every row cites a file or says "none found".

**Files:**
- Create: `.agents/docs/regression-coverage-map.md`
- Modify: `scripts/verify/report.mjs` (update `NOT_COVERED` from the findings)

**Interfaces:**
- Consumes: nothing.
- Produces: the document, and a corrected `NOT_COVERED` array.

- [ ] **Step 1: Enumerate the content types**

```bash
grep -n "  type: '" ../quorum-shared/src/types/message.ts
```

Expected: 28 types. Record every one in the document's first column.

- [ ] **Step 2: For each type, find the delivery arm that asserts it**

```bash
# The space arm's assertion loop is the authority for spaces:
sed -n '691,708p' src/dev/tests/harness/space-message-id-derivation.scenario.test.ts
# For each type, search every harness scenario for an assertion (not just a send):
grep -rn "typesSeenBy\|content?.type ===" src/dev/tests/harness/*.scenario.test.ts
```

Record per type: **asserted** (a receiver checks it arrived), **sent only** (put on the wire, never asserted — `pin` is the known case), or **none**.

- [ ] **Step 3: Record the already-measured findings so they are not re-derived**

These were measured 2026-08-22 and must appear in the document:

| Finding | Evidence |
|---|---|
| Space delivery asserts 9 types | `space-message-id-derivation.scenario.test.ts:691-708` |
| `pin` is sent but never asserted | same file, line 433 — needs a role holding `message:pin`, no owner bypass |
| **DM asserts no content type beyond plain text** | no `dm-*.scenario.test.ts` sends `embed`, `sticker`, `reaction`, `edit-message` or `remove-message` |
| `remove-reaction` is asserted nowhere | absent from the space assertion loop and from every DM scenario |
| `src/dev/tests/integration/` and `src/dev/tests/e2e/` are empty | `ls` both |
| 16 of 169 components have a test | `src/dev/tests/components/` |

- [ ] **Step 4: Write the document**

Create `.agents/docs/regression-coverage-map.md` with:

1. A one-paragraph statement of purpose: this is the list the gate's `NOT COVERED` line is derived from, and it is measured, not estimated.
2. A table: content type · space arm · DM arm · cross-client arm · notes.
3. A second table for non-message critical paths: space create, invite, join, kick, rejoin, role permissions, config sync, storage eviction and restore, login. Mark each covered / partial / none, citing the scenario.
4. A **Gaps, ranked** section — ranked by *silence*, not by size. A gap whose failure is invisible to a user outranks one they would notice immediately.
5. Footer: `*Last updated: 2026-08-22*`

- [ ] **Step 5: Correct `NOT_COVERED` in `report.mjs` from what you found**

Replace the array with the audit's top gaps, phrased for a reader who has not opened the document. Keep it to five entries or fewer — a list nobody reads protects nobody.

- [ ] **Step 6: Verify the document has no unmeasured claims**

Re-read it and check every row cites a file, a line, or "none found". Any row you cannot evidence must say `UNKNOWN — not yet measured` rather than a guess.

- [ ] **Step 7: Commit**

```bash
python "$HOME/.agents/skills/docs-manager/update-index.py" .
git add .agents/docs/regression-coverage-map.md .agents/INDEX.md scripts/verify/report.mjs
git commit -m "docs: map what regression coverage actually exists, measured per content type"
```

---

## PART C — The measured gaps

### Task 8: Extract `space-delivery`, and add `remove-reaction`

Promotes the DELIVERY arm out of the attack scenario so "did this fix drop a feature" is answerable without running an attack.

**Files:**
- Create: `src/dev/tests/harness/space-delivery.scenario.test.ts`
- Modify: `src/dev/tests/harness/README.md`

**Interfaces:**
- Consumes: `createSpaceBot`, `HarnessSpaceBot` from `./spaceBot`; `RunLog` from `./log`.
- Produces: `yarn harness space-delivery`.

- [ ] **Step 1: Create the scenario by extracting the delivery half**

Copy `space-message-id-derivation.scenario.test.ts` to `space-delivery.scenario.test.ts`, then remove **only** the attack machinery: `forgePost`, `derivedId`, the `forgeSend` call, the `refusals` logger patch, the positive-control assertion, the CONTROL forgery arm, and the `undeliverable` recipe check.

**Keep, unchanged and with their comments intact:**
- `until`, `sleep`, `forceDelivery`, `settleFor`, `threadIdFor`
- the `saveMessage` instrumentation on **both** bots and `typesSeenBy`
- all three batches and their six-frames-per-batch limit
- the `timedOut` and `outbound.failures` diagnostics
- the assertion ordering: novel errors → outbound failures → timeouts → per-type

That ordering is load-bearing. A frame that never left the sender and a frame the receiver refused produce the identical symptom, and the per-type message blames the receiver. Both traps are documented in the harness README and were measured.

- [ ] **Step 2: Add the `remove-reaction` arm**

The audit found this type is asserted nowhere. It mutates a target row, so it belongs in batch 2 and needs its own target. Add a fourth post to batch 1 — which would make seven frames, over the measured limit — so instead put the new post in batch 1 and the `remove-reaction` in batch 3, keeping every batch at six or fewer.

In batch 1, replace the reply frame's position by adding `D_TEXT` as a fourth post and moving the reply to batch 2:

```ts
const D_TEXT = `honest-post-D-${stamp}`;
// batch 1 becomes: [post A, post B, post C, post D, embed, sticker] (6)
```

Then in batch 2, after the reaction on A, add the reply, and in batch 3 add:

```ts
// `remove-reaction` needs a reaction to remove, so it targets D, which received
// one in batch 2. Split across batches on purpose: the two frames write the
// same row, and two writes to one record inside a single delivered batch is the
// concurrency race the file header warns about.
await x.sendControl(s.spaceId, s.channelId, {
  type: 'reaction',
  senderId: x.identity.address,
  messageId: rowD!.messageId,
  reaction: '🎉',
});
```

placed in batch 2, and in batch 3:

```ts
await x.sendControl(s.spaceId, s.channelId, {
  type: 'remove-reaction',
  senderId: x.identity.address,
  messageId: rowD!.messageId,
  reaction: '🎉',
});
```

Add `['v', 'remove-reaction']` to the assertion loop.

- [ ] **Step 3: Update the header comment**

Replace the file header with one describing delivery preservation as the purpose, keeping the two measured traps (batch size, sending just after a reconnect) verbatim. State plainly that `pin` is sent but not asserted and why, so nobody "fixes" it into a failing arm.

- [ ] **Step 4: Run it**

```bash
yarn harness space-delivery
```

Expected: PASS, with `DELIVERY types accepted by victim` listing at least `post, embed, sticker, reaction, edit-message, thread, remove-message, update-profile, remove-reaction`, `timedOut` empty and `outbound failures` `0 / 0`.

If a type is missing, read the diagnostics before concluding anything: a timeout or an outbound failure means the frame never arrived, which is the relay or the batching, not the receiver.

- [ ] **Step 5: Add it to the harness README scenario table**

Add a row under "Space scenarios" describing what it proves and noting that `pin` is sent but not asserted.

- [ ] **Step 6: Commit**

```bash
git add src/dev/tests/harness/space-delivery.scenario.test.ts src/dev/tests/harness/README.md
git commit -m "test(harness): prove every space content type still survives the receive path"
```

---

### Task 9: Prove `space-delivery` can fail

An arm that cannot fail manufactures confidence. This is a required gate, not a nice-to-have — the harness README records a security scenario that was green against vulnerable code on its first draft.

**Files:** none changed permanently.

- [ ] **Step 1: Break one content type on the receive path**

Find where the receiver dispatches on `content.type` and make it drop `sticker`:

```bash
grep -rn "content.type" src/services/MessageService.ts | head -20
```

Add a temporary early return for `sticker` in the receive dispatch. Do **not** commit this.

- [ ] **Step 2: Run and confirm RED, for the right reason**

```bash
yarn harness space-delivery
```

Expected: FAIL on `DELIVERY: an honest 'sticker' frame did not survive`, with `timedOut` **empty** and `outbound failures` **0 / 0**.

If it fails on a timeout instead, the arm is measuring the relay, not the receive path, and the result proves nothing — re-run before concluding.

- [ ] **Step 3: Restore and confirm GREEN**

```bash
git checkout src/services/MessageService.ts
yarn harness space-delivery
```

Expected: PASS.

- [ ] **Step 4: Record the falsification in the scenario header**

Add a line to the file header:

```
// FALSIFIED 2026-08-22: dropping `sticker` in the receive dispatch turns this
// red on the sticker arm, with no timeouts and no outbound failures. An arm
// that has not been seen to fail is not evidence.
```

- [ ] **Step 5: Commit**

```bash
git add src/dev/tests/harness/space-delivery.scenario.test.ts
git commit -m "test(harness): record that space-delivery was seen to fail on a dropped type"
```

---

### Task 10: `dm-delivery` — the biggest measured gap

No DM scenario asserts any content type beyond plain text. The receive-auth work touches the DM path, so a fix that broke DM attachments or reactions would ship silently.

**Files:**
- Modify: `src/dev/tests/harness/bot.ts` (add the `sendControl` seam)
- Create: `src/dev/tests/harness/dm-delivery.scenario.test.ts`
- Modify: `src/dev/tests/harness/README.md`

**Interfaces:**
- Consumes: `createBot` from `./bot`, `RunLog` from `./log`.
- Produces: `HarnessBot.sendControl(toAddress: string, content: object): Promise<void>`, and `yarn harness dm-delivery`.

**Two facts measured 2026-08-22 that change how this is built — do not skip them:**

1. **The DM bot can only send text.** `HarnessBot` exposes `send(toAddress, text)` and nothing else; there is no `sendControl` as there is on `spaceBot`. The seam has to be added first (Step 1).
2. **A DM bot has no `graph`, so `graph.outbound.failures` does not exist.** The space arm's outbound-failure diagnostic has no DM equivalent: `deps.ts` runs each enqueued action immediately, where the space path uses the serialized FIFO in `outbound.ts` (harness README, point 4). Copying that assertion across would reference a missing field. The DM assertion order is therefore **novel receive errors → timeouts → per-type**, with no outbound arm.

- [ ] **Step 1: Add the `sendControl` seam to `bot.ts`**

`MessageService.submitMessage` already accepts `pendingMessage: string | object`
(`src/services/MessageService.ts:3912-3914`), so a control frame needs no new
service code — only a way for a scenario to reach the object form.

Add this beside the existing `send`, reusing its registration and passkey setup:

```ts
    /**
     * Send a non-text DM content object through the REAL send path.
     *
     * `submitMessage` takes `string | object`, so this is the same call `send`
     * makes with the object branch taken — no bespoke framing, which is the
     * point: a scenario that builds its own frame would test the scenario.
     */
    sendControl: async (toAddress: string, content: object) => {
      const self = (await apiClient.getUser(identity.address))?.data as UserRegistration;
      const counterparty = (await apiClient.getUser(toAddress))?.data as UserRegistration;
      if (!self || !counterparty) {
        throw new Error(`missing registration (self=${!!self} counterparty=${!!counterparty})`);
      }
      const passkeyInfo = {
        credentialId: '',
        address: identity.address,
        publicKey: Buffer.from(
          new Uint8Array(identity.keyset.userKeyset.user_key.public_key)
        ).toString('hex'),
        completedOnboarding: true,
      };
      await messageService.submitMessage(
        toAddress,
        content,
        self,
        counterparty,
        queryClient,
        passkeyInfo,
        identity.keyset
      );
      await refreshSubscriptions();
    },
```

Add `sendControl(toAddress: string, content: object): Promise<void>;` to the
`HarnessBot` interface beside `send`.

- [ ] **Step 2: Confirm the seam works before building on it**

```bash
yarn harness dm-basic
```

Expected: still PASS. Adding an unused method must not change existing behaviour; if `dm-basic` goes red here, fix that before writing the new scenario.

- [ ] **Step 3: Write the scenario**

Model it on `space-delivery` (Task 8), with these differences:

- Two throwaway bots, A and B, from `createBot`.
- Every type asserted on the bot that did **not** send it. Same trap as the space arm: the send path saves the sender's own copy, so asserting on the sender passes without the frame crossing the wire.
- Instrument `messageService.saveMessage` on both bots exactly as the space arm does, because target-mutating types (reaction, edit, remove) change an existing row rather than creating one and cannot be read off the message store.
- **Quote `bot.novelErrors()`, never `bot.errors`** — a frame the bot already decrypted is refused by design, and counting replays as failures is a documented past mistake (harness README, point 2).
- Six frames per batch maximum, for the same measured reason as the space arm.
- Types to cover, from the audit: `post`, `embed`, `sticker`, `reaction`, `remove-reaction`, `edit-message`, `remove-message`, `dm-update-profile`.
- Assertion order: **novel receive errors → timeouts → per-type delivery.** No outbound arm — see the note above.

- [ ] **Step 4: Run it**

```bash
yarn harness dm-delivery
```

Expected: PASS with all eight types listed as accepted by the non-sending bot.

A first run that fails on a type is **not** automatically a bug in the app: check `timedOut` first, then reduce the batch size. Only once those are clean does a missing type mean the receive path dropped it — and if it does, **that is a real finding**: stop, file it as a bug, and do not adjust the scenario until it has been triaged. A new arm that goes red on its first honest run is the arm doing its job.

- [ ] **Step 5: Add it to the harness README scenario table**

Add a row under the DM scenarios table, and note in the layout table that `bot.ts` now exposes `sendControl` alongside `send`.

- [ ] **Step 6: Commit**

```bash
git add src/dev/tests/harness/bot.ts src/dev/tests/harness/dm-delivery.scenario.test.ts src/dev/tests/harness/README.md
git commit -m "test(harness): prove every DM content type still survives the receive path"
```

---

### Task 11: Prove `dm-delivery` can fail

Same gate as Task 9, on the new arm.

- [ ] **Step 1: Break one DM content type on the receive path**

Add a temporary early return for `embed` in the DM receive dispatch. Do not commit it.

- [ ] **Step 2: Run and confirm RED for the right reason**

```bash
yarn harness dm-delivery
```

Expected: FAIL naming `embed`, with `timedOut` empty, outbound failures `0 / 0`, and novel receive errors `0`.

- [ ] **Step 3: Restore and confirm GREEN**

```bash
git checkout src/services/MessageService.ts
yarn harness dm-delivery
```

Expected: PASS.

- [ ] **Step 4: Record the falsification in the header, then commit**

```bash
git add src/dev/tests/harness/dm-delivery.scenario.test.ts
git commit -m "test(harness): record that dm-delivery was seen to fail on a dropped type"
```

---

### Task 12: Wire the live tier in, and make running it the rule

**Files:**
- Modify: `scripts/verify/steps.mjs`, `scripts/verify/index.mjs`
- Modify: `AGENTS.md` (desktop, shared, mobile), `.agents/AGENTS.md` (desktop)
- Modify: `.agents/docs/regression-coverage-map.md`

- [ ] **Step 1: Add the live steps to `steps.mjs`**

Inside `stepsFor`, before the closing `return []`:

```js
if (tier === 'live' && repoName === 'desktop') {
  // Desktop-only: every live arm is driven from this repo, including the two
  // cross-client ones, which spawn mobile's scenarios without modifying it.
  const harnessDetail = (out) =>
    out.includes('PASS') ? 'arms green' : '';
  return [
    mk('dm-basic', 'dm-basic', ['harness', 'dm-basic'], harnessDetail),
    mk('dm-delivery', 'dm-delivery', ['harness', 'dm-delivery'], harnessDetail),
    mk('space-basic', 'space-basic', ['harness', 'space-basic'], harnessDetail),
    mk('space-delivery', 'space-delivery', ['harness', 'space-delivery'], harnessDetail),
    mk('cross-dm', 'cross-dm', ['harness:cross'], harnessDetail),
    mk('config-cross', 'config-cross', ['harness:config-cross'], harnessDetail),
  ];
}
```

- [ ] **Step 2: Run the live steps from `index.mjs`**

After the fast-tier loop:

```js
if (plan.live) {
  for (const step of stepsFor('desktop', REPOS.desktop, 'live')) {
    // The two cross-client arms need mobile; the rest do not.
    const needsMobile = step.id.includes('cross');
    if (needsMobile && !existsSync(REPOS.mobile)) {
      results.push(skipped(step, 'quorum-mobile not found — cross-client arm skipped'));
      continue;
    }
    results.push(await runStep(step));
  }
}
```

Add `skipped` to the `runner.mjs` import.

- [ ] **Step 3: Run the whole thing once, end to end**

```bash
yarn verify --all
```

Expected: fast rows for three repos, then six live rows. Budget 15-20 minutes. Record the real total in the coverage map so the design's estimate stops being an estimate.

- [ ] **Step 4: Add the rule to all three AGENTS.md files**

Add this section to `quorum-desktop/AGENTS.md`, `quorum-shared/AGENTS.md` and `quorum-mobile/AGENTS.md`:

```markdown
## Verifying a change

Before reporting any code change complete, run `yarn verify` and paste the
verdict block **verbatim**.

- Do not summarise it, and do not report a subset of the rows.
- Do not report `PASS` when the block says `PASS (PARTIAL)` or `FLAKY`. Those
  are distinct verdicts: `PASS (PARTIAL)` means coverage was reduced, `FLAKY`
  means a step went green only on a retry.
- `yarn verify --show-receipt` prints the last run's record, including the
  commit it ran against.

The gate routes itself from the diff. It runs the live tier for anything not on
its safe list, which is deliberate: an unclassified path counts as risky.
```

- [ ] **Step 5: Update the coverage map with what the gate now covers**

Move the newly covered rows out of the gaps section, and record the measured wall-clock from step 3.

- [ ] **Step 6: Commit across the three repos**

```bash
git add scripts/verify AGENTS.md .agents/docs/regression-coverage-map.md \
  && git commit -m "feat(verify): run the live delivery tier and require the gate before shipping"
cd ../quorum-shared && git add AGENTS.md && git commit -m "docs: require yarn verify before reporting a change complete"
cd ../quorum-mobile && git add AGENTS.md && git commit -m "docs: require yarn verify before reporting a change complete"
cd ../quorum-desktop
```

---

### Task 13: Ship — one PR per repo

Only run this once every task above is done and `yarn verify --all` has been seen
green on the branch.

**Files:** none. This task only pushes and opens PRs.

- [ ] **Step 1: Confirm the gate passes on its own branch**

```bash
cd e:/GitHub/Quilibrium/quorum-desktop && yarn verify --all
```

Expected: `VERDICT  PASS`. A gate that cannot clear itself is not shippable.
`PASS (PARTIAL)` is acceptable **only** if the warning is the known
published-shared one; any other skip must be explained in the PR body.

- [ ] **Step 2: Confirm nothing unrelated rode along**

```bash
for r in quorum-desktop quorum-shared quorum-mobile; do
  cd "e:/GitHub/Quilibrium/$r"
  echo "=== $r ==="
  git log --oneline "$(git symbolic-ref refs/remotes/origin/HEAD | sed 's|refs/remotes/||')..HEAD"
done
```

Read each list. Every commit must belong to this plan. Mobile in particular must
**not** list the two `fix(spaces)` commits — if it does, the branch was cut from
the wrong base and the PR must not be opened.

- [ ] **Step 3: Confirm no secret or machine-local file is staged anywhere**

```bash
for r in quorum-desktop quorum-shared quorum-mobile; do
  cd "e:/GitHub/Quilibrium/$r"
  git diff --name-only "$(git symbolic-ref refs/remotes/origin/HEAD | sed 's|refs/remotes/||')..HEAD" \
    | grep -Ei '\.env|\.state/|verify-receipt|\.secret/' && echo "  ⚠ $r: STOP" || echo "  ok: $r"
done
```

Expected: `ok` for all three. Anything listed must be removed from the branch
before pushing — this repo is public.

- [ ] **Step 4: Push all three branches**

```bash
for r in quorum-desktop quorum-shared quorum-mobile; do
  cd "e:/GitHub/Quilibrium/$r" && git push -u origin feat/verify-regression-gate
done
```

- [ ] **Step 5: Open one PR per repo**

Each PR body states: what the gate does, the measured baseline it was built
against, the two new live arms **and the fact that each was seen to fail**, and
what it explicitly does not cover. Paste the `yarn verify --all` verdict block
from step 1 into the desktop PR.

```bash
cd e:/GitHub/Quilibrium/quorum-desktop
gh pr create --base main --title "feat: a routed regression gate with a readable verdict" --body-file <(cat <<'EOF'
Adds `yarn verify`: one command that routes checks from the diff across the
three repos and prints a verdict readable without reading the diff.

Also closes two measured coverage gaps: no DM scenario asserted any content type
beyond plain text, and `remove-reaction` was asserted nowhere.

Design: `.agents/issues/.done/2026-08-22-verify-regression-gate-design.md`
Plan:   `.agents/issues/.done/2026-08-22-verify-regression-gate-plan.md`

Both new live arms were run against deliberately broken code and seen to go red
before being trusted.
EOF
)
```

For shared and mobile, `--base master`, and a short body noting the PR only adds
a wrapper that delegates to desktop's orchestrator plus an AGENTS.md rule, and
that no source code is modified.

- [ ] **Step 6: Do NOT merge**

Leave all three PRs open for review. Report the three URLs and stop.

---

## Out of scope

- **`space-cross`, the desktop↔mobile space delivery arm.** The remaining Channel B hole. Separate plan, a few days; plan it only once phase 1 runs and both new arms have been proven able to fail.
- **Playwright / browser end-to-end.** Declined in the design: UI regressions are loud and self-announcing, and this design buys coverage on the silent half.
- **CI and git hooks.** Deliberately excluded — the gate stays inert unless invoked.
- **Call content types** (`call-*`, `space-call-*`). WebRTC needs a different rig than the harness provides.
- **Fixing the two load-sensitive tests.** They are tolerated by the `RETRYABLE` list and reported as `FLAKY`; fixing them is its own issue.
- **The stale `vitest.security.config.ts` reference** in `vitest.config.ts`, which names a config and a `yarn test:security` script that do not exist. Unrelated cleanup.

---

_Last updated: 2026-08-22_

## Status (2026-08-23)

Built and committed, **not shipped**. Three branches named
`feat/verify-regression-gate` exist in quorum-desktop, quorum-shared and
quorum-mobile; nothing is pushed and no PR is open, at the operator's explicit
instruction.

The checkboxes above are per-step and were never ticked as work progressed —
read the git log on the branch rather than the boxes for what actually landed.

Done since this plan was written, and not covered by it:

- The gate was found to mint permanent, undeletable accounts and spaces on the
  production relay on every run. Fixed for accounts and for `space-delivery`;
  see [accounts](../.done/2026-08-23-harness-mints-permanent-accounts-every-run.md)
  and [space reuse](../.done/2026-08-23-harness-space-reuse-design.md).
- Every live arm has now been falsified — broken deliberately, watched go red,
  restored — which the original plan did not require of all of them.

Remaining before this can close:

1. The coverage and cost review in
   [2026-08-23-verify-gate-coverage-and-cost-review.md](2026-08-23-verify-gate-coverage-and-cost-review.md)
   — routing tightness, an audit of all 42 scenarios, wiring in the user-ops and
   authorization arms, and the `space-basic` decision.
2. Ship: one PR per repo. Held.

## Status (2026-08-24) — plan delivered, issue closed

Item 1 is **done** (that review is now in `.done/`), and so are the three
pre-ship fixes that came out of it
([2026-08-24-verify-gate-pre-ship-fixes.md](2026-08-24-verify-gate-pre-ship-fixes.md)).
Item 2 is the only thing left and is held at the operator's instruction —
tracked there, not here.

For how the tool behaves today, read
[verify-gate.md](../../docs/verify-gate.md), not this plan. A plan describes
intent at a point in time; four of its assumptions turned out to be wrong and
are listed in the design doc's Status section.

Last measured run before closing (plain `yarn verify`, commit `7716b77fa`):
**455s**, no SKIP rows, **0 new accounts**. `yarn verify --all` was also watched
end to end: all six live arms ran, `space-basic` PASS in 21s.

An independent adversarial review of the whole branch found one real defect —
the gate and the arms it spawns could disagree about which quorum-mobile was
under test — which is fixed and re-verified.

*Last updated: 2026-08-24*

*Last updated: 2026-08-23*
