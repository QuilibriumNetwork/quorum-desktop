---
type: task
title: "ROOT CAUSE: the relay kills any client that misses a pong by >1s (9s ping / 10s deadline), and frames written in the blind window before the client notices are silently lost"
status: in-progress
priority: high
created: 2026-07-30
updated: 2026-07-31
severity: CRITICAL — silently drops 15-25% of all DMs during ordinary use on mobile, with no error surfaced anywhere and no recovery. This is the leading explanation for the ~6-month message-loss symptom
area: WebSocket transport / relay pong deadline / send durability
repos: relay/infra (the primary fix), quorum-shared + quorum-desktop (send durability only)
related:
  - "issues/transport/measurements.md § THE RELAY PROBE (the current mechanism), § THE IDLE CAPTURE and § ROUND P (the effect)"
  - "quorum-mobile#183 item 2 (node write-loss) — this plausibly explains a large share of it"
  - "issues/transport/runbook.md (how the rounds were run)"
---

# The relay reaps clients that miss a pong, and takes their messages with them

> **TL;DR.** The relay sends a **protocol PING every 9.0 s** and enforces a
> **10.0 s read deadline that only a pong refreshes** — so a client has about
> **1.0 second** to answer or it is killed, TCP destroyed, no close frame,
> surfacing as **code 1006**. Application traffic does **not** refresh the
> deadline (measured with valid, accepted frames). Chromium pongs in
> milliseconds so desktop survives; React Native over a mobile radio misses the
> 1 s budget often enough to be killed every ~16 s. Because 1006 gives no
> protocol signal, `readyState` still reads `OPEN` for seconds afterwards, so
> `ws.send()` accepts frames that are never delivered and never retried —
> measured DM loss 15%/15%/20%/25% across four rounds.
>
> **The primary fix is relay-side: raise `pongWait` to ~60 s and `pingPeriod`
> to ~54 s** (the Gorilla library's own example values; this relay runs 10 s/9 s,
> about six times too small). **No client can fix this** — JS cannot see, send
> or delay a pong on any platform. The only client-side lever left is send
> durability, so a drop stops costing messages.

## §0d. ⛔ RETRACTION: the original diagnosis in this file was wrong

This file first concluded that **"any connection silent for ~11 s is killed and
the app has no keepalive, so add a ~5 s app-level keepalive to
`quorum-shared`."** Direct measurement of the relay refuted both halves the same
day (`measurements.md` § THE RELAY PROBE):

| original claim | verdict |
|---|---|
| it is an **idle timeout** on app silence | ⛔ **WRONG** — a fully silent connection survives indefinitely provided it pongs |
| the app has **no keepalive**, which is the defect | ⛔ **MISLEADING** — every platform already pongs automatically at the native layer; that *is* the keepalive, and it is not optional or visible to JS |
| an **app-level ~5 s keepalive** in `quorum-shared` fixes it | ⛔ **REFUTED** — valid, relay-accepted app frames every 5 s did **not** prevent the kill. Only pongs refresh the deadline |
| the desktop survives by being **accidentally chatty** | ⛔ **WRONG** — it survives because Chromium pongs in milliseconds |

**Why the error happened, worth keeping:** mobile falls silent immediately after
subscribing, so "time since the last app frame" (~10.9 s median) and "time since
the connection opened" were nearly the same number, and the wrong one was taken
as causal. The 10.9 s figure sat right next to the real 10.0 s pong deadline,
which made the wrong model look quantitatively convincing. **Nothing in the
capture could distinguish the two hypotheses**, because the probe measured the
app's frames rather than the protocol's control frames.

**The measurement that settled it took ~10 seconds and no phone** — see
`.agents/scripts/relay-pong-probe.mjs`. The lesson is the one this
investigation keeps re-learning: instrument the layer the mechanism lives in.

**Everything below about the *consequence* (§1, §2, §3, §3b) still stands** —
frames written into a dying socket are lost exactly as described. Only the
*cause* (§0, §0b, §0c) and the Layer 1 fix (§6) were wrong.

# The socket dies every ~16s and takes messages with it

