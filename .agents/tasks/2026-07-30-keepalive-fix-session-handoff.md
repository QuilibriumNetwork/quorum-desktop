---
type: task
title: "The keepalive fix — RESEARCH DONE, and it refuted the plan. The cause is relay-side; the client work left is send durability"
status: RESEARCH COMPLETE 2026-07-30. Layer 1 (app keepalive) is REFUTED by direct measurement and must NOT be built. Primary fix is a relay config change owed to the lead dev. Layer 2 (send durability) is the remaining client work
created: 2026-07-30
updated: 2026-07-30
area: WebSocket transport / relay pong deadline / send durability
repos: relay/infra (primary fix), quorum-desktop + quorum-shared (send durability only)
related:
  - "bugs/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md §0d (the retraction) and §6 (the revised fix)"
  - "docs/transport-measurements.md § THE RELAY PROBE (the measurements)"
  - "scripts/relay-pong-probe.mjs (reproduces it in ~10s, any machine, no phone)"
---

# The keepalive fix: what the research found

## §1. The headline — the plan was wrong, and measurement caught it

The brief for this session was *"research → fix → verify, because we need to be
sure before handing this to the lead dev."* The research stage refuted the fix
before a line of it was written.

**Planned:** add a ~5 s application-level keepalive to `quorum-shared`, because
"any connection silent for ~11 s is killed and the app has no keepalive."

**Measured:** there is no idle timeout. The relay sends a **protocol PING every
9.0 s** and enforces a **10.0 s read deadline that only a pong refreshes**.
Clients get a **~1.0 second budget** to answer each ping. Application traffic —
including valid frames the relay accepts — does **not** refresh the deadline.

So the planned keepalive would have shipped a release, woken the mobile radio
every 5 s forever, and **changed nothing**. It would have failed the acceptance
test in a way that looked like "the fix didn't take" rather than "the diagnosis
was wrong."

Full evidence: `docs/transport-measurements.md` § THE RELAY PROBE.
Retraction and revised plan: the bug file's §0d and §6.

## §2. What is now established

| fact | evidence |
|---|---|
| relay pings every **9.0 s** | ±0.03 s across many trials |
| read deadline is **10.0 s**, pong-refreshed only | 5 `nopong` runs: 9.71 / 9.98 / 9.99 / 10.02 / 10.03 s |
| **app traffic does not help** | valid accepted `listen`/`unlisten` every 5 s → still died at 10.0 s |
| pong budget is **~1.0 s** | 500 ms late survives; 900 ms late dies |
| kill is a **bare TCP teardown** | no close frame → client sees 1006, clean=false, empty reason |
| a ponging client survives indefinitely | silent-but-ponging connections survived every cap tested |

**Why mobile and not desktop:** browsers and React Native both pong
automatically in native code (Chromium; OkHttp on RN Android), and **JS cannot
see, send, delay or control a pong on any platform**. Chromium answers in
milliseconds. A phone on a mobile radio — radio wake-up, doze exit, WiFi
power-save, any latency spike over ~1 s — misses the budget often enough to be
killed every ~16 s. That also fits the *variable* mobile lifetimes (13.9 /
16.3 / 20.2 s) better than any fixed timer.

**Therefore no client change can fix the cause.**

## §3. What to hand the lead dev — the primary fix

**Raise the relay's pong deadline and ping period.**

```go
// current (inferred from measured behaviour)   // recommended
pongWait   = 10 * time.Second                   pongWait   = 60 * time.Second
pingPeriod = (pongWait * 9) / 10  // 9s         pingPeriod = (pongWait * 9) / 10  // 54s
```

The `pingPeriod = pongWait * 9/10` ratio is the Gorilla WebSocket idiom, so the
relay is almost certainly following the library's example — with `pongWait` set
to 10 s instead of the example's **60 s**. OkHttp's guidance is a 30-60 s
heartbeat. The relay is roughly **six times too tight** for a mobile network.

One configuration change fixes every client, every platform, DMs and spaces,
**with no app release**.

Ask them to confirm: is the 9 s pinger the relay itself, or Cloudflare in front
of it? The Gorilla ratio points at origin app code, but that was not confirmed
server-side.

**Verification for them:** `.agents/scripts/relay-pong-probe.mjs nopong 90`.
Today it dies at 10.0 s. After the change it should survive ~60 s.

## §4. The remaining CLIENT work — send durability only

The client cannot stop the drops, so it must stop losing messages to them.

1. **Widen the replay window.** Retain frames for N seconds after `ws.send` and
   replay unconfirmed ones on reconnect. Messages carry ids and the receive path
   dedupes, so replay is safe. `quorum-shared`'s clients already have a
   `pendingEnvelopes` buffer + flush-on-reconnect; the window is simply far too
   narrow (it rescues only the batch actively being written).
2. ⚠️ **Desktop has no such buffer at all — and does not use the shared client.**
   `quorum-desktop/src/components/context/WebsocketProvider.tsx` is a separate
   implementation; `quorum-shared`'s `BrowserWebSocketClient` is used by no app.
   Desktop's `processOutbound` calls `ws.send(m)` in a loop with no per-send
   `readyState` re-check and no requeue. It is spared today only because
   Chromium pongs reliably — it is not safe, just lucky.
3. **Keep frames pending until acknowledged**, not until `ws.send` returns.
4. **Protocol write ack** (quorum-mobile#183) — unchanged ask, better motivated.

⚠️ Branch + PR per repo. `quorum-shared` changes need the local-link workflow,
and its version bump is a separate commit on master, never on the feature
branch; we never publish (lead dev's call). Mobile is currently on the debug
branch `diag/dm-frame-trace` — branch off master, not off it.

## §5. Acceptance criteria — revised

The Layer 1 rows are void. What remains:

| stage | measurement | pass |
|---|---|---|
| baseline (recorded) | idle capture, drops per 25 min | **81** |
| after the **relay** change | same idle capture, same phone | **≈0 drops** |
| after the **relay** change | 20-message burst, DM doctor both receivers | **20/20 on both** |
| after Layer 2 | burst with a drop forced mid-run | **20/20 still** |

The relay rows cannot be run until the relay change lands. Layer 2 is testable
independently — and is worth testing *before* the relay change, while drops are
still plentiful and free.

## §6. Still owed, independent of the fix

- **Confirm the mobile mechanism directly.** That RN misses pongs is *inferred*.
  RN's JS `WebSocket` does not expose ping/pong, so this needs a **packet
  capture on the phone** or **relay-side logs** — an app patch cannot see it.
- **Tie individual lost messages to individual CLOSE events** — one burst with
  the lifecycle probe armed (added after round P). Closes round P's 9 and 10.
- **Production-build check** via TCP sampling (`adb shell ss -tn`), no
  instrumentation needed; folds in the long-owed W-run.
- **Desktop A offline catch-up reading** from round Z.
- **Is the deadline uniform** across relay instances and regions?

---
*Last updated: 2026-07-30*
