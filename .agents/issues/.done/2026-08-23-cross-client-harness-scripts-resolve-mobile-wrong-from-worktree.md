---
type: bug
title: 'run-cross.mjs / run-config-cross.mjs resolve quorum-mobile wrong from a linked worktree'
status: done
priority: medium
created: 2026-08-23
updated: 2026-08-24
---

# run-cross.mjs / run-config-cross.mjs resolve quorum-mobile wrong from a linked worktree

## Status

Fixed 2026-08-24, commit `79080e5fa`. `src/dev/tests/harness/mobileRepo.mjs`
now resolves the path once, reusing `mainCheckoutFrom()`, and honours
`HARNESS_MOBILE_REPO` — the escape hatch the error messages had always promised
and no script read. The gate's matching skip guard is gone.

**Wider than this issue described.** Two `.ts` scenarios carried the identical
bug (`config-cross.scenario.test.ts:36`, `config-from-mobile.scenario.test.ts:34`)
and are fixed too. Fixing only the two `.mjs` orchestrators would have moved the
failure one layer down — mobile found, scenario spawned, scenario dead on a
state file it looked for inside `.worktrees/`.

MEASURED after the fix, from the worktree: `yarn harness:config-cross` passes
both directions in 34.6s, and `yarn harness:cross` reaches the relay and
exchanges real messages. Both had been skipped on every run.

`src/dev/tests/verify/mobileRepo.test.ts` guards it: 7 unit cases plus a
source-level contract, derived from disk, that no harness file may build its
own path to quorum-mobile.

⚠️ The first thing `cross-dm` did once it could run was report a reproducible
message loss — see
[2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md](../.open/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md).
That is a separate finding, not a regression from this fix.

## Symptoms

`yarn harness:cross` and `yarn harness:config-cross` both fail immediately,
before doing any real work, when desktop is checked out as a linked worktree
(e.g. `.worktrees/secondary`):

```
[cross] FAIL — quorum-mobile not found at E:\GitHub\Quilibrium\quorum-desktop\.worktrees\quorum-mobile.
        The two repos must be siblings, or set HARNESS_MOBILE_REPO.
```

```
[config-cross] quorum-mobile not found at E:\GitHub\Quilibrium\quorum-desktop\.worktrees\quorum-mobile
[config-cross] both repos must be checked out side by side.
```

MEASURED 2026-08-23, twice over: first as four of six live-tier steps inside
`yarn verify --all` (both failed, `desktop:cross-dm` and `desktop:config-cross`,
after `dm-basic`/`dm-delivery`/`space-basic`/`space-delivery` all recovered
following the Task 12 diagnosis of an unrelated resource-pressure issue), then
again running each standalone (`yarn harness:cross`, `yarn harness:config-cross`)
from the same worktree — identical error both times. That rules out sequencing
or load: this is not residue of the resource-pressure problem fixed alongside
it, it is a separate, pre-existing bug that only a worktree checkout exposes.

## Root Cause

`src/dev/tests/harness/run-cross.mjs:20-22` and
`src/dev/tests/harness/run-config-cross.mjs:33-34`:

```js
const DESKTOP_REPO = resolve(HERE, '../../../..');
const MOBILE_REPO = resolve(DESKTOP_REPO, '..', 'quorum-mobile');
```

`resolve(HERE, '../../../..')` correctly lands on the desktop checkout root
regardless of whether that root is the main checkout or a linked worktree. The
bug is the next line: it assumes the sibling repos (`quorum-shared`,
`quorum-mobile`) live one level up from *that* root. True for the main
checkout (`quorum-desktop/..` is where the siblings actually are), false for a
linked worktree (`quorum-desktop/.worktrees/secondary/..` is just
`.worktrees/`, not the checkout's real parent).

This is the identical bug class `scripts/verify/routing.mjs`'s
`mainCheckoutFrom()` was written to fix (see that function's own header
comment, dated 2026-08-22, for the same "the brief has the caller default
siblings to `resolve(desktop, '..')`, which is wrong from a linked worktree"
diagnosis) — it was just never applied to these two scripts, which predate
that fix and live outside `scripts/verify/`.

A second, smaller issue in the same spot: the error text says "or set
`HARNESS_MOBILE_REPO`", but neither script actually reads that environment
variable anywhere. It's a promised escape hatch that doesn't exist.

## Current handling

As of Task 12 (`scripts/verify/index.mjs`), `yarn verify` predicts the exact
broken path these scripts will independently compute and proactively marks the
`cross-dm` and `config-cross` live steps `skipped(...)` with a reason naming
this issue, rather than letting them fail (or silently omitting them). That
downgrades the verdict to `PASS (PARTIAL)` and states the gap on every run.
This is a workaround in the gate, not a fix — see Prevention.

## Prevention

Apply the same fix `routing.mjs`'s `mainCheckoutFrom()` already contains
(resolve the MAIN checkout via `git rev-parse --git-common-dir`, not a bare
`resolve(desktop, '..')`) to `run-cross.mjs` and `run-config-cross.mjs`, or
make `HARNESS_MOBILE_REPO` a real, read environment variable overriding
`MOBILE_REPO` in both scripts. Once either ships, remove the corresponding skip
condition in `scripts/verify/index.mjs` (search for this issue's filename) so
the live tier stops reflexively skipping these two arms from a worktree.
