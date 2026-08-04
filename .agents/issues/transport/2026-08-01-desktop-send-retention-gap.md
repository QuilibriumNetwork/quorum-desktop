---
type: task
title: "Desktop has NO send retention — it does not consume the shared WebSocket client that got the fix"
status: in-progress
priority: high
created: 2026-08-01
updated: 2026-08-04
area: WebSocket transport / send durability
repos: quorum-desktop (+ quorum-shared if the client is adopted)
related:
  - ".agents/issues/transport/2026-08-04-flushoutbound-reports-delivered-on-bufferedamount-alone.md (SPLIT OUT 2026-08-04 — the same blind window on the revoke-device path. Adding retention here does NOT fix it; decide the interaction while implementing)"
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
| **D** | **Wrapper**: keep `WebsocketProvider`'s outer React API (context, `flushOutbound`, `DISCONNECT_GRACE_MS`) and delegate the inner socket/queue mechanics to an internal `BrowserWebSocketClient` | medium | Added 2026-08-04. Gets A's consolidation without B's fourth near-duplicate, at the price of an adapter boundary. **Not evaluated in depth** — recorded so the next person does not have to rediscover it |

**Original recommendation: A, unless adopting the shared client turns out to drag in
transport-unrelated behaviour changes** (subscription handling, reconnect/backoff semantics,
state-change callbacks). Scope that first — if it does, take B and file A as follow-up.

## DECIDED 2026-08-04 — take B, file A as follow-up

The condition above was scoped, and **it fired**. Independently reviewed by a second agent
prompted to refute the conclusion; it reached the same call and supplied the `flushOutbound`
finding that became the split-out issue.

**Evidence that A drags in transport-unrelated behaviour:**

- `BrowserWebSocketClient` and `createBrowserWebSocketClient` have **zero consumers** in any
  of the three repos. Only the class, its own test, and the `quorum-shared` re-export. Desktop
  would be its first production user, so A trades a known-narrow gap for an unexercised
  reconnect/backoff/subscription path.
- `DISCONNECT_GRACE_MS`, `flushOutbound` and `bufferedAmount` have **zero equivalents** in
  `quorum-shared/src`. These are not vestigial: `flushOutbound` is called from
  `src/hooks/business/user/useDeregisterThisDevice.ts:142` in the revoke-device-before-wipe
  flow, has a dedicated test (`src/dev/tests/components/websocketFlushOutbound.unit.test.tsx`),
  and exists because awaiting `enqueueOutbound` proves frames were *signed and queued*, not
  sent.

Swapping a tested, security-relevant surface to close a gap that is currently latent is the
wrong trade. B is a small integration against a class that is already published and already
running in production on mobile.

**A stays desirable** and should be revisited once `BrowserWebSocketClient` has a consumer,
or if a second transport fix has to be written twice. Option D may be the cheaper route to it.

⚠️ Whichever route, **do not simply reuse mobile's tuning without thought**. The defaults
(`12000 ms / 200 frames / 3 replays`) were sized from mobile radio behaviour: an observed
blind window over 5 s and a 4.42 s reconnect gap. Desktop's reconnect profile has never been
measured, and the shipped design keys retention to the **socket close** rather than a wall
clock, so the parameter means something slightly different there.

## What Option B actually involves (2026-08-04)

`SendRetention` is a three-method class, so the mechanical shape is small:

```
retain(frame, now)          after each successful ws.send
sealOnClose(now)            in ws.onclose
takeForReplay(now, queue)   in ws.onopen  →  { frames, dropped }
```