> ⚠️ **The framing in §0-§0c below is the SUPERSEDED one.** The disconnection
> counts and lifetimes are real measurements and remain valid; their attribution
> to an "idle timeout" is retracted per §0d.

## §0. The measurement that settles it (2026-07-30, 25 min, phone completely idle)

| metric | value |
|---|---|
| disconnections | **81** in 1539 s → **one every 19.0 s** |
| connection lifetime (OPEN→CLOSE) | min 13.9 s, **median 16.3 s**, max 20.2 s |
| reconnect gap (CLOSE→OPEN) | median **2.7 s** |
| close code | **1006 on every single one**, `clean=false`, no reason string |
| queued frames at close | `pending=0 outbound=0` (idle — nothing to requeue) |
| time actually connected | **86%** |

**No burst, no messages, no user activity.** This alone disproves the earlier
worry that the bursts were causing the drops — the operator raised exactly that
objection, and it was right to raise: the drops are constant and load-independent.

**And there is no keepalive to prevent it.** A grep of the shipped transport
bundle finds no `ping`, `pong`, `heartbeat`, or keepalive timer in **either** the
RN client or the browser client. The connection is left to go silent and
something upstream reaps it.

### §0b. ⭐ It is an IDLE timeout of ~11 seconds — measured, not assumed

Time between the **last frame sent** and the **CLOSE**, across 217 disconnections:

| p25 | **median** | p75 | max |
|---|---|---|---|
| 7.2 s | **10.9 s** | 12.4 s | 16.7 s |

**203 of 217 closes happened within 14 s of the last frame.** One cycle in full:

```
18:30:10  OPEN
18:30:13  27 frames    ← re-subscribe burst
18:30:14   1 frame
          …12 s of complete silence…
18:30:26  ERROR + CLOSE (1006)
18:30:29  OPEN
18:30:32  16 frames    ← re-subscribe burst again
          …silence…
```

Connect → subscribe → fall silent → get killed → reconnect → repeat. The 6,501
frames logged in 25 minutes are almost entirely **re-subscription churn caused by
the reconnects themselves** (~80 frames × 81 reconnects), not useful traffic.

### §0c. ⚠️ Why the desktop survives — and TWO retracted claims

⛔ **RETRACTED #1: "the desktop shows the same ~19 s cycle."** Based on a single
`quorum-ws` row reading 19.82 s. Wrong.

⛔ **RETRACTED #2: "the desktop is reaped on a ~175 s cycle."** Based on HAR
`time` values of 172.9 s and 177.6 s. **For a still-open connection, HAR `time`
is elapsed-so-far, not a lifetime.** The operator noticed the connection had by
then been open 20+ minutes, which is what exposed the error.

✅ **What is actually true:** the desktop holds a single connection for **20+
minutes** (re-verified at 3.1 minutes with the VPN disconnected, so the VPN is
not the explanation either). Both clients were on the same WiFi.

**The desktop escapes because it is accidentally chatty** — its background
traffic recurs more often than the ~11 s idle window, so the timer never expires.
It is not better designed; the mobile client simply goes silent after
subscribing. That is the entire difference.

> **Method note worth keeping:** three claims about the desktop were made and two
> were wrong, each corrected within minutes by the operator looking at the actual
> screen. The failure mode both times was reading a *duration-so-far* as a
> *final lifetime*. Instrument lifetimes at the close event, never from a
> snapshot of an open connection.

# Frames written into a dying WebSocket are silently lost

## §1. The mechanism

1. The client hands a frame to `ws.send()`. The call returns without error — the
   local socket buffer accepts the bytes.
2. The TCP connection is **already broken** (or breaks moments later). The bytes
   are never delivered and never retransmitted.
3. Some seconds later the client *notices* the socket is gone and reconnects.
4. On reconnect it requeues **only the batch it was actively writing** at the
   moment of detection. Everything written in the preceding seconds is treated as
   sent and is never retried.

There is no application-level ack for an inbox write, so nothing anywhere ever
learns those messages did not arrive. The sender shows them as sent; the
receivers never saw them; no warning is logged by any party.

## §2. Evidence (round P, 2026-07-30, mobile A → account B, 20 messages, 2 s apart)

