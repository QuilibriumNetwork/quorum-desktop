---
type: bug
title: "vitest intermittently runs 29 of 736 tests — the import phase collapses from ~98s to <1.2s"
status: open — observed twice on 2026-08-01, not yet reproduced on demand
priority: high (a test suite that under-reports coverage is worse than one that fails)
created: 2026-08-01
updated: 2026-08-01
severity: potentially silent — the first question below decides whether this is an annoyance or a trap
area: test infrastructure (vitest, desktop unit suite)
repos: quorum-desktop
related_docs:
  - "vitest.config.ts"
---

# vitest intermittently runs 4% of the suite

## §1. The symptom

A normal full run of `npx vitest run`:

```
Test Files  50 passed (50)
Tests       736 passed (736)
Duration    26.30s (transform 49.11s, setup 27.89s, import 98.46s, tests 10.42s, ...)
```

Twice on 2026-08-01 the same command instead produced **29 tests**, with the
**import phase collapsing by two orders of magnitude**:

| # | When | Reported | import phase | Preceding activity |
|---|---|---|---|---|
| A | during step-2 implementation | `Test Files 47 failed \| 3 passed (50)` / `Tests 29 passed (29)` | **1.16s** | a full `npx jest` run in `quorum-mobile` executing in parallel |
| B | immediately after merging PRs #288/#289 | `Tests 29 passed (29)` — ⚠️ `Test Files` line truncated by `tail -4`, **not known** | **707ms** | two `gh pr merge` operations had just completed |
| C | step-3, **single-file run** | `Test Files 1 failed (1)` / `Tests no tests` | **0ms** | had just written `src/db/messages.ts` |
| D | step-3, full run | `Test Files 48 failed \| 3 passed (51)` / `Tests 29 passed (29)` | **576ms** | `yarn build` in `quorum-shared` (a `link:` dependency) |
| E | step-3, full run | `Test Files 48 failed \| 3 passed (51)` / `Tests 29 passed (29)` | **700ms** | `yarn build` in `quorum-shared` |

Every time:

- **exactly 29 tests** in the full-suite cases, which strongly suggests the *same*
  3 files survive rather than a random subset;
- an immediate re-run with **no code change** was fully green.

**Occurrence C matters most**: it was a SINGLE-file run with nothing else
executing, which rules out "concurrent load" as a necessary condition and rules
out any theory that needs many workers.

### ⛔ A tempting correlation that does NOT hold

D and E both followed a `quorum-shared` rebuild, which made "rebuild a `link:`ed
dep → next run collapses" look deterministic. **It was tested twice and failed to
reproduce both times** — rebuild followed immediately by a single-file run, and
by a full run, were both clean (51 files, 744 tests). So the rebuild is at most a
contributing factor, not a trigger. Do not start from this hypothesis.

An import phase of <1.2s against a normal ~98s means the modules were never
really imported — the files are erroring at import time, not failing assertions.

## §2. The question that decides how bad this is

> **Does the flaked run exit non-zero?**

Occurrence A clearly reported `47 failed`, so that one is loud and CI would catch
it. Occurrence B's `Test Files` line was lost to a `tail -4`, so it is **unknown**
whether it reported failures or presented as a clean pass.

- If it always fails loudly → this is an annoyance and a CI-retry problem.
- If it can report success while running 4% of the tests → it is a **trap**: a
  green suite that proves almost nothing, and every "736 tests pass" claim made
  around it becomes unreliable.

**Answer this first.** Everything else is secondary.

## §3. What is known about the environment

| | |
|---|---|
| vitest | 4.1.2 |
| node | v22.23.1 |
| platform | win32-x64, 12 logical CPUs |
| environment | `jsdom`, `globals: true`, `setupFiles: src/dev/tests/setup.ts` |
| notable config | `server.deps.inline: ['@quilibrium/quilibrium-js-sdk-channels']` — a heavy WASM SDK force-inlined for every file that touches it |
| pool | not configured, so vitest's default |

## §4. Hypotheses, cheapest first

1. **Vite dependency-optimization cache invalidation.** Best fit for ALL five: A,
   B, D and E followed something that touches disk under `node_modules` or the
   project tree, and C followed a source write. If `node_modules/.vite` is being
   re-optimized and a run starts during that window, every import fails while the
   optimizer holds the cache. Cheapest check: delete `node_modules/.vite` and see
   whether the very next run reproduces it.
