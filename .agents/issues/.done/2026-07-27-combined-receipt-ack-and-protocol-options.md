---
type: task
title: "DM receipt protocol: read acks now name what they read (option 2b, shipped)"
status: done
created: 2026-07-27
completed: 2026-08-01
priority: medium
effort: option 2b done end to end; what is left lives elsewhere — see §11
area: DM receipts — shared ReceiptService + receipt wire types, desktop MessageService/ActionQueueHandlers, mobile WebSocketContext
repo: quorum-shared (protocol + service) + quorum-desktop (wiring) + quorum-mobile (wiring)
shared_change_required: true
related:
  - "quorum-mobile/.agents/tasks/2026-07-26-receipt-truthfulness-delivery-gated-reads.md (the correctness fix this builds on — SHIPPED all three platforms; §8 lists these as deliberate follow-ups)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-false-receipt-ticks-on-undelivered-message.md (the bug that motivated all of this)"
  - "quorum-mobile/.agents/bugs/2026-07-20-mobile-desktop-message-transport-delay-loss-master.md (transport master — option 3 belongs to this stream)"
  - "quorum-mobile/.agents/tasks/2026-07-24-typing-indicators-and-toggles-port.md (other control-message traffic on the same ratchet — see §6)"
---

# DM receipt protocol: read acks now name what they read

## Status

