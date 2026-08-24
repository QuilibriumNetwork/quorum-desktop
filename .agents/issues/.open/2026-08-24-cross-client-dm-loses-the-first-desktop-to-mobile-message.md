---
type: bug
title: 'Cross-client DM loses the first desktop→mobile message in most runs'
status: open
priority: high
created: 2026-08-24
updated: 2026-08-24
---

# Cross-client DM loses the first desktop→mobile message in most runs

## Status

Found 2026-08-24, the first time the mobile↔desktop DM cell has ever been
measured. Not yet diagnosed. The measurement is solid; the mechanism is not.

## Symptoms

`yarn harness:cross` reports, in 4 of 5 consecutive runs:

```
[cross] mobile→desktop: sent=20 arrived=20 loss=0.0%
[cross] desktop→mobile: sent=20 arrived=19 loss=5.0%  missing=[1]
[cross] total: 39/40 delivered
[cross] LOSS DETECTED — 1/40 messages did not arrive.
```

Desktop reports it sent all 20. Mobile records 19. The missing one is **always
index 1, never any other index**, and always in the desktop→mobile direction.

## Why this is the first time it has been seen

`dm-cross.scenario.test.ts`'s own header records the gap it was built to close:

```
desktop↔desktop   301/301, 201/201, 0%      (dm-loss)
mobile↔mobile     80/80, 0%                 (quorum-mobile yarn harness:dm)
mobile↔desktop    NEVER RUN                 <- this file
```

`.agents/issues/transport/measurements.md` confirms it: every arrival row in
that table is desktop↔desktop or multi-device. There is no mobile↔desktop row.

The arm existed but could not run — `run-cross.mjs` resolved quorum-mobile as a
sibling of the desktop checkout, which is wrong from a linked worktree, so it
died before doing any work (fixed 2026-08-24, commit `79080e5fa`). The first
thing it did once it could run was find this.

## Measurements

MEASURED 2026-08-24, five runs, `ROUNDS=20`, production relay, desktop as role
`b` (echo) and mobile as role `a` (initiator):

| run | drain ordering | mobile→desktop | desktop→mobile | verdict |
|---|---|---|---|---|
| 1 | before `start()` | 20/20 | 19/20, missing `[1]` | LOSS |
| 2 | before `start()` | 20/20 | 20/20 | clean |
| 3 | before `start()` | 20/20 | 19/20, missing `[1]` | LOSS |
| 4 | before `start()` | 20/20 | 19/20, missing `[1]` | LOSS |
| A | **after** `start()` (control) | 20/20 | 19/20, missing `[1]` | LOSS |
| 5 | before `start()`, full log kept | 20/20 | 19/20, missing `[1]` | LOSS |

Five losses in six runs. The mobile→desktop column never moves.

Run 1 used a **brand-new account** (`cross-desktop-b`, minted that run), so no
stale session or inbox state existed on either side. It lost `[1]` anyway.

## Is the instrument trustworthy? Mostly yes — checked before blaming the app

This arm had never run, so "the measuring equipment is wrong" had to be ruled
out before "the app is wrong". MEASURED from desktop's own structured run log
(`src/dev/tests/harness/logs/*-dm-cross-b.jsonl`, run of 2026-08-24 08:43):

```
{"msg": "drained 0 stale frame(s) before starting"}
{"msg": "sent=20/20 received=20  novel decrypt failures=0"}
```

- **`drained 0`** — the reused identity inherited no stale frames, so nothing
  from an earlier run could be distorting either count.
- **`sent=20/20`** — desktop's `bot.send()` returned successfully for all 20
  echoes, including `#1`. `sentByMe` is only appended after the send resolves,
  so this is not an optimistic count.
- **`received=20`, `novel decrypt failures=0`** — desktop's own receive path is
  clean, so the desktop half of the instrument is self-consistent.

On the mobile side, the counting half is `dm-two-bot`, the **same scenario that
measured mobile↔mobile at 80/80, 0%**. It is not new equipment. Its log for the
losing run:

