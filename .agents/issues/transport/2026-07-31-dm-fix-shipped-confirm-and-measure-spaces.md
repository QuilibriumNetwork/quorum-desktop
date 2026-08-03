---
type: task
title: "DM fix is SHIPPED and live — what remains is one confirmation round, then measuring spaces"
status: in-progress
created: 2026-07-31
area: WebSocket transport / send durability / spaces measurement
repos: quorum-mobile (device rounds), quorum-desktop (tooling + docs)
related:
  - "issues/transport/measurements.md § ROUND Q → § ROUNDS T and U (all the evidence)"
  - "issues/transport/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md (root cause, still OPEN — cause is relay-side)"
  - "quorum-mobile/.agents/bugs/2026-07-26-spaces-log-append-ack-ignored-silent-write-loss.md (the spaces brief, re-scoped 2026-07-31)"
---

# Where this stands, and the two rounds left

## §1. The situation in one minute

For ~6 months, 15-25% of DMs sent from mobile vanished silently. **Cause found,
measured, and the client-side half is fixed and live.**

**The cause:** the relay pings every 9.0 s and enforces a 10.0 s deadline that
only a pong refreshes, so a client has **~1.0 s** to answer or the TCP
connection is destroyed **with no close frame**. `readyState` then reads `OPEN`
for 3.5-5 s, and every frame written in that window is accepted by `ws.send()`,
dropped from the queue as sent, and never delivered or retried.

**How it was confirmed:** Round Q joined each lost message to the socket close
that followed it — every loss sat **1.4-3.5 s before a close**, no survivor
inside that band. Round R repeated it with **three predictions published before
the data was read**, and all three held.

**The fix:** the rescue path already existed (`pendingEnvelopes`) and was simply
~1 s wide against a 3.5-5 s window. Widening it took a reproducible **16-17/20
to 20/20**, `duplicates: 0` on every patched round.

## §2. What is already done — do not redo any of this

