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

yarn verify --live-allow-minting   # rarely. See "Accounts and Spaces are permanent".
```

---

## How this relates to "the tests"

**It is not a separate tool from the test suites. It is the thing that runs
them.** When an agent used to report "1808 tests pass", that was
`yarn test:run` — which is now one row inside `yarn verify`.

```
yarn verify
│
├── quorum-shared     build · typecheck · unit (766 tests)
│
├── quorum-desktop    typecheck · lint · unit (1808 tests)   ← "the tests"
│                     harness-offline · build
│
├── quorum-mobile     lint · typecheck · unit (1222 tests)
│
└── live tier         dm-basic · dm-delivery · space-delivery · config-cross
                      real bots, real messages, real relay
                      (auto-skipped where it would mint — see below)
```

**One command at the end of a change. Nothing else.**

`yarn verify` exists in all three repos, but the two siblings just delegate to
desktop's orchestrator (`quorum-shared/scripts/verify.mjs`,
`quorum-mobile/scripts/verify.mjs`). Same tool, three entry points — so it does
not matter which repo you happen to be standing in. If quorum-desktop is not
checked out beside them, they fall back to that repo's own fast tier and say so.

### Is it wasteful, if agents already lint and typecheck as they work?

Slightly, and deliberately. Two different jobs:

- **While working**, run `tsc --noEmit` and `eslint` directly. That is ~50s of
  fast feedback on desktop and it is the right tool for the loop.
- **Before reporting done**, run `yarn verify`. It re-runs them.

The duplication is under a minute, and it buys the property that matters: **the
gate does not trust that somebody already ran something.** A gate that skips a
check because it assumes it was covered is not a gate. If you want a middle
option, `yarn verify --fast` runs the whole fast tier across all three repos
without touching the relay.

### What it does not run

| Command | Why not |
|---|---|
| `yarn bench` | Load-generating benchmarks. Running them alongside makes timing-sensitive tests flaky — documented in `vitest.config.ts`. |
| `yarn format:check` | Cosmetic. A gate that goes red over a blank line teaches people to ignore red. |
| `yarn validate` | Redundant — it is `tsc --noEmit && eslint .`, both already steps. |
| quorum-shared `lint` | The script exists but the repo has no eslint installed, no config and no dependency. Tracked: [cross-repo tooling gaps](../issues/.open/2026-08-24-verify-gate-cross-repo-tooling-gaps.md). |

quorum-mobile's typecheck **used** to be on this list. It had no script at all,
so nothing ever ran one automatically. Added 2026-08-24 and wired in as a
`KNOWN-RED` step at a baseline of 11 — the errors stay unfixed (10 are in the
untested `services/calling/`), but the count can now only go down. See
[the issue](../issues/.open/2026-08-24-mobile-typecheck-11-errors.md).

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

### If you fix some of them, do you have to edit anything?

**No — the run stays green either way, and the gate tells you what to do.**

| You fixed | Verdict | What the run says |
|---|---|---|
| some of them (11 → 7) | still green | `ℹ down to 7 from a recorded baseline of 11 — lower it in baseline.mjs` |
| all of them | still green | `ℹ that exemption is now stale and must be deleted` |
| none, but added one | **`FAIL`** | the count exceeded its ceiling |

Nothing breaks if you ignore the `ℹ` line, so a partial fix never costs you a
red. But the recorded ceiling would still be 11, so drifting back up to 11 would
pass unnoticed — the note asks for the one-word edit that locks the gain in.

`ℹ` and `⚠` are different on purpose. **`⚠` lines are why the verdict says
PARTIAL** and you have to decide whether the gap matters. **`ℹ` lines cost the
verdict nothing** — they are housekeeping the run noticed. An improvement must
never make the report look worse, which is the same rule that stopped `KNOWN-RED`
rows downgrading the verdict.

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

### The mint guard: why a fresh clone runs no live arms

Fixed bot names bounded the cost **per machine**, not globally. The identities
live in `src/dev/tests/harness/.state/`, which is **gitignored** — it holds real
private keys — so a different machine starts empty and mints the lot. MEASURED
2026-08-24 on a simulated fresh checkout: **6 accounts and 1 Space** on the first
plain `yarn verify`, and a CI runner would pay that on *every* job, because its
filesystem is wiped each time.

So before running any live arm, the gate asks the only question that matters:
**would this arm create permanent state that does not already exist?** It answers
by checking for the identity files the arm reuses
(`scripts/verify/mintGuard.mjs`).

| Machine | `.state/` | What happens |
|---|---|---|
| The maintainer's | populated | every arm runs, exactly as before — **no change** |
| A fresh clone | empty | arms skipped, reason printed, `PASS (PARTIAL)`, **nothing minted** |
| CI | empty | same |

MEASURED 2026-08-24, `--explain` with the state directory temporarily moved
aside — and with the populated directory as the control:

```
  LIVE ARMS  (none)
  MINT-GUARD dm-basic, dm-delivery, space-delivery, config-cross
             (no persisted identities — would register permanent production state)