```
sent=20/20 received_from_peer=19 persisted=59 leftOnMyInbox=0 kinds={post:59}
texts=[A→B #1|A→B #1|A→B #2|A→B #2|B→A #2|A→B #3|A→B #3|B→A #3|...]
```

`persisted=59` against 60 on a clean run — exactly one message short. The
`texts` list shows the shape directly: from `#2` onward every round is
`A→B #n, A→B #n, B→A #n`, but `#1` has no `B→A` at all. **`leftOnMyInbox=0`**
means it was not sitting undelivered on mobile's inbox either.

So: desktop sent it and says so; mobile never persisted it and its inbox was
empty. That is a delivery or silent-drop failure, not a counting artifact.

**Still unverified:** whether the frame ever reached mobile's inbox, and whether
mobile's scenario would even report a decrypt failure if one occurred. Those are
the open questions, and they decide whether this is a relay problem or a
mobile-side one.

## What has been ruled out

- **Not caused by the 2026-08-24 identity change.** Run 1 minted a fresh
  account, where a fixed name and a stamped name behave identically and the
  drain is a no-op against an empty inbox. It lost `[1]` regardless.
- **Not caused by the drain reordering.** Control run A restored the previous
  ordering (`start()` then `drainInbox()`) and reproduced the loss.
- **Not general transport loss.** The mobile→desktop direction is 20/20 in
  **every** run — same wire, same relay, same run. That direction is a built-in
  control arm, and it never moves.
- **Not random.** Five runs, four losses, always index 1. Random loss would
  scatter across indices.

## Leading hypothesis (INFERRED — not yet tested)

Simultaneous bidirectional session establishment.

The scenario deliberately uses one initiator, and its own comment says why:

> Both sides sending from the same instant looked natural and was wrong: it
> opens sessions in both directions at once, and a 25-round run failed all 50
> messages on X3DH while every frame arrived intact.

But role `b` echoes each message the moment it arrives, so `b`'s echo of `#1` is
its first-ever outbound to `a` and is sent while `a` is still completing its own
side of the handshake. That reproduces a narrow version of exactly the race the
one-initiator design was adopted to avoid — one message wide instead of all of
them.

If that is right, this is **not harness-only**. The user-facing shape is two
people messaging each other at the same moment, and one of the two messages
never arriving.

## Next steps to diagnose

1. Check whether mobile **never received** the frame or received it and failed
   to decrypt. Those are different bugs. Desktop prints
   `novel decrypt failures=N`; mobile's scenario prints its own counts.
2. Delay `b`'s first echo by a few seconds and re-run. If the loss disappears,
   the race is confirmed and the fix belongs in session establishment, not
   transport.
3. Re-run with desktop as role `a` (`HARNESS_DESKTOP_ROLE=a`). If the loss
   follows the ECHO role rather than the platform, that rules out
   "desktop→mobile is a weak direction" and confirms it is about who speaks
   second.

## Impact on the verify gate

`cross-dm` is **held back to `yarn verify --all`** while this is open
(`exhaustiveOnly` in `scripts/verify/steps.mjs`, alongside `space-basic`). It is
red in 5 of 6 runs for a reason unrelated to whatever change is being verified,
and an arm in that state would block every piece of work behind a bug nobody is
fixing this week.

Held back, not removed: every per-change run prints a `HELD BACK` line naming
it and quoting this issue, so it cannot quietly become "nobody runs it". The
cost is stated plainly — a **mobile-only change now runs one live arm**
(`config-cross`) instead of two.

**Releasing it is two deleted lines** in `steps.mjs` once this is resolved
either way. `src/dev/tests/verify/routing.test.ts` asserts the held-back set by
value, so removing the flag without updating the expectation fails the fast
tier rather than passing silently.

See [2026-08-24-verify-gate-pre-ship-fixes.md](../2026-08-24-verify-gate-pre-ship-fixes.md).

*Last updated: 2026-08-24*
