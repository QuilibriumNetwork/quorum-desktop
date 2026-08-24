---
type: task
title: 'Three fixes to yarn verify before the branches ship'
status: open
priority: high
created: 2026-08-24
updated: 2026-08-24
---

# Three fixes to `yarn verify` before the branches ship

Written to be startable cold, immediately after a context compaction. Nothing
below depends on remembering the session that produced it.

## Where the work is

- Branch `feat/verify-regression-gate`, in the **linked worktree**
  `.worktrees/secondary` (not the main checkout).
- The same branch name exists in all three repos. All three are committed and
  clean; **nothing has been pushed and no PR exists.** The operator has held
  shipping deliberately.
- Read the git log, not the checkboxes in
  [2026-08-23-verify-gate-coverage-and-cost-review.md](2026-08-23-verify-gate-coverage-and-cost-review.md),
  which predate most of the work. That issue's `## Status` section is current.

Last measured full run (2026-08-23, plain `yarn verify` on this branch):
**383s, `PASS (PARTIAL)`, 0 new accounts, 0 new Spaces.** The `PARTIAL` is
item 2 below.

## Why these three, and not the bigger gap

The largest known coverage gap is that **ten authorization scenarios exist and
none of them runs in the gate** — and the operator ships mostly authorization
work. That is deliberately NOT in this issue. It is a project (each scenario
needs the identity fix plus space reuse before it can be allowed to run
automatically), and it does not block this batch.

These three do block it. Two of them would silently undo work already paid for,
and the third is an unverified path.

---

## 1. `cross-dm` is in the gate and still mints a permanent account every run

**Severity: this is the one that undoes previous work.** Two sessions were spent
making the live tier stop registering permanent, undeletable relay accounts. It
now mints zero — except here.

`src/dev/tests/harness/dm-cross.scenario.test.ts:64`:

```ts
const bot = await createBot(`cross-desktop-${ROLE}-${String(startedAt).slice(-6)}`);
```

The timestamp in the name mints a new account on every run. `cross-dm` is one of
the wired live arms (`scripts/verify/steps.mjs`, the `tier === 'live'` branch),
so on a normal checkout this fires on **every code change that reaches the live
tier**. It is invisible today only because of item 2: the arm cannot run from a
worktree, so it currently skips.

Mobile's half is already correct and needs no change:
`quorum-mobile/dev/harness/dm-two-bot.scenario.ts:74` uses the fixed
`dm-bot-${ROLE}`, and `quorum-mobile/dev/harness/identity.ts` persists it.

**The fix** is the same one already applied to `dm-delivery` and
`space-delivery`: drop the stamp, keep the drain. The drain is already
there (`bot.drainInbox()`, a few lines below the `createBot` call), and its
comment already states why it matters — "stale frames from an earlier run would
be counted as this run's arrivals". That is exactly the hazard a fixed identity
introduces, and it is already handled.

**Do not fix this before item 2.** The arm cannot run from this worktree, so a
change to it cannot be verified here, and an unverifiable change to a
loss-measuring scenario is not worth making. See the note on `harness/README.md`
below.

**How to know it worked** (all three, not one):

1. Run `yarn harness:cross` twice. Count `src/dev/tests/harness/.state/*.json`
   before and after: it must not grow. (It was 92 files when this was written.)
2. The loss numbers must still be sane. This scenario measures per-direction
   frame loss by joining ciphertext fingerprints; a reused identity that picked
   up stale frames would inflate `arrived`. Compare the two runs against each
   other.
3. Falsify it. Break something on the DM receive path, confirm the arm goes red,
   restore, confirm the production tree is byte-identical to HEAD
   (`git status --porcelain`).

Then update the "cost" column for `cross-dm` in
[regression-coverage-map.md](../docs/regression-coverage-map.md) (Bucket 1
table) and delete the `⚠️` callout above it, which describes this bug.

---

## 2. Two arms never run here, so every verdict says `PASS (PARTIAL)`

Full diagnosis and the exact fix already written up in
[2026-08-23-cross-client-harness-scripts-resolve-mobile-wrong-from-worktree.md](.open/2026-08-23-cross-client-harness-scripts-resolve-mobile-wrong-from-worktree.md).
Do not re-derive it; that file names the two offending lines and the function
that already solves the same problem correctly.

