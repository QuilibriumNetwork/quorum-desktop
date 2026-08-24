---
type: bug
title: 'verify: every fresh checkout mints permanent accounts and a Space on the production relay'
status: open
priority: high
created: 2026-08-24
updated: 2026-08-24
---

# `verify` mints permanent state on every fresh checkout

## ⚠️ This is a ship blocker for the verify gate

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

## Related

- Fixed names and `drainInbox()`: `src/dev/tests/harness/README.md`, and
  [2026-08-23-harness-mints-permanent-accounts-every-run.md](../.done/2026-08-23-harness-mints-permanent-accounts-every-run.md) (closed — it solved the per-machine half)
- The gate itself: [verify-gate.md](../../docs/verify-gate.md)
- Ship is held on this: [2026-08-24-verify-gate-pre-ship-fixes.md](../2026-08-24-verify-gate-pre-ship-fixes.md)

*Last updated: 2026-08-24*
