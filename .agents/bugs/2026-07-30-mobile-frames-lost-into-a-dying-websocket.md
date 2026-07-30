---
type: bug
title: "⭐⭐ ROOT CAUSE: the WebSocket has NO keepalive, dies every ~16s, and frames written in the blind window before the client notices are silently lost"
status: OPEN — root cause identified 2026-07-30 by direct socket-lifecycle instrumentation. 81 disconnections measured in 25 minutes of pure idle. Desktop shows the same ~19s cycle, so this is NOT platform-specific. Fix design owed
created: 2026-07-30
updated: 2026-07-30
severity: CRITICAL — silently drops 15-25% of all DMs during ordinary use, on every platform, with no error surfaced anywhere and no recovery. This is the leading explanation for the ~6-month message-loss symptom
area: WebSocket transport / connection lifetime / send durability
repos: quorum-shared (the transport clients), quorum-mobile + quorum-desktop (both consume it), and possibly the relay/infra that severs the connection
related:
  - "docs/transport-measurements.md § ROUND P and § THE IDLE CAPTURE (the evidence)"
  - "quorum-mobile#183 item 2 (node write-loss) — this plausibly explains a large share of it CLIENT-side"
  - "tasks/2026-07-29-manual-round-runbook.md (how the rounds were run)"
---

# The socket has no keepalive, dies every ~16s, and takes messages with it

> **TL;DR.** Something in the network path closes any WebSocket that goes quiet
> for **~11 seconds**, and **the app has no keepalive on any platform**. Mobile
> connects, fires a burst of subscription frames, falls silent, and is reaped —
> over and over. Because the close arrives as code 1006 (no close handshake),
> `readyState` still reads `OPEN` for seconds afterwards, so `ws.send()` accepts
> frames that are never delivered and never retried. Measured: **81
> disconnections in 25 minutes**, median **10.9 s of silence** before each kill,
> and DM loss of 15%/15%/20%/25% across four rounds. **The fix is a keepalive
> well under the reap window (~5 s), in the shared transport.**

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
5. **Does traffic keep it alive?** If a connection survives markedly longer while
   messages flow, that is direct evidence a keepalive is the missing piece.
6. **Production build check** — does the `.preview` build show the same cadence?
   Folds neatly into the still-owed W-run.

## §6. Fix direction — two independent layers, both worth doing

### Layer 1 — stop the connection dying (attacks the cause)

**Add an application-level keepalive to the shared transport**, on an interval
comfortably under the measured ~11 s idle reap — **~5 s** gives two chances
before the window closes. None exists today on any platform. The browser and RN
`WebSocket` APIs cannot send protocol-level pings from JS, so it must be a small
application message the relay tolerates (ideally one it echoes, so the client
also learns the connection is alive in both directions).

**If this alone works the loss largely disappears** — no dying socket, no
reconnect storm, no re-subscription churn, no blind window. One change in
`quorum-shared` fixes mobile and desktop, DMs and spaces, for every user.

⚠️ **Open questions to settle before writing it** (see §4 and the research
brief):
- **What actually reaps the connection?** Router, ISP/CGNAT, or Cloudflare in
  front of the relay. If it is a proxy setting, raising it may be the smaller
  fix and the client heartbeat becomes belt-and-braces. It does **not** block
  the client fix, which is correct on any network.
- **Interval vs battery.** A 5 s heartbeat keeps the mobile radio awake and has a
  real power cost. Consider relaxing or suspending it when backgrounded, and
  reconnecting on foreground instead.
- **Does the relay accept an arbitrary keepalive frame**, and is there already a
  no-op message type suited to it?
- **Adaptive interval** — start conservative (~5 s) and only tune upward with
  measurements, since the reap window differs per network.

### Layer 2 — make sends survive a drop anyway (attacks the consequence)

Even with a keepalive, connections will still break sometimes, so the client must
stop treating `ws.send()` as proof of delivery.

1. **Widen the replay window (cheap, high value):** retain frames for N seconds
   after `ws.send` and replay unconfirmed ones on reconnect. Messages already
   carry ids and the receive path already dedupes redelivered frames, so replay
   is safe. The app *has* a pending-queue and flush-on-reconnect path already —
   its window is simply far too narrow, rescuing only the in-flight batch.
2. **Keep frames pending until something acknowledges them**, rather than until
   `ws.send` returns.
3. **Protocol-level write ack (the real fix, upstream):** the standing ask on
   quorum-mobile#183. This finding strengthens it enormously — the failure is not
   exotic server behaviour but the ordinary consequence of a connection that
   breaks every ~19 seconds.

### Sequencing and acceptance criteria

Layer 1 first (cause), Layer 2 second (durability). **For the first time in this
investigation there is a pass/fail test that can actually fail:**

| stage | measurement | pass |
|---|---|---|
| baseline (today) | idle capture, drops per 25 min | **81** |
| after Layer 1 | same idle capture | **≈0 drops**, connection lives minutes |
| after Layer 1 | burst of 20 + DM doctor on both receivers | **20/20 on both** |
| after Layer 2 | burst with a drop deliberately forced mid-run | **20/20 still** |

Re-run the idle capture and one burst round per the runbook; the doctor's
copy-report gives the measurement rows directly.

⚠️ Do **not** treat this as fully replacing #183 item 2 until a burst round with
the lifecycle probe ties individual lost messages to individual CLOSE events
(§5 step 4). It may explain most of it, some of it, or all of it.

---
*Last updated: 2026-07-30*
