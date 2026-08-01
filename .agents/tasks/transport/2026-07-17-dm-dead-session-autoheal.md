---
type: task
title: "DM delivery auto-heal — detect via missing delivery receipts, resend / repair without manual reset"
status: OPEN — RE-SCOPED 2026-08-01, and the priority is INVERTED from what this file used to say. Heal action 1 (single-loss resend) is now largely SUBSUMED by the send-retention fix shipped in quorum-shared 2.1.0-39, which does the same thing in seconds instead of 60s and without needing receipts. Heal action 2 (dead-direction re-init) is NOT covered by anything shipped, CANNOT be covered by retention (replaying frames on a broken session achieves nothing), and now has TWO PROVEN causes behind it instead of the "unknown desync" this file assumed. BUILD HEAL ACTION 2; drop or defer heal action 1. ⚠️ GATED on the receipt-truthfulness two-device runtime check — the detector's input signal has been measurably unstable across four rounds. Previously: ⚠️ RE-RAISED 2026-07-26 (dead directions not fixed by PR #238; desktop↔desktop reproduced 0/10 both directions); before that DOWNGRADED 2026-07-17.
created: 2026-07-17
area: DM session lifecycle / delivery recovery
related:
  - ".agents/tasks/transport/index.md (the map — read first)"
  - ".agents/tasks/transport/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md (§6.2 root cause — explains the single-frame loss that originally justified this task)"
  - ".agents/tasks/.done/2026-07-31-ship-send-retention-to-quorum-shared.md (the fix that subsumes heal action 1)"
  - ".agents/tasks/transport/2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md (OPEN, high — a proven cause of exactly heal action 2's case)"
  - "quorum-mobile#183 item 2b (late-join fork — the other proven cause of a permanently dead direction)"
  - "quorum-mobile/.agents/tasks/.done/2026-07-26-receipt-truthfulness-delivery-gated-reads.md (the detector's input signal; runtime check still owed)"
  - ".agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md (three-mechanism resolution; residual single-frame loss)"
  - ".agents/tasks/2026-07-17-dm-session-reset-and-delivery-fix-plan.md (Reset Session button — the manual valve this automates)"
  - ".agents/tasks/transport/dm-ratchet-upstream-divergences.md (Divergence 3: stale init-envelope guard — constrains the heal design)"
---

# DM delivery auto-heal

## ⚠️ Read this first — re-scoped 2026-08-01

**The task splits into two heal actions, and they have moved in opposite directions.**
Build the second one. The first is now mostly someone else's job.

| | heal action 1 — resend single loss | heal action 2 — dead-direction re-init |
|---|---|---|
| **status** | ⛔ largely **SUBSUMED** | ⭐ **UNCOVERED, and now well-motivated** |
| covered by shipped code? | yes — `SendRetention`, `quorum-shared` 2.1.0-39 | **no, and it cannot be** |
| why | retention replays frames written into a dead socket, on reconnect, in seconds — without needing receipts at all | retention replays the **same frames on the same session**. If the session is broken, replaying achieves nothing |
| known cause | §6.2 relay pong deadline — **found, measured, mitigated** | #183 item 2b + the stale-returning-device bug — **proven, unmitigated** |

## Why — the original justification, and what happened to it