Captured on the diagnostic rig with the `node_modules` transport patch live, so
every frame handed to the socket is logged, plus mid-write socket failures.

**Two socket drops occurred during the 50-second burst** (17:28:29 and 17:29:01
local), each logged as `[WS-frame] socket lost mid-batch, requeued` ×6 followed
~1.8 s later by `[WS-frame] flushed-pending` ×6.

Distance from each message's socket write to the next detected drop:

| message | gap to next detected drop | outcome |
|---|---|---|
| 3 | **2.0 s** | **LOST** |
| 16 | **2.5 s** | **LOST** |
| 2 | **4.6 s** | **LOST** |
| 15 | 5.1 s | landed |
| 1 | 7.6 s | landed |
| 14 | 9.4 s | landed |

**A threshold at roughly five seconds.** Everything written inside that window
before a drop was lost; the nearest survivor sat just outside it. All six
per-device frames for every lost message were logged as written to the socket —
the send path did its job completely (confirmed independently in round Z: 120/120
send rows, no gaps).

Receiver side, same round: desktop B **15/20, missing [2, 3, 9, 10, 16]**,
unchanged after reload, zero decrypt failures, zero unknown-inbox drops, zero
misfiling.

## §3. Why this explains the whole six-month symptom

| observation | explained |
|---|---|
| losses are scattered, not contiguous | drops happen at arbitrary moments ✓ |
| no error or warning anywhere, on any device | the client believes it sent them ✓ |
| both receivers lose the **identical** messages (rounds U, X, Y, Z) | the frames never left the phone, so no copy exists ✓ |
| a cold inbox drain never recovers them | they never reached the relay ✓ |
| rate 15-25%, varying per round | depends how often the connection drops ✓ |
| **every headless bench measured 0% for weeks** | the harness uses Node `ws` over a stable wired connection where sockets essentially never drop. **The benches lacked the trigger, not the bug** ✓ |

That last row is the one that reframes months of work. It also fits the
2026-07-29 sender-isolation result exactly: the same account, the same relay,
the same receiver — mobile app lost 15-20%, a harness bot over Node `ws` lost
none. The variable was never the crypto or the client logic. **It was the
socket.**

## §3b. Why the client keeps writing into a dead socket for seconds

Close code **1006** means the connection ended **without a close handshake** — no
`Close` frame arrived from the peer. The client therefore cannot learn about the
break from the protocol; it finds out only when the OS surfaces a failed read or
write, which lags the actual breakage by seconds. During that lag
`ws.readyState` still reads `OPEN`, so:

- the pre-write guard (`if (this.ws?.readyState !== WebSocket.OPEN)`) passes,
- `ws.send()` accepts the bytes into the local buffer and returns without error,
- the frame is treated as sent and dropped from the queue,
- the bytes are never delivered and never retransmitted.

Because the connection is reaped on a ~16 s cycle, **this window recurs
continuously**, which is why the loss looks random and why it needs no burst.

## §4. What is NOT yet established

- **The ~5 s blind window is inferred, not directly measured.** We know the
  connection dies and we know which messages die with it; we have not
  instrumented the exact instant the connection became unusable versus the
  instant the client noticed. `bufferedAmount` reads `?` on RN's socket, which
  would have shown bytes queued-but-unsent at the drop.
- **The loss/drop correlation comes from one round** (round P). The idle capture
  proves the drops; a repeat round with the lifecycle probe now armed would tie
  each individual lost message to a specific `CLOSE`, including P9 and P10,
  which did not align with either drop the older probe could see.
- **Android logcat throttled** during round P (37 `chatty` indicators; 108 of
  ~120 expected frame lines survived). All six frames for each lost message were
  captured, but frame coverage was not complete.
- **What actually severs the connection is unknown.** ~16 s is far too short and
  too regular for an ordinary NAT timeout. Candidates: a relay/load-balancer idle
  timeout, an infrastructure proxy, or a server-side ping the client never
  answers. Needs a look from the server side, or a packet capture.
- **Whether the ~19 s cycle is universal** — same on production builds, other
  networks, other accounts — is untested. The single desktop observation
  (19.82 s) is one sample from one machine.

## §5. Confirmation steps

