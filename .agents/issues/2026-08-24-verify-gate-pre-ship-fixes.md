---
type: task
title: 'Three fixes to yarn verify before the branches ship'
status: in-progress
priority: high
created: 2026-08-24
updated: 2026-08-24
---

# Three fixes to `yarn verify` before the branches ship

Written to be startable cold, immediately after a context compaction. Nothing
below depends on remembering the session that produced it.

## Status

**All three done, 2026-08-24.** Commits `79080e5fa`, `f26ed9c43`, `f7edfce42`,
`216b950a9`. Still unshipped — nothing pushed, no PRs.

| item | outcome |
|---|---|
| 2. mobile path bug | Fixed in **four** call sites, not two — see below. `config-cross` now PASS in 33s where it had always been SKIP. No SKIP rows remain. |
| 1. `cross-dm` minting | Fixed. MEASURED: account files went 94 → 95 (one-time mint of the fixed name) then stayed at 95 across five more runs. |
| 3. `yarn verify --all` | MEASURED end to end. All six arms ran, `space-basic` PASS in 21s, no HELD BACK lines, verdict `FAIL` — because `cross-dm` found a real loss. |

**Two things went wider than this issue predicted.**

The path bug was in **four** files, not two: `config-cross.scenario.test.ts:36`
and `config-from-mobile.scenario.test.ts:34` carried it as well. Fixing only the
two `.mjs` orchestrators would have moved the failure one layer down — mobile
found, scenario spawned, scenario dead on a state file it looked for inside
`.worktrees/`. The first version of the contract test scanned only `.mjs` and
would have reported everything fine.

And `cross-dm`, once runnable, immediately reported a reproducible message loss
(5 of 6 runs, always the first echo desktop sends). Mechanism found the same
day: mobile receives desktop's X3DH session-initiation frame, cannot decrypt it
against the session it already holds, and drops it. Filed as
[2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md](.open/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md).
The arm is held back to `--all` until that resolves.

Two reporting defects were found and fixed along the way: the held-back reason
was hardcoded to "it creates a permanent Space" (wrong for the second arm), and
a FAIL row printed "arms green" because the extractor matched the *other*
repo's test-runner output.

**Independent adversarial review: done.** It found one real defect, and it was
one this branch created. Making `HARNESS_MOBILE_REPO` real meant the harness
honoured it while `index.mjs` still computed its own sibling path — so with the
variable set to a different checkout, the gate would diff repo A, find it
present, run the cross-client arms, and the arms would test repo B. A green run
that never executed the code that triggered it. Fixed in `7716b77fa`: the rule
moved to `routing.mjs`, the gate asks it instead of computing, and the answer is
exported to every spawned child. MEASURED — both resolvers now return the same
path with and without the override.

The review confirmed as correct: the `drainInbox()`-before-`start()` ordering
(the calls are plain signed HTTP, independent of the websocket), the fixed bot
name (storage is in-memory per process, so isolation never came from the
identity), the `harnessDetail` status threading, the `SAFE`/`SAFE_ALONE`
carve-outs checked against all three real checkouts, and every reachable
`liveScope` × `exhaustive` combination.

It also raised one cosmetic issue, filed separately as
[2026-08-24-verify-detail-column-blank-for-the-vitest-driven-arms.md](.open/2026-08-24-verify-detail-column-blank-for-the-vitest-driven-arms.md).

**One more fix came out of explaining the tool to the operator.** Asked how to
read the verdict, the honest answer was "it says `PASS (PARTIAL)` on every
cross-repo change and you have to adjudicate three warning lines yourself" —
which is the same defect this branch spent the day removing elsewhere: a warning
that fires when nothing is wrong stops being read.

MEASURED, per change type:

| Change | Best possible verdict, before |
|---|---|
| desktop-only | `PASS` |
| touches quorum-shared | **always `PASS (PARTIAL)`** |
| touches quorum-mobile | **always `PASS (PARTIAL)`** |

Cause: quorum-shared carries 1 known type error and quorum-mobile 302 known
lint errors, both already on main and both tracked. `KNOWN-RED` forced PARTIAL,
so those two made every cross-repo run partial for reasons unrelated to the
change under test.

Fixed: `PASS (PARTIAL)` now means exactly one thing — **this run proved less
than a full run would**. A `KNOWN-RED` step ran and returned the tracked result,
so it proved nothing less and no longer downgrades the verdict; it is named on
the verdict line instead. A step that gets WORSE than its baseline still FAILs,
and that path is pinned by a test with a control beside it. Falsified: restoring
the old severity list turns both new assertions red while the FAIL/FLAKY/SKIP
guards stay green.

Documentation written at the same time:
[.agents/docs/verify-gate.md](../docs/verify-gate.md) — the verdicts, the costs,
the held-back arms, the permanence rules, and what the gate does not cover.

MEASURED after the change, same four change types:

| Change | Verdict now |
|---|---|
| desktop styles | `PASS` |
| a desktop service | `PASS` |
| a mobile screen | `PASS` |
| a quorum-shared util | `PASS (PARTIAL)` — **correctly** |