Short version: `run-cross.mjs` and `run-config-cross.mjs` resolve
`quorum-mobile` as `resolve(DESKTOP_REPO, '..')`, which is right from the main
checkout and wrong from a linked worktree. `mainCheckoutFrom()` in
`scripts/verify/routing.mjs` already fixes exactly this bug class and is
exported — reuse it rather than writing a second version.

**Why this is a ship blocker and not a nuisance.** The verdict vocabulary is
four words, and the whole design rests on `PASS (PARTIAL)` meaning "coverage was
reduced, look at why". On this machine it currently fires on **every single
run**, for a reason that is not about the change under test. A warning that is
always on is not a warning. Left in place through a merge, it trains everyone to
skim past the one signal the gate has for "this run proved less than you think".

**After fixing**, remove the matching skip block in `scripts/verify/index.mjs`
(search for the issue filename above; it is the `crossScriptMobilePath` guard,
which deliberately predicts the broken path so the run skips before paying for a
spawn it knows will fail). Then confirm a plain `yarn verify` reaches a bare
`PASS`, not `PASS (PARTIAL)` — that is the observable outcome.

Note the second, smaller defect recorded in that issue: both scripts print "or
set `HARNESS_MOBILE_REPO`" and neither script reads that variable. Either make
it real or stop promising it.

---

## 3. `yarn verify --all` has never been run since it changed

`space-basic` was moved off the per-change tier at the operator's instruction
(it creates a permanent, undeletable Space every run, and unlike
`space-delivery` it cannot reuse one, because creating a space IS its subject).
It now runs only under `--all`, marked `exhaustiveOnly` in `steps.mjs`.

That path has been verified on paper only — `yarn verify --explain --all` prints
the right plan, and unit tests cover `liveArmsFor`/`heldBackArms`. **Nobody has
watched it execute.** This repo's standing rule is that reasoning is not
verification, and `--all` is precisely the command someone is told to run before
shipping, so it should be known to work at least once.

Cost: about 7 minutes and **one permanent Space**. That is the whole price, it
is one-time, and it buys the only evidence that the pre-ship command works.

Run it last, after items 1 and 2, so the run also exercises those.

Expected: all six live arms present, `space-basic` among them with no `HELD
BACK` line, and the account-file count unchanged.

---

## Constraints that apply to all three

These are not negotiable and have each already caught a real problem:

- **Never mint accounts or Spaces unless minting is the subject.** Registration
  is permanent and there is no delete endpoint. Fixed bot names, `drainInbox()`
  before `start()`, per-run uniqueness from message content rather than from the
  identity. Full rule in `src/dev/tests/harness/README.md`.
- **Falsify before counting it as coverage.** Break the real code, watch the arm
  go red, restore, confirm the tree is byte-identical. An arm that has never
  been seen to fail is not evidence. Note that a change to `quorum-shared`
  requires `yarn build` there before it reaches desktop.
- **Include a control.** A falsification sweep that reports red for everything
  looks identical to a broken harness. This bit twice in one session: once a
  bad CLI flag made every mutant "pass", once a spawned test runner could not
  find its config. Both were caught only by a control arm.
- **Label claims MEASURED / READ / INFERRED.** Stating an inference in the voice
  of a measurement is the most damaging habit here, because the operator cannot
  tell them apart and will act on both.
- **Independent review** before shipping anything that changes test isolation or
  routing. Dispatch it in a fresh context; do not self-review. The review of the
  previous batch found a genuine critical defect (the safe list was clearing the
  file that owns the WebSocket) that self-review had missed, and one finding
  that did not hold up under mutation testing — check them, do not just apply
  them.

## Then, and only then

Ship: **one PR per repo, three PRs, do not merge.** Held by the operator until
explicitly released. Do not push before asking.

## Not in scope

- The ten authorization arms (see "Why these three" above). Next project.
- The two KNOWN-RED baselines, shared typecheck and mobile lint, tracked in
  their own issues and correctly classified by the gate.
- Anything in `.agents/issues/.open/` not linked from this file.

*Last updated: 2026-08-24*