It is reachable from the package root — `dist/index.d.ts` does `export * from './transport'`
and `dist/transport/index.d.ts` names `SendRetention` — and desktop's `package.json:64` pins
`link:../quorum-shared`, a local link to the sibling checkout. So **no version bump, no npm
publish, no lead-dev dependency.** (Note the difference from mobile, which consumes the
published `2.1.0-39`. Do not carry mobile's version reasoning across.)

Desktop's `OutboundMessage` is `() => Promise<string[]>`
(`src/components/context/WebsocketProvider.tsx:14`), so a replay is `async () => frames` with
no type change.

### ⚠️ Hazards — the reason this is not a 30-minute job

**H1. Replay ordering is a tested invariant, and desktop cannot honour it by accident.**
The shared client unshifts replayed frames onto the **front** of `pendingEnvelopes`
(`quorum-shared/src/transport/browser-websocket.ts:259`) because replayed frames are older
than mid-batch casualties "and the recipient must see frames in ratchet order". This is not
cautious prose: `quorum-shared/src/transport/websocket-send-retention.test.ts:157-179`
("keeps replayed frames ahead of frames caught mid-batch") asserts `['A','B1','B2']` after a
reconnect.

Desktop's `enqueueOutbound` **only ever appends** (`WebsocketProvider.tsx:228-231`), and
desktop has no `pendingEnvelopes`-equivalent bucket to land ahead of. So the obvious
implementation — `enqueueOutbound(async () => frames)` — replays out of ratchet order, and
does so **silently**. A ported implementation must prepend onto `outboundQueue.current`, which
means adding array-prepend logic that does not exist in that file today.

> **Do not reason past this on "Double Ratchet tolerates reordering".** Textbook DR does,
> via skipped-key storage. This estate has U3/U2 open upstream, one of which is *"skipped-key
> lookup matches by index without checking the bucket belongs to the frame's chain"* — a
> documented defect in exactly the mechanism that would provide the tolerance. Ordering is a
> constraint to preserve here, not one to argue about.

**H2. `flushOutbound` is unsound in the identical failure mode, and retention does not fix
it.** Split out to its own issue (see `related`). Decide the interaction explicitly while
implementing rather than leaving it unaddressed while claiming the retention gap is closed.

**H3. Control frames share the send path, unlike the shared client.** Desktop routes
`{type:'listen'}` through `enqueueOutbound` from at least seven sites (`MessageDB.tsx:599,633`,
`ActionQueueHandlers.ts:775`, `ConfigService.ts:243`, `InvitationService.ts:803`,
`MessageService.ts:1510,3559`), and `MessageService.ts:1508-1515` pushes a `listen` and a
`direct` into the **same batch array**, so they cannot be separated without parsing.

Nuance worth stating precisely, because it is easy to get backwards: the shared client's
exclusion comment (`browser-websocket.ts:342`, "Control frames sent via send() are not
retained") applies only to its `subscribe()`/`unsubscribe()` methods. Anything riding
`enqueueOutbound` **is** retained there too. Desktop has no bypass method at all — even
`setResubscribe` goes through `enqueueOutbound` (`MessageDB.tsx:595-596`). So retaining
desktop's `listen` frames **matches** shared behaviour rather than diverging from it.

The open question is therefore not "exclude them" but: is replaying a stale `listen` harmful
when `resubscribeRef` (`WebsocketProvider.tsx:176`) has already re-issued a full resync on the
same `onopen`? Probably benign — subscribe is idempotent and the stale set is a subset — but
it is undecided, and the replay lands *before* the resubscribe under H1's prepend.

**H4. Verify the `onopen` / `setInterval` interaction.** Both `ws.onopen`
(`WebsocketProvider.tsx:179`) and the 1 s drain (`:216-226`) call `processOutbound()`, and
replay will be added to `onopen`. The `outboundProcessingRef` boolean lock (`:137-141`) looks
sufficient, but it now guards a path that can prepend to the queue mid-drain. Worth an
explicit test rather than an assumption.

**H5. Do not port mobile's constants unexamined** — see the tuning warning below. Desktop's
reconnect is a fixed `setTimeout(connect, 1000)` (`:190`), a *known* profile unlike mobile's,
which is an argument for revisiting `12000 ms` rather than inheriting it.

### Effort

**Roughly a day and a half, not half a day.** The three call sites are ~30 minutes. The cost
is H1 (new prepend semantics plus an ordering test), H3 (a decision), H2 (a decision, or an
explicit deferral in writing), and a fault-injection test.

⭐ **This cannot be verified by using the app.** Desktop essentially never enters the failure
state on its own, so "messages still arrive" proves nothing and would be a green test that
could never have gone red. The instrument is a fake socket killed without a close frame.
`src/dev/tests/components/websocketFlushOutbound.unit.test.tsx:16-49` already has a
`FakeWebSocket` (controllable `readyState`, `sent[]`, `close()`) to build on.

## Acceptance

1. A desktop send that occurs while the socket is dead-but-`OPEN` is replayed on reconnect,
   with a `[WS-retain] replaying N frame(s) from the previous connection` line to prove it.
2. `duplicates: 0` on a 20-message desktop→desktop burst read from IndexedDB (the DM doctor
   reports this directly), matching what every patched mobile round measured.
3. Fault-injected: kill the socket mid-burst without a close frame and confirm nothing is
   lost. The relay probe (`.agents/scripts/relay-pong-probe.mjs`) demonstrates the server-side
   behaviour; reproducing it against the desktop client needs a local stub or a forced close.
4. **Ordering (added 2026-08-04, see H1):** a test asserting replayed frames precede frames
   queued after the close, mirroring `websocket-send-retention.test.ts:157-179`. Without this
   row the fix can ship silently reordered.
5. **Revert-check:** with the fix reverted, rows 3 and 4 must go red. An assertion that passes
   either way is worse than no test.

## Not in scope

Fixing the cause. The relay pong deadline is `#183` item 1 and belongs to the lead dev;
everything here only makes the loss survivable, exactly as on mobile.

`flushOutbound`'s soundness — split to its own issue on 2026-08-04, because it is a distinct
defect on a distinct (security-relevant) path that this fix does not close. H2 records the
interaction that must still be decided here.

---
*Created: 2026-08-01 — Last updated: 2026-08-04*