1. ✅ **DONE — socket lifecycle probe.** `patch-rn-ws-diag.mjs` now logs
   `[WS-life] OPEN / CLOSE (code, reason, clean, queue depths) / ERROR`. This is
   what produced §0.
2. ✅ **DONE — idle baseline.** 81 drops in 25 idle minutes; the burst is
   exonerated as the cause.
3. ⭐ **Desktop cross-check** — DevTools → Network → WS shows `quorum-ws` closing
   at 19.82 s and being replaced. One sample; watch 2-5 minutes for the full
   cadence and confirm it repeats.
4. **Burst round with the lifecycle probe armed** — tie each lost message to a
   specific `CLOSE`. Prediction: every loss sits within a few seconds before one,
   with no unexplained cases left.
5. ⛔ **ANSWERED, and the answer was NO — "does traffic keep it alive?"** Valid,
   relay-accepted app frames every 5 s did not extend the connection by a single
   second. Only pongs do. This is what refuted Layer 1 (see §0d and §6).
6. **Production build check** — does the `.preview` build show the same cadence?
   Folds neatly into the still-owed W-run.
7. ✅ **DONE — relay protocol probe.** `.agents/scripts/relay-pong-probe.mjs`
   measures the ping period, the pong deadline and the pong budget directly, in
   ~10 s, from any machine, with no phone and no instrumentation.

## §6. Fix direction — REVISED after the relay probe

### ⭐ Primary fix — relay configuration (lead dev / infra; NOT a client change)