```

The check is deliberately about **state, not identity** — "would this mint?",
never "who is running this". A machine-identity check answers a question that
merely *correlates* with the one we care about, and correlations drift.

For bot accounts that means checking the identity files, which is the same
condition `identity.ts` uses. **For Spaces it needs more**, and the first version
of the guard wrongly claimed otherwise. Adversarial review found three ways a
file could sit on disk while `space-delivery` still created a permanent Space, so
the guard now mirrors `restoreSharedSpace` instead of approximating it:

| Situation | Old guard | Now |
|---|---|---|
| Only the victim's space file present | **said safe → minted a Space** | blocked |
| A space file present but truncated | **said safe → minted** | blocked |
| The two files naming different spaces | **said safe → minted** | blocked |
| `HARNESS_FRESH=1` with every file present | **said safe → minted** | blocked, naming the env var |

`HARNESS_FRESH` is the one most likely to bite: the harness's own docs recommend
setting it for clean-room reproduction, and nothing in `scripts/verify/` clears
it.

Same class of bug in the other arm. **`cross-dm` chooses its bot names from
`HARNESS_DESKTOP_ROLE`** — desktop `a` implies mobile `b`, and both names change
together. The guard had the default pair hardcoded, so with that variable
exported in the shell it cleared the arm and the run minted **two** accounts, one
per platform. The role rule now lives in one place (`routing.mjs`'s
`crossRoles`), imported by both `run-cross.mjs` and the guard, so they cannot
disagree. MEASURED, with a control:

```
  (default)                LIVE ARMS  … cross-dm …
  HARNESS_DESKTOP_ROLE=a   MINT-GUARD cross-dm
  HARNESS_FRESH=1          MINT-GUARD space-delivery
```

**An arm the guard does not recognise is treated as minting** and held back. Note
this is the opposite of the routing allowlist, which fails toward running MORE:
there an unnecessary six minutes is cheap, here the mistake is irreversible.
`mintGuard.test.ts` fails the fast tier if a live arm has no entry, if a declared
bot no longer exists in its scenario, or if a scenario creates a bot nobody
declared.

**`--live-allow-minting` opts in.** It is deliberately NOT implied by `--all`:
`--all` is a statement about coverage, this is a statement about accepting an
irreversible side effect on production, and the two are consented to separately.

> Still unsolved, and the real fix: point the harness at a **non-production
> relay**. The client half already exists — `env.ts:48-49` reads `QUORUM_API_URL`
> and `QUORUM_WS_URL`, so switching is two environment variables. What is missing
> is a relay server to point at. Tracked in
> [the minting issue](../issues/.done/2026-08-24-verify-mints-permanent-state-on-every-fresh-checkout.md).

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
| `scripts/verify/mintGuard.mjs` | Refuses live arms that would register permanent production state. |
| `src/dev/tests/verify/` | 151 tests over all of the above, run in the fast tier. |

Design decisions and the measurements behind them:
[2026-08-23-verify-gate-coverage-and-cost-review.md](../issues/.done/2026-08-23-verify-gate-coverage-and-cost-review.md)
and [2026-08-24-verify-gate-pre-ship-fixes.md](../issues/2026-08-24-verify-gate-pre-ship-fixes.md).

*Last updated: 2026-08-24*
