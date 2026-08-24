---
type: doc
title: The verify gate — what `yarn verify` is and how to read it
status: done
ai_generated: true
created: 2026-08-24
updated: 2026-08-24
---

# The verify gate

## What it is, in one paragraph

`yarn verify` answers one question: **did this change break anything we know how
to check?** It looks at what your branch changed, works out which checks could
possibly notice that change, runs them across all three Quorum repos, and prints
a single screen ending in one word. You do not choose what runs. You do not
choose how deep it goes. Both follow from the diff.

```bash
yarn verify              # the normal one — routes itself, ~3 to 7.5 minutes
yarn verify --explain    # print the plan and stop. Instant, runs nothing.
yarn verify --fast       # skip the real-relay checks, for a quick look mid-work
yarn verify --all        # everything, including the arms held back. ~12 minutes
yarn verify --show-receipt   # what the last run did, and which commit it ran against
```

---

## Reading the verdict

The last line is the answer. There are four possible words and they mean
different things:

| Verdict | What it means | What to do |
|---|---|---|
| **`PASS`** | Everything that could observe your change ran, and nothing regressed. | Ship it. |
| **`PASS (PARTIAL)`** | **This run proved LESS than a full run would.** Something was skipped, or a whole area was not reachable. | Read the `⚠` lines underneath. Each names what was not covered and why. Decide whether that gap matters for your change. |
| **`FLAKY`** | A step failed and then passed on a retry. | Do not treat as green. Run again. If it flips twice, you have an intermittent bug, which is worth more attention than a solid one. |
| **`FAIL`** | Something broke. | Do not ship. The failing row names the step. |

**`PASS (PARTIAL)` means exactly one thing: reduced coverage.** Nothing else is
allowed to trigger it. That rule is load-bearing — a warning that fires when
nothing is wrong stops being read, and then it is not a warning.

### What you will actually see

MEASURED 2026-08-24, by change type:

| What you changed | Verdict when nothing is wrong |
|---|---|
| Desktop anything — styles, components, services | `PASS` |
| quorum-mobile anything | `PASS` |
| **quorum-shared anything** | **`PASS (PARTIAL)`, and correctly so** |

The quorum-shared case is not a wart. Desktop consumes shared through a symlink,
so it tests your local edit — but **mobile resolves the PUBLISHED
`@quilibrium/quorum-shared` from npm**, so mobile's tests ran against the
released package, not your change. That is genuinely reduced coverage, and the
run says so in one line:

```
  ⚠ shared changed, but mobile resolves the published @quilibrium/quorum-shared
    — mobile is NOT testing your change. Publish and bump before trusting it.
```

So for a shared change, `PASS (PARTIAL)` means: **desktop is clear, mobile is
unproven.** Ship it if the change is desktop-facing; publish and re-check before
relying on it for mobile.

### `KNOWN-RED` rows, and why they do not downgrade the verdict

A row can say `KNOWN-RED`:

```
  mobile   lint   KNOWN-RED   302 errors (known-red, baseline 302) — .agents/issues/.open/…
```

That is a step which **ran, failed, and failed exactly as recorded on main** —
breakage that was already there before you started, tracked in its own issue.
It did not prove less about your change, so it does not make the run partial.
The verdict line names them so a clean `PASS` can never sit silently above two
failing steps:

```
  VERDICT  PASS — nothing regressed in what this covers
           2 step(s) already broken on main, unchanged: lint, typecheck — not caused by this change
```

**If a known-broken step gets WORSE, the run FAILS.** 303 lint errors where 302
were recorded is a `FAIL`, loudly — the baseline is a ceiling, never a budget.
Baselines live in `scripts/verify/baseline.mjs`; the only edits that file should
ever see are lowering a number or deleting an entry.

> Changed 2026-08-24. `KNOWN-RED` used to force `PASS (PARTIAL)`. Since
> quorum-shared carries 1 known type error and quorum-mobile 302 known lint
> errors, that meant **every** cross-repo change reported PARTIAL for reasons
> unrelated to it, and the operator had to adjudicate three warning lines on
> every run to answer a question the verdict exists to answer.

---

## What it costs, and why

The trigger is an **allowlist** of things proven harmless — not a denylist of
things known to be risky. That direction is the whole design. A denylist rots
silently: somebody adds a new receive path, nobody lists it, coverage lapses and
there is no signal. An allowlist rots loudly: it costs an unnecessary six
minutes, which you notice immediately.

**So anything nobody has classified runs the full set, on purpose.**

| What you changed | What runs | Time |
|---|---|---|
| Docs, styles, images, translation catalogues, plain UI components | Fast tier only | ~3 min |
| Only quorum-mobile | Fast tier + the cross-client arm | ~4 min |
| Services, sync, storage, crypto, **or anything unrecognised** | Fast tier + live tier | ~7.5 min |
| Anything under `src/dev/tests/harness/` | Fast tier + full live tier | ~7.5 min |