**Raise the relay's pong deadline and ping period.** Measured today: `pingPeriod
= 9.0 s`, `pongWait = 10.0 s`, leaving clients a **1.0 second** budget to answer
each ping. That is the entire bug. The Gorilla WebSocket library's own example —
whose `pingPeriod = pongWait * 9/10` ratio this relay clearly follows — uses
**`pongWait = 60 s` / `pingPeriod = 54 s`**, and OkHttp's guidance is a 30-60 s
heartbeat. The relay is running roughly **six times too tight** for a mobile
network.

```go
// current (inferred from measured behaviour)      // recommended
pongWait   = 10 * time.Second                      pongWait   = 60 * time.Second
pingPeriod = (pongWait * 9) / 10  // 9s            pingPeriod = (pongWait * 9) / 10  // 54s
```

This is a one-line configuration change that fixes **every client on every
platform with no app release**, and it is the only place the problem can
actually be fixed.

### ⛔ Layer 1 (app-level keepalive) — REFUTED, do not implement

The previously planned ~5 s app-level keepalive in `quorum-shared` **cannot
work**, and this was measured rather than reasoned:

- Valid, relay-**accepted** app frames sent every 5 s did not prevent the kill
  (trials 5 and 6 in § THE RELAY PROBE). Only pongs refresh the deadline.
- Every platform *already* pongs, automatically, in native code. There is no JS
  API to send, delay, observe or influence a pong — not in browsers, not in
  React Native. So there is no client-side keepalive left to add.

Building it would have cost a release, kept the mobile radio awake every 5 s for
nothing, and **failed the acceptance test**.

### Layer 2 — send durability (the only client-side lever, now more important)

With the cause unfixable from the client, this is what the client can still do:
stop treating `ws.send()` as proof of delivery so a drop stops costing messages.

1. **Widen the replay window (cheap, high value):** retain frames for N seconds
   after `ws.send` and replay unconfirmed ones on reconnect. Messages already
   carry ids and the receive path already dedupes redelivered frames, so replay
   is safe. `quorum-shared`'s clients *have* a `pendingEnvelopes` buffer and a
   flush-on-reconnect path — its window is simply far too narrow, rescuing only
   the batch actively being written.
2. ⚠️ **Desktop has no such buffer at all.** `quorum-desktop`'s
   `src/components/context/WebsocketProvider.tsx` is a **separate implementation**
   that does not use `quorum-shared`'s `BrowserWebSocketClient` (which is, in
   practice, unused by any app). Its `processOutbound` calls `ws.send(m)` in a
   loop with no per-send `readyState` re-check and no requeue on failure. Desktop
   is currently spared only because Chromium pongs reliably.
3. **Keep frames pending until something acknowledges them**, rather than until
   `ws.send` returns.
4. **Protocol-level write ack (the real fix, upstream):** the standing ask on
   quorum-mobile#183, unchanged but far better motivated now.

### Acceptance criteria — REVISED

The original Layer 1 rows are void (there is no Layer 1). What remains testable:

| stage | measurement | pass |
|---|---|---|
| baseline (recorded) | idle capture, drops per 25 min | **81** |
| after the **relay** change | same idle capture, same phone | **≈0 drops**, connection lives minutes |
| after the **relay** change | 20-message burst, DM doctor both receivers | **20/20 on both** |
| after Layer 2 | burst with a drop forced mid-run | **20/20 still** |

The relay rows cannot be run until the relay change lands — they are the lead
dev's to validate, and `.agents/scripts/relay-pong-probe.mjs` verifies the new
constants in ~10 s from any machine (`nopong` should then survive ~60 s).

⚠️ Do **not** treat this as fully replacing #183 item 2 until a burst round ties
individual lost messages to individual CLOSE events. It may explain most of it,
some of it, or all of it.

## §7. Still owed

- **Confirm the mobile mechanism directly.** The model predicts RN misses pongs
  intermittently; that is inferred, not observed. RN's JS `WebSocket` does not
  expose ping/pong, so this needs a **packet capture on the phone** or
  **relay-side logs** — an app patch cannot see it.
- **Determine whether the 9 s pinger is the relay or Cloudflare in front of it.**
  The 9 s/10 s Gorilla ratio points at origin app code, unconfirmed server-side.
- **Check the deadline is uniform** across relay instances and regions.

## §8. 2026-07-31 — mechanism CONFIRMED on device, and a client fix VALIDATED (not shipped)

**Confirmed.** Rounds Q and R joined every sent message to the socket close that
followed it. **Every loss sat 1.4-3.5 s before a CLOSE and no survivor sat inside
that band**, twice. Round R published three predictions before the data was read
and all three held, including that the near-edge survivors would show
`socket lost mid-batch, requeued` then `flushed-pending` — they did, 6 frames
each, one message's fan-out per close.

**The existing rescue was the answer all along, just too narrow.** Its window is
~1 s; the lethal window is 3.5-5 s.

**Fix validated, not shipped.** A local `node_modules` patch widening the
retention window:

| round | retention | result |
|---|---|---|
| Q / R | none | 16/20, 17/20 |
| S | 6 s | **20/20** |
| T | 6 s | 19/20 — one loss, aged out because the reconnect gap ate the budget |
| U | **12 s** | **20/20**, with 3 messages rescued at ages 6 s would have dropped |

`duplicates: 0` and `decryptFailish: 0` on every patched round.

⛔ **Also refuted here:** the radio-warmth hypothesis. Connections during an
active burst live *shorter* than idle (12.9 s vs 15.4 s vs 16.3 s), so radio
sleep is **not** why the pong is missed. **That mechanism is still unexplained**
— it is the one load-bearing inference in this file that remains unproven.

### Why this bug stays OPEN

1. **The cause is untouched.** Connections still died 9 times in 51 s during the
   round that passed. Only the relay-side `pongWait` change stops that.
2. **The client fix IS now shipped** — merged as `quorum-shared` b24058e (PR #69)
   and published as **2.1.0-39**, which mobile requires and has. It does not
   change this bug's status: the fix makes the loss survivable, it does not stop
   the connections dying. Record: `issues/.done/2026-07-31-ship-send-retention-to-quorum-shared.md`.
   ⚠️ The shipped code differs from what rounds S/T/U validated (per-connection
   buffer rather than a wall-clock window, plus three other departures) and has
   **not yet been run on a device** — see
   `2026-07-31-dm-fix-shipped-confirm-and-measure-spaces.md`.
3. **Two clean rounds are not elimination.** At 15-25% loss a 20-message round
   can pass on luck; the per-message position analysis carries the weight, not
   the 20/20.

Move to `.solved` only when the quorum-shared PR has merged **and** the relay
constant has been raised **and** a round confirms it on a shipped build.

---
*Last updated: 2026-07-31*