*(Rewritten 2026-08-01. The section below used to open "The three systemic killers are
fixed" and treat dead directions as a hypothetical safety net. Both halves have aged.)*

The 2026-07-17 fixes still stand: session destruction on decrypt failure (PR #235), ratchet
state races (PR #236/#237), stale init-envelope redelivery (PR #238). Many more have shipped
since; see the PR ledger in `index.md` §7.

**The observation that motivated this task was correct, and it now has a mechanism.** This
file described, nine days before anyone could explain it:

> *isolated single-frame wire loss. One message vanishes — sent fine, never delivered, no
> error anywhere — while the session stays healthy and the next message lands.*

That is the §6.2 **blind window**, exactly. The relay pings every 9.0 s and destroys the TCP
connection if a client is >1 s answering, with **no close frame**, so `readyState` keeps
reading `OPEN` for another 3.5-5 s and everything written in that gap is accepted by
`ws.send()` and never delivered. Frames written 1.4-3.5 s before a close died in **7 of 7**
cases across two unpatched rounds, with zero survivors inside the band.

**So heal action 1's failure class is real, is understood, and is now handled elsewhere** —
by `SendRetention` (`quorum-shared` 2.1.0-39, merged PR #69), which replays retained frames
on reconnect. It beats the design in this file on every axis that matters: it fires in
seconds rather than after a 60 s receipt window, and it **does not depend on receipts**, so
it also works in conversations where this task's detector is blind by construction.

It also settles this file's main safety worry empirically: **`duplicates: 0` on every patched
round**, which is direct evidence that resending frames on this stack does not produce
visible duplicates or a decrypt-failure storm.

### What is NOT covered, and why heal action 2 went up in value

Retention resends **the same frames on the same session**. That is useless when the session
itself is the problem — and two mechanisms are now *proven* to produce exactly that, where
this file previously assumed only a hypothetical "future/unknown desync":

| cause | shape | status |
|---|---|---|
| **#183 item 2b** — a receiver whose first processed frame sits at chain position ≥2 forks permanently at the next DH turn | the **sender's** direction is permanently undecryptable; the receiver's own direction keeps working. The half-dead conversation | deterministic repro (`dr-advanced-start-fork.mjs`), **upstream, unmitigated on both platforms** |
| **stale-returning-device** — a device returning with months-stale state | loses **100% of sends** toward the peer, silently; sender's UI looks healthy | **OPEN, severity high.** Demonstrated live, probe-verified on three stores |

Both are permanent, neither is recoverable by resending, and a **local session re-init is the
only available recourse**. That is heal action 2, unchanged in design and now much better
justified than when it was written.

⚠️ Note also that §6.2 is a *plentiful supply of the trigger* item 2b needs: frames lost into
a dying socket are exactly the establishment-phase loss that leaves a receiver starting
mid-chain. **That connection is a hypothesis and has not been tested**, but it means dead
directions may be considerably less rare than the 2026-07-17 downgrade assumed.

### Residual for heal action 1 — small, but not empty

Do not delete the single-loss path from the design entirely; just do not build it first.

- `SendRetention` is bounded: **200 frames, 3 replays per frame**. A long connection thrash
  can exceed those.
- The residual node write-loss (#183 item 3) is not covered by any client mechanism.
- **Desktop has no send retention at all** — it is a separate WebSocket implementation that
  does not consume the shared client. Filed as
  `2026-08-01-desktop-send-retention-gap.md`. **Fixing that is a better use of effort
  than building heal action 1 for desktop**, because it is a smaller change with a broader
  blast radius.

## Detection signal (already shipped)

Delivery receipts. Sender-side rules:
- **Single loss:** a message with no delivery-ack after a window (e.g. 60s) while LATER
  messages in the same conversation DID get acked → that frame is lost, session is healthy.
- **Dead direction:** N consecutive messages (e.g. 3) with no delivery-ack within a window
  (e.g. 120s) → the direction is dead (session desync or listen gap).

HARD LIMITATION: if delivery receipts are disabled for a conversation, the detection signal
does not exist — auto-heal is blind there and must no-op. A PROTOCOL-level transport ack
(always on, never user-visible — the Signal/WhatsApp model, where only READ receipts are
optional) would fix reliability but is a REAL PRIVACY TRADE-OFF, not a clean win: even an
invisible ack reveals device reachability/presence to the counterparty (a contact can send
messages just to watch when acks return, mapping the user's online pattern), defeating the
deliberate Quorum stance that a user with receipts off sends NOTHING back. That stance is
STRONGER than Signal's and consistent with the metadata-minimizing ethos — do not trade it
away casually. Lead-dev decision; the principled default is: acks stay fully optional and
the reliability machinery honestly degrades to no-op when they are off. Other caveats: counterparty
genuinely offline must not trigger (no acks at all + no incoming traffic = ambiguous, do
nothing); debounce across reconnects.

> ⭐ **CORRECTION 2026-08-01 — the privacy analysis above is sound but aims at the wrong
> design.** The write-ack now filed upstream as **#183 Ask 3 is RELAY-side**: the node
> confirms *it stored the frame*. It involves no counterparty participation and says nothing
> about the counterparty's device, so it carries **none** of the presence leak described
> above. A contact could not use it to map anyone's online pattern, because the counterparty
> never sends anything.
>
> That matters directly here: a relay write-ack would give this detector a signal that works
> **even with receipts off**, dissolving the HARD LIMITATION cleanly rather than trading
> privacy for it. Keep the paragraph above — it is the right answer for an end-to-end
> delivery ack, and that distinction is worth having written down. But do not cite it as an
> objection to #183 Ask 3.

> ⚠️ **NEW GATE 2026-08-01 — do not go automatic until the detector's input signal is
> verified.** Receipt truthfulness is **code complete on all three platforms** (shared #66,
> desktop #258, mobile #188) but its **two-device runtime check is still owed by both
> clients**. Meanwhile receipts have been **measurably unstable across four device rounds** —
> round T had T1-T4 missing on mobile A, round U had T20 missing on desktop A, gaps moving
> between rounds and devices with no pattern, still marked `[UNCONFIRMED]` in
> `measurements.md`.
>
> Building an automatic ladder on a signal we have repeatedly watched misbehave risks
> **spurious session re-inits**, and session churn has itself been implicated in earlier bugs.
> Sequence: land the receipt runtime check first, then ship detection in **observe-only mode**
> (log what it *would* have healed, heal nothing), read a week of that, and only then enable
> heal action 2. The detector being pure and side-effect-free (see Safety rails) is what makes
> that staging cheap.

## Heal actions (escalation ladder — do the least destructive thing that works)

> **2026-08-01: build #2 first.** #1 is largely handled by `SendRetention` (see Why). Keep it
> in the design as the residual path, but it is no longer the reason this task exists.

1. **[LOW PRIORITY — mostly subsumed]** **Resend on the SAME session** (single-loss case): re-encrypt and re-send the unacked
   message. `retryDirectMessage` already does exactly this (today it is manual, wired to the
   failed-message retry button). The resend advances the ratchet normally; the receiver
   treats it as a new frame. Idempotency: same messageId, receiver-side saveMessage
   overwrites/dedupes by messageId.
2. ⭐ **[THE TASK — build this]** **Session re-init + resend** (dead-direction case): do what the Reset Session button does
   — which, IMPORTANT (verified 2026-07-17), is **LOCAL-ONLY**: delete local encryption
   states for the conversation; NO signal is sent to the counterparty. The next outgoing
   send then creates a fresh session via a new init envelope, and the counterparty's
   init-envelope path replaces its rows for this device tag. After re-init, resend all
   unacked messages (still in local DB with no deliveredAt).
   - Interaction with the staleness guard (PR #238): the fresh envelope carries a new
     timestamp, strictly newer than anything it replaces → passes `isStaleInitEnvelope`
     on the counterparty. No special handling needed.
   - Do NOT use delete-conversation signaling for healing — that wipes the counterparty's
     conversation state and is a different, destructive operation.

UX: automatic, with at most a subtle one-line notice ("connection repaired") for case 2;
case 1 should be fully invisible. Rationale: eliminating the manual reset is the point.

## Safety rails

- One heal attempt per conversation per cooldown (e.g. 10 min); if a healed session dies
  again immediately, stop and surface a manual "tap to repair" affordance instead of
  thrashing.
- Log every trigger and action loudly (warn level, consistent with the session-lifecycle
  log net from PR #238) for field diagnosis.
- Keep detection decision logic PURE (counts, windows — no storage/transport) and
  extractable to quorum-shared; mobile has receipts and the same residual loss class.
- **(2026-08-01)** Purity is now load-bearing rather than tidy: it is what makes the
  observe-only staging above cheap, and what lets the detector be unit-tested against
  recorded receipt sequences instead of needing a device round per iteration.
- **(2026-08-01) Do not trigger on transient non-delivery.** Connections now die roughly
  every 15 s on mobile by relay design, so brief non-delivery is *normal background*, not a
  signal. Anything retention is going to rescue will have landed well inside the 60 s / 120 s
  windows, so a detector that fires later is looking at genuine residue — but only if the
  windows are respected. Never trigger on first failure.

## Definition of done

1. Receipt-truthfulness two-device runtime check recorded (prerequisite, owned elsewhere).
2. Pure detector implemented with unit tests over recorded receipt sequences, covering: single
   loss, dead direction, counterparty-offline (must no-op), receipts-disabled (must no-op).
3. Shipped in **observe-only** mode; a week of logs read.
4. Heal action 2 enabled behind the cooldown rail, with the "connection repaired" notice.
5. A dead direction deliberately induced (`dr-advanced-start-fork.mjs` reproduces item 2b's
   shape) and observed to self-heal without a manual reset.

---
*Created: 2026-07-17 — Last updated: 2026-08-01*