2026-08-01 — option 2b shipped on all three platforms (shared #67, desktop #267, mobile #205); option 1 skipped, option 2 deferred (R6), two follow-ups spun out to their own files (§11)


## What this document is

**Outcome first: none of the three options originally proposed here were built.** The review
in §8 rejected option 1, deferred option 2, and produced a fourth design — **option 2b**,
which shipped on 2026-07-28 (shared #67, desktop #267). Implementation status and what is
still open are in §9.

What shipped, in one line: a read ack now carries the ids it read alongside the high-water
mark, so a message whose delivery ack was lost in transport can still reach ✓✓ instead of
sitting on one tick forever.

**The document is kept in three layers, oldest first, deliberately not rewritten:**

| Section | Layer | Status |
|---|---|---|
| §1-§7 | The original proposal, written 2026-07-27 | Superseded. Kept because §2's analysis of the two ack shapes is what led to 2b, and §3's hazard analysis is why option 1 was dropped rather than merely deprioritised. |
| §8 | Review response, 2026-07-28 | The decision record. R3 defines 2b; R6 explains why option 2 is deferred rather than rejected. |
| §9 | Implementation status | Historical as of 2026-08-01 — its "what remains" list is now resolved or spun out. |
| §11 | Closure | Current. Start here: what shipped, and where the two surviving follow-ups live. |

Reading §1-§7 as instructions would be a mistake — option 1 in particular is analysed in
detail and then **not built**. They are preserved as reasoning, not as a plan. Anyone picking
this up should read §9, then §8, and treat the earlier sections as background for *why* the
shipped design looks the way it does.

---

## 1. Background — what shipped, and what it left behind

The bug: read acks carry a **high-water mark** ("read up to timestamp Y"). The sender
expanded that into "every own message at or below Y was read **and** delivered", so messages
lost in transport were stamped with a delivery they never earned. The lie was manufactured
entirely on the sender side, so the recipient could never contradict it.

The fix (shared `2.1.0-37` → desktop PR #258 → mobile PR #188): delivery became the single
source of truth. `readAt` may only be set on a message that already carries a genuine
`deliveredAt`. A read ack advances a watermark; it never manufactures a delivery.

**The complication that shaped the design.** Read debounce is 5s
(`READ_FLUSH_TIMEOUT_MS`), delivery debounce is 10s (`DELIVERY_FLUSH_TIMEOUT_MS`), both in
`shared/src/receipts/service.ts:18-19`. So when someone reads without replying, the read ack
reliably arrives **before** the delivery acks for those same messages, at a moment when
nothing has `deliveredAt` yet. Naively gating read on delivery would drop the upgrade
permanently: nothing marked at read time, then delivery lands and sets ✓, but the read
information is gone and it never reaches ✓✓.

So the shipped design is order-independent: the read ack records a per-conversation
watermark, and the delivery ack completes the upgrade for anything at or below it. Whichever
ack lands second finishes the job.

**This works. It is also more machinery than the problem deserves**, and the reason is
structural, not incidental — see §2.

---

## 2. The root asymmetry (the argument to attack)

The two ack types have fundamentally different shapes:

| | Payload | Cost |
|---|---|---|
| **Delivery ack** | the actual **set** of received message IDs (`Map<address, Set<string>>`, `service.ts:35`) | O(n) in messages, batched per 10s window |
| **Read ack** | a single **high-water mark** `{messageId, timestamp}` (`service.ts:37`) | O(1) regardless of how many were read |

Delivery acks are honest by construction: a lost message never enters the set, so it can
never earn a `deliveredAt`. Read acks are inferential: they describe a *range*, and the
sender has to reason about what that range implies.

**The whole reconciliation subsystem exists to bridge that mismatch.** The watermark cache,
the ordering analysis, `reconcile.ts` — none of it would be needed if both acks named
messages explicitly.

### The tell

The shipped invariant has an exception carved into it: *the high-water-mark message is
self-proving, because reading it proves it arrived* (`resolveReadAckPatch`, the
`isHighWaterMark` branch). That is not a special case. **It is the general rule applied to
exactly one message.** If reading X proves X arrived, then a read ack naming X, Y and Z
proves all three arrived.

We have the correct principle, apply it to one message, then build a watermark and a
two-sided reconciliation dance to handle the rest by inference. A special case sitting
inside an invariant usually means the invariant is fighting the data model.

### What the asymmetry buys, and what it costs

It saves bytes on one of the two ack types. The other already pays O(n) over the same
conversation covering largely the same messages. Reading 200 unread messages would make a
set-based read ack roughly 13KB instead of ~100 bytes — but the delivery acks for those same
200 messages already cost that 13KB. It is a 2x on an already-paid cost, not a new order of
magnitude.

For that saving we paid: a per-conversation watermark cache, an ordering hazard that needed
careful reasoning to avoid breaking read receipts entirely, a reconcile module duplicated in
call sites across two platforms, and a correctness bug that misled users for months.

**Reviewer: this is the judgement call.** If you think the bandwidth asymmetry is worth
keeping, option 2 is wrong and option 1 is the right ceiling. Say so explicitly.

---

## 3. Option 1 — combined ack (the proposal)

> **NOT BUILT.** Rejected in review — see §8 R1. The mixed-version hazard analysed below is
> real, and the reason it is fatal rather than merely awkward is that option 1 combines by
> *draining* the delivery buffer, so an old peer ignoring the extra payload destroys those
> delivery acks permanently. 2b carries derived data instead and destroys nothing. This
> section is kept for that analysis.

### What it does

When the read timer fires, drain the delivery buffer into the **same** message instead of
letting it flush separately 5 seconds later. One control message carries both.

Two consequences:

1. **The ordering trap leaves the hot path.** Delivery information arrives atomically with
   (never after) the read information it needs to be gated on, so the common
   read-without-replying case stops depending on the watermark bridge at all.
2. **Trickle-case ack traffic drops.** Per the transport analysis in the truthfulness task
   §7, the worst case (1 msg / 30s, read, no reply) is ~3.0x baseline: one delivery ack plus
   one read ack per message. Combining makes it ~2.0x.

The watermark stays as a safety net — it still earns its place when a *previous* delivery ack
was lost, or when acks genuinely arrive out of order. It just stops being load-bearing for
the ordinary case.

### Wire format

The receipt wire types are **already in shared**: `shared/src/types/receipt.ts`. That file
is the single definition both clients build against, which is the good news — there is one
place to change, not two.

Current shapes:

```ts
type DeliveryAckMessage = { senderId: string; type: 'delivery-ack'; messageIds: string[] };
type ReadAckMessage     = { senderId: string; type: 'read-ack';
                            upToMessageId: string; upToTimestamp: number };
type ReceiptControlMessage = DeliveryAckMessage | ReadAckMessage;
```

**A new `type: 'combined-ack'` is unsafe against old peers — verified, not assumed.** On
desktop, `MessageService.ts:584-636` narrows on `type` through four branches
(`delivery-ack`, `read-ack`, `typing-start`/`typing-stop`, `dm-update-profile`), each
returning `true` to signal "intercepted". An unrecognised `type` matches none of them, falls
past the piggyback extraction at `638-650`, and **reaches the message-save path**. Mobile's
`handleDmReceipt` has the same structure. This is exactly the failure that produced the
typing-signal crash loop mobile documents in that function (124 crash-loops in one 5-minute
capture) — un-intercepted control messages hit `saveMessage`, died on the NOT NULL
`messageId` constraint, were never acked, and redelivered forever.

So: **additive fields on the existing two types**, not a third type. Allow a `read-ack` to
also carry `messageIds`, and a `delivery-ack` to also carry the read HWM fields.

### ⚠️ But additive fields have their own mixed-version hazard — this needs solving

Found while verifying the above; it is **not** a solved problem and it is the sharpest open
question in this proposal.

An old peer receiving an enriched `read-ack` hits `MessageService.ts:596`, processes the read
half, returns `true`, and **silently discards `messageIds`**. That is not merely "loses the
combining benefit". The sending side already drained its delivery buffer to build the
combined ack (`flushForPiggyback` clears the buffer *and* cancels the timer,
`service.ts:172-179`), so **those delivery acks are gone permanently** — nothing re-sends
them.

Consequence in a mixed deployment, updated reader → old-or-new sender:

- The sender never receives delivery confirmation for that batch.
- If the sender is on the **new** truthfulness logic, those messages are gated on a
  `deliveredAt` that will never arrive. Only the HWM message self-proves. The rest sit at
  blank or ✓ indefinitely — the exact "receipts look broken" outcome the truthfulness task
  worked to avoid on mobile.

This is a silent, permanent data loss on a best-effort path, which is the worst combination:
no error, no retry, no visible failure until a user notices missing ticks.

Candidate mitigations, none yet chosen — **reviewer input wanted here specifically**:

1. **Keep the delivery ack separate during a transition window.** Send both (combined
   read-ack *and* the standalone delivery ack) until old peers are gone. Costs the traffic
   saving entirely during the transition, but is trivially safe and trivially revertible.
2. **Only combine when the peer is known-new.** Requires a capability signal we do not
   currently have on the DM path. Probably too much machinery for the payoff.
3. **Do not drain on combine.** Include `messageIds` in the read ack additively but leave the
   delivery buffer intact so its own 10s timer still fires. Delivery info arrives twice
   (harmless — `resolveDeliveryAckPatch` returns `null` when nothing changes, so the second
   is a no-op), and the ordering-trap benefit is still obtained from whichever lands first.
   **This looks like the cheapest safe option** and it deliberately trades the traffic saving
   for correctness. Note it means option 1 delivers its *ordering* benefit but not its
   *traffic* benefit until old peers age out.

If mitigation 3 is right, it is worth asking whether option 1 is worth doing at all versus
going straight to option 2 — since the traffic win was half the motivation.

### Where the combining logic should live

**It can technically be done without touching shared, and it should still go in shared.**

The escape hatch exists: `flushForPiggyback(address)` is public (`service.ts:59-66`) and
drains the delivery buffer *and* cancels its pending timer (`clearDeliveryAddress`,
`service.ts:172-179`), so a platform's `onReadFlush` callback could call it and send one
message with no shared change at all.

Do not do that. The entire lesson of the truthfulness bug was that identical receipt logic
duplicated per platform drifts until one side lies. Implementing "combined ack" twice in
platform code rebuilds exactly that setup, and leaves the behaviour unexpressed in the shared
contract, so nothing prevents one client from combining while the other does not.

Proposed shape in `ReceiptService`:

- `resetReadTimer`'s callback (`service.ts:156-170`) drains the delivery buffer for that
  address alongside the HWM.
- Symmetrically, `resetDeliveryTimer` (`service.ts:140-154`) should pick up a pending read
  HWM if one exists — otherwise a delivery-first flush still splits.
- `flushAll` (`service.ts:112-124`) currently emits delivery and read separately in two
  loops; it should combine per address too.
- Emit via one callback (`onCombinedFlush`, or a merged `onFlush` carrying both halves)
  rather than firing the two existing ones back to back, so platforms cannot send two
  messages by accident.

### Platform wiring

**Desktop** — sends acks through the Action Queue:
- `src/components/context/MessageDB.tsx:1104-1115` (`onFlush` → `send-delivery-ack`) and
  `1157-1169` (`onReadFlush` → `send-read-ack`).
- `src/services/ActionQueueHandlers.ts:1056-1100` (`sendDeliveryAck`) and `1112-1145`
  (`sendReadAck`) build the wire payloads. One combined handler, or one of these extended.
- Action type union: `src/types/actionQueue.ts:33-36`.
- Receive/intercept: `src/services/MessageService.ts:581-600`.
- Note the dedup keys (`delivery-ack:${address}` / `read-ack:${address}`) — a combined action
  needs a single key, or a combined ack can be dropped by a stale pending entry of the other
  kind.

**Mobile** — sends acks directly, no queue:
- `context/WebSocketContext.tsx` — `onFlush` and `onReadFlush` inside the `ReceiptService`
  constructor, both routed through `sendDmReceiptAck`.
- Receive/intercept: `handleDmReceipt`, the `raw.type === 'delivery-ack'` /
  `'read-ack'` branches.

### Mobile does not piggyback at all — verify and decide

**Found while writing this, not previously recorded.** Desktop attaches pending acks to
outgoing DMs (`MessageService.ts:532-539`, calling `flushForPiggyback` and
`flushReadForPiggyback`). **Mobile never calls either method.** It *consumes* piggybacked
acks on receive (`WebSocketContext.tsx:646-651`) but never *produces* them.

Two consequences a reviewer should weigh:

1. The transport analysis in the truthfulness task §7 concluded active back-and-forth costs
   "~1.0x — effectively free" because acks ride along on messages already being sent. **That
   is true for desktop and false for mobile.** Mobile pays a standalone encrypted ack, with a
   ratchet advance, for every ack in every conversation pattern. Real mobile receipt traffic
   is higher than that table implies.
2. It makes option 1 worth *more* on mobile than on desktop, and it raises a separate
   question: should mobile just implement piggybacking? That may be the cheaper win, and it
   needs no wire change at all (the envelope fields already exist and mobile already parses
   them on receive).

**Recommendation: treat "mobile piggybacking" as a sibling item to be decided alongside
option 1, not folded into it.** They are independent, and bundling them makes the diff harder
to review. But do decide them together, because if mobile piggybacks, the trickle case is the
only one option 1 improves for mobile.

### Verification

- Shared: unit tests for the combined flush — read timer drains delivery, delivery timer
  picks up a pending read HWM, `flushAll` combines per address, and neither path can emit two
  messages for one address. Existing receipt tests must stay green.
- Both platforms: existing receipt tests green
  (desktop `receiptReconciliation.test.ts` 12 tests + mobile's port, 12 + 9 wiring).
- **Old-peer compat is the check that cannot be skipped**: a current-version client must
  still process an enriched ack from an updated one, and vice versa. Static reasoning is not
  enough here; this needs a mixed-version two-device run.
- Two-device: the read-without-replying case must still reach ✓✓ (the ordering trap). Note
  this fix makes that case *easier*, not harder, but it is still the highest-risk check.

### Sequencing note (real logistical cost)

Desktop consumes shared via **symlink** (instant). Mobile consumes a **pinned npm version**,
so any shared change needs a publish plus a pin bump before mobile can compile against it.
The truthfulness fix went shared → desktop → mobile over two days for exactly this reason.

**Therefore: decide option 2 before starting option 1.** If both are wanted, doing them as
two shared releases means two publish cycles and two mobile bumps for one subsystem. If
option 2 is chosen, option 1 is largely subsumed by it and should probably be skipped.

---

## 4. Option 2 — symmetric acks (read ack carries the set)

Read acks carry the set of message IDs read, exactly as delivery acks do.

**Why this is the elegant end state:** every message named in a read ack is self-proving, by
the same logic that already exempts the HWM message today. There is no invariant left to
enforce, no watermark, no ordering hazard. The bug class does not get *fixed* — it becomes
**inexpressible**, because you cannot fabricate a delivery for an ID that is not in the list.
`reconcile.ts` largely dissolves.

**Cost — this is a genuine project, not a refactor:**
- `readHighWaterMarks: Map<address, {messageId, timestamp}>` (`service.ts:37`) becomes a set
  per address.
- `onMessageRead` (`service.ts:80-86`) dedupes by "is this timestamp higher", which stops
  making sense for a set — it needs different semantics, and the read-observer call sites on
  both platforms should be re-checked against them.
- Callback signatures change: `onReadFlush(address, hwm)` and
  `onReadAckProcessed(upToMessageId, upToTimestamp, address)`.
- Wire format change in `shared/src/types/receipt.ts`, with old/new peer compat.
- Both platforms rewire; `reconcile.ts` and its tests shrink substantially.
- Ack size grows with the number of messages read (see §2 for why this is likely acceptable).

The truthfulness task rejected this as "a wire-format change, drops the O(1) ack property,
and needs old/new peer compat". **That was the right call for a correctness fix that needed
to ship fast and stay wire-neutral. It is not automatically the right permanent verdict**,
and it is worth deciding deliberately rather than by inheritance.

---

## 5. Option 3 — per-conversation sequence numbers

A monotonic per-conversation counter, so the **receiver** can detect a gap: "I have 1, 2, 3,
5 — 4 is missing", and ask for a retransmission.

This is the only one of the three that *repairs* loss rather than being honest about it.
Everything else in this document, including the shipped fix, is bookkeeping about a lossy
channel. Today the receiver has no idea a missing message ever existed, which is why the
sender-side fix was the only place the bug could be addressed at all.

Large protocol change. **Belongs to the transport reliability stream, not the receipt stream**
(`quorum-mobile/.agents/bugs/2026-07-20-mobile-desktop-message-transport-delay-loss-master.md`),
and should be scoped there against the known open send-side losses rather than here. Listed
so the reviewer can see the full ladder and judge whether options 1 and 2 are worth doing at
all if 3 is coming.

---

## 6. Scope boundary — typing indicators

Typing signals are the other small control message on the same DM ratchet: throttled to one
`typing-start` per 5s per scope with an 8s receive TTL
(`shared/src/typing/service.ts`). Desktop has them; **mobile has neither send nor receive
nor UI** — it intercepts `typing-start` / `typing-stop` purely to consume them, because
un-intercepted they fell through to `saveMessage` and crash-looped. The port is planned
(`quorum-mobile/.agents/tasks/2026-07-24-typing-indicators-and-toggles-port.md`, status
`todo`, no shared change needed).

**Recommendation: do NOT fold typing into any combined-ack envelope.** The two have opposite
latency requirements. A typing signal is worthless if delayed — it must go now. An ack is
explicitly deferrable, which is the entire basis of the 5s/10s debounce design. Batching them
together would either make typing laggy or make acks chatty.

It is relevant in two narrower ways, both worth a sentence in the reviewer's response:

1. **Volume context.** The truthfulness task §7 notes that in an active conversation typing
   indicators already cost more than receipts do. Mobile's typing port will add that traffic
   on top of mobile's already-higher receipt traffic (see the no-piggybacking finding in §3).
   If control-message volume is a concern, typing is the larger lever, not receipts.
2. **A shared question deferred.** There is now a family of small control messages over the
   DM ratchet (`delivery-ack`, `read-ack`, `typing-start`, `typing-stop`), each with its own
   timer and flush policy and no common notion of batching. Option 1 could be framed narrowly
   (acks only) or generally (a control-message envelope). **This document proposes narrow**,
   for the latency reason above. A reviewer who disagrees should say so now, because it
   changes the shape of the shared API.

---

## 7. What the reviewer is asked to decide

> **All six answered in §8** ("Verdicts on §7"). Kept so the answers there have their
> questions attached.

1. **Is §2's argument right?** The claim is that the read-ack O(1) optimisation does not pay
   for itself, given delivery acks already pay O(n) over the same conversation. If that is
   wrong, option 2 is off the table and option 1 becomes the ceiling.
2. **Option 1's mixed-version hazard — the sharpest open question.** A new `combined-ack`
   type is verified unsafe (falls through to `saveMessage` on old peers). But additive fields
   let an old peer silently discard the delivery half of a combined ack *after the sender has
   already drained its buffer*, permanently losing those delivery acks — which under the new
   gating leaves real messages stuck without ✓✓. §3 lists three mitigations and leans toward
   #3 (do not drain on combine; let the delivery timer still fire; accept duplicate delivery
   info, which is a no-op). **Confirm, correct, or propose better.** If #3 is right, option 1
   loses its traffic benefit until old peers age out and keeps only the ordering benefit,
   which materially weakens the case for doing it before option 2.
3. **Option 1 or option 2 first?** They are not independent: option 2 subsumes most of option
   1, and each shared release costs a publish plus a mobile pin bump. Doing 1 then 2 pays
   that twice.
4. **Mobile piggybacking** — separate item, decide alongside. Possibly a bigger win for
   mobile than option 1, and needs no wire change.
5. **Narrow (acks only) vs general (control-message envelope)?** §6 proposes narrow.
6. **Does option 3 change the answer?** If sequence numbers are coming in the transport
   stream, some of this may be premature.

Nothing here is approved. The shipped receipt behaviour is correct as-is; every option in
this document is an improvement to elegance, traffic, or repairability, not a bug fix.

---

## 8. Review response (2026-07-28) — verification results and verdicts

Reviewed with all three repos checked out side by side. **Every code citation above was
verified against the current code and is accurate** — files, line numbers, behaviours, the
124-crash-loop figure (verbatim in the mobile comment, `WebSocketContext.tsx:632-637`),
shared `2.1.0-37`, the 12-test desktop suite, and the four cross-referenced `.agents` files.
The two claims the preamble asked to be attacked were both probed in depth. Both hold, but
each leads somewhere the document did not go.

### R1. The mixed-version hazard is real — and it is specific to option 1

Confirmed end to end: `flushForPiggyback` destroys the buffer and its timer
(`clearDeliveryAddress`), the shipped `read-ack` branch reads only the two HWM fields, and
nothing re-sends a drained batch. Mitigation 3 is also confirmed safe — duplicate delivery
info resolves to `null` in `resolveDeliveryAckPatch` (`reconcile.ts:107`).

The sharper observation is *why* the hazard exists: option 1's enrichment carries state that
was **destructively drained from a different buffer** at the sender. An enriched read ack
whose extra payload is instead *derived* (from the reader's own read state) destroys nothing
when an old peer ignores it — behaviour degrades to exactly today's, not to permanent loss.
The hazard is not a property of enriched acks; it is a property of draining-to-combine. That
kills option 1 rather than merely weakening it: its traffic benefit is unobtainable safely,
and R3 below gets its ordering benefit without draining anything.

For completeness, a fourth mitigation exists: invert the direction and enrich the
**delivery** ack with the read HWM. Old peers keep the delivery half (their existing branch
processes `messageIds`) and drop the read half — on *every* combined flush, so ✓✓ largely
stops appearing against old peers for as long as they stay old. It is the only mitigation
that buys the traffic win without a capability signal, and its price is a visible, repeating
regression instead of silent loss. Recorded to close the space; not recommended.

### R2. §2 is half right — the watermark is not (just) a bandwidth optimisation

The claim "O(1) does not pay for itself" is correct as far as it goes: the saving is ~2x on
an O(n) cost delivery acks already pay, and steady-state read acks would be small.

What §2 misses is that the two ack shapes differ on a second axis the document never names:
**delivery acks are incremental** (each states a delta; a lost one is lost forever — the
shipped design accepts this), while **the read watermark is cumulative** (each ack restates
the entire read history, so a later ack restores read status that a lost earlier ack would
have set). To be precise, because it is the exact place this subsystem's original bug lived:
that healing applies **only to `readAt`, and only on messages that already carry a genuine
`deliveredAt`**. The watermark never manufactures a delivery, so a message that never landed
stays blank forever no matter how far past it the watermark advances. Verified 2026-07-28
against all four write paths and pinned by tests (see R5). Full option 2 quietly trades
that away: with sets, a lost read ack leaves messages read-but-never-again-named at ✓
forever, where today they heal at the next read. On this transport — whose documented loss
is the motivation for the entire stream — degrading read receipts to delivery-receipt
reliability is a real cost, not an elegance-neutral refactor. The "tell" in §2 is correctly
observed but misread: the HWM exception is not the general rule struggling to get out. It is
the *immediacy* rule, and the watermark is the *recovery* rule. A design can have both.

### R3. Option 2b — the shape options 1 and 2 were both reaching for

Add an optional `messageIds` field to the **existing** `read-ack`: the IDs read since the
last read flush, accumulated in `ReceiptService.onMessageRead` — which already receives
every ID individually and currently discards all but the max. Keep the HWM fields and the
watermark machinery permanently, as the recovery layer rather than a compat shim.

- **Honest by construction**: every named ID was genuinely read, so per-message
  delivered+read proof is the `isHighWaterMark` branch of `resolveReadAckPatch` generalised
  to n messages — a few lines, not a new subsystem.
- **Kills the ordering trap** the way option 1 wanted to: the read ack itself proves
  delivery for everything it names, so read-without-reply reaches ✓✓ immediately — no timer
  coupling, no combined callback, no dedup-key surgery.
- **Repairs lost delivery acks**, which nothing today can (only the single HWM message
  self-proves): a read ack naming M yields ✓✓ even when M's delivery ack died in transport.
  Strictly better loss behaviour than the shipped design, not merely equal.
- **Mixed-version safe with nothing to mitigate**: the set is derived from read state; the
  delivery buffer is never touched; an old peer ignoring `messageIds` gets today's behaviour
  bit for bit. Losing the set in transport falls back to the watermark heal.
- **Cost**: one additive wire field (and its mirror inside `ReceiptEnvelopeFields` for the
  piggyback path), a read-set buffer beside the HWM in shared, one extended callback
  signature, and set-processing inside the single intercept function each platform already
  has. One shared release, one mobile pin bump. Read acks grow by the IDs read per 5s
  window — one ID in the trickle case; a 200-message backlog read approaches delivery-ack
  size, which §2 already argues is an acceptable ceiling.

This supersedes option 1 entirely. Its relationship to option 2 is narrower than "replaces"
— see R6.

### R4. Smaller verified findings

- Mobile's no-piggybacking gap is confirmed (neither `flushForPiggyback` nor
  `flushReadForPiggyback` is called anywhere in quorum-mobile) and everything needed to fix
  it already exists on the wire and at both receive sites. It is the cheapest real traffic
  win available: mobile-only diff, no shared release, no compat risk.
- Mobile guards ack processing against multi-device self-echo (`raw.senderId !== self`,
  `WebSocketContext.tsx:622-631`); desktop has no such guard. Any enriched format must keep
  `senderId`, and 2b's set-processing on mobile must sit behind the same guard.

### R5. Re-verification: the original bug cannot recur, and 2b cannot reintroduce it

Checked explicitly (2026-07-28) because R2's "the watermark heals" phrasing invites the
misreading that a watermark can mark undelivered history read. It cannot.

**All four write paths delegate to the same shared resolver — no per-platform logic exists
to drift:** desktop cache `MessageDB.tsx:1198` and IndexedDB `db/messages.ts:521`; mobile
cache `WebSocketContext.tsx:5764` and SQLite `messagesDb.ts:672`. Same for the delivery side
(`MessageDB.tsx:1139`, `messages.ts:480`, `WebSocketContext.tsx:5723`, `messagesDb.ts:637`).

**The gate itself** (`reconcile.ts:80-84`): `covered` requires `deliveredAt !== undefined`,
so a past message below the watermark with no delivery returns `null` — no `readAt`, no
`deliveredAt`. Only the HWM message is exempt, and only because being read proves it
arrived. The delivery-side heal (`reconcile.ts:103`) can only run on a message named in a
delivery ack, so a never-delivered message never reaches it.

**Pinned by tests, both repos, all green** (`reconcile.test.ts` 28/28 run 2026-07-28):
"leaves an undelivered message untouched — the core fix", "leaves a lost message blank in
both orders", and the ten-message regression "reproduces the reported bug: lost messages
stay blank while neighbours upgrade" (m4 and m7 lost, read ack for m10 → both stay blank,
the other eight upgrade). Desktop's 12-test DB suite mirrors each case against IndexedDB.

**2b does not reintroduce it.** The set names only messages the recipient actually read,
which is proof of arrival by the same logic that exempts the HWM today — it is not a range
expanded into implied deliveries. A never-delivered message is never read, so it can never
appear in the set. 2b widens the self-proving exemption from one message to n; it does not
weaken the delivery gate, and `covered` stays exactly as it is for everything unnamed.

*(Caveat unchanged from today's design: a peer could name IDs it never received. That is a
lie the HWM already permits, bounded to receipts, and out of scope here.)*

### R6. Option 2 is not a rival to 2b — it is a possible sequel, gated on transport

Worth stating plainly because "do 2b instead of 2" reads as a choice between two designs,
and it is not. **2b is option 2's mechanism without option 2's deletion.** Both make read
acks name messages explicitly; they differ on exactly one question — does the high-water
mark stay? 2b keeps it, permanently, as the recovery layer. Option 2 removes it.

So everything option 2 was wanted for, 2b already delivers: explicit naming, the bug class
becoming inexpressible, the ordering trap gone. What is left of option 2 is purely **deleted
code** — the watermark cache on both platforms, `deriveReadWatermark` /
`advanceReadWatermark`, and the `readWatermark` parameter threaded through
`resolveDeliveryAckPatch` and all four write paths. That is a real simplification, and it is
the only thing still on the table under the option 2 heading.

Per R2, making that deletion is wrong **while the channel loses messages**, because the
watermark is what heals a lost read ack. It stops being wrong the day read acks become
reliable — which is precisely what option 3's stream would provide. So option 2 is not
rejected, it is **reclassified**: no longer "the elegant end state to pick instead of 1",
now "the cleanup to revisit if and when transport work makes the recovery layer dead weight".

**Order matters, and it favours doing 2b first.** After 2b the wire already carries the set,
so option 2 later is a pure code deletion — no wire change, no compat window, no mobile pin
bump for protocol reasons. The reverse is not true: doing option 2 now spends a wire change
to remove the HWM field, and re-adding it later would cost a second one. 2b therefore keeps
option 2 available and makes it cheaper, while option 2 first forecloses the middle ground.

**Practical instruction for whoever implements 2b: do not delete the watermark as part of
it.** The temptation will be real — once read acks name messages, the watermark looks
redundant in every test that passes. It is not redundant; it is the only thing standing
between a dropped read ack and a permanently missing ✓✓.

### Verdicts on §7

1. **§2 half right** — the bandwidth argument is correct, but the watermark's
   cumulative-recovery property (missed by §2) must survive any redesign. See R2.
2. **Hazard confirmed; mitigation 3 verified safe; but moot** — drain-to-combine should not
   ship at all. See R1.
3. **Neither "1 then 2" nor "2"**: skip option 1, and do **2b** (R3) as the single wire
   change. Option 2 is not dropped — it survives as an optional later code deletion once
   read acks are reliable, and doing 2b first is what keeps it cheap. See R6.
4. **Mobile piggybacking: yes, and first** — before and independent of any wire change;
   file it as its own task in quorum-mobile.
5. **Narrow.** Typing's latency profile (5s throttle / 8s TTL, verified) is incompatible
   with deferrable acks; a general envelope is speculative until a third deferrable control
   type exists.
6. **Option 3 changes nothing here**: sequence numbers are receiver-side channel repair;
   receipts remain the sender-side honesty layer. 2b narrows what option 3 must explain
   (fewer stuck-tick states); it does not compete with it.

**Recommended sequence**: mobile piggybacking now (mobile-only) → option 2b as one shared
release + pin bump → skip option 1 → option 3 scoped in the transport stream as planned →
option 2 revisited only after that, as a pure deletion, if read acks have become reliable.
Nothing is urgent; the shipped behaviour is correct.

---

## 9. Implementation status (2026-07-28) — superseded by §11

> Kept as the record of what was open on the day desktop shipped. Every item in
> "What remains" below has since been resolved or given its own file — see §11.

**Option 2b is shipped on shared + desktop.** Option 1 was skipped as decided; option 2
remains deferred per R6, and the watermark was deliberately NOT deleted.

- **quorum-shared #67** (squash-merged to `master`): optional `messageIds` on
  `ReadAckMessage` and on the piggyback envelope; `ReceiptService` accumulates a per-address
  read set beside the mark and emits both as one `ReadFlushPayload`;
  `resolveReadAckPatch`'s `isHighWaterMark` generalised to `isNamed`. 522 tests green
  (receipts 74, was 63). Version bumped to `2.1.0-39` in a standalone commit on master —
  **`2.1.0-38` was skipped**, it existed only inside the PR squash. Not yet published to npm.
- **quorum-desktop #267** (squash-merged to `main`): read flush carries ids through the
  action queue and the piggyback envelope; both the standalone `read-ack` intercept and
  piggybacked `readAckUpTo` pass them to reconciliation; the IndexedDB walk applies them.
  560 tests green (receipt storage 18, was 12). Typecheck and build clean.

The observable gain: a message whose delivery ack was lost now reaches ✓✓ when the peer
reads it, instead of sitting on one tick forever. The delivery gate is unchanged — an
UNNAMED undelivered message is still refused, pinned by tests in both repos.

### What remains — NOT only mobile

1. **Live verification largely closed by test, integration risk remains.**
   `src/dev/tests/db/receiptLostDeliveryAck.test.ts` drives the real `ReceiptService` through
   its real 5s flush timer and the real IndexedDB walk, and proves four messages with NO
   delivery ack all reach delivered+read — with a paired test that strips the ids and shows
   only the mark upgrades, so the result cannot come from the old path. Not covered:
   encryption/transport, tick rendering, and the glue inside `MessageDBProvider`'s
   `onReadAckProcessed` (mirrored in the test, not imported). Wire serialisation is a
   non-question: `delivery-ack` has always carried `messageIds: string[]` in production.
   **See §10 if a live run is still wanted.**
2. **Publishing `2.1.0-39` is the lead dev's step, NOT ours.** Our shared-side work ended
   when the bump commit landed on master — we never run `npm publish`. npm latest is
   `2.1.0-37`, so mobile still resolves its pin and is entirely unaffected today. Item 5
   below is **blocked** on that publish, not merely unstarted.
3. **Desktop self-echo guard — open question from R4, now sharper.** Mobile guards its ack
   intercepts with `raw.senderId !== self` because own acks fan out to the user's other
   devices; desktop has no such guard. Verified 2026-07-28 that `encryptAndSendDm` excludes
   only the *sending device's* inbox (`MessageService.ts:998`), not the user's other
   devices, so the fan-out is real on desktop too. What is NOT established is whether it
   causes damage: desktop keys the ack to the envelope sender, so a self-echo may land on a
   self-addressed conversation that does not exist and no-op, where mobile keys to the
   conversation partner and would mis-apply it. **Needs a multi-device desktop check before
   being called either a bug or a non-issue.** 2b does not worsen it — named ids are the
   partner's message ids and never match own messages — but the high-water-mark path is
   unaffected by that reasoning.
4. **Mobile piggybacking** (mobile-only, no shared release, no compat risk) — still the
   cheapest remaining win, still unstarted.
5. **Mobile 2b wiring** — **BLOCKED** until the lead dev publishes `2.1.0-39`, since mobile
   consumes shared as a pinned npm version rather than a link. Nothing to do here meanwhile.

Items 1 and 3 are desktop work we can do now. Item 2 is not ours. Item 4 is mobile and
unblocked; item 5 is mobile and blocked.

---

## 10a. Independent review findings (2026-07-28)

Two reviewers were run cold on the merged diff, in fresh context: a correctness/wiring pass
and a silent-failure hunt. **Both independently ranked the same issue first.**

**Fixed:**

- **Malformed `messageIds` crashed the receive path.** The value is untrusted peer JSON and
  went straight into `new Set(...)`. An array-LIKE object (`{"length":1,"0":"x"}`) is valid
  JSON, passes a truthy `.length`, and is not iterable — so the Set constructor throws. On
  the steady-state DM path there is no try/catch around `interceptControlMessages`, so the
  whole ack was lost including its valid mark; on the init path the raw control JSON could
  be persisted and rendered as a chat message. **A crash surface introduced by 2b.** Fixed
  in shared (`sanitizeReadMessageIds`) so both platforms inherit it; anything not an array
  of non-empty strings degrades to mark-only. Nine tests added.
- **Two comments of mine overclaimed** and are corrected. `sendReadAck` asserted a
  superseding queued ack "carries a mark at least as high" — nothing enforces that, since
  each flush window computes its mark from scratch, so reading newer-then-older produces a
  lower mark that replaces the higher one. It also said the affected messages "fall back to
  needing their own delivery ack", which is empty for exactly the messages naming rescues.
  `updateMessagesReadAt` claimed the cursor covers every named id — true only for a
  well-behaved peer.

**Known, recorded, not fixed:**

- **Queue dedup drops named ids.** `enqueue` deletes the pending task sharing
  `read-ack:${address}`, so two read flushes before the queue drains (it stalls entirely
  while offline) destroy the earlier window's ids. A message with no `deliveredAt` then
  stays on one tick. **A missed rescue, not a regression** — it was stuck before 2b too.
  The fix is merging ids into the superseded task instead of replacing it.
- **Cache/DB divergence on an out-of-range named id.** `resolveReadAckPatch` honours a
  self-proving message regardless of date; the IndexedDB cursor stops at `upToTimestamp`
  while the React Query cache walk has no bound. An ack naming an id newer than its own mark
  marks it live and not on disk, so the tick vanishes on reload. **Pre-dates named ids** (the
  high-water-mark message always had this shape) and our sender never emits it. Deliberately
  not "fixed" by widening the DB walk: doing so means fetching by message id outside the
  conversation-bounded cursor, which introduces a cross-conversation write surface that does
  not currently exist.
- **Drain-then-send-throws on the piggyback path.** `flushForPiggyback` clears the buffer
  before the caller encrypts; if that send throws, the ids are gone with nothing to
  re-buffer. Pre-existing shape — the bare mark always rode it — but named ids now ride it
  too. The offline ActionQueue path is safer here since the drained data is persisted with
  the queued task and retried.

Both reviewers confirmed the core invariant holds: no path marks a message read or delivered
that was neither named nor genuinely delivered.

---

## 10. How to verify this live (the obvious test does not work)

**Two desktop accounts is the right setup, but a plain happy-path run proves nothing about
2b.** In a healthy channel the delivery acks arrive, so messages reach ✓✓ through the
pre-existing delivery path exactly as they did before this change. That run is still worth
doing as a regression check — it confirms nothing broke — but it does not exercise the new
capability at all.

**The new capability only shows itself when a delivery ack never arrives.** That is the whole
point of 2b: naming a message is the *alternative* proof of arrival.

### The blocked route

The clean way to simulate it would be delivery receipts OFF, read receipts ON, on the reader.
Then no delivery acks are ever sent (buffering is gated at `MessageService.ts:669`) while
read acks still flow. **This is not reachable from the UI**: both the global
(`UserSettingsModal/Privacy.tsx:169`) and per-conversation (`ConversationSettingsModal.tsx:300`)
switches cascade — turning delivery off forces read off too.

### The workable route

Temporarily patch the **reader's** build to skip delivery-ack buffering — the condition at
`MessageService.ts:667-674` — leaving read receipts on. Then:

1. Account A sends four messages to account B.
2. B opens the conversation and reads them.
3. **Expected with 2b: all four reach ✓✓ on A's side.**

That single run is self-proving, with no before/after comparison needed. Without the named
ids, messages carrying no `deliveredAt` provably cannot reach ✓✓ — only the high-water-mark
message could, so the older three would stay blank. Seeing all four upgrade can only be the
named-ids path.

The headless DM harness (`.agents/tools/dm-debug/`, and the `dm-loss` harness) is the other
candidate, and is the better option if it can be made to drop delivery acks specifically,
since it needs no patched build.

---

## 11. Closure (2026-08-01)

**Option 2b is shipped on all three platforms.** A read ack names the ids it read alongside
the high-water mark, so a message whose delivery ack was lost in transport reaches ✓✓ when
the peer reads it, instead of sitting on one tick forever.

| Repo | PR | What landed |
|---|---|---|
| quorum-shared | #67 | Optional `messageIds` on `ReadAckMessage` and the piggyback envelope; per-address read set beside the mark; `isHighWaterMark` generalised to `isNamed`; `sanitizeReadMessageIds`. Published to npm as **`2.1.0-39`**, now the registry's latest. |
| quorum-desktop | #267 | Ids through the action queue and the envelope, both intercepts, the IndexedDB walk. 560 tests. |
| quorum-mobile | #205 | Ids on the standalone read-ack (omitted when empty), both intercepts forwarding the raw peer value for shared to sanitize, resolver context for the React Query and SQLite walks. 160 tests, receipts 21 → 34. |

The delivery gate is unchanged and pinned on both platforms: an undelivered message the ack
did **not** name is still refused. Mobile's proof is a paired test against real SQLite — three
messages with no delivery acks at all reach ✓✓ when named, and only the mark upgrades when
not, so the result cannot come from the pre-2b path.

### The §9 list, resolved

1. **Live verification** — closed by test as far as test can close it
   (`receiptLostDeliveryAck.test.ts` on desktop drives the real service through its real 5s
   timer and the real IndexedDB walk; mobile's paired SQLite test does the equivalent). The
   residual is integration-only: encryption/transport, tick rendering, and the
   `MessageDBProvider` glue. **§10 is kept** for whoever wants that run — note the obvious
   happy-path test proves nothing here, because a healthy channel reaches ✓✓ through the
   pre-existing delivery path.
2. **Publishing `2.1.0-39`** — **done.** Verified 2026-08-01: it is npm's latest, and mobile
   resolves it from the registry (`yarn.lock`, not a link).
3. **Desktop self-echo guard** — **spun out** to
   `issues/transport/2026-08-01-desktop-ack-self-echo-guard.md`. It never belonged to 2b: it pre-dates
   named ids, and 2b cannot worsen it (named ids are the partner's message ids and can never
   match our own). The fan-out is confirmed real; whether it does damage on desktop is not,
   and settling that needs a multi-device run rather than more reading.
4. **Mobile piggybacking** — **still open, own file**, unchanged by any of this:
   `quorum-mobile/.agents/tasks/2026-07-27-mobile-piggyback-receipt-acks-on-outgoing-dms.md`.
   Mobile consumes piggybacked acks but never produces them, so it pays a full ratchet
   advance for every ack. Mobile-only, no shared release, no compat risk — still the cheapest
   remaining traffic win.
5. **Mobile 2b wiring** — **done** (#205). It was blocked on item 2 and unblocked when
   `2.1.0-39` reached npm.

### Deliberately not done, and why

- **Option 1** (drain the delivery buffer into the read ack) — skipped. Its traffic benefit
  is unobtainable safely, and 2b takes its ordering benefit without draining anything. R1.
- **Option 2** (delete the high-water mark) — deferred, not rejected. The mark is the only
  thing that repairs a *dropped read ack*, and this transport loses messages. It becomes a
  pure code deletion, with no wire change, if and when option 3's work makes read acks
  reliable. R6.
- **Option 3** (per-conversation sequence numbers) — belongs to the transport reliability
  stream, as it always did.
- **The three known-not-fixed items in §10a** stay known and not fixed: queue dedup dropping
  named ids (a missed rescue, not a regression — those messages were stuck before 2b too),
  cache/DB divergence on an out-of-range named id (pre-dates named ids; widening the DB walk
  would introduce a cross-conversation write surface that does not currently exist), and
  drain-then-send-throws on the piggyback path (pre-existing shape).

---

*Last updated: 2026-08-01*

## Review Log
**2026-08-01 - claude-opus-5**: Closed the task — 2b now shipped on all three platforms; added §11 and spun out the one item that was never 2b's
- Mobile 2b wiring landed (quorum-mobile #205): named ids on the standalone read-ack omitted when empty so older peers see a byte-identical message, both intercepts forwarding the RAW peer value so shared's sanitizer (not a local `new Set`) handles malformed input, ids threaded into the resolver context for the React Query and SQLite walks
- Mobile receipts 21 → 34 tests, full suite 160 green; the rescue is proved by a PAIRED test against real SQLite — same three messages with no delivery acks reach ✓✓ when named, only the mark upgrades when not — so the result provably comes from naming
- Verified §9 item 2 is done: `2.1.0-39` is npm's latest and mobile resolves it from the registry per yarn.lock, superseding the doc's "npm latest is 2.1.0-37"
- Spun §9 item 3 (desktop self-echo guard) out to issues/transport/2026-08-01-desktop-ack-self-echo-guard.md — it pre-dates 2b and was holding the parent open for an unrelated reason; re-verified the fan-out filter, which had drifted from the cited MessageService.ts:998 to :1054-1057, and noted `selfAddress` is already a parameter of `interceptControlMessages` so the fix, if needed, is one condition
- Marked §9 superseded rather than rewriting it, keeping the three-layer structure the doc deliberately uses; §10 kept because the live-run caveat (a happy-path test proves nothing about 2b) still applies to anyone attempting it
- Left mobile piggybacking open in its own file, and restated why option 1 stays skipped, option 2 stays deferred, and the three §10a items stay known-and-unfixed

**2026-07-28 - claude-fable-5**: Full verification pass against all three repos, plus reviewer verdicts on §7 recorded as new §8; status updated to reviewed
- All code citations verified accurate: line refs, behaviours, 124-crash-loop figure, shared 2.1.0-37, 12-test desktop suite, all four cross-referenced .agents files
- Mixed-version hazard confirmed end to end and shown to be specific to drain-to-combine (flushForPiggyback destroys buffer+timer); mitigation 3 verified safe via resolveDeliveryAckPatch null on dupes; a 4th mitigation (invert direction, enrich delivery-ack) recorded and rejected
- §2 judged half right: the watermark is cumulative loss-recovery, not just a bandwidth optimisation — full option 2 would regress read-receipt healing on a lossy transport
- Proposed option 2b (additive messageIds on the existing read-ack, watermark retained as recovery layer) — supersedes option 1 and replaces option 2's end state
- Confirmed mobile never calls flushForPiggyback/flushReadForPiggyback; recommended mobile piggybacking as the first, mobile-only win
- Noted desktop lacks mobile's self-echo ack guard (senderId !== self); any enriched format must keep senderId and mobile must keep the guard

**2026-07-28 - claude-fable-5**: Re-verification pass: confirmed the read-ack watermark cannot mark undelivered messages as read, and tightened §8 R2 wording that implied otherwise
- Traced all four receipt write paths — desktop cache MessageDB.tsx:1198 + IndexedDB db/messages.ts:521, mobile cache WebSocketContext.tsx:5764 + SQLite messagesDb.ts:672 — all delegate to shared resolveReadAckPatch; no per-platform logic exists to drift
- Confirmed the gate at reconcile.ts:80-84 requires deliveredAt !== undefined for any non-HWM message, and the delivery-side heal at :103 only runs on messages named in a delivery ack
- Ran shared reconcile.test.ts: 28/28 green, including 'leaves an undelivered message untouched', 'leaves a lost message blank in both orders', and the 10-message regression where lost m4/m7 stay blank while the other eight upgrade
- Confirmed option 2b cannot reintroduce the bug: the read set names only genuinely-read messages (proof of arrival), never a range expanded into implied deliveries
- Added §8 R5 recording this verification; corrected R2's 'any later ack heals any earlier loss' to state that healing covers readAt only, never manufactures a deliveredAt
- Tooling note: src/db/messages.ts contains a raw NUL byte at line 1307 (IDBKeyRange sentinel written literally instead of escaped), which makes ripgrep classify the file as binary and silently skip it in searches

**2026-07-28 - claude-fable-5**: Clarified the 2b/option-2 relationship, which the previous pass overstated as a replacement; added §8 R6 and corrected the affected lines
- Corrected R3's closing claim 'replaces option 2's end state / reconcile.ts never dissolves' — too absolute; the watermark should not be deleted while the channel is lossy, which is a condition, not a permanent rule
- Added R6: 2b is option 2's mechanism minus option 2's deletion; they differ only on whether the high-water mark stays. What remains of option 2 is purely deleted code (watermark cache both platforms, deriveReadWatermark/advanceReadWatermark, the readWatermark param through resolveDeliveryAckPatch and all four write paths)
- Recorded the sequencing asymmetry: doing 2b first leaves option 2 as a pure code deletion with no wire change or compat window, whereas option 2 first spends a wire change to remove the HWM field and would cost a second to re-add it
- Added an explicit implementer warning not to delete the watermark as part of 2b — it looks redundant once read acks name messages, but it is the only recovery path for a dropped read ack
- Updated verdict 3, the recommended sequence, and the status line to reflect option 2 as deferred rather than rejected

**2026-07-28 - claude-fable-5**: Post-implementation update: recorded that option 2b shipped on shared+desktop, and corrected the assumption that only mobile work remains
- Added §9 with the shipped scope for shared #67 and desktop #267, test counts (522 shared / 560 desktop), and the note that shared is at 2.1.0-39 unpublished with 2.1.0-38 skipped
- Updated the status frontmatter from 'reviewed, not approved' to 'option 2b SHIPPED'
- Recorded three remaining NON-mobile items: no live two-device verification yet, shared not yet published to npm, and the R4 desktop self-echo guard
- Sharpened R4 with new evidence — encryptAndSendDm excludes only the sending device's own inbox (MessageService.ts:998), not the user's other devices, so ack fan-out to own devices is real on desktop; whether it causes damage is still unestablished because desktop keys the ack to the envelope sender where mobile keys to the conversation partner
- Noted 2b does not worsen the self-echo question since named ids are the partner's and never match own messages, but the high-water-mark path is not covered by that reasoning

**2026-07-28 - claude-fable-5**: Reframed the document from proposal to record, and added §10 after finding the obvious live test does not exercise the feature
- Replaced the title and 'Purpose of this document' section — it still read as a proposal awaiting review, which was actively misleading now that none of its three options were built; new opening states the outcome first and maps the doc as three layers (§1-7 superseded reasoning, §8 decision record, §9 current status)
- Added a NOT BUILT banner to §3 (option 1) and an 'all answered in §8' note to §7, so neither reads as an instruction
- Added §10: verified that delivery-OFF + read-ON, the clean way to simulate a lost delivery ack, is NOT reachable from the UI — both the global toggle (Privacy.tsx:169) and per-conversation toggle (ConversationSettingsModal.tsx:300) cascade delivery-off into read-off
- Recorded the workable route: temporarily patch the reader's delivery-ack buffering condition (MessageService.ts:667-674), send four messages, expect all four to reach the second tick — self-proving in one run because without named ids only the high-water-mark message could upgrade
- Noted the dm-loss harness as the better alternative if it can be made to drop delivery acks specifically, since it needs no patched build

**2026-07-28 - claude-fable-5**: Ran two independent cold reviewers on the merged diff and recorded findings in new §10a; fixed a crash surface 2b introduced
- Both reviewers independently ranked the same issue first: peer-supplied messageIds went unvalidated into new Set(), and an array-LIKE object like {length:1,'0':'x'} is valid JSON, passes a truthy .length, and is not iterable — confirmed it throws TypeError
- Confirmed the steady-state DM receive path (MessageService.ts:5540) has no try/catch, so that throw discarded the entire ack including its valid high-water mark; the init path catches it but can then persist the raw control JSON as a chat message
- Fixed by sanitizeReadMessageIds in shared so both platforms inherit one implementation — anything not an array of non-empty strings degrades to mark-only, and the mark is never discarded because of a bad set; 9 tests added, shared now 533
- Corrected two of my own comments that overclaimed: sendReadAck asserted a superseding queued ack carries a mark at least as high (nothing enforces it — each flush window computes its mark from scratch, so newer-then-older yields a LOWER mark) and that affected messages fall back to their own delivery ack (empty for exactly the messages naming rescues)
- Recorded three known-not-fixed items: queue dedup dropping named ids (missed rescue, not regression), cache/DB divergence on an out-of-range named id (pre-dates named ids; deliberately not fixed because widening the DB walk introduces a cross-conversation write surface), and drain-then-send-throws on the piggyback path (pre-existing shape)
- Both reviewers confirmed the core invariant holds — no path marks a message read or delivered that was neither named nor genuinely delivered