2. **Worker pool starvation or crash.** A worker dying during module resolution
   gives exactly this shape. ⚠️ Weakened by occurrence C, a single-file run with
   nothing else executing.
3. **Windows file-handle exhaustion (`EMFILE`).** Windows is markedly less
   forgiving than Linux. Same weakening from C.
4. **The inlined WASM SDK.** `server.deps.inline` forces
   `@quilibrium/quilibrium-js-sdk-channels` through transform for every importer.
   If resolving or instantiating it fails transiently, every file that imports it
   fails at import — which would neatly explain why a small, fixed set of files
   (those that do *not* touch the SDK) survives.

Hypothesis 4 predicts the surviving 3 files share the property of not importing
the SDK. That is cheap to check and would discriminate 4 from 1-3.

## §4b. 🔵 STRONGEST LEAD — the same signature reproduced ON DEMAND, from a drive-letter mismatch

Later on 2026-08-01, running vitest from inside the secondary worktree produced
**exactly this signature deliberately**:

```
Error: Cannot find module '/@fs/E:/GitHub/Quilibrium/quorum-desktop/.worktrees/secondary/src/dev/tests/setup.ts'
 Test Files  1 failed (1)
      Tests  no tests
   Duration  1.92s (transform 0ms, setup 0ms, import 0ms, ...)
```

Note `import 0ms` and `Tests no tests` — the collapsed-run fingerprint from §1.

**Cause:** the command was issued with a cwd of `D:/GitHub/.../worktrees/secondary`
while the file resolved through `E:/GitHub/.../worktrees/secondary`. Both paths
reach the same directory (one is an NTFS junction), but Vite's `/@fs/` resolution
and its `server.fs.allow` list compare paths as STRINGS, so the two spellings do
not match and every module fails to resolve. Re-running the identical command
from the `E:` spelling passed immediately (2 files, 21 tests).

**Why this is the best lead for §1.** `git worktree list` reports the worktree
under `D:/`, so any tooling that takes git's word for the path and any human or
agent that copies it gets the wrong spelling. `.worktrees/` is a cross-drive
junction sitting INSIDE the project root — which is also exactly what broke
`yarn lint` for every file until `.worktrees/**` was added to the eslint ignores
(PR #287). Two separate tools have now mis-walked this directory.

**Cheapest test:** run the full suite from the `E:` spelling and from the `D:`
spelling and compare. If the flake in the MAIN repo has the same root, expect it
to correlate with something resolving a path through the junction rather than
with load or concurrency — which would also explain occurrence C (a single-file
run with nothing else executing, which no concurrency theory survives).

⚠️ Not yet proven for the MAIN repo: every main-repo run in this session used
the `E:` spelling and none of them collapsed. So this is a confirmed mechanism
that produces an identical signature, not yet a confirmed cause of §1.

## §5. Diagnosis plan

- [ ] **Capture a full flaked run.** Loop `npx vitest run` under artificial load
      (run the mobile jest suite, or several CPU hogs, in parallel) and tee the
      COMPLETE output plus `echo "exit=$?"`. Do not `tail` it — that is how
      occurrence B lost its most important line.
- [ ] **Record the exit code** (§2).
- [ ] **Identify the 3 surviving files**, and check whether they import
      `@quilibrium/quilibrium-js-sdk-channels`.
- [ ] **Capture the actual import-time error** for one failing file. It will be in
      the full output; occurrence A's was never read because the summary was
      grepped for `FAIL` and the run was assumed to be environmental.
- [ ] Try `--pool=forks` vs `--pool=threads`, and `poolOptions.maxForks`, to see
      whether constraining concurrency removes it.
- [ ] Check whether `quorum-shared` is being rebuilt by anything concurrent — its
      `dist` is a resolved dependency here, and rebuilding it mid-run would
      invalidate modules under the runner's feet.

## §6. Why this is filed rather than shrugged off

Every claim made about this work on 2026-08-01 — "720 tests pass", "728", "736" —
rests on this suite being honest about how much it ran. Two of roughly eight full
runs that day were not. The failure mode is unusually deceptive because the
headline number (`29 passed`) is still all-green; only the file count and the
implausible import duration give it away, and both are easy to miss when a
command is piped through `tail`.

**Practical mitigation until it is understood:** when quoting a suite result,
quote the **file count** alongside the test count (`50 files, 736 tests`), not the
test count alone. A collapsed run is instantly obvious that way and invisible
otherwise.

---
*Last updated: 2026-08-01*
