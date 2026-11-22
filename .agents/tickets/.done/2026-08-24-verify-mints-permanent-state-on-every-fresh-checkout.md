---
type: bug
title: 'verify: every fresh checkout mints permanent accounts and a Space on the production relay'
status: done
priority: high
created: 2026-08-24
updated: 2026-08-24
---

# `verify` mints permanent state on every fresh checkout

## Status

**Fixed 2026-08-24 by option C + B — the mint guard.** Ship is no longer blocked.

`scripts/verify/mintGuard.mjs` asks, before every live arm, whether running it
would create permanent state that does not already exist, and skips it if so.
`--live-allow-minting` opts in, and is deliberately not implied by `--all`.

MEASURED the same day, with a control:

| Machine | `--explain` output |
|---|---|
| This one (95 identity files) | `LIVE ARMS dm-basic, dm-delivery, space-delivery, config-cross` — unchanged |
| Same machine, `.state/` moved aside | `LIVE ARMS (none)` + `MINT-GUARD` naming all four |

So a fresh checkout registers **nothing**, and the maintainer's workflow is
byte-identical to before. Covered by 26 tests in
`src/dev/tests/verify/mintGuard.test.ts`, falsified by mutation.

### Independent review found three defects in the first version — all fixed

Dispatched an adversarial review specifically asked to hunt for the DANGEROUS
direction: can the guard report an arm safe while it would in fact mint? It found
three, all confirmed by reading the source, all fixed and each falsified by
reverting the fix and watching the suite go red.

| # | Defect | Consequence |
|---|---|---|
| 1 | `space-delivery` declared only the VICTIM's space file | `restoreSharedSpace` is all-or-nothing (`snaps.some((s) => !s)`), so a machine missing just the SENDER's file was cleared and left a permanent Space |
| 2 | `cross-dm`'s bot names hardcoded to the default role | `HARNESS_DESKTOP_ROLE=a` (which `runner.mjs` passes through, since it spawns with no `env` override) makes the arm use `cross-desktop-a` + `dm-bot-b` — **two** accounts minted under a clean report |
| 3 | Existence treated as sufficient for space reuse | `HARNESS_FRESH=1` skips restore before reading anything; an unparseable file, or two files naming different spaces, also fall through to create |

Root cause was one modelling error, not three: `STATE_BY_ARM` described "the
identities this arm reuses" as **one fixed list per arm**, and that cannot
represent state which depends on the environment. Entries are now functions of
`env`, the role rule lives in `routing.mjs` and is imported by both the guard and
`run-cross.mjs`, and the space check mirrors `restoreSharedSpace`'s four
bail-outs rather than approximating them.

Worth recording plainly: **the first version shipped with 141/141 tests green.**
The tests only ever asked whether declared names still existed in the scenarios,
so they were structurally incapable of noticing a name that should have been
declared and was not. Green was consistent with the bugs, not evidence against
them. MEASURED end to end afterwards, with a control:

```
  (default)                LIVE ARMS  … cross-dm …
  HARNESS_DESKTOP_ROLE=a   MINT-GUARD cross-dm
  HARNESS_FRESH=1          MINT-GUARD space-delivery
```

**Option A was NOT taken and remains the real fix.** Ruled out for now on the
operator's information (2026-08-24): the harness's client half already supports
it — `env.ts:48-49` reads `QUORUM_API_URL` / `QUORUM_WS_URL`, so switching
endpoints is two environment variables — but there is no relay server available
to point at, and the lead who would know is unavailable. quorum-mobile's "local
API" setting in user settings is the same client-side switch, which is evidence
a relay runs somewhere, not that one is obtainable. **One question resolves it:
"is there a relay we can run locally, or a staging endpoint?"** If the answer is
yes, this whole issue evaporates and the guard becomes unnecessary.

Also worth recording, MEASURED 2026-08-24: **none of the three repos has any CI**
(no `.github/workflows` in desktop, mobile or shared). The unbounded-CI-growth
scenario below was therefore hypothetical, not live. The per-developer cost was
real.

## ⚠️ This was a ship blocker for the verify gate

Not because it is broken here. Because **shipping it hands the behaviour to
everyone else.** The moment `yarn verify` is on `main`, every other developer's
agent runs it after every meaningful change, and the first run on each machine
registers permanent, undeletable state on the **production relay**.

Raised by the operator 2026-08-24, before opening the PRs:

> what happens if other devs start doing stuff with the agents in these repos,
> their agent will auto run the test, and hence mint at the beginning new users
> and spaces… I just want to be sure the system doesn't get out of hand here and
> is architecturally solid and cannot be abused

The concern is correct. Measured below.

## Why "fixed bot names" did not solve this

