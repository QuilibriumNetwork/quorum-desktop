---
type: task
title: "Desktop has NO send retention — it does not consume the shared WebSocket client that got the fix"
status: in-progress
created: 2026-08-01
area: WebSocket transport / send durability
repos: quorum-desktop (+ quorum-shared if the client is adopted)
related:
  - ".agents/issues/transport/index.md (the map — read first)"
  - ".agents/issues/transport/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md (the root cause this protects against)"
  - ".agents/issues/.done/2026-07-31-ship-send-retention-to-quorum-shared.md (the fix mobile got)"
  - ".agents/issues/transport/2026-07-17-dm-dead-session-autoheal.md (its heal action 1 is the alternative recovery route for desktop; this is the cheaper one)"
---

# Desktop has no send retention

## The finding

The send-retention fix shipped in `quorum-shared` 2.1.0-39 lives in that package's
WebSocket clients. **Desktop does not use them.** It has its own implementation, and its
outbound loop is this:

```ts
// src/components/context/WebsocketProvider.tsx
while ((outbound = dequeueOutbound())) {        // removed from the queue
  const messages = await outbound();
  for (const m of messages) {
    wsRef.current.send(m);                      // written, and forgotten
  }
}
```

Once a message is dequeued and written, **nothing retains it**. There is no replay on
reconnect, and there is not even the ~1 s mid-batch `pendingEnvelopes` requeue that mobile
had *before* the fix. `ws.onclose` sets state and schedules a reconnect; it does not
recover anything in flight.

Verified 2026-08-01 by reading the file and by grepping `src/` for `pendingEnvelopes`,
`SendRetention` and `retainedFrames` — **zero hits anywhere in the desktop source.**

Structurally, desktop is in the weakest position of any client in the estate.

## Why it has not bitten

Desktop does not miss pongs. The relay's deadline is ~1 s (see the root-cause bug) and
Chromium answers in milliseconds over a stable connection; desktop connections have been
observed holding **20+ minutes**, VPN or not. So the blind window essentially never opens,
which is exactly why desktop benches measure **301/301 both directions, 0% loss** while
mobile was losing 15-25%.

**That is a reason it is low urgency, not a reason to close it.** The thing keeping desktop
safe is a property of Chromium's networking stack, not anything in this repo. Any of these
moves desktop into the window mobile lives in, with no recourse whatsoever:

- a flaky or congested home connection, or a VPN adding latency
- a laptop resuming from sleep
- the relay tightening its deadline further, or a different relay/region running tighter
- Electron changing its socket behaviour under us

It is also worth noting the asymmetry is invisible from the outside: nothing in the app or
its logs would tell you desktop lacks a protection mobile has.

## Options

| # | option | effort | notes |
|---|---|---|---|
| **A** | **Adopt the shared `BrowserWebSocketClient`** in place of the in-repo provider | medium | ⭐ The strategically right answer. That client **already has the retention fix** (it was fixed alongside the RN one in PR #69) but **no application currently uses it**, so it is untested in production. One implementation, one place to fix things, and it deletes a divergence rather than adding a mitigation |
| B | Port retention into `WebsocketProvider.tsx` | small | Fastest, but adds a fourth near-duplicate of logic that already exists twice in shared. Keeps the divergence alive |
| C | Do nothing, rely on auto-heal | — | See the sibling task. Strictly worse: a receipt-driven heal reacts after 60 s and only when receipts are enabled, where retention reacts on reconnect and always |

**Recommendation: A, unless adopting the shared client turns out to drag in
transport-unrelated behaviour changes** (subscription handling, reconnect/backoff semantics,
state-change callbacks). Scope that first — if it does, take B and file A as follow-up.

⚠️ Whichever route, **do not simply reuse mobile's tuning without thought**. The defaults
(`12000 ms / 200 frames / 3 replays`) were sized from mobile radio behaviour: an observed
blind window over 5 s and a 4.42 s reconnect gap. Desktop's reconnect profile has never been
measured, and the shipped design keys retention to the **socket close** rather than a wall
clock, so the parameter means something slightly different there.

## Acceptance

1. A desktop send that occurs while the socket is dead-but-`OPEN` is replayed on reconnect,
   with a `[WS-retain] replaying N frame(s) from the previous connection` line to prove it.
2. `duplicates: 0` on a 20-message desktop→desktop burst read from IndexedDB (the DM doctor
   reports this directly), matching what every patched mobile round measured.
3. Fault-injected: kill the socket mid-burst without a close frame and confirm nothing is
   lost. The relay probe (`.agents/scripts/relay-pong-probe.mjs`) demonstrates the server-side
   behaviour; reproducing it against the desktop client needs a local stub or a forced close.

## Not in scope

Fixing the cause. The relay pong deadline is `#183` item 1 and belongs to the lead dev;
everything here only makes the loss survivable, exactly as on mobile.

---
*Created: 2026-08-01 — Last updated: 2026-08-01*