Two edges worth knowing:

- **Translations are safe, the code that loads them is not.** `src/i18n/it/messages.po` is a fast-tier change; `src/i18n/i18n.ts` is not.
- **The harness is deliberately never "safe".** It IS the live tier's measuring equipment, so a change to it is precisely the change a live run has to check.

"What changed" means **this branch's commits plus any uncommitted work**, so
committing before you verify is fine. (Until 2026-08-23 it read only the working
tree, so a clean branch reported "no changes" and ran nothing at all.)

`yarn verify --explain` prints the plan in milliseconds without running
anything. Use it instead of guessing from this table.

---

## The two tiers

**Fast tier** — typecheck, lint, unit tests, build, across whichever repos are
in scope. Plus `harness-offline`, three scenarios that need no network.

**Live tier** — real bot clients, sending real messages, over the **production
relay**. This is why it costs minutes rather than seconds, and why it is not run
for a change that could not possibly affect delivery.

### Arms currently held back

Two live arms do not run on a per-change verify. Every run that leaves one out
prints a `HELD BACK` line naming it and saying why, so this can never quietly
become "nobody runs it". `yarn verify --all` runs both.

| Arm | Why it is held back |
|---|---|
| `space-basic` | Creates a permanent, undeletable Space every run. Unlike `space-delivery` it cannot reuse one, because creating a Space *is* its subject. |
| `cross-dm` | Reports a reproducible cross-client message loss whose cause is open — see [the issue](../issues/.open/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md). An arm red in most runs, for a reason unrelated to the change under test, would block every piece of work. |

Releasing either is two lines in `scripts/verify/steps.mjs`. The held-back set is
asserted **by value** in `src/dev/tests/verify/routing.test.ts`, so removing a
flag without updating the expectation fails the fast tier rather than passing
silently.

---

## ⚠️ Accounts and Spaces are permanent

**The relay has no delete endpoint for either.** Registrations do not expire.
Anything a scenario creates is there for good.

So a scenario must never mint either unless minting is the thing it measures:

- **Bot names are fixed, never stamped.** A timestamped name mints a new account
  every run. Reuse is safe because isolation never came from the identity —
  storage is in-memory `fake-indexeddb`, so every run starts from an empty
  database anyway. Per-run uniqueness comes from a stamp in the message
  **content**, which is free.
- **Call `drainInbox()` before `start()`**, so a reused inbox does not inherit
  frames the relay queued for an earlier run.

MEASURED 2026-08-24: a full `yarn verify` creates **zero** accounts and **zero**
Spaces. `yarn verify --all` creates one Space, via `space-basic`.

Full rules: `src/dev/tests/harness/README.md`.

---

## What it does NOT cover

Printed on every single run as a `NOT COVERED` line, so a `PASS` can never be
read as more than it is:

- role and permission gating — the harness cannot build one yet
- authorization — 10 forgery/scope scenarios exist, **none of them runs here**
- pin, an honoured mute, and DM profile updates — sent, never confirmed to land
- calling — zero coverage of all 9 WebRTC message types
- no end-to-end or integration test exists

The measured basis for that list is
[regression-coverage-map.md](regression-coverage-map.md), which classifies all
42 harness scenarios. Update both together when coverage actually changes.

---

## For agents

**Run `yarn verify` before reporting any code change complete, and paste the
verdict block verbatim.** Not a summary, not a subset of the rows. `PASS
(PARTIAL)` and `FLAKY` are not `PASS` and must never be reported as such.

## Where the pieces live

| File | Job |
|---|---|
| `scripts/verify/index.mjs` | Entry point. Resolves the repos, builds the plan, runs the steps. |
| `scripts/verify/routing.mjs` | The allowlist, and every "where is this repo" rule. Pure and unit-tested. |
| `scripts/verify/steps.mjs` | The step catalogue — what each tier runs, per repo. |
| `scripts/verify/runner.mjs` | Spawns steps, handles the one retryable arm, applies baselines. |
| `scripts/verify/report.mjs` | The verdict rules and the printed block. |
| `scripts/verify/baseline.mjs` | KNOWN-RED debt markers. A ceiling, not a budget. |
| `src/dev/tests/verify/` | 118 tests over all of the above, run in the fast tier. |

Design decisions and the measurements behind them:
[2026-08-23-verify-gate-coverage-and-cost-review.md](../issues/.done/2026-08-23-verify-gate-coverage-and-cost-review.md)
and [2026-08-24-verify-gate-pre-ship-fixes.md](../issues/2026-08-24-verify-gate-pre-ship-fixes.md).

*Last updated: 2026-08-24*