That last one is not a leftover. A quorum-shared change genuinely IS partial:
mobile resolves the PUBLISHED `@quilibrium/quorum-shared`, so mobile's tests did
not exercise your local edit. The run now says exactly that, in one line,
instead of burying it under two that did not apply.

**Final measured run** (plain `yarn verify`, this branch): **482s**, no SKIP
rows, **0 new accounts**, verdict `PASS (PARTIAL)` with the KNOWN-RED steps
listed as informational and one genuine `⚠`:

```
  VERDICT  PASS (PARTIAL) — reduced scope, see the warnings below
           2 step(s) already broken on main, unchanged: typecheck, lint — not caused by this change
           ⚠ shared changed, but mobile resolves the published @quilibrium/quorum-shared — mobile is NOT testing your change.
           ⚠ This does NOT clear a change that touches shared or the wire.
```

## ✅ Ship was BLOCKED on a design question — now unblocked

The three fixes in this issue were never the blocker.

While explaining the tool to the operator, a harder question surfaced: **what
happens when other developers' agents start running this?** Measured, and the
answer was bad enough to hold the PRs:

**A fresh checkout mints 6 permanent accounts and 1 permanent Space on the
production relay, on its first run.** Fixed bot names solved the per-machine
half of this; they did nothing about the number of machines, because `.state/`
is gitignored and cannot be otherwise. CI would be worse — an ephemeral
filesystem means every job pays it again, unbounded — though MEASURED
2026-08-24, none of the three repos has any CI at all today.

**Resolved 2026-08-24 by the mint guard** (`scripts/verify/mintGuard.mjs`): a
live arm runs only if the identities it reuses already exist, so a fresh clone
skips them all and registers nothing, while this machine is unaffected.
`--live-allow-minting` opts in. Full measurement, the options considered and why
C+B was chosen:
[2026-08-24-verify-mints-permanent-state-on-every-fresh-checkout.md](.done/2026-08-24-verify-mints-permanent-state-on-every-fresh-checkout.md).

The real fix — pointing the harness at a non-production relay — stays open, and
needs one question answered by whoever runs the relay. The harness side is
already done (`env.ts:48-49`).

## Also landed while unblocking

Neither was in this issue's scope; both came out of mapping the system.

- **quorum-mobile now typechecks.** It had no `typecheck` script, so nothing ran
  one automatically. Added, wired in, and recorded as `KNOWN-RED` at a baseline
  of 11 — the errors are untouched, but the count can now only fall.
  [Issue](.open/2026-08-24-mobile-typecheck-11-errors.md).
- **`plan.notes`, a second reporting channel.** `⚠` (reduced coverage, forces
  PARTIAL) is now separate from `ℹ` (advisory, costs the verdict nothing). The
  stale-exemption warning moved to `ℹ`, because a step going GREEN must never
  make the run report worse — the same rule that stopped `KNOWN-RED` downgrading
  the verdict. A new `ℹ` asks for a baseline to be lowered when a count improves,
  so a partial fix cannot silently leave the ceiling too high.
**That decision comes before the PRs**, because merging is precisely the act
that hands this behaviour to everyone else.

Two smaller gaps found in the same pass, not blockers:
[cross-repo tooling gaps](.done/2026-08-24-verify-gate-cross-repo-tooling-gaps.md)
— quorum-shared's `lint` script names a tool the repo has never had, and
quorum-mobile has never been typechecked by anything (11 errors, 10 of them in
the calling code the gate already reports as untested).

**Remaining before ship:** resolve the minting question, then one PR per repo,
three PRs, do not merge. Held.

## Where the work is

- Branch `feat/verify-regression-gate`, in the **linked worktree**
  `.worktrees/secondary` (not the main checkout).
- The same branch name exists in all three repos. All three are committed and
  clean; **nothing has been pushed and no PR exists.** The operator has held
  shipping deliberately.
- Read the git log, not the checkboxes in
  [2026-08-23-verify-gate-coverage-and-cost-review.md](.done/2026-08-23-verify-gate-coverage-and-cost-review.md),
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
[2026-08-23-cross-client-harness-scripts-resolve-mobile-wrong-from-worktree.md](.done/2026-08-23-cross-client-harness-scripts-resolve-mobile-wrong-from-worktree.md).
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
spawn it knows will fail).

> ⚠️ **The success criterion below was wrong when written.** It said "confirm a
> plain `yarn verify` reaches a bare `PASS`, not `PASS (PARTIAL)`". That was not
> achievable and never had been: READ `scripts/verify/report.mjs:25-36`, a
> KNOWN-RED row renders `PASS (PARTIAL)` by design, and this branch has two
> (`shared:typecheck`, `mobile:lint`). The 2026-08-23 run was going to say
> PARTIAL whatever happened to the cross-client arms.
>
> **The right criterion is "no SKIP rows"**, and that is what was MEASURED on
> 2026-08-24: `config-cross` PASS in 33s where it had always been SKIP, no SKIP
> row anywhere in the table, 0 new accounts. The residual PARTIAL now comes from
> the two tracked KNOWN-RED baselines plus the shared/mobile publish-asymmetry
> warning — all of which are the gate correctly reporting real gaps, not a
> broken path.

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