| item | status |
|---|---|
| root cause measured | ✅ reproducible in 10 s: `.agents/scripts/relay-pong-probe.mjs` |
| mechanism confirmed | ✅ rounds Q and R, pre-registered predictions |
| client fix built + sized | ✅ rounds S/T/U (6 s was too small, 12 s works — see §5) |
| shipped to `quorum-shared` | ✅ **merged `b24058e` (PR #69)** |
| **published to npm** | ✅ **`2.1.0-39`** — verified by inspecting the published tarball, not by timestamps |
| **mobile consumes it** | ✅ requires and has `2.1.0-39`; the dist carries `SendRetention` |
| local `node_modules` patch | ✅ **gone**, wiped by the reinstall — no double-retention risk |
| upstream ask filed | ✅ quorum-mobile#183 section 1 |
| tooling on `main` | ✅ `relay-pong-probe.mjs`, `validate-capture.mjs`, `join-losses-to-closes.mjs` |

⚠️ **The diag probes were wiped by the same reinstall** (`WS-diag`, `WS-life`,
`WS-frame` all read 0 in `node_modules`). **`git debug` is required before any
round** or the capture will have no socket data at all.

## §3. ROUND 1 — confirm the shipped build

> **PARTIAL PROGRESS 2026-08-01 — a smoke round ran, and it does NOT close this.**
> A 20-message burst on the **published** package (mobile dev build → desktop) landed
> **20/20**. Build provenance was verified by inspecting the installed package: version
> `2.1.0-39`, a real directory rather than a `link:`, `SendRetention` present, local
> patch **not** applied, retention on by default at `12000 ms / 200 frames / 3 replays`.
> **But there was no logcat capture and the diag probes were absent** (`WS-diag`,
> `WS-life`, `WS-frame` all missing — the reinstall wiped them and `git debug` had not
> been re-run), so there is **no socket data and no way to tell whether the socket
> died at all**. At 15-25% loss that 20/20 is not separable from a quiet burst.
> **This section is still owed in full.** No round letter was used; none is burned.
> Logged as `measurements.md` § THE PUBLISHED-BUILD SMOKE ROUND.
>
> ⭐ **One thing that round taught us, worth using below:** the published package and
> the old local patch **both log under `[WS-retain]`**, so that tag alone proves
> nothing. The published build prints `replaying N frame(s) **from the previous
> connection**`; the patch printed `replaying N frame(s) **retained within 12000ms**`
> and `[WS-retain] armed window=`. Grep for the wording, not the tag. And because that
> line comes from the *package* rather than the rig, it is evidence even in a capture
> with no probes armed.

The 20/20 results came from a **local patch**. The shipped code is *different
and strictly more protective* (see §5), and it has **never been run on a
device under instrumentation**. That is the gap.

1. `cd quorum-mobile && git debug` — must print `RIG ARMED`. **Do not apply
   `patch-rn-ws-retain.mjs`** — the fix is in the package now; applying the
   patch on top would double-retain.
2. Restart Metro with **`-ResetCache`** (node_modules changed).
3. Start `.agents/scripts/capture-xptrace.bat`, **then reload the app** so the
   armed markers land inside the capture.
4. Validate before spending the round:
   `node ../quorum-desktop/.agents/scripts/validate-capture.mjs <capture.log>`
5. Burst: next unused letter (X, Y, Z, P, Q, R, S, T, U burned), 20 messages,
   2000 ms. **Both desktops with the real app open** (runbook rule 6).
6. Read both DM doctors, immediately and again ~10 min later.

**Analysis — the 20/20 is not the measurement.** At 15-25% loss a 20-message
round can pass on luck. What carries the weight is the per-message join:

```bash
node .agents/scripts/join-losses-to-closes.mjs <capture.log> --burst <run-*.jsonl> --lost <missing>
```

A real pass needs (a) drops actually occurred during the burst, and (b) messages
that sat inside the blind window survived. Look for `[WS-retain] replaying N`.

## §4. ROUND 2 — measure spaces (never been done)

> ⚠️ **Not to be confused with**
> `issues/2026-07-31-spaces-list-cross-device-sync.md`, dated the same day. That one is about **which
> Spaces appear in a device's list** (UserConfig sync, membership propagation, ghost cleanup). This
> section is about **whether messages sent into a Space arrive** (transport). Different layer, different
> code, unrelated fixes.

**Spaces message delivery has never been measured.** The spaces bug report says
so outright. Everything about it is code-reading.

⭐ **Verified 2026-07-31: every `log-append` goes through `enqueueOutbound`** —
space messages, channel management, deletes, edits, mutes, device-key
statements. Same client, same drain loop as DMs. **So the shipped fix already
covers spaces**, and no further `quorum-shared` change is needed for transport
durability.

**The prediction:** if space losses land in the same **1.4-3.5 s band** before a
close, they are the same bug and already fixed.

⚠️ **Run an unpatched control consideration first.** The fix is now in the
package and cannot be trivially removed, so a true control is no longer
available on this device. Read a clean result as "spaces are fine *now*", not as
"spaces were never losing messages".

**Tooling:** the desktop DM doctor **works as-is for spaces** — `scanSequence`
matches every row in the whole `messages` store by text pattern with no DM/space
filter. The **burst button is DM-only**, so space messages must be typed by
hand, which means no per-message send record and an approximate rather than
exact join. Good enough for "do spaces lose messages, and do losses cluster
before closes?"

Full protocol, tooling matrix and background:
`quorum-mobile/.agents/bugs/2026-07-26-spaces-log-append-ack-ignored-silent-write-loss.md`
§ HOW TO MEASURE SPACES.

## §5. How the shipped fix differs from what was validated

The device rounds validated a local patch. The merged implementation departs
from it in four ways, each strictly more protective — which is *why* §3's
confirmation round matters:

1. **Age is measured from send to socket CLOSE, not to replay.** The buffer is
   per-connection: sealed on `onclose`, drained on `onopen`. The reconnect gap
   can no longer eat the budget — which is exactly what cost Round T its one
   loss (a 4.42 s gap left only 1.58 s of useful coverage at 6 s).
2. **Frames flushed out of `pendingEnvelopes` are retained too**, so a rescued
   frame landing on a second dead socket still has recourse.
3. **Replays are capped per frame (default 3)**, so a flapping link cannot chase
   the same frame forever.
4. **`BrowserWebSocketClient` fixed as well**, though no application uses it.

## §6. Still unexplained — do not let this get lost

**Why React Native misses the pong is unknown.** Radio sleep was the hypothesis
and **Round U refuted it**: connections during an active burst live *shorter*
than idle (12.9 s vs 15.4 s vs 16.3 s idle). This is the one load-bearing
inference in the whole chain still resting on nothing. Confirming it needs a
packet capture on the handset or relay-side logs — RN's JS `WebSocket` does not
expose ping/pong, so no app patch can see it.

Also open: **receipt gaps move between rounds and devices with no pattern**
(round T: T1-T4 missing on mobile A; round U: T20 missing on desktop A). Marked
`[UNCONFIRMED]` in the measurements log across four rounds now. Do not build on
it, but keep counting receipts per device.

## §7. What the lead dev still owes

1. ⭐ **Raise the relay pong deadline** — `pongWait` 10 s → 60 s, `pingPeriod`
   9 s → 54 s. **This is the only change that stops the connections dying.**
   Everything we shipped only makes the loss survivable: connections still died
   **9 times in 51 seconds** during the round that passed 20/20. Self-verifying:
   after the change `relay-pong-probe.mjs nopong 90` should survive ~60 s
   instead of dying at 10 s. Filed as **#183 section 1**.
2. Confirm whether the 9 s pinger is the relay itself or Cloudflare in front.
3. Consider the protocol **write-ack** (#183 section 3) — it would let the
   client retire the timer heuristic for ack-driven retention, the correct end
   state.
4. Unaffected by all of this: the `channel` crate bugs (#183 sections 2a/2b).

---
*Last updated: 2026-07-31*