Two sessions were spent replacing timestamped bot names with fixed ones, so a
bot is registered once and reused forever. That works — **on one machine.**

The identities live in `src/dev/tests/harness/.state/*.json`, and that directory
is **gitignored** (READ: `.gitignore:45`) because the files hold real private
keys. It cannot be committed, and should not be.

So "fixed name + persisted state" means *reused per machine*, not *reused
globally*. A different machine has an empty `.state/`, so `loadOrCreateBot`
takes the mint-and-register branch for every bot.

**Fixed names bounded the cost per machine. They did nothing to bound the number
of machines.**

## What a fresh checkout actually costs

MEASURED 2026-08-24 by reading the four live arms a per-change run executes:

| Arm | Bots it creates | On a fresh `.state/` |
|---|---|---|
| `dm-basic` | `alice-bot`, `bob-bot` | 2 accounts |
| `dm-delivery` | `dm-delivery-receiver`, `dm-delivery-sender` | 2 accounts |
| `space-delivery` | `space-delivery-victim`, `space-delivery-sender` | 2 accounts **+ 1 Space** |
| `config-cross` | reuses mobile's shared throwaway | **fails** — see below |

**6 permanent accounts and 1 permanent Space**, per machine, on first run.

The Space comes from `space-delivery.scenario.test.ts:219-223`: it reuses a
persisted space when one exists and creates one when none does — "first run,
`HARNESS_FRESH=1`, or a state file that failed to restore".

`yarn verify --all` adds `space-basic` (another Space, by design) and `cross-dm`.

### `config-cross` fails outright on a fresh clone

`config-cross.scenario.test.ts:41-46` throws when
`quorum-mobile/dev/harness/.state/config-sync-bot.json` is absent, telling you to
run mobile's scenario first. On a fresh pair of clones that file does not exist,
so a new developer's very first `yarn verify` reports a **FAIL** they did not
cause. Bad first impression, and it will be read as "the gate is broken".

## The worst case is CI, not developers

A developer pays this once. **A CI runner pays it every single run**, because the
filesystem is ephemeral — every job starts with an empty `.state/`.

Nobody has wired `yarn verify` into CI yet. But it is the obvious next thing
somebody does with a command called "verify", and there is currently nothing
stopping them. That is unbounded growth of permanent, undeletable records on
production, from a single well-intentioned pull request.

## Options

Not yet decided — this needs the operator's call.

**A. Point the harness at a non-production relay.** The real fix. `README.md`
says `QUORUM_API_URL` / `QUORUM_WS_URL` already override the endpoint. If a test
relay exists or can exist, the whole problem evaporates and the live tier
becomes genuinely safe for anyone. Everything else here is damage control.
UNKNOWN — not yet measured: whether a test relay exists, and whether the harness
works fully against one.

**B. Make the live tier opt-in rather than default.** `yarn verify` gives the
fast tier to everyone; the live tier requires an explicit flag, or an env var
the maintainer sets once on their own machine. Other developers and CI get real
value (typecheck, lint, 1808+766+1222 tests, build) and mint nothing. Costs: the
live tier stops being automatic, which is most of what makes it useful.

**C. Refuse the live tier when `.state/` is empty, with a clear message.** Turns
the silent minting into an explicit decision by whoever hits it. Cheap, and
strictly better than today whatever else is chosen. Does not help CI, which
would just be told no every time — arguably correct.

**D. Ship a shared set of bot identities.** Rejected. That means real private
keys in a public repo.

**A + C** is the strongest combination if a test relay is available. **B + C** if
not.

**Chosen: C + B**, since no relay is available (see Status). C is the automatic
half — the guard refuses an arm that would mint — and B is the manual escape
hatch, `--live-allow-minting`. A stays the right fix whenever a relay appears.

### Why C turned out stronger than it looked when written

Written above as "cheap, strictly better than today". In implementation it is
better than that, because the check is per-arm and asks the *same* predicate the
minting code asks. So it does not degrade the maintainer's experience at all —
their arms all have state, so all of them run — while giving a fresh clone total
protection with no configuration, no flag, and nothing to remember. The guard
also cannot silently rot: an arm it does not recognise is assumed to mint, and
the contract tests fail the fast tier if the table drifts from the scenarios.

## Related

- Fixed names and `drainInbox()`: `src/dev/tests/harness/README.md`, and
  [2026-08-23-harness-mints-permanent-accounts-every-run.md](../.done/2026-08-23-harness-mints-permanent-accounts-every-run.md) (closed — it solved the per-machine half)
- The gate itself: [verify-gate.md](../../docs/verify-gate.md)
- Ship is held on this: [2026-08-24-verify-gate-pre-ship-fixes.md](2026-08-24-verify-gate-pre-ship-fixes.md)

*Last updated: 2026-08-24*
