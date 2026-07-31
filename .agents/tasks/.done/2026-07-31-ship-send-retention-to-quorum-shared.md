---
type: task
title: "Ship the send-retention fix to quorum-shared (proven locally on device; PR only, no version bump, no publish)"
status: DONE — merged as quorum-shared b24058e (PR #69) and PUBLISHED as 2.1.0-39; mobile requires and has it. Kept for the reasoning trail. ➡️ ACTIVE WORK MOVED TO tasks/2026-07-31-dm-fix-shipped-confirm-and-measure-spaces.md
created: 2026-07-31
area: WebSocket transport / send durability
repos: quorum-shared (the change), quorum-mobile (consumer, blocked on publish), quorum-desktop (separate, see §6)
related:
  - "docs/transport-measurements.md § ROUND Q / ROUND R / ROUND S / ROUNDS T and U (the evidence)"
  - "bugs/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md (root cause)"
  - "quorum-mobile/.agents/scripts/patch-rn-ws-retain.mjs (the proven local patch — gitignored, ask the operator)"
---

# Ship the send-retention fix to quorum-shared

## §0. What shipped (2026-07-31)

Merged into `quorum-shared` master as **b24058e** — PR
[#69](https://github.com/QuilibriumNetwork/quorum-shared/pull/69), squash-merged,
branch deleted. **Version deliberately left at 2.1.0-39; nothing published.**

New file `src/transport/send-retention.ts` holds the policy as a pure,
clock-injected `SendRetention` class (callers pass `now`, so it tests without a
socket). Both `RNWebSocketClient` and `BrowserWebSocketClient` use it. 27 new
tests, 558 passing overall; typecheck and build clean.

Four deliberate departures from §3's "reproduce the local patch" — each one
strengthens it, none weakens it:

1. **Age is measured from send to socket CLOSE, not to replay.** This is §2's
   preferred option 1 (key on connection generation) in its practical form: the
   buffer is per-connection by construction — sealed on `onclose`, drained on
   `onopen` — so the reconnect gap can no longer eat the budget. It also makes
   12s derivable rather than fitted: the relay's own pong deadline is 10s, plus
   margin. **Strictly more protective than what was validated**, since it
   replays a superset for the same constant — including the frame Round T lost.
2. **Frames flushed out of `pendingEnvelopes` are retained too.** The local
   patch retained only in the outbound drain, so a rescued frame landing on a
   second dead socket was lost with no further recourse.
3. **Replays are capped per frame (default 3).** Falls out of (2): re-retaining
   restarts a frame's clock, so without a cap a flapping link would chase the
   same frame forever. Makes the bound stated instead of accidental.
4. **`BrowserWebSocketClient` fixed as well** (§3 left this to judgement). It is
   consumed by no application today, but divergence is how the two drifted in
   the first place, and the shared policy module made it nearly free.

The `[WS-retain] replaying N frame(s)` capture line is preserved verbatim, and
uses `console.warn` rather than `logger.warn` on purpose — `logger` no-ops in a
production build, which would silence the line §5's acceptance test reads for.

**Still open:** the device round in §5 (operator), then everything in §8.
`quorum-mobile` remains on its local `node_modules` patch until a publish.

## §1. Read this first — you do not need to re-derive anything

The investigation is finished. The cause is measured, the mechanism is confirmed
by pre-registered predictions, and a candidate fix has been validated on a real
device. **Your job is to port a working local patch into `quorum-shared` as a
PR.** Do not re-open the diagnosis.

**The mechanism, in five lines:**

1. The relay pings every 9.0 s and kills any client whose pong is >1 s late.
2. It kills with **no close frame**, so the client keeps writing into a dead
   socket for **3.5-5 s** before it notices.
3. Frames written in that blind window are accepted by `ws.send()`, dropped from
   the queue as "sent", and never delivered or retried. **That is the loss.**
4. An existing rescue (`pendingEnvelopes`) already replays frames caught
   mid-batch when the failure surfaces — but its window is only ~1 s wide.
5. **The fix is to widen that rescue.** Nothing else in the client changes.

**The evidence (`docs/transport-measurements.md`):**

| round | retention | result |
|---|---|---|
| Q | none | 16/20 — 4 lost, all inside the 1.4-3.5 s band before a drop |
| R | none | 17/20 — 3 lost, all inside it. Mechanism confirmed by 3 pre-registered predictions |
| S | 6 s | **20/20** — 3 messages survived the band that had killed 7 of 7 |
| T | 6 s | 19/20 — one loss, diagnosed to the reconnect gap eating the budget |
| U | 12 s | **20/20** — 3 messages rescued at ages 6 s would have dropped |

`duplicates: 0` and `decryptFailish: 0` on every patched round.

## §2. Is this a keeper or a stopgap? — BOTH, and the split matters

**The mechanism is permanent. The 12 s constant is provisional.**

**Keep forever.** Treating `ws.send()` as proof of delivery is simply wrong —
it means "the local buffer accepted these bytes", nothing more, in every
WebSocket implementation. Connections will keep breaking for reasons the relay
fix cannot touch: WiFi↔cellular handover, backgrounding, tunnels, genuine packet
loss. A client with no send-side durability loses messages silently on every one
of those. The codebase already agrees with this principle — `pendingEnvelopes`
exists precisely for it, and is simply mis-sized.

**Expected to change.** The **wall-clock window** is the weak part, and Round T
proved it: retention is measured from send to *replay*, so a long reconnect gap
eats the budget (a 4.42 s gap left only 1.58 s of useful coverage at 6 s). Two
better shapes, in order of preference:

1. **Key on connection generation** — stamp each frame with the connection it
   was written on, and on reconnect replay everything from the *previous*
   generation regardless of age. Removes the timing sensitivity entirely rather
   than papering over it. **Prefer this if it is not much more work.**
2. **Ack-driven retention** — retain until something acknowledges the write.
   Needs the protocol write-ack that does not exist yet (#183 item 3). This is
   the real end state; the timer is a stand-in for the missing ack.

So: **ship the durability, and write it so the retention policy is one small
replaceable piece.** Do not present the 12 s number as a considered constant —
it is "worst observed blind window (~5 s) + worst observed reconnect gap
(~4.4 s), plus margin".

## §3. What to implement (quorum-shared)

File: `src/transport/rn-websocket.ts`, class `RNWebSocketClient`.

The proven local patch does exactly three things. Reproduce them in TypeScript:

1. **Retain on send.** After each frame is handed to `ws.send()` in the outbound
   drain, push `{ frame, t }` onto a retention buffer, capped (200 frames ≈ 33
   messages of 6-target fan-out).
2. **Replay on reconnect.** In `onopen`, take everything still inside the
   retention policy and `unshift` it onto the **front** of `pendingEnvelopes`,
   then clear the buffer. Front matters: `pendingEnvelopes` holds frames caught
   mid-batch at the moment of failure, which are chronologically **newer** than
   anything retained, and the recipient must see frames in ratchet order.
3. **Skip anything already queued.** Filter the replay set against
   `pendingEnvelopes` so a frame that failed its `ws.send` (and was therefore
   already pushed there by the catch path) is not queued twice.

Reference implementation, already validated on device:
`quorum-mobile/.agents/scripts/patch-rn-ws-retain.mjs` — gitignored and
local-only, so **ask the operator for it** rather than looking for it in git.

**Also consider** whether `BrowserWebSocketClient` should get the same change.
It is currently used by **no application** (see §6), so it is dead code in
practice — but leaving the two implementations divergent is how they drifted in
the first place. Fixing both is cheap and defensible; say which you chose.

### Safety — already checked, do not re-litigate

Replay can re-send a frame that actually arrived, because the client knows when
it *noticed* the death, not when the relay caused it. This is safe:

- Duplicates are **already routine** — the relay re-pushes frames before the
  delete lands, constantly, today.
- A duplicate's message key was already consumed, so it fails AEAD, is logged and
  deleted. **No message is lost.**
- It **cannot feed crate bug 2a**: skipped keys are filed when a frame arrives
  *ahead* of the ratchet position; a replay sits *behind* it.
- Measured: `duplicates: 0` on both receivers across all three patched rounds.

The cost is log noise. If that becomes loud, the deferred
`tasks/.deferred/2026-07-17-dm-dedupe-before-decrypt.md` is the designed
mitigation and its trigger condition would then be met.

## §4. Process — read carefully, this repo has specific rules

- **Branch + PR** (this is code). **Squash-merge** it.
- ⛔ **Do NOT bump the version. Do NOT publish to npm.** Publishing is the lead
  dev's call. In this repo the version bump is normally a separate commit on
  master *after* merge — **not this time**. Leave the version alone entirely.
- Docs-only changes go straight to `main`/`master` with **no branch and no PR**,
  and are **committed once at end of day**, not per file. Docs that accompany
  *this* code change ride on the code branch.
- Tests: add unit coverage for the retention policy (retain → reconnect →
  replayed in order; aged-out entries dropped; already-queued frames not
  duplicated). Keep the policy pure so it is testable without a socket.

## §5. Verification

The acceptance test is a device round, and the operator runs it. **You cannot
verify this from a bench** — every headless bench uses Node `ws` over a wired
connection, which answers pings in sub-millisecond time and therefore never
hosts the trigger. That is why weeks of green benches meant nothing.

Protocol: `tasks/2026-07-29-manual-round-runbook.md`. The measurement that
carries the weight is **not** the 20/20 — with 15-25% loss a 20-message round
can pass on luck. It is the **per-message position analysis**: for each message,
its gap to the next `[WS-life] CLOSE` and its age at replay time. Run:

```bash
node .agents/scripts/join-losses-to-closes.mjs <capture.log> --burst <run-*.jsonl> --lost 3,4,10
```

A pass means messages that sat inside the blind window survived **and** the log
shows `[WS-retain] replaying N` firing on the reconnects.

⚠️ After any `quorum-shared` rebuild the `node_modules` transport patch is
wiped: re-run `git debug`, then **restart Metro with `-ResetCache`** (a warm
cache serves the old bundle — that cost Round Z its entire dataset).

## §6. Desktop — probably nothing to do, but check

**`quorum-desktop` does not use `quorum-shared`'s WebSocket client at all.** It
has its own `src/components/context/WebsocketProvider.tsx`, and
`BrowserWebSocketClient` is consumed by no application. So **a quorum-shared
change does not reach desktop**, and no desktop consumption work is needed for
this fix.

Separately, and **not part of this task**: desktop's provider has **no
pending-envelope requeue at all** — its `processOutbound` calls `ws.send(m)` in a
loop with no per-send `readyState` re-check and no requeue on failure. It is
spared today only because Chromium answers pings in milliseconds, so it rarely
hits the blind window. That is luck, not design, and it deserves its own task.

## §7. Mobile — blocked, and that is expected

`quorum-mobile` consumes `quorum-shared` from npm, so it **cannot take this fix
until a version is published**, which is the lead dev's call. Until then the
operator's device keeps running the local `node_modules` patch, which is
functionally the same code.

Nothing to do in `quorum-mobile` for this task. Do not link, do not vendor.

## §8. What the lead dev needs to do — hand them this list

1. ⭐ **Raise the relay's pong deadline.** `pongWait` 10 s → 60 s, `pingPeriod`
   9 s → 54 s (the Gorilla example's own values; the relay currently runs ~6×
   tighter than the library's default and OkHttp's 30-60 s guidance).
   **This is the only change that stops the connections dying.** Everything in
   this task only makes the loss survivable. Self-verifying: after the change
   `node .agents/scripts/relay-pong-probe.mjs nopong 90` should survive ~60 s
   instead of dying at 10 s. Filed as **#183 item 1**.
2. **Confirm whether the 9 s pinger is the relay or Cloudflare in front of it.**
   The 9/10 ratio is the Gorilla idiom, which points at origin application code,
   but we only see the edge.
3. **Publish `quorum-shared`** once the PR in §3 is merged, so mobile can
   consume it. Version bump deliberately not done in the PR.
4. **Consider the protocol write-ack** (**#183 item 3**). It would let the client
   retire the timer heuristic entirely in favour of ack-driven retention, which
   is the correct end state.
5. **Unaffected by any of this:** the `channel` crate bugs (**#183 items 2a and
   2b**), which have their own deterministic repros.

---
*Last updated: 2026-07-31*

