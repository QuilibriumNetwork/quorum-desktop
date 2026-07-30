---
type: task
title: "NEXT SESSION — implement and verify the WebSocket keepalive fix (plus the research to be confident before it reaches the lead dev)"
status: OPEN — root cause established 2026-07-30. This file is the brief for the implementation session. Research first, then fix, then verify, then hand over
created: 2026-07-30
area: WebSocket transport / keepalive / send durability
repos: quorum-shared (the fix lives here), quorum-mobile + quorum-desktop (verification)
related:
  - "bugs/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md (THE root cause — read first)"
  - "docs/transport-measurements.md § THE IDLE CAPTURE (the numbers)"
  - "tasks/2026-07-29-manual-round-runbook.md (how to run the verification rounds)"
---

# Next session: the keepalive fix

## §1. Read these first, in order (20 minutes)

1. `bugs/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md` — the root
   cause, the evidence, the two-layer fix, and the acceptance criteria.
2. `docs/transport-measurements.md` § THE IDLE CAPTURE and § ROUND P.
3. `docs/transport-reliability-index.md` §1 item 6h for the one-paragraph frame.

**The one-line version:** any connection silent for ~11 s is killed (code 1006,
no close handshake); the app has no keepalive anywhere; `readyState` stays
`OPEN` for seconds after the break so `ws.send()` swallows frames that are never
delivered and never retried. 15-25% of DMs lost, silently, for months.

## §2. The operator's requirement

> *"We need to be sure of the results before handing this to the lead dev."*

So: **research → fix → verify with numbers → only then hand over.** A plausible
fix is not enough; the acceptance test in §5 must actually pass, and it is
designed so it can fail.

## §3. Research to do BEFORE writing code

The operator explicitly asked for external best-practice research, not only
codebase reading. Worth doing — this is a standard problem with well-trodden
answers, and we should not invent one.

**A. WebSocket keepalive best practice**
- Application-level heartbeat vs protocol ping/pong: browsers and RN cannot send
  protocol pings from JS, so what do production apps actually do?
- Interval selection against an ~11 s reaper. Is ~5 s right? What do widely-used
  real-time SDKs default to, and why?
- Detecting a dead connection *quickly* rather than waiting for a failed write
  (e.g. expecting a server echo within N ms and forcing a reconnect on miss).

**B. Mobile-specific concerns**
- Battery/radio cost of a 5 s heartbeat on Android; standard mitigations
  (suspend when backgrounded, reconnect on foreground, align with app state).
- React Native `WebSocket` (okhttp) specifics: does anything there help or hurt?
  Is there a `pingInterval` reachable from RN, or must it be application-level?
- Behaviour across network transitions (WiFi ↔ cellular, doze, app backgrounded).

**C. Send durability (Layer 2)**
- Standard patterns for "the socket may have eaten my write": pending-until-acked
  queues, replay windows on reconnect, idempotent redelivery.
- What guarantees are reasonable in a P2P/decentralised setting where there is no
  server-side write ack today (see quorum-mobile#183) — and what the client can
  do unilaterally, without protocol changes.

**D. Codebase**
- `quorum-shared` transport clients (RN + browser) — where a heartbeat belongs so
  both platforms inherit it; how `pendingEnvelopes` / `outboundQueue` /
  `resubscribeHandler` interact on reconnect.
- Does the relay accept an arbitrary keepalive frame? Is there an existing no-op
  or ping-like message type? **If not, this needs the lead dev before we ship.**
- Whether the reconnect/backoff logic amplifies the problem (currently a fresh
  connection re-subscribes ~29 frames, ~81 times in 25 min).

## §4. The fix, in two layers

**Layer 1 — keepalive (attacks the cause).** In `quorum-shared`'s transport so
both clients inherit it. ~5 s interval (two chances inside the ~11 s window).
Ideally a message the relay echoes, so the client also learns the connection is
alive inbound. Suspend/relax when backgrounded on mobile.

**Layer 2 — send durability (attacks the consequence).** Stop treating
`ws.send()` as delivery: retain frames briefly and replay unconfirmed ones on
reconnect. Messages already carry ids and the receive path dedupes, so replay is
safe. The app already has `pendingEnvelopes` + flush-on-reconnect — the window is
simply far too narrow (it rescues only the in-flight batch).

⚠️ Branch + PR per repo, as always. `quorum-shared` changes need the local-link
workflow, and its version bump is a separate commit on master (never on the
feature branch); we never publish — that is the lead dev's call.

## §5. Verification — the acceptance test (this is the point)

| stage | measurement | pass |
|---|---|---|
| baseline (recorded 2026-07-30) | idle capture, drops per 25 min | **81** |
| after Layer 1 | same idle capture, same phone | **≈0 drops** |
| after Layer 1 | 20-message burst, DM doctor on both receivers | **20/20 on both** |
| after Layer 2 | burst with a drop forced mid-run | **20/20 still** |

Tooling is already built and merged: mobile burst button (flask icon, dev
builds), desktop `/dev/dm-doctor`, and the socket-lifecycle probe in
`quorum-mobile/.agents/scripts/patch-rn-ws-diag.mjs` (**gitignored, local only** —
re-apply after any `yarn install`; `git debug` does it). Protocol: the runbook.

**Also cheap and worth doing:** the TCP-sampling method (`adb shell ss -tn`,
watching distinct local ports against the relay) needs **no instrumentation**, so
it can measure the `.preview`/production build and confirm live users are hit by
the same thing.

## §6. Still owed from 2026-07-30, independent of the fix

- **Tie individual lost messages to individual CLOSE events** — one burst with
  the lifecycle probe armed (it was added *after* round P). Closes the last
  inferential gap, including round P's messages 9 and 10.
- **Production-build check** (TCP sampling, per above) — also folds in the
  long-owed W-run.
- **Desktop A offline catch-up reading** from round Z.
- **Identify what actually reaps the connection** (router / ISP-CGNAT /
  Cloudflare). Does not block the client fix; may reveal a smaller infra fix.

## §7. What to hand the lead dev, once the numbers are in

1. The root-cause bug file, with the before/after measurements.
2. The client fix (PRs), with the acceptance-test results.
3. The remaining **protocol** ask, unchanged but now much better motivated:
   a **write ack** (quorum-mobile#183). This finding shows the failure is not
   exotic server behaviour but the ordinary consequence of a connection that
   dies whenever it goes quiet.
4. If the relay/proxy idle timeout turns out to be configurable, the
   infrastructure-side ask.

---
*Last updated: 2026-07-30*
