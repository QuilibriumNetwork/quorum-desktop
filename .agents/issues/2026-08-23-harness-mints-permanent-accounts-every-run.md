---
type: bug
title: 'Harness mints permanent, undeletable accounts on the production relay every run'
status: in-progress
created: 2026-08-23
updated: 2026-08-23
---

# Harness mints permanent, undeletable accounts on the production relay every run

## Summary

Three of the four live arms wired into `yarn verify` name their bots with a
per-run timestamp, so every run registers brand-new accounts on the **production**
relay. Registrations never expire and there is no endpoint to delete them. The
`yarn verify` AGENTS.md rule turns this from an occasional manual cost into a
per-code-change one.

## Measurements

All MEASURED on 2026-08-23 against `https://api.quorummessenger.com`, read-only.

### What each run creates

| Arm | Bot naming | New accounts/run |
|---|---|---|
| `dm-basic` | `alice-bot`, `bob-bot` — fixed | 0 |
| `dm-delivery` | `delivery-receiver-${stamp}` | 2 |
| `space-basic` | `space-a-${stamp}` | 2 + 1 space |
| `space-delivery` | `delivery-victim-${stamp}` | 2 + 1 space |

`stamp` is `String(Date.now()).slice(-6)`, e.g.
`space-basic.scenario.test.ts:51`. A new name means a new `.state/<name>.json`,
which means `loadOrCreateBot` takes the mint-and-register branch
(`identity.ts:133-153`) rather than the load branch.

**Per full `yarn verify --all`: ~6 accounts + 2 spaces.**

### What has already accumulated

```
src/dev/tests/harness/.state/          385 files, 376 with a userKeyset
.worktrees/secondary/.../.state/        84 files
```

A file carrying a `userKeyset` is a distinct account minted and registered.
Date range 2026-07-27 → 2026-08-22, so roughly **460 accounts in four weeks**
from one machine.

### Registrations are permanent

Addresses derived from `.state` files and queried directly:

| Bot | Minted | Response |
|---|---|---|
| a throwaway stamped bot | 2026-07-29 | HTTP 200, 1113 bytes, 1 device |
| a second throwaway stamped bot | 2026-07-29 | HTTP 200, 1113 bytes, 1 device |
| `alice-bot` (reused, fixed name) | 2026-07-27 | HTTP 200, 1113 bytes, **1 device** |

26 days on, all still resolve in full. Nothing expires.

### There is no way to delete them

Full API surface (`src/api/quorumApi.ts`, `src/api/baseTypes.ts`):

| Endpoint | Deletes? |
|---|---|
| `/inbox/delete` | ✅ messages (the ack mechanism) |
| `/hub/delete` | ✅ hub entries |
| `DELETE /users/<addr>/public-profile` | ✅ profile only |
| accounts | ❌ **no endpoint** |
| spaces | ❌ **no endpoint** |

### Scale calibration

1113 bytes each, so ~460 accounts is ~420 KB. Small in raw storage. The concern
is unbounded, uncleanable growth of a namespace, and that it is unknown from the
client side whether registrations propagate to the permanent Quilibrium
hypergraph or stay in relay storage — quorum-mobile's
`.agents/docs/message-transport-architecture.md` §2.0 explicitly declines to
assert either way. Fix it because it is cheap to fix, not because it is urgent.

## Why the fix is low-risk

The stamped names were assumed to provide clean-room isolation. They do not
provide the part that matters, because **the harness database is already fresh
on every run**: `storage.ts` backs `MessageDB` with `fake-indexeddb`, which is
in-memory and process-scoped. Every node process starts with an empty database
regardless of bot name.

So a stamp buys only *network identity* isolation — the expensive half — while
*local storage* isolation is automatic and free. What genuinely persists across
runs for a reused identity is relay-side queued inbox frames, and `drainInbox()`
already exists for exactly that.

Corroborating evidence: 11 of the harness scenarios already use fixed names, and
`alice-bot` has been reused since 2026-07-27 while still reporting exactly one
device registration — the persistence mechanism described in the harness README
("re-runs do not spawn new device registrations, which would feed the
device-registration ghost-accumulation problem") works as designed.

## Local relay: viable in principle, blocked in practice

Both clients already support pointing at a local relay — quorum-mobile has a dev
toggle for `http://localhost:5000` (`services/api/config.ts:20-22`) and the
desktop harness honours a `QUORUM_API_URL` override (`env.ts:48`). The server
that serves port 5000 is not in any repo available here and is not documented
anywhere, so this route is unavailable for now. If it ever becomes available,
switching is one environment variable and no code change.

## Scope of this fix

**In scope** — the four live arms wired into `yarn verify`, since those are what
the AGENTS.md rule causes to run on every code change:

- [ ] Replace stamped bot names in `dm-delivery`, `space-basic`, `space-delivery`
      with a fixed roster
- [ ] Drain relay-side inbox state at scenario start so a reused identity cannot
      inherit stale queued frames
- [ ] Falsify each changed arm: break real application code, confirm the arm goes
      red, restore
- [ ] Document the local-relay switch in the harness README

**Out of scope, tracked separately** — the ~20 manually-run scenarios that also
use stamped names (`wipe-*`, `mid-*`, `sm-*`, `sokf-*`, `thr-*`, `tgt-*`,
`sds-*`, `sdl-*`), and space reuse (each remaining space creation is +1 permanent
space per run; reusing one needs persisted space ids and a decision about hub log
growth).

## Status

In progress. Blocks shipping the `yarn verify` PRs, because the AGENTS.md rule in
those PRs is what multiplies the cost.

*Last updated: 2026-08-23*
