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
measured. **Root cause MEASURED and fixed on the mobile side the same day**
(quorum-mobile branch `fix/cross-dm-first-reply-drop`, commit `1661fc5`): mobile
re-ran a full X3DH on **every** send while its session was unconfirmed, giving
each send a different session key and replacing the row's ratchet. Desktop's
first reply had been encrypted against the session mobile had just discarded, so
it failed with `aead::Error` and was dropped.

**The reported symptom is fixed and the fix is measured** — desktop's first
reply now arrives, and mobile↔mobile stays 6/6 with no loss. **The arm is still
red**, because fixing this exposed a *second*, independent defect on the desktop
side (§"Residual defect"). Do not close this issue on the strength of the fix.

`cross-dm` stays held back to `yarn verify --all` while this is open.

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

## Mechanism — MEASURED 2026-08-24

Mobile **receives the frame and drops it.** It does not fail to arrive.

Captured from mobile's own output during `yarn verify --all`
(`quorum-mobile/context/WebSocketContext.tsx:3407`):

```
[DM-recv] init-wrapped frame undecryptable by ALL states — dropping after bounded retries
  {"inbox":"Qmc8CadFcW2w","ts":1787562913071,"states":1}
```

**Exactly one occurrence, matching exactly one lost message.** (The log shows
the string twice; the second is the source line echoed inside the stack trace,
not a second drop.)

Two details carry the diagnosis:

- **`init-wrapped`** — this is an X3DH session-initiation frame. Only the first
  message of a new session is wrapped that way, which is why the loss can only
  ever hit index 1.
- **`states: 1`** — mobile already held one session state for this conversation
  and could not decrypt the init against it.

That gives the sequence, end to end:

1. Mobile (role `a`) sends `#1`. Doing so **creates mobile's session state** for
   desktop.
2. Desktop receives it and decrypts cleanly.
3. Desktop echoes `#1`. This is desktop's first outbound, so it goes out
   **init-wrapped** — desktop is opening its own session.
4. Mobile gets the init-wrapped frame, tries it against its one existing state,
   fails, and **drops it after bounded retries**.
5. From `#2` onward desktop's session is established, frames are ordinary, and
   mobile decrypts every one.

This is the collision the scenario's own header warned about, now confirmed by
mechanism rather than inferred:

> Both sides sending from the same instant looked natural and was wrong: it
> opens sessions in both directions at once, and a 25-round run failed all 50
> messages on X3DH while every frame arrived intact.

Role `b` echoes the moment `#1` arrives, so both sides open a session at almost
the same instant — one message wide instead of all of them.

## Why this is probably not harness-only

**Desktop↔desktop never shows it.** `dm-loss` measured 301/301 and 201/201 with
0% loss, over 402 decrypted posts, and `dm-basic`/`dm-delivery` pass in the gate
every run. Desktop's receive path evidently survives the case that mobile's
drops, so this looks like a **divergence between the two implementations**, not
a property of the protocol.

The user-facing shape is two people messaging each other at the same moment, and
the mobile user never seeing the reply. Nothing about that requires a harness.

## Earlier hypothesis, now superseded (kept for the record)

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

## Root cause — MEASURED 2026-08-24

Step 1 of the plan below is done, and it went further than "mobile drops it".

**Reproduce in ~50 seconds, not 6 minutes.** `HARNESS_ROUNDS=3` reproduces it as
reliably as `20` — the loss can only ever hit index 1, so the extra 17 rounds
buy nothing. `HARNESS_LOG_DEBUG=1` is required to see any `logger.debug` output
from mobile; without it `dev/harness/shim.ts` leaves the level above debug and
the decisive lines are invisible.

```
HARNESS_LOG_DEBUG=1 HARNESS_ROUNDS=3 yarn harness:cross
```

`confirmSenderSession` had **four** different `return null` paths and logged
none of them, so every cause looked identical from the outside. With a reason
attached to each (now committed), the failing frame reported:

```
[session-confirm] not a confirm case {"reason":"ratchet-decrypt-failed",
  "err":"Double ratchet decryption error: Decryption failed: aead::Error"}
```

Not a missing row, not a partial envelope. The row was present, keyed by the
very inbox desktop replied to, and unconfirmed — the ratchet simply did not
match. And a second frame **560 ms later, on the same inbox, CONFIRMED**.

The cause is on the mobile SEND path. `sessionSendShape` returns `'init'` for
every send while `sendingInbox.inbox_public_key` is empty, and that branch called
`encryptMessageForNewDevice` → `establishSession`, whose first line is an
unconditional `generateX448()`. Instrumenting it:

```
1. hadPriorSession:false                    newEphemeral: <E1>
2. hadPriorSession:true  prior:<E1>         newEphemeral: <E2>   ← replaces session 1
3. hadPriorSession:true  prior:<E2>         newEphemeral: <E3>   ← replaces session 2
```

Three sessions on one row in one conversation. A fresh ephemeral is a different
X3DH session key, so each re-init orphaned the previous session — and desktop's
reply to session 1 arrived after mobile had moved to session 2.

The code's own comment, 60 lines below that call, states the opposite invariant:

> Store the X3DH ephemeral keypair for **reuse** in subsequent init envelopes.
> Until the session is confirmed … ALL init envelopes must use the SAME
> ephemeral key so the receiver derives the same session key via X3DH.

The `x3dhEphemeral*` fields were being written on every save and never read.
That is why this survived so long: the invariant was documented, believed, and
unimplemented.

### Why "always index 1", finally explained

The window is exactly one message wide because it closes at confirmation. Once
the peer's reply confirms the session, `sessionSendShape` stops returning
`'init'`, no further re-init happens, and nothing else can be orphaned.

## Two remedies tried; the first was refuted by measurement

**Remedy A — reuse the stored ephemeral (implement the documented invariant).**
Refuted. It fixed the reported bug (`B→A #1` arrived, session confirmed on the
first reply) but reusing the ephemeral rebuilds the ratchet at **position 0**,
so the next message re-used the first one's slot and the peer rejected it:

```
mobile→desktop: sent=3 arrived=1  missing=[2,3]
```

One lost message traded for two. Recorded because it is the obvious fix and the
next person will reach for it.

**Remedy B — re-announce, do not re-establish (shipped).** The ratchet must keep
ADVANCING while the announcement is repeated. `buildReinitEnvelopeSend` wraps the
EXISTING ratchet in an InitializationEnvelope and seals it with the session's
STORED X3DH ephemeral, so the peer's derivation still points at the session our
ratchet belongs to. This is what the SDK does (`sent_accept ? plain :
init-wrapped`), what desktop does, and what `buildAcceptSend` already did for the
mirror case. Rows predating the stored ephemeral fall back to the old path.

Result: `establishSession` runs **once** instead of three times, and desktop's
first reply arrives in every run since.

Also shipped: an init-wrapped frame that no stored state can decrypt now
**establishes** a session from it instead of being dropped. Routing on "do any
states exist" rather than "did any state work" is what sent an unreadable init
frame down a path whose only outcome was to discard it.

## Residual defect — desktop churns its session per unconfirmed send

**This is the reason the arm is still red, and it is NOT caused by the mobile
fix** — it is visible in the baseline runs too, where desktop advertised a
different return inbox on each of its two frames.

Desktop mints a **new conversation inbox and a new session for each send** while
its own side is unconfirmed. Measured, two consecutive frames on one mobile
inbox, ~300–560 ms apart:

```
frame 1  peerReturn <D1>  → CONFIRMED; mobile now sends to <D1>
frame 2  peerReturn <D2>  → different session → undecryptable
```

Mobile confirms to `<D1>`; desktop has already moved to `<D2>`. So:

- desktop's **second** reply is unreadable by the session mobile just confirmed,
  and `initializeRecipientSession` cannot build one from it either
  (`init on conversation inbox failed to build a session`);
- mobile's **third** send goes to `<D1>`, which desktop has abandoned, and is
  lost.

Net at `ROUNDS=3`: baseline lost 1 of 6, the branch loses 2 of 5. **By raw count
the branch is not yet an improvement** — it fixes one defect and leaves a second
one exposed. Diagnosing further needs desktop-side instrumentation of which
session row its send path selects; everything above was measured from mobile.

This is the mirror of the mobile bug just fixed, and the same remedy probably
applies: while unconfirmed, re-announce the existing session rather than
building a new one.

## Two traps in the measuring equipment itself

1. **`yarn harness:cross` does NOT go through `scripts/verify/mintGuard.mjs`.**
   The guard only runs under `yarn verify`. Running the harness directly from a
   checkout whose `.state/` lacks the bot file registers a **new permanent
   account** with no warning. Each git worktree has its OWN gitignored
   `.state/`, so "the identity exists" is true per checkout, not per repo —
   running the same arm from a different worktree mints. One account
   (`cross-desktop-b`) was registered this way on 2026-08-24. Pin harness runs
   to one checkout, or copy the state file first.
2. **Desktop's vitest side fails to start in roughly half of back-to-back
   runs**, with `Vitest failed to find the current suite` at
   `dm-cross.scenario.test.ts:53` (the `test.skipIf` registration) and
   `import 0ms`. It collects fine in isolation. Mobile then fails with the
   misleading `waited 120000ms for peer b's "hello"`. Re-run; a short sleep
   between runs seems to help. Worth its own issue if it persists.

## Next steps

Items 1 and 4 of the original plan are **done** (§"Root cause"): the frame was
only ever tried against existing states, that routing is fixed, and "bounded
retries" was a symptom rather than the cause — the frame was unreadable on
arrival, not merely early. What remains:

1. **Fix desktop's session churn** (§"Residual defect") — the mirror of the
   mobile bug. Desktop mints a new session and return inbox per send while
   unconfirmed; it should re-announce the existing one, exactly as
   `buildReinitEnvelopeSend` now does on mobile. Instrument desktop's send path
   first to confirm which row it selects. This is what blocks the arm going
   green. Costs nothing, mints nothing.
2. **Re-run the mobile↔mobile control after any desktop change**
   (`yarn harness:dm` in quorum-mobile, `HARNESS_ROUNDS=3`). It is currently
   6/6 with no loss on the fix branch, and it is the arm that would notice a
   session-handling regression first. Mints nothing.
3. **Optional: delay `b`'s first echo by a few seconds and re-run.** Now only a
   confirmation that the timing window is what it appears to be; the mechanism
   is already measured. Mints nothing.
4. **Re-run with desktop as role `a`** (`HARNESS_DESKTOP_ROLE=a`) to see whether
   the residual loss follows the ECHO role rather than the platform.
   ⚠️ **Mints one permanent account** (`cross-desktop-a` does not exist).
   Do not run this casually — see the mint-guard trap above.

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

See [2026-08-24-verify-gate-pre-ship-fixes.md](../.done/2026-08-24-verify-gate-pre-ship-fixes.md).

*Last updated: 2026-08-24*

