---
type: doc
title: "Transport & DM reliability — measurement log (every run, every number, one place)"
status: living — APPEND-ONLY. Add a row when a run produces a number; never rewrite a past row.
created: 2026-07-28
updated: 2026-08-02
area: WebSocket transport / DM Double Ratchet / delivery loss
related: tasks/transport/index.md
---

# Transport & DM reliability — measurement log

**What this answers:** *what have we actually run, in what configuration, and what
did each result change?* Two weeks of capture rounds and bench runs produced
numbers scattered across five documents and three parallel chronologies (findings
A→AL in the captures archive, rounds 1-29 in the mobile master, and per-task
progress logs). None of those answers the question above on its own.

## Why this file is safe to consolidate, when the index deliberately is not

`index.md` refuses to carry status, and it is right to:
statuses are claims about the present, they go stale silently, and duplicating
them is what rotted the docs the index exists to navigate.

**Measurements are the opposite.** "On 2026-07-28, mobile client over Node's
WebSocket, fresh single-device accounts, 80/80 delivered" is true permanently,
whatever we later conclude it means. A measurement never needs updating — only
superseding by a newer measurement, which is a new row. That is why this is the
one document in the cluster that can safely be a single consolidated list.

## Start here — the five that carry the current picture

Capped at five deliberately. If a sixth belongs, one has to go: an unbounded
"important" list is how this file previously ended up with 58 star markers on a
scale that only ratcheted upward, four separate entries each claiming to be the
most important one, and retracted findings still wearing their original emphasis.
**Status tags replaced that.** Untagged means the entry still stands; the
exceptions carry `[REFUTED]`, `[SUPERSEDED]`, `[UNCONFIRMED]` or
`[PARTLY REFUTED]` in the heading, which is falsifiable and updatable in a way
that an importance rating is not.

| # | section | why it is on this list |
|---|---|---|
| 1 | **ROUND Q** (2026-07-31) | every loss falls in a 1.4-3.5 s band before a socket CLOSE, no survivor inside it. The mechanism, measured |
| 2 | **THE RELAY PROBE** (2026-07-30) | the relay pings every 9.0 s and enforces a 10.0 s deadline only a pong refreshes. Reproducible in 10 s from any machine |
| 3 | **THE SENDER ISOLATED** (2026-07-29) | same account, same receiver, minutes apart: mobile app lost, harness bot lost none. The single-variable comparison |
| 4 | **ROUND X** (2026-07-29) | the cold-drain control — lost frames are in nobody's inbox, so they never reached the relay |
| 5 | **ROUND Z** (2026-07-30) | 120/120 send rows: the client's send path is complete, so the loss is downstream of it |

## How to add a row

Append. Never edit a past row, even one that later turned out to be misleading —
add a newer row and a note. Every row must cite the doc that reported it, so any
number here can be traced back rather than taken on trust.

**When a later run overturns an earlier one, tag the earlier heading** rather
than rewriting it. The row stays; the reader learns it no longer holds without
having to read forward to find out.

**Record the CLASS of the result.** The single most expensive confusion in this
investigation has been conflating failures that live at different layers:

| class | question | a miss here means |
|---|---|---|
| **arrival** | did the frame reach the peer's socket at all? | transport loss |
| **decrypt** | it arrived — did it open? | a crypto/session failure, usually transient |
| **persistence** | it opened — did the app keep it? | the message is gone with no error anywhere |

A frame that arrives and fails AEAD is **not** lost. Reporting it as loss is how
"desktop↔desktop loses 100% of messages" got written down when what actually
happened was that every frame arrived and none decrypted.

> **The third class was added 2026-07-28, and its absence is why this went
> unfound for weeks.** Every scenario before `dm-multidevice` measured arrival, and
> `dm-loss` measures *only* arrival by construction. A message that arrives,
> decrypts cleanly, and is then dropped before `saveMessage` is invisible to every
> one of them — they would all report that run as flawless, and on the canonical
> accounts `dm-loss` did exactly that while the operator watched messages fail to
> appear. **If a scenario does not count what the app persisted, it cannot see this
> class at all.** Say which classes a run measured, not just its numbers.

---

## Field rounds — instrumented, real devices

Full detail: `quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md`
(the 3115-line master; section numbers below are its own).

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-25 | round 10-11 | desktop↔mobile | decrypt | desktop was DELETING frames that decrypt seconds later; after the fix, frames recover | first root cause found and closed | master §16-17 |
| 07-25 | round 14 | desktop↔mobile | decrypt | a desktop session reset is one-sided: mints a new receiving inbox, never tells mobile | onset mechanism | master §19 |
| 07-25 | round 18 | mobile→desktop | decrypt | mobile branches its send on the wrong field, so a peer's unconfirmed session can never confirm | the accept-missing defect | master §20-sexies |
| 07-25 | round 20 | mobile→desktop | arrival | **mobile's SEND side exonerated by measurement** | killed the mobile-send model | master §20-sexies-ter |
| 07-26 | — | desktop↔desktop | **decrypt** | **0/10 both directions — frames ARRIVING and failing AEAD** | falsified "desktop↔desktop is a clean control". ⚠️ this is a decrypt result, NOT loss | resurfaced bug, finding AE |
| 07-26 | round 26 | mobile sender | arrival | read-ack frames 0/10 delivered while chat posts 11/11 delivered — same socket, same minutes | loss is selective, not blanket | issue #183 item 2 |
| 07-26 | round 27 | mobile sender | arrival | 4 of 34 frames to one inbox vanished; all handed to the socket, signed, socket open, never redelivered | the write-layer "black hole" | issue #183 item 2 |
| 07-26 | round 27 | mobile sender | decrypt | 51/51 decrypt failures self-healed on redelivery | decrypt failures are latency, not loss | issue #183 |
| 07-26 | round 29 | **mobile↔mobile, two phones** | arrival | **8 of 25 lost A→B (32%), 0 of 18 B→A** — same hub, same minutes, size-blind, all 8 confirmed at `ws.send` | the strongest evidence for #183 item 2, and the directionality is the key datum | master §27.2, issue #183 |
| — | ×2 rounds | desktop→mobile | arrival | 12/12 delivered, twice consecutively | desktop→mobile is clean in the field | issue #183 |

## Bench runs — headless, no devices

### Desktop harness (`quorum-desktop`, `yarn harness …`)

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-27 | `dm-loss` | desktop↔desktop, Node `ws`, WASM, **fresh** accounts, 20-min tail | arrival | **301 sent / 301 arrived each way, 0 missing, 0%** | first desktop-side loss measurement; the figure quoted in issue #183 | resurfaced bug §(loss table) |
| 07-27 | `dm-reorder` | synthetic reorder | decrypt | reproduces the production decrypt failure **on demand in ~35s** | turned a capture-round problem into a bench problem | headless-dm-harness task |
| 07-27 | `dm-stale-bucket` | mitigation OFF vs ON | decrypt | **32 → 0 failures** over 56 new-chain frames | validated the #265 mitigation | resurfaced bug §5-B1′ |
| 07-27 | `dr-prune-safety --synthetic-only` | offline, no devices | decrypt | naive prune destroys **3/3** delayed frames; B1′ keeps **3/3** and still recovers | proved the obvious fix was wrong before it shipped | tool output |
| 07-28 | `dm-loss` run 1 | desktop↔desktop, Node `ws`, WASM, **fresh throwaways** | arrival | **201 sent / 201 arrived per direction, 0%** (402 posts decrypted) | second null; 18 novel decrypt failures, all healed | cross-platform task §RUN 1 |
| 07-28 | `dm-loss` run 2 | desktop↔desktop, **canonical aged multi-device** accounts | arrival | **201 measurable per direction, 0%.** 3618 frames pushed for 200 messages — **~9 frames/message fan-out** vs ~1:1 on throwaways | multi-device fan-out does NOT by itself produce loss. 140 novel decrypt failures, all healed | cross-platform task §RUN 2 |

> ⚠️ **Do not quote "3618 frames, zero loss."** Only 201 per direction are
> *measurable* — the join deliberately excludes frames fanned out to the accounts'
> other devices, which can never arrive at the peer bot and are not loss. The other
> ~3400 are **unobserved, not observed-good**.

### The fan-out channel during that same run — operator observation

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-28 | `dm-loss` run 2, **same run as the row above** | the canonical accounts' OTHER devices — two desktop clients the operator had open and online | arrival | **~10 of 200 messages landed on one desktop, 0 of 200 on the other** | the fan-out channel behaved nothing like the peer channel *in the same run, at the same moment* | operator, observed live during the run; confirmed 2026-07-28 as desktop run 2 |

**The row that reframed the bench nulls, and it reframes the one above
it.** In one run, on one pair of accounts, the peer channel was perfect (201/201
each way) while the self-sync fan-out to the same accounts' other devices was
close to total loss. The bench reported 0% and was *structurally blind* to the
channel that was failing — the ~3400 frames it excluded by design.

⚠️ **Qualifier, deliberately recorded:** this was observed in two desktop UIs, not
instrumented. A message could in principle arrive and be persisted without
rendering in a conversation that is not open. That is exactly why the next
scenario counts what `saveMessage` receives per device rather than what a UI shows
— see `2026-07-28-harness-multidevice-and-coverage.md`. Until that runs, treat
the figure as a strong signal, not a measurement.

**Consequence for every earlier row in this file:** *every* bench run to date used
one device per account. The self-sync copy and the peer's second device have never
been exercised by any bench, on either platform. The nulls above are real, and they
are nulls about a narrower channel than they appear to describe.

> ⚠️ The 07-27 run (301/direction) and the 07-28 run 1 (201/direction) are
> **different runs**, not two reports of one. An earlier version of the index's
> §3.1 matrix collapsed them into a single row; finding that is what prompted this
> file.

### Multi-device (`dm-multidevice`) — the channel the rows above are blind to

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-28 | `dm-multidevice` | **one account with TWO devices** + peer, all harness bots, Node, fresh account | arrival | 5 rounds — all four legs 0%, 5/5 messages on every device | proved the shape; too small to speak to the 200-message observation | run log |
| 07-28 | `dm-multidevice` | same, **100 rounds** | arrival + decrypt | **101/101 frames on all four legs, 0%. 100/100 messages on every device** — including the self-sync copy and the peer's 2nd device. 1 novel decrypt failure (phone), healed | **multi-device fan-out is NOT broken by itself on desktop.** Does NOT reproduce the ~10/200 observation | run log `2026-07-28T13-18-18` |

### [SUPERSEDED] 4 devices — the operator's symptom reproduces on the bench

> Superseded by the 07-29 re-run below: identical configuration, opposite result.
> The 52/100 did not reproduce on a relay verified healthy first.

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-28 | `dm-multidevice` | **one account with FOUR devices** + peer, all harness bots, Node, fresh account, 100 rounds | arrival **and** persistence | **every one of the 8 frame legs: 101/101, 0% loss. Zero decrypt failures anywhere.** But `dev1` persisted only **52/100** messages — in BOTH directions, the same count — while `dev2` and `dev3` persisted 100/100 | **first bench reproduction of the operator's symptom.** Loss between arrival and persistence, with no error of any kind | run log `2026-07-28T13-45-03` |
| 07-29 | `dm-multidevice` | **the same 4-device configuration**, re-run against a relay **verified healthy first** (`/` → 404, known user → 200). Fresh account, 100 rounds, 700ms gap, 180s settle | arrival **and** decrypt **and** persistence | **all 8 frame legs 101/101, 0% loss. Every device persisted 100/100 in BOTH directions** (dev0-dev3 and bob). 2 novel decrypt failures on dev3, both healed. **Ratchet lock: n=1065 holds, p50=29ms, p90=231ms, p99=370ms, max=555ms — every hold under 1s, ZERO in the 15-30s / 30-55s / >55s buckets** | **the 52/100 did NOT reproduce, and the lock-across-HTTP mechanism did not fire.** Re-points the row above at relay degradation rather than device count | run log `2026-07-29T05-52-51` |
| 07-29 | `dm-multidevice` **+ FAULT INJECTION** | same 4 devices / 100 rounds, but **`/inbox/delete` deliberately stalled 30s on a deterministic 1-in-20 of calls** (`HARNESS_FAULT_DELETE_DELAY_MS=30000`, rate 0.05 — 50 of 1016 calls hit). 300s settle | arrival **and** persistence | **All 8 frame legs still 101/101, 0% arrival loss** — but persistence collapsed: dev0 97/100, **dev1 50/58, dev2 25/27, dev3 23/23**, bob 85/100. **Every single gap is a `CONTIGUOUS TAIL`, not one scattered.** Lock: n=5745, **10 holds in the `30-55s` bucket, max=31260ms**; queued-behind-lock **max=31173ms** | **MECHANISM CONFIRMED.** A slow inbox-delete holds the ratchet lock and stalls the conversation, exactly as §1 predicted by code reading | run log `2026-07-29T06-19-55` |

**Why this is the important row in the file.** The frames all arrived. Nothing
failed to decrypt. `dm-loss` counts frames, so it would have reported this run as
flawless — which is exactly what it did report on the canonical accounts while the
operator watched messages fail to appear. The gap is **between the socket and
`saveMessage`**, and no existing scenario looks there.

It also rules something out: at 2 devices, 100 rounds, everything was clean. The
failure needs more than one extra device, which fits the operator's 5+ device
accounts and explains why every earlier bench (one device each) was green.

**The identical 52 in both directions is the informative detail.** A per-message
drop would not hit two independent streams equally; a device that stopped
processing at one moment would. That points at a receive-pipeline stall rather than
per-message loss — but the count alone cannot distinguish "stopped at #52" from
"dropped every other one", and those are different bugs. The scenario now reports
WHICH message numbers are missing so the shape is unambiguous.

⚠️ **Not yet confirmed, and these are the ways it could still be the bench's fault:**

- one run, one device out of three extras — not yet reproduced
- all five bots share ONE Node process, so a starvation or event-loop effect
  peculiar to the harness cannot be excluded. That `dev2` and `dev3` were perfect in
  the same process argues against it, but does not settle it
- the persistence seam is a tee on `saveMessage`; a fault in the tee itself would
  look identical from outside

⚠️ **Provenance note, recorded because it nearly went unnoticed:** this result came
from an invocation that appeared to have been cancelled — the process kept running
and completed. A *subsequent* background run of the same scenario failed at
collection (`Vitest failed to find the current suite`, 9.7s) because it started
while the first was still finishing, and produced nothing. Two vitest runs of the
harness must not overlap.

**What still separates this bench from the operator's observation**, in decreasing
order of how cheaply it can be closed:

1. **device count** — 2 here, 5+ on the canonical accounts. The one-key-many-bots
   trick extends to 4 devices with no change to any real account
2. **account age** — fresh here, heavily used there
3. **the receiving client** — the observed devices were the real desktop app *in a
   browser*; here they are harness bots in Node. Same client code, different
   runtime, different storage, no UI layer. The harness cannot close this one by
   construction

### The 07-29 re-run — the reproduction did not hold

**Added 2026-07-29, after running the confirmation the bug report asked for.** The
heading above says the symptom "reproduces on the bench". On the evidence of one
run that was true; the re-run says it does not reproduce reliably, and the
existing text is left standing so the sequence stays readable.

Identical configuration, identical device count, identical round count. The only
deliberate difference was **checking the relay was healthy before starting** —
which the 07-28 run could not have done, because it finished at 15:51 and the
relay was 502ing on every path by 15:53 and stayed down for over an hour. Its own
row already carried that caveat. The re-run is clean on every axis the earlier one
was not.

**The lock histogram is the part that carries weight, because it reports even when
nothing goes missing.** 1065 holds, none longer than 555ms, none within a factor
of twenty of a single timed-out attempt. Per the bug's §5.3 criterion that is
"the mechanism is not firing on this run".

Read carefully, this run says three separate things, and they are not the same
strength:

1. **The 52/100 is not a device-count threshold** — 4 devices on a healthy relay
   is clean. Reasonably well supported: same parameters, opposite result.
2. **The lock mechanism did not fire here.** Directly measured, not inferred.
3. **The mechanism is still real as code.** §1 of the bug is a reading of the
   source, and this run does not touch that. What it constrains is *when* the
   coupling bites: a healthy relay never makes the POST slow enough to matter.

⚠️ **What it does NOT do is exonerate the receive path.** A null on a healthy
relay is exactly what the mechanism predicts on a healthy relay, so this run
cannot distinguish "the bug is not there" from "the bug did not have its trigger
today". Confirming or killing it needs the POST to be slow — a fault-injected or
genuinely degraded relay — not another clean one. Another green 4-device run adds
nothing.

> ⚠️ Inference, not measurement, recorded because it is the one hint in the data:
> the holds are bimodal (638 under 100ms, 427 between 100ms and 1s) rather than
> massed in the low band where crypto-only work would sit. That is *consistent
> with* a network round trip inside the critical section. The probe times the
> hold, it does not observe what runs inside it, so this is a hint about where to
> look next and not evidence the coupling fired.

### The 07-29 fix validation — and the partial fix that passed every other test

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-29 | `dm-multidevice` + injection | same injection, **lock-only fix applied** | persistence | lock max **655ms** (was 31260ms), queueing **456ms**, zero `30-55s` holds — **but persistence still 79/38/30/23 with `CONTIGUOUS TAIL` everywhere** | ⚠️ **the fix that wasn't.** Freed the lock perfectly and the symptom survived | run log `2026-07-29T06-36-45` |
| 07-29 | `dm-multidevice` + injection | same injection, **complete fix applied** (all 14 sites) | arrival + decrypt + persistence | **66 of 1327 calls stalled 30s — the harshest fault of any run — and every device persisted 100/100 both directions, bob 100/100, ZERO decrypt failures anywhere, no gaps.** Lock max **562ms** | ✅ **validated.** Over half an hour of cumulative relay stall absorbed with nothing lost or delayed | run log `2026-07-29T08-08-45` |

**The middle row is the one to remember.** Freeing the ratchet lock cut hold times
48×, emptied the `30-55s` bucket, kept the typecheck clean and passed all 565 unit
tests — **and the messages still vanished in contiguous tails.** Every signal
except the one that mattered said "fixed".

The cause: the ratchet lock is not the only serialization point, and not the
important one. `WebsocketProvider.processInbound` awaits `handleNewMessage`
serially per inbox, so **any** awaited relay call in that ~2400-line handler is a
head-of-line block on that inbox — lock or no lock. Eight more awaited
inbox-deletes lived outside the critical section. Verified against the app's own
code, not assumed from the bench.

> **The durable rule, worth more than the fix:** not *"don't hold the lock across
> HTTP"* but **"don't await the relay inside `handleNewMessage` at all."**

Novel decrypt failures fell **246 → 121 → 0** across the three runs, in lockstep
with the tails. Those were frames backing up behind a stall and being redelivered
while the session advanced — the known reorder/stale-bucket class, not a separate
defect. Independent corroboration that the mechanism was correctly identified.

⚠️ Still desktop-only, still does not explain the mobile field loss, and mobile
needs no change — its pattern is what the fix copies.

### The 07-29 fault-injected run — the lock mechanism, measured

**This is the run that settles the ratchet-lock-across-HTTP question**, and it only
works because it stops waiting for the relay to misbehave and *makes* it misbehave.
The two clean 4-device runs could never have decided it: a lock held across a fast
POST is indistinguishable from a lock not held across a POST at all.

Injecting a 30s stall into 1 call in 20 produced every predicted signature at once:

| §5 criterion | predicted if the mechanism is real | measured |
|---|---|---|
| lock hold time | clusters at the stall duration | **10 holds in `30-55s`, max 31260ms** — the injected 30s, visible directly |
| gap shape | `CONTIGUOUS TAIL` (backlog) not `scattered` (drops) | **every gap on every device was a contiguous tail. Zero scattered.** |
| both directions together | equal, since one conversationId ⇒ one lock | dev1 50/58, dev2 25/27, **dev3 23/23** |
| frame arrival | unaffected — this is downstream of the socket | **101/101 on all 8 legs, 0% loss** |
| queueing | messages wait behind the holder | **max 31173ms** — a message sat 31s waiting its turn |

Nothing was dropped by the transport. Every frame arrived. The messages did not get
persisted **because the receive path was stuck waiting on an HTTP call whose failure
it already treats as harmless.**

### ⚠️ Three things this run does NOT establish — read before quoting it

1. **The harness overstates the blast radius, and by a lot.** All five bots share
   one process and therefore one `dmRatchetMutex` singleton, and DM
   conversationIds are `<partner>/<partner>` — so **all four of A's devices
   contend on the same key** (bob's address). The `slowest:` list shows only
   **two** distinct keys across five bots, confirming it. In production each
   device is a separate browser with its own lock, so one device's stalled ack
   stalls *that device*, not all four. The per-device degradation ladder here
   (97 → 50 → 25 → 23) is largely a harness artifact. **The mechanism is real;
   this run's magnitude is not a production estimate.**
2. **This is very probably LATENCY, not loss** — as §3 of the bug insisted it
   would be. 50 injections × 30s ≈ 1500s of cumulative stall across 2 lock keys,
   against a 300s settle: the backlog *could not* have drained in the window.
   The missing messages were almost certainly still queued when counting stopped.
   Distinguishing permanently-lost from very-late needs a settle longer than the
   injected stall budget, and this run cannot do it.
3. **It does not explain the field symptom.** The defect is desktop-only (§6 of
   the bug verifies mobile does not have it), and the field's worst cases are
   mobile→desktop and mobile↔mobile. It required a 30s injected stall to fire.
   **Do not let this absorb quorum-mobile#183 item 2.**

**What it does establish** is worth stating plainly: a latent defect that was
argued from code reading is now a measured behaviour, the fix has an acceptance
test that can actually fail (re-run this injection after the fix; expect no
`30-55s` holds and no tails), and the bug is no longer a hypothesis competing for
attention with the field investigation — it can be fixed and closed on its own
evidence.

### 2026-07-29 — THE SENDER ISOLATED: same account, same receiver, two runtimes

**The single-variable sender comparison.** Two senders, the same real
desktop receiving, the same accounts, the same relay, minutes apart. Only the
sender's runtime differs.

| when | sender | runtime | receiver | class | result |
|---|---|---|---|---|---|
| 07-29 | **operator's mobile app** | **RN native socket + uniffi crypto** | operator's real desktop (browser) | arrival | **16 of 20 — T1, T5, T13, T17 absent, still absent 10+ minutes later** |
| 07-29 | **harness bot as the same account A** | **Node `ws` + WASM crypto** | the same desktop, same window | arrival | **all delivered, none missing** |

Both measured on the receiver with the same instrumented probe reading IndexedDB
directly, so the two numbers are like-for-like.

**What it establishes.** The receiving client, the relay, the account state and the
fan-out are all common to both rows and one row is perfect. **The difference is the
sender's runtime.** This is the single-variable comparison the investigation has
wanted for months and could never construct, because no bench can drive RN's native
socket.

**What it rules out**, all from the same reading:

- **Not session replacement / unknown-inbox** — the receiver's probe recorded
  `replaced: 0, unknownInbox: 0` while the loss happened. Independently confirms
  the retirement of that hypothesis.
- **Not a display bug** — IndexedDB and the rendered conversation agree exactly,
  both missing the same four. Settles the one layer never previously tested.
- **Not the ratchet-lock stall** — fixed, and this is scattered rather than a tail.
- **Not the relay or fan-out in general** — the harness reached that same desktop
  through the same relay with zero loss.

**Gap shape: SCATTERED (1, 5, 13, 17), not contiguous.** By this file's own rule
that means per-message drops rather than a receive-pipeline stall — pointing at the
write path, which is exactly quorum-mobile#183 item 2's shape.

⚠️ **Two corrections made while producing this row, both recorded so the reasoning
is legible:**

- The first reading (16/20) was briefly interpreted as *latency with a long tail*
  after an ambiguous "they all landed". A re-read 10 minutes later returned the
  identical `missing: [1,5,13,17]`. **It is loss, or a tail longer than 10 minutes.**
  The latency reframing was wrong and is withdrawn.
- The 4 missing read receipts were briefly treated as a possible separate receipt
  defect. They are a **consequence**: the receiver never saw those four messages,
  so it had nothing to acknowledge. One bug, not two.

**Remaining suspects, unchanged but now carrying all the weight:** RN's native
WebSocket write path, and the uniffi bridge. Both are named in #183 item 2, both
are outside every bench by construction.

### 2026-07-29 — a LIVE production capture, on a real desktop, not a bench

The only row in this file that is not a bench run or a UI observation: an actual
browser console log from the operator's desktop (account B), captured while a
harness run drove the peer account.

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-29 | **operator's real desktop, live** | production build in a browser, real aged account, harness driving the peer | **persistence** | **366 `DM frame for unknown inbox — no encryption state` — 366 DISTINCT frame timestamps, each once.** Two inboxes, 183 each. **36 `⚠️ SESSION REPLACED by init envelope`**, all one conversationId, all fresh (`envelopeAgeSeconds` -1/0/1). **Zero delete failures.** | **first direct evidence of a client-side loss path in production**, and the first measurement taken in a browser rather than Node | operator console log |

**What it establishes.** A session replacement orphans the receiving inbox, and
frames the peer already addressed to it arrive with no state and are never
persisted. The frames are **stranded, not destroyed**: the cleanup call named the
*device* inbox while the frame sat in a *session* inbox, so it succeeded and
removed nothing — which is why zero delete failures appear alongside 366 drops.

**Methodological notes, both learned the hard way today:**

- **The 366 was checked for redelivery inflation, not assumed.** An independent
  review proposed it might be a small set re-logged repeatedly, correctly citing
  this investigation's own rule to de-duplicate by fingerprint before reasoning —
  a rule that *was* skipped when the finding was first written up. Checking the
  timestamps refuted the inflation: 366 lines, 366 distinct frames.
- ⚠️ **The "~10 drops per replacement matches ~10 of 200" corroboration is
  RETRACTED.** It is not discriminating: the already-solved ratchet-lock bug
  explains that same field observation and was confirmed by fault injection.
  Reaching for a number that fits and treating the fit as support is the exact
  error this file exists to prevent.
- ⚠️ **Most of those 36 replacements were harness-induced.** This capture measures
  the *mechanism*, not the natural replacement rate. Do not quote a frequency from
  it.

Full analysis and the corrections:
[`bugs/.solved/2026-07-29-session-replacement-strands-in-flight-frames.md`](../../bugs/.solved/2026-07-29-session-replacement-strands-in-flight-frames.md) — **read §7 first**, the original write-up was wrong on its central claim.

### 2026-07-29 — THE SYMPTOM REPRODUCED ON THE BENCH, healthy relay, no injection

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-29 | `dm-multidevice` **canonical** | **aged account A** with 2 harness devices (`user-a` + the new `user-a-obs`) + `user-b`, 200 rounds, 700ms gap, **600s settle**, relay healthy, **no fault injected**, lock fix in place | arrival + decrypt + **persistence** | **all 4 frame legs 201/201, 0% loss.** bob 200/200, dev0 200/200 — but **`user-a-obs` persisted 100/200 in BOTH directions**, `CONTIGUOUS TAIL from #101` in both. Decrypt failures dev0=80, dev1=17, bob=46. Lock max 412ms | **the operator's ~10-of-200 symptom, on the bench, automated** | run log `2026-07-29T10-07-26` |

**This is the first reproduction that needs no fault injection and no degraded
relay.** Every frame arrived at the extra device's socket — 201/201 on both its
legs — and it persisted exactly half of them, stopping dead at message #101 in
both directions simultaneously and never recovering across a **10-minute** tail.

**Reading the shape:**

- **Both directions stop at the same number.** Sends alternate on a 700ms gap, so
  `#101` in each direction is the *same instant* — roughly 70s into the send loop.
  This is one event at one moment, not two independent failures.
- **It is not latency.** 600s of settle with frames still arriving and nothing
  further persisted. §3's "a longer tail recovers them" does not hold here.
- **It is not the ratchet-lock-across-HTTP bug** (that is fixed and shipped), and
  not relay degradation (relay verified healthy, no injection).
- **The socket stayed alive.** `transport.arrived` recorded all 201 frames per leg
  *after* the device stopped persisting. So the failure is downstream of arrival
  and downstream of the socket, in the receive pipeline itself.
- **Aged account is the differentiating variable.** The identical shape on a
  *fresh* 4-device account was clean (100/100 everywhere, same day, same code).

### ✅ Deadlock RULED OUT, and the reproduction is deterministic

**Second canonical run, 2026-07-29 (log `2026-07-29T10-35-59`), with both new
detectors armed:**

```
outstanding critical sections: NONE (no lock was still held at the end)
no bot has a stuck inbound frame
```

Neither the ratchet lock nor any handler invocation was outstanding. **The
deadlock hypothesis below is dead**, and so is the broader "something hung"
reading. Kept here because the reasoning was sound and the instrument that killed
it is the useful artifact.

**And the reproduction is exact:**

| | run 1 | run 2 |
|---|---|---|
| dev1 persisted | 100/200 both directions | **100/200 both directions** |
| tail begins | #101 | **#101** |
| decrypt failures dev0/dev1/bob | 80 / 17 / 46 | 102 / 33 / 25 |

Identical counts twice rules out a race. **The handler RETURNS for messages #101
onward — they are processed and silently discarded, not stalled.** That is a
different bug class from everything this investigation has assumed so far, and it
retires the "backlog, a longer tail recovers them" reading (§3 of the solved lock
bug) for this failure.

**Two readings of the number, and they predict different things:**

1. **A ceiling** — dev1 persisted exactly 200 messages (100 + 100) and stopped.
2. **Proportional** — it stopped at exactly the halfway point; and the 07-28
   fresh-account 4-device run showed **52/100**, also about half.

Discriminated by re-running at 100 rounds: **~50/100 ⇒ proportional (time or
rate); 100/100 ⇒ a ceiling near 200.**

### ⚠️ The lock histogram CANNOT rule out a deadlock — it only sees holds that finished

`installLockProbe` records a sample in a `finally` block (`lock-probe.ts:65-74`).
**A critical section that never returns never reaches that `finally`, so it is
never sampled.** `max=412ms` therefore means "the longest hold that *completed*
was 412ms" — it says nothing about a hold still outstanding when the run ended.

That matters because a permanently-held `dmRatchetMutex` on one `conversationId`
would produce precisely this signature: both directions of that conversation stop
at one instant, permanently, while the socket keeps receiving. `KeyedMutex`'s own
documentation warns about exactly this failure mode — *"waiting for delivery
inside the lock is a circular wait"*.

**Deadlock is therefore a live hypothesis that our current instrument is blind to,
and the cheapest next step is to make it visible:** track holds at *acquire* time
and report any still outstanding at the end of the run, rather than only those
that released.

⚠️ **Harness-vs-product is NOT yet settled.** All three bots share one Node
process and the harness serializes inbound dispatch through a single promise chain
(`transport.ts` `dispatch()`), so one handler invocation that never settles would
stall that bot's entire queue forever — matching the shape exactly. The browser
serializes per inbox too (`processInbound`), so the mechanism is plausible in the
app, but this run cannot distinguish "product deadlock" from "harness-only hang".
**Do not report this upstream until that is separated.**

### Persistence on AGED accounts (`dm-loss` canonical) — closes one of two blind cells

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-29 | `dm-loss` canonical | **the operator's real aged multi-device accounts**, 200 rounds, 700ms gap, **600s settle**, per-message persistence counted for the first time | arrival **and** persistence | **frames 201/201 each way, 0%. Persisted: bob 200/200, alice 200/200.** 6 novel decrypt failures total, all healed. Fan-out **2412 frames for 201 messages (~12:1)** | **aged session state does NOT break persistence on the peer channel.** Concentrates suspicion on the fan-out channel | run log `2026-07-29T09-44-43` |

**Why this run existed.** `dm-loss` had only ever counted frames, plus a running
`posts decrypted` tally that could not say *which* message went missing. So on the
canonical accounts it reported 201/201 / 0% while the operator watched those same
accounts' other devices receive ~10 of 200 — it was never asking the question.
Per-message persistence accounting now makes it ask.

**The answer is clean**, and that is informative rather than disappointing: it
removes "aged session state corrupts persistence" as an explanation. Frames arrive,
decrypt, and get persisted correctly on aged accounts, over a 10-minute tail.

### ⚠️ The blind cell that REMAINS, and it is the one that matches the observation

This run measured the **peer** channel. The operator's observation was about the
**fan-out** channel — messages reaching their *other* devices.

| channel | fresh accounts | **aged accounts** |
|---|---|---|
| peer — frames | ✅ clean | ✅ clean |
| peer — **persistence** | ✅ clean | ✅ **clean (this run)** |
| fan-out — frames | ✅ clean | ✅ clean |
| fan-out — **persistence** | ✅ clean (4 devices) | ❌ **NEVER MEASURED** |

The amplification is the tell: **2412 frames went out for 201 messages**, and only
320 landed on inboxes this bench subscribes to. The other ~2100 went to the
operator's real devices and are unobserved — "unobserved, not observed-good", the
same structural blindness recorded against run 2.

**Reaching that last cell needs a second harness bot registered as a device on the
aged account A**, which mints one permanent extra device registration there (stable
bot name, so it is minted once and reused). That is the cost the trap list warns
about, it is bounded, and it is the only automated route left to the operator's
actual symptom. Everything cheaper has now been run.

### Cross-platform (`dm-cross`) — the last empty cell in the 2×2

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-29 | `dm-cross` smoke | mobile↔desktop, 5 rounds, **20s settle** | — | 4/8 "delivered" | ⛔ **not a measurement** — settle far too short, and the gaps were at the HEAD not the tail. Recorded only so nobody re-derives it as a finding | run log |
| 07-29 | `dm-cross` | **mobile↔desktop on one bench**, two processes/two repos, Node `ws`, WASM, fresh throwaways, 1 device each, 40 rounds each way, 180s settle | arrival | **mobile→desktop 40/40, 0.0%. desktop→mobile 39/40, missing only #1.** 79/80 total | **the field's reported worst direction is CLEAN on the bench.** Completes the 2×2; no bench configuration now reproduces the field loss | run log `run-1785314457979` |

**The single miss is message #1 in the echo direction, and that shape repeated in
the smoke run.** Role `b` echoes the instant it receives round 1, which is the
earliest possible moment in the reverse direction — before that direction's
session is settled. Missing the **head** is the signature of session
establishment; per-message transport loss does not preferentially eat message #1
twice in a row. ⚠️ Recorded as a strong inference, not a demonstrated cause: it
has not been isolated, and it is worth its own scenario (mobile's own notes
already flag simultaneous-open as a real and separate mechanism).

**What this closes.** Every cell of the platform matrix is now measured:

| | desktop receiver | mobile receiver |
|---|---|---|
| **desktop sender** | 301/301, 201/201, 0% | **40/40, 0%** (this run, echo direction minus #1) |
| **mobile sender** | **40/40, 0%** (this run) | 80/80, 0% |

**No bench configuration reproduces the field loss** — including, now, the exact
cross-platform direction the field complains about. Since all four benches share
Node `ws` + WASM + fresh accounts, that combination is what they collectively
exonerate, and the remaining suspects for round 29 are unchanged and sharpened:
RN's native WebSocket write path, the uniffi bridge, aged real-account state, and
device network conditions. **The client logic is not where this lives.**

⚠️ One unexplained observation, recorded rather than dismissed: mobile persisted
119 messages for 40 sent + 39 received, with its own outgoing texts appearing
twice in the sample. Not loss, and it does not affect the join (the receiver's
set is deduped by number), but it is unaccounted for and someone should find out
why before quoting mobile's `persisted=` figure for anything.

### Mobile harness (`quorum-mobile`, `yarn harness:dm`)

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-28 | `harness:dm` | **mobile↔mobile**, Node `ws`, WASM, fresh throwaways, 1 device each | arrival | **40 rounds each way, 80/80 delivered, 0%**, zero decrypt failures, both device inboxes empty at the end | mobile's client logic does not lose messages in Node. See the caveat below — this does NOT isolate RN native | cross-platform task, mobile PR #193 |

### Offline analysis tools (`.agents/tools/dm-debug/`)

| run | result | what it changed | source |
|---|---|---|---|
| `dr-position-table` | 1920 synthetic frames, **zero failures at every position** | ⛔ corroborates finding AC; is **not** evidence the crate is clean | tool README |
| `dr-self-echo` | **0 of 2709** — a client never receives its own outbound frames | killed the self-echo theory | tool README |
| `dr-ablate` / mitigation corpus | **139 of 159** captured failures recover when one bucket is removed | pinned the mechanism behind #183 item 1a | resurfaced bug §1 |

---

## What the collected bench nulls do and do not establish

Three 0%-arrival-loss bench results now exist (07-27 desktop, 07-28 desktop ×2,
07-28 mobile). **None contradicts round 29.** The benches differ from the field
configuration in several variables at once:

| | client | transport | crypto | accounts |
|---|---|---|---|---|
| bench | desktop **or mobile** | Node `ws` | WASM | fresh, or canonical-but-desktop |
| **field (round 29)** | mobile | **RN native** | **uniffi** | real devices |

The mobile bench differs from round 29 in **four** variables — transport, crypto
backend, account shape and OS — so it does not isolate RN's native socket. The
only near-single-variable comparison available is desktop-bench vs mobile-bench
(same transport, same crypto, same account shape, different client), and that says
only: *mobile's client logic is no worse than desktop's when run in Node.*

Live suspects for round 29, still undistinguished:

1. RN's native WebSocket write path
2. the uniffi bridge — the mobile harness proved the two crypto backends genuinely
   disagree on error conventions, so "same Rust crate" does not mean "same behaviour"
3. real-account state: aged sessions, ghost devices, multi-device fan-out **on mobile**
   (row 2 above shows fan-out alone is harmless on *desktop*)
4. device network conditions

**Not yet run, and the two cheapest experiments that would discriminate:**

- **mobile bench on the canonical multi-device accounts** — changes exactly one
  variable from the 07-28 mobile row, and tests suspect 3 directly. It will register
  an additional device on those accounts, as the desktop bench already did.
- **mobile↔desktop on one bench** — the field's reported worst case, and the only
  cell no bench covers at all.

---

## 2026-07-29 (afternoon) — the U-run cross-store check: the loss is COMMON-MODE AT THE SOURCE

The morning U-run (operator's mobile dev build, account A → desktop B, 17/20,
missing U2/U5/U10 on the receiver) was re-checked with store-wide IndexedDB
scans (`tools/dm-debug/07-receiver-probe.js`) on **both** desktops:

| store | channel | class | result |
|---|---|---|---|
| desktop B (the peer) | peer channel | persistence (store scan, all conversations) | **17/20, missing [2, 5, 10], duplicates 0** |
| desktop A (the SENDER's own other device) | self-sync fan-out | persistence (store scan, all conversations) | **17/20, missing [2, 5, 10], duplicates 0** |

**The same three messages are absent from two independent stores fed by two
independent channels.** Each message fans out as separate frames to every device
of both accounts; independent per-inbox write loss cannot hit the identical
three messages on both channels. **The unit of loss is the whole message — all
of its fan-out copies died together, at or before the source.** This reshapes
quorum-mobile#183 item 2: the write-layer story must explain message-level, not
inbox-level, loss (candidates: the RN native socket silently swallowing writes
on a dying connection — RN ignores okhttp's `send()` result — or the node
dropping a message's whole fan-out batch atomically). Issue body update pending.

## 2026-07-29 (afternoon) — the preview-build V-run: NOT a dev-vs-prod datapoint, but a new bug

Setup: preview (release) APK **rebuilt the same day 16:32 local from current
code** (verified via adb `lastUpdateTime`), but installed over **June-20-era app
data** with account B logged in since then — i.e. a *returning stale device*
with months-old session state. It sent `V 1`…`V 20` to account A at 16:35-16:37
local, roughly one minute after the reinstall.

| observer | class | result |
|---|---|---|
| desktop A (the peer — intended receiver) | persistence (store scan) + UI | **0/20. Zero warnings** (no unknown-inbox, no session-replaced, no decrypt failures). Confirmed visually later |
| desktop B (sender's own other device) | persistence (store scan) | **20/20 in the store — but INVISIBLE in the UI**: every V row is filed under `spaceId = channelId = <B's own address>` (a ghost B↔B self-conversation) instead of the peer's address, which is how the real conversation is keyed (U-reference row: keyed by A's address) |
| control | — | B's **desktop** → A messages delivered normally the same day (15:27), so account B could reach A; only the stale phone could not |

Consequences, in order:

1. **This run does NOT answer §3.1 (dev-vs-prod)** — the stale state confound
   dominated everything. The clean run (sign out/in on the preview app first,
   then `W 1`…`W 20`) is still owed.
2. **It demonstrated a real user-shaped failure live**: a device returning after
   weeks silently loses 100% of its sends toward the peer (frames presumably
   posted to June-era session inboxes orphaned by later replacements — the
   #273 mechanism seen from the SENDER's side, and why the receiver logs
   nothing: it is not subscribed to those inboxes at all), while its self-sync
   copies arrive, decrypt, persist — and then hide in a misfiled ghost
   conversation. Filed as
   `2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md`.
3. **Spurious conversation rows on both desktops**: desktop A carries an
   "Unknown User" row with B's address (preview "U20", zero unique messages —
   `duplicates: 0` proves no extra copies); desktop B carries the ghost
   self-conversation whose profile backfill 404s on B's own address. Both
   minted around the stale device's activity.
4. ⚠️ Timing caveat, recorded for honesty: desktop A's probe reading was taken
   ~25s after the last send; the absence was re-confirmed visually ~1h later,
   but no second probe reading was taken.

---

## 2026-07-29 (evening) — ROUND X: the field loss captured from BOTH ENDS, with a cold-drain control

**The first round captured from both ends with a cold-drain control.** First round run
with the shipped tools (mobile burst button + desktop DM doctor), first round
where the sender's per-message record and both receivers' stores describe the
same twenty messages.

**Configuration:** mobile A, **dev build**, burst tool, `X 1`…`X 20`, 2000 ms
interval, 16:36:31→16:37:21Z. Receivers: desktop B (peer channel, app live
throughout) and desktop A (the sender's own second device, self-sync fan-out
channel — **app NOT running during the burst**, cold-started at 16:47).

| observer | channel | class | result |
|---|---|---|---|
| **phone (sender)** | — | send record | **20/20 handed to the socket, zero errors**, each with messageId, nonce, queue time and settle time. Run wall time 50.0 s |
| **desktop B** | peer | arrival + persistence | **17/20, missing [1, 6, 11].** Identical across three scans including one after a full page reload. Zero warnings (`sessionReplaced=0, unknownInbox=0, decrypt=0`), zero misfiled, zero duplicates |
| **desktop A** | self-sync fan-out | arrival + persistence | app closed during the burst ⇒ 0/20 at first read; **cold-started and drained the inbox 9 minutes later ⇒ 17/20, missing [1, 6, 11]** — the same three. Zero warnings |

### What this establishes, and why the cold drain is the key control

1. **The same three messages are absent from two independent channels.**
   Fan-out sends separate frames per device; independent per-inbox loss cannot
   select the identical three on both. **The loss unit is the whole message.**
   Confirms the morning's U-run cross-store finding on fresh evidence.
2. **They were not waiting server-side.** Desktop A's client started from
   cold and drained its inbox from scratch — the operation that collects
   everything pending — and still got only 17. Frames 1, 6, 11 are **not in
   either recipient's inbox**. This is the control every previous reading
   lacked, and it closes the "very late rather than lost" escape hatch far more
   tightly than a settle window ever could.
3. **Nothing failed on either receiver.** No decrypt failures, no unknown-inbox
   drops, no session replacements, no misfiling, no orphan match. The receive
   path was not asked to handle these frames at all.
4. **Shape: scattered (1, 6, 11), not a contiguous tail** — per-message drops,
   not a pipeline stall, by this file's own rule.

Net: three messages left the phone's socket cleanly and reached neither
mailbox. **That is quorum-mobile#183 item 2's shape, measured end-to-end for
the first time.**

### [REFUTED] A NEW signal: every loss came from the slow-send group

> Refuted by Round Y, which had 19 of 20 sends slow and losses unremarkable in
> timing. Do not re-derive it.

The burst record's `tsAfterSendMs` is sharply bimodal, and the split is not random:

| group | messages | count | lost |
|---|---|---|---|
| **fast (35-94 ms)** | 2, 3, 4, 9, 13, 18, 19, 20 | 8 | **0** |
| **slow (617-762 ms)** | 1, 5, 6, 7, 8, 10, 11, 12, 14, 15, 16, 17 | 12 | **3** (1, 6, 11) |

**The first time a property of the sending message itself correlates with
loss.** 3/12 in the slow group, 0/8 in the fast. ⚠️ One round, n=20, and 8 fast
samples cannot exclude chance (a hypergeometric test on these counts is not
significant) — **this is a lead to test, not a finding**. The obvious mechanism
to look at is what the slow sends were doing extra: session establishment /
init-envelope work. Message #1 being lost also matches the known
session-establishment signature seen on the cross-platform bench.

**Next round must record this deliberately:** repeat bursts, tag each message
fast/slow from the record, and see whether losses keep landing in the slow
group. If they do, the suspect narrows from "the write path" to "the write path
for init-wrapped/session-establishing frames".

### ⚠️ Two corrections made during this round, recorded because both nearly became findings

- **A "three-hour receive stall" was claimed and is RETRACTED.** Desktop A's
  0/20 was read as a stalled receive pipeline, with the conversation row's stale
  `13:55` timestamp as corroboration. The operator pointed out the app had not
  been open on that profile; the router confirms `/dev/dm-doctor` renders
  **outside the app shell** (`Router.web.tsx` — dev routes are siblings of
  `<Layout>`, not children), so a tab on the doctor page has no WebSocket and
  receives nothing. There was no stall. The corrected reading is *stronger*
  (item 2 above), which is the lesson: the confident wrong version was also the
  weaker one.
- **The stale-returning-device bug is CONFIRMED independent**, not an artifact
  of the above: desktop A, cold-drained at 16:50, still reads **0/20 for the V
  series** sent 2 hours earlier. Those frames are not in its inbox either —
  consistent with the orphaned-session-inbox mechanism, and not explainable by
  the app having been closed, since a cold drain would have collected them.

### Incidental, on desktop A: an ORPHAN-KEY row

3 messages filed under a conversation key equal to **A's own address**, with no
matching `conversations` row — permanently unreachable by the UI. Distinct from
desktop B's `SELF`-flagged ghost row (which *has* a conversation row holding the
20 misfiled V messages). Same family as the misfiling face of the
stale-device bug; both are recorded there.

---

## 2026-07-30 — ROUND Y: exact replication, and the slow-send lead is REFUTED

Same configuration as Round X, one deliberate correction: **both desktops had
the app open and connected for the whole burst** (Round X's desktop A did not —
see its §corrections). Mobile A dev build, burst tool, `Y 1`…`Y 20`, 2000 ms,
14:43:30→14:44:20Z.

| observer | channel | class | result |
|---|---|---|---|
| **phone (sender)** | — | send record | **20/20 handed to the socket, zero errors.** Wall time 50.5 s |
| **desktop B** | peer, live throughout | arrival + persistence | **17/20, missing [5, 11, 17].** Identical before and after reload. Zero warnings |
| **desktop A** | self-sync fan-out, live throughout | arrival + persistence | **17/20, missing [5, 11, 17]** — the same three. Zero warnings |

### ⛔ The slow-send correlation is REFUTED — do not re-derive it

Round X reported that all 3 losses fell in a "slow send" group (617-762 ms)
while 8 fast sends (35-94 ms) were clean, and flagged it as a lead to test.
**Round Y kills it.** This round **19 of 20 sends were slow** (481-682 ms; a
single 40 ms outlier), and the three lost messages took **548, 515 and 496 ms** —
unremarkable, slightly *faster* than the round's mean. There is no relationship
between send duration and loss.

Recorded prominently because it was explicitly published as a lead, and because
this is what the round was for. The X split was chance in n=20; the discipline
that killed it in one round is worth more than the lead was.

### What three rounds now establish, repeatedly

1. **Loss rate stable at 3/20 (15%)**, twice consecutively, consistent with the
   earlier 15-20% field figures.
2. **Both receivers lose the identical set, every time** — and this round with
   both clients live and connected throughout, removing Round X's confound.
   Common-mode loss at or before the source is now established across three
   independent rounds (U, X, Y).
3. **Reload never recovers them** (operator waited ~1 min, then reloaded, then
   re-scanned: unchanged).
4. **Zero warnings of any kind, on either receiver, in every round.**

### ⚠️ An evenly-spaced pattern, recorded and explicitly NOT built upon

X lost 1, 6, 11 (every 5th); Y lost 5, 11, 17 (every 6th). Both are arithmetic
progressions, which invites a periodicity theory. **Resist it**: the U-run
(2, 5, 10) and the T-run (1, 5, 13, 17) were not. A 3-term AP among 20 arises by
chance ~8% of the time, so two consecutive occurrences is ~0.6% — suggestive,
far from conclusive, and this investigation's documented failure mode is exactly
this kind of pattern-fit. Watch it across future rounds; do not theorise on it.

### [UNCONFIRMED] A different failure class: receipt acks lost on the way to MOBILE

> Did not reproduce in Round Z, where receipts behaved correctly. Not a standing
> finding; do not cite it as established.

Operator observation during Round Y, unprompted:

| device | receipts visible |
|---|---|
| **desktop A** (account A, second device) | receipts on **all 17** landed messages |
| **mobile A** (account A, the sender itself) | receipts on **only 4** — messages 1, 2, 3 and 20 |

Same account, same 17 messages, two devices, one has the full set and one has
four. Desktop A holding them proves B **did** emit acks for all 17, so this is
not a sender-side or B-side omission: **~13 receipt acks reached one of A's
devices and not the other.** The gap shape is head+tail (1, 2, 3 … 20), not
scattered.

This is **not** the same as the retired 2026-07-29 observation (there, the
receipts were missing *because* the underlying messages never arrived — a
consequence, not a second bug). Here the messages landed, the acks were emitted,
and only mobile lacks them.

It corroborates field round 26, which saw **read-ack frames 0/10 delivered while
chat posts 11/11 delivered in the same socket and the same minutes** (issue #183
item 2) — the same selectivity, in the other direction. Taken together, loss on
the mobile leg is not specific to outbound chat messages.

⚠️ **Needs one clarification before it is quoted**: the operator's note is
ambiguous between *delivery* ticks and *read* ticks ("read receipt only on
1,2,3,20 and no readreceipts"). Confirm which tick class is present on those four
before building on this row.

**Next rounds must count receipts as a first-class result**, on every device, not
as an aside — the tooling counts messages only.

### The live hypothesis after Round Y

Not send duration, but **ratchet chain position**. The DH ratchet steps whenever
the peer's traffic comes back — including B's receipt acks mid-burst — so a few
messages per burst are sent at a **chain transition**. That is a structural
property that varies per message and is invisible to every instrument used so
far. The mobile diag rig already logs DH epoch and sending-chain length per send
(`rig=9`), and since the burst button is now on `master`, `git debug` rebases the
rig on top of it and yields both in one build. **One rig round answers whether
the lost messages sit at chain transitions.**

---

## 2026-07-30 — ROUND Z: the RIG round. Send side proven complete; the session/shape hypothesis refuted

First round on the **diagnostic rig** (`diag/dm-frame-trace`, rebased onto master
so it carries the burst button too — `git debug`, BUILD CHECK all green). Mobile A
→ account B, `Z 1`…`Z 20`, 2000 ms, 15:00:16→15:01:03Z. Desktop B live; desktop A
deliberately **closed** (offline-device catch-up test, reading owed).

| observer | class | result |
|---|---|---|
| **phone (sender)** | send record | **20/20 sent**, wall 49.0 s |
| **phone (rig)** | send instrumentation | **120 `[DM-send row]` probes = 20 messages × 6 device targets, no gaps.** Every lost message was prepared and dispatched to all six targets exactly like the landed ones |
| **desktop B** | arrival + persistence | **16/20, missing [1, 7, 8, 14]**, unchanged after reload. Zero warnings |

### What the rig establishes: the client's send path is COMPLETE

Every one of the 20 messages produced a full 6-target fan-out at the send-row
stage — including all four that vanished. **No message was skipped, no target
dropped, no send errored.** The loss is entirely downstream of the client's send
logic. This is the first round with direct instrumentation on the sending side of
a reproduced loss.

### ⛔ The session / chain-transition hypothesis is REFUTED

Round Y proposed that losses sit at ratchet chain transitions, testable via the
rig's `shape` field (`init` = session setup, `plain` = established). The result
kills it: **`shape` is constant per target device, not per message.**

| target | shape (all 20) | session rows |
|---|---|---|
| QmX4pUca… | plain | 1 |
| QmbbgTUt… | **init** | 2 |
| QmUoTWS7… | plain | **19** |
| QmYTED4B… | **init** | 2 |
| QmPYQwYN… | **init** | 1 |
| QmNpLHRH… | **init** | 1 |

Every message to a given device carries the same shape, so shape cannot select
*which* messages vanish. Timing does not either: the lost messages' fan-out
spreads (156/369/162/272 ms) sit inside the landed range (152-3159 ms).

**Two hypotheses proposed and killed in two consecutive rounds** (slow-send in Y,
shape/chain in Z). Both were published as leads and both were refuted by the next
measurement rather than accumulating.

### ⛔ The evenly-spaced pattern is also dead

X lost 1, 6, 11; Y lost 5, 11, 17 — both arithmetic progressions, flagged as a
curiosity and explicitly not built upon. **Z lost 1, 7, 8, 14 — 7 and 8 are
adjacent.** Coincidence confirmed. The earlier restraint was correct.

### Two real defects the rig exposed incidentally (neither causes the loss)

1. **4 of 6 target devices receive init-wrapped frames on EVERY message** — those
   sessions never confirm, so session-setup material is re-sent forever. The
   known "sessions never confirm" defect, now observed in live production traffic
   rather than inferred. Related: `quorum-mobile` #177 and the send-latency bug's
   finding of 6 permanently-unconfirmed sessions.
2. **Ghost fan-out: one conversation targets 6 device inboxes**, and one of them
   carries **19 session rows** of churn debris. Every typed message becomes six
   encrypted frames.

### Loss rate across the three tool-instrumented rounds

| round | lost | rate |
|---|---|---|
| X | 3/20 [1, 6, 11] | 15% |
| Y | 3/20 [5, 11, 17] | 15% |
| Z | 4/20 [1, 7, 8, 14] | 20% |

Stable 15-20%, matching every earlier field figure.

### ⚠️ The gap this round did NOT close, and the one-flag fix

`[DM-send row]` fires at frame **preparation**, not at the socket write. The
node_modules transport patch that logs each actual `ws.send` (`[WS-frame]`)
**produced zero lines**, despite `git debug` reporting all three bundles patched
— almost certainly Metro serving a cached copy of the dependency (app-source rig
changes were picked up on reload; the node_modules patch was not).

**Fix: start Metro with `-ResetCache`.** Closing this gives the complete chain —
prepared → handed to the socket → absent at both receivers — which is what makes
the upstream report airtight. (Field rounds 27 and 29 already established the
`ws.send` link historically; this would re-establish it on current code.)

### Receipts: round Y's anomaly did NOT reproduce

Operator observation: this round receipts behaved **correctly** — present for
landed messages, absent for the four that never arrived, which is the right
behaviour. Round Y's asymmetry (desktop A holding 17 receipts while mobile A held
4) is therefore **unconfirmed and not a standing finding**. Keep counting
receipts per device in future rounds; do not cite the Y row as established.

### Inbound during the burst

Only 10 `[DM-recv wire]` frames, all to one inbox, and **several are redeliveries
of the same fingerprint via both the `batch` and `individual` paths** (e.g.
`e3f16f2f` three times). Not loss, but worth knowing the inbound path duplicates
under normal operation.

---

## 2026-07-30 — ROUND P: THE MECHANISM. Frames written into a dying socket

**The round that first tied loss to socket drops.** Same rig configuration as Round
Z, but Metro started with **`-ResetCache`**, which finally loaded the
`node_modules` transport patch — so every frame handed to `ws.send` is logged,
along with mid-write socket failures. Mobile A → account B, `P 1`…`P 20`, 2000 ms.

| observer | class | result |
|---|---|---|
| phone (sender) | send record | 20/20 sent |
| phone (rig + transport patch) | **socket** | **TWO socket drops during the 50 s burst** (17:28:29, 17:29:01 local), each `socket lost mid-batch, requeued` ×6 then `flushed-pending` ×6 ~1.8 s later |
| desktop B | arrival + persistence | **15/20, missing [2, 3, 9, 10, 16]** (25%), unchanged after reload, zero warnings |

### The finding: loss clusters in the ~5 s before a detected socket drop

| message | gap to next detected drop | outcome |
|---|---|---|
| 3 | **2.0 s** | **LOST** |
| 16 | **2.5 s** | **LOST** |
| 2 | **4.6 s** | **LOST** |
| 15 | 5.1 s | landed |
| 1 | 7.6 s | landed |
| 14 | 9.4 s | landed |

`ws.send()` returns successfully because the local buffer accepts the bytes, but
the TCP connection is already broken and they are never delivered. On reconnect
the client requeues **only the batch it was actively writing**; everything
written in the preceding seconds is treated as sent and never retried. No
application-level ack exists, so nothing anywhere learns those messages died.

All six per-device frames were logged as written for every lost message (and
Round Z independently showed 120/120 send rows), so the client's send path is
complete — the frames are lost *after* `ws.send` and *before* the wire.

### Why this explains every prior null, including weeks of green benches

The harness runs Node `ws` over a stable wired connection, where sockets
essentially never drop. The phone runs a mobile radio, where they drop
constantly — **twice in one 50-second burst here**. Every bench was measuring a
configuration in which the trigger cannot occur. It also matches the 2026-07-29
sender-isolation row exactly: same account, same relay, same receiver, mobile app
lost 15-20% and a harness bot over Node `ws` lost none. **The variable was never
the crypto or the client logic; it was the socket.**

Full write-up, caveats and fix direction:
[`2026-07-30-mobile-frames-lost-into-a-dying-websocket.md`](2026-07-30-mobile-frames-lost-into-a-dying-websocket.md).

### ⚠️ Limits of this round — read before quoting it

- **One round.** Replication owed.
- **Messages 9 and 10 do not align with a *detected* drop.** The probe only sees
  a dead socket when it is midway through a batch write; drops between batches
  are invisible. Undetected drops are an inference, not a measurement.
- **logcat throttled** (37 `chatty` indicators; 108 of ~120 expected frame lines
  survived). Does not affect the lost messages — all six frames captured for each
  — but frame coverage is incomplete.
- `bufferedAmount` reads `?` on RN's socket, so bytes queued-but-unsent at the
  drop cannot be seen. That would be direct confirmation.

**Confirmation round:** extend the patch to log socket lifecycle directly
(`onopen`/`onclose` with code+reason/`onerror`) rather than only mid-write
failures, then repeat. Predictions: every lost message sits within ~5 s of a
`close`, including 9 and 10; and the true `close` count exceeds the 2 visible now.

### Loss rate across four instrumented rounds

| round | lost | rate | notes |
|---|---|---|---|
| X | 3/20 [1, 6, 11] | 15% | cold-drain control on 2nd receiver |
| Y | 3/20 [5, 11, 17] | 15% | both receivers live |
| Z | 4/20 [1, 7, 8, 14] | 20% | rig: 120/120 send rows complete |
| **P** | **5/20 [2, 3, 9, 10, 16]** | **25%** | **rig + transport patch: socket drops seen** |

---

## [CAUSAL HALF SUPERSEDED] 2026-07-30 — THE IDLE CAPTURE: the connection dies every 19 seconds, with nobody touching it

> The counts and lifetimes stand. Their attribution to an idle timeout does not —
> see THE RELAY PROBE below.

**The measurement that turns a mechanism into a root cause.** After Round P
suggested losses cluster before socket drops, the transport patch was extended to
log the socket **lifecycle itself** (`[WS-life] OPEN / CLOSE(code, reason, clean,
queue depths) / ERROR`) rather than only noticing a dead socket mid-write. Then
the phone was left **completely idle** — no burst, no messages, no interaction.

| metric | value |
|---|---|
| capture | **25.6 minutes, phone idle** |
| disconnections | **81** → **one every 19.0 s** |
| connection lifetime (OPEN→CLOSE) | min 13.9 s, **median 16.3 s**, max 20.2 s |
| reconnect gap (CLOSE→OPEN) | median **2.7 s** |
| close code | **1006 on every one**, `clean=false`, empty reason |
| queue depth at close | `pending=0 outbound=0` |
| time actually connected | **86%** |

### What it establishes

1. **The drops are not caused by the bursts.** The operator raised precisely this
   objection ("a real user hardly sends a message every 2000 ms") and was right to.
   The answer is that the connection dies on its own schedule whether or not
   anything is sent. Bursts were a magnifying glass, never the cause.
2. **There is NO keepalive anywhere in the transport.** A grep of the shipped
   bundle finds no `ping`, `pong`, `heartbeat` or keepalive timer in either the RN
   client or the browser client. The socket is left silent and something upstream
   reaps it after ~16 s.
3. **Close code 1006 = no close handshake**, so the client cannot learn of the
   break from the protocol — it finds out only when a read/write finally fails,
   seconds later. In that gap `readyState` still reads `OPEN`, the pre-write guard
   passes, `ws.send()` accepts the bytes, and the frame is dropped from the queue
   as "sent".
4. **The arithmetic closes the loop.** A ~5 s blind window inside a 19 s cycle
   is ~26% of sends. Measured DM loss across the four instrumented rounds: **15%,
   15%, 20%, 25%.** Two independent routes to the same number.
5. **It explains ordinary use, not just bursts.** One message sent at a random
   moment has roughly a one-in-four chance of entering a doomed connection. That
   is the six-month field symptom exactly.

### [REFUTED] It is an IDLE timeout of ~11 s — measured across 217 closes

> There is no idle timeout. A silent connection survives indefinitely provided it
> pongs. The ~11 s was mobile's app-silence, coincidentally near the real 10.0 s
> pong deadline. See THE RELAY PROBE.

Time from the **last frame sent** to the **CLOSE**:

| p25 | **median** | p75 | max | within 14 s |
|---|---|---|---|---|
| 7.2 s | **10.9 s** | 12.4 s | 16.7 s | **203 / 217** |

One cycle: `OPEN → ~29 subscribe frames over 2-3 s → 12 s of total silence →
ERROR + CLOSE(1006) → OPEN → …`. The 6,501 frames logged in 25 minutes are almost
entirely **re-subscription churn caused by the reconnects themselves**, not
useful traffic.

### ⚠️ Desktop comparison — TWO claims made and retracted the same hour

| claim | basis | verdict |
|---|---|---|
| "desktop shows the same ~19 s cycle" | one `quorum-ws` row reading 19.82 s | ⛔ **WRONG** |
| "desktop is reaped on a ~175 s cycle" | HAR `time` = 172.9 s and 177.6 s | ⛔ **WRONG** — for a still-open connection HAR `time` is *elapsed so far*, not a lifetime |
| **desktop holds one connection 20+ minutes** | operator watching the live panel; re-verified at 3.1 min with the **VPN disconnected** | ✅ **correct** |

**Why the desktop survives:** it is accidentally chatty. Its background traffic
recurs more often than the ~11 s idle window, so the timer never expires. Not
better engineering — the mobile client simply goes silent after subscribing.
Both clients were on the same WiFi, and the VPN (desktop only) was excluded by
re-testing with it off.

> **Method note:** both errors read a *duration-so-far* as a *final lifetime*.
> Measure connection lifetimes at the close event, never from a snapshot of an
> open connection.

### TCP-level confirmation, independent of app logging

Sampling the phone's TCP table over adb (`ss -tn`, 10 samples / 50 s) shows
**five distinct local ports** against the relay's Cloudflare address
`172.67.151.63:443` — the connection genuinely re-establishes at TCP level. This
method needs **no instrumentation**, so it works on production/`.preview` builds
too, and is the cheapest way to check whether live users' apps behave the same.

### Why every bench was green, restated precisely

Node's `ws` on a wired desktop holds a connection for hours, and the harness
never idled a socket into the reap window. **The benches were not wrong and the
client logic was never at fault — the benches simply could not host the
trigger.** This also retro-explains the 2026-07-29 sender-isolation row: same
account, same relay, same receiver, mobile app lost 15-20% while a harness bot
over Node `ws` lost none. The variable was the socket all along.

### What this does NOT yet establish

- The blind window between the real break and the client noticing is
  **inferred**; the exact instant was not instrumented (`bufferedAmount` reads
  `?` on RN's socket).
- Individual lost messages have not yet been tied to specific `CLOSE` events —
  the lifecycle probe was armed *after* round P. A repeat burst closes this,
  including round P's messages 9 and 10.
- **What performs the reap is unknown** — home router, ISP/CGNAT, or Cloudflare
  in front of the relay. It does not block the client fix (a keepalive is correct
  on any network), but if it is a proxy setting, raising it may be the smaller
  fix.
- **Not yet checked on a production build.** The TCP-sampling method above needs
  no instrumentation and can answer this on the `.preview` or live app.

Full analysis, caveats and the two-layer fix plan:
[`2026-07-30-mobile-frames-lost-into-a-dying-websocket.md`](2026-07-30-mobile-frames-lost-into-a-dying-websocket.md).

---

## 2026-07-30 — THE RELAY PROBE: it is not an idle timeout, it is a 10 s pong deadline

**This round supersedes the causal half of THE IDLE CAPTURE above.** The
observed *effect* (connections dying constantly, 1006, frames lost in the blind
window) is unchanged and still correct. The *cause* was misidentified, and the
fix that followed from it would not have worked.

### Method

The relay's protocol behaviour was measured directly, from the desktop, with a
dependency-free raw WebSocket client over TLS
([`.agents/scripts/relay-pong-probe.mjs`](../../scripts/relay-pong-probe.mjs)).
A raw client is required because **every JS WebSocket client pongs
automatically and cannot be told not to** — and *not* ponging is precisely the
condition under test. Each trial takes ~10-40 s. **No phone, no instrumentation,
no app build.**

### Results

| # | trial | pongs? | app frames? | outcome |
|---|---|---|---|---|
| 1 | `ws` library, fully silent | yes (auto) | none | **survived 90 s** (9 pings, all auto-ponged) |
| 2 | raw `pong` control | yes | none | **survived** (39.5 s, 24.5 s, 21.6 s across runs) |
| 3 | raw `nopong` | **no** | none | **died 9.71 / 10.03 / 9.98 / 10.02 / 9.99 s** |
| 4 | raw `nopong-app` (empty listen, rejected) | no | every 5 s | **died 9.76 s** |
| 5 | raw `nopong-listen` (**valid** frame, accepted) | no | every 5 s | **died 10.02 s** |
| 6 | raw `nopong-unlisten` (**valid** frame, accepted) | no | every 5 s | **died 10.01 s** |
| 7 | `pong-slow` 500 ms | late 500 ms | none | **survived 31.4 s** |
| 8 | `pong-slow` 900 ms | late 900 ms | none | **died 10.02 s** |
| 9 | `pong-slow` 1500 / 3000 ms | late | none | **died 10.01 / 10.02 s** |

### The model, fully pinned

- The relay sends a **protocol-level PING every 9.0 s** (measured to ±0.03 s).
- It enforces a **read deadline of exactly 10.0 s**, refreshed **only by a pong**.
- **Application traffic does not refresh it.** Trials 5 and 6 sent well-formed
  frames the relay *accepted* (no error response) and still died on schedule.
  Trial 4 rules out "the frame was merely rejected" as the explanation.
- On expiry the relay **destroys the TCP connection with no close frame**, which
  is exactly what surfaces to a client as **code 1006, `clean=false`, empty
  reason** — the signature on all 81 disconnections in THE IDLE CAPTURE.
- **A client therefore has a ~1.0 s budget to answer each ping.** 500 ms
  survives; 900 ms is already too late.

This is the standard Gorilla WebSocket idiom
(`pingPeriod = pongWait * 9/10`, deadline refreshed in the pong handler) with
the constants set about **six times too small**: the library's own example uses
`pongWait = 60 s` / `pingPeriod = 54 s`, and OkHttp's guidance is a 30-60 s
heartbeat. This relay runs **10 s / 9 s**.

### ⛔ What this overturns

| prior claim | status |
|---|---|
| "any connection silent for ~11 s is killed" | ⛔ **WRONG.** A fully silent connection survives indefinitely as long as it pongs (trials 1, 2) |
| "the desktop survives because it is accidentally chatty" | ⛔ **WRONG.** It survives because Chromium pongs within milliseconds. Chattiness is irrelevant (trials 5, 6) |
| "the app has no keepalive, so add one at ~5 s in `quorum-shared`" | ⛔ **REFUTED.** An app-level keepalive cannot help: only pongs count. It would have failed the acceptance test |
| "the median 10.9 s silence before each close is the reap window" | ⛔ **Coincidence.** 10.9 s of app silence sat near the 10.0 s pong deadline, which is what was actually firing |

The `~11 s idle` reading was an artefact: mobile falls silent right after
subscribing, so "time since last app frame" and "time since connection open"
were nearly the same number, and the wrong one was causal.

### [PARTLY REFUTED] Why mobile dies and desktop does not

> The desktop half stands (Chromium pongs in milliseconds). The mobile half does
> not: Round Q showed connections during an active burst live *shorter* than idle,
> so radio sleep is NOT why the pong is missed. That mechanism is unexplained.

**Browsers and React Native both pong automatically at the native layer, and JS
cannot see, send, delay or control it.** Chromium (desktop/Electron) answers in
milliseconds over a stable connection. React Native on Android is backed by
OkHttp, which also auto-pongs natively — but on a mobile radio, a **1.0 s**
round trip budget is brutal. Any radio wake-up, doze exit, WiFi power-save
cycle or latency spike over ~1 s misses the deadline and the relay kills the
connection.

That fits the mobile capture's *variable* lifetimes (13.9 s min, 16.3 s median,
20.2 s max) far better than a fixed idle timer: some pings are answered in
time and extend the connection, some are not.

**Consequence: the client cannot fix this.** There is no JS API for pong timing
on any platform. This is a relay configuration issue.

### What this does NOT establish

- **The exact mobile mechanism is inferred, not measured.** The model predicts
  mobile misses pongs intermittently; that has not been observed directly.
  RN's JS `WebSocket` does not expose ping/pong events, so confirming it needs
  a **packet capture on the phone** or **relay-side logs** — not an app patch.
- **Whether the 9 s pinger is the relay itself or Cloudflare in front of it.**
  The 9 s/10 s ratio is the Gorilla signature, which points at origin app code,
  but this was not confirmed from the server side.
- **Whether the deadline is uniform** across relay instances/regions.
- Measured from one machine, one network, on 2026-07-30.

### Why every bench was green, restated once more

Node's `ws` auto-pongs over a wired connection with sub-millisecond latency, so
the harness never came close to the 1 s budget. **The benches could not host the
trigger** — the same conclusion as before, but now with the actual mechanism.

Full analysis and the revised fix plan:
[`2026-07-30-mobile-frames-lost-into-a-dying-websocket.md`](2026-07-30-mobile-frames-lost-into-a-dying-websocket.md).

---

## 2026-07-31 — ROUND Q: every loss lands in a 1.4-3.5 s BAND before a socket CLOSE

**The round that closes the chain.** Round P showed losses clustering before
socket drops but could not tie individual messages to individual closes (its
lifecycle probe was armed *after* it). Round Q does, and the separation is total.

**Configuration:** mobile A → account B, `Q 1`…`Q 20`, 2000 ms, 42.9 s wall,
08:22:26→08:23:09Z. Both desktops live throughout.

| observer | class | result |
|---|---|---|
| phone (sender) | send record | **20/20 sent**, zero errors |
| phone (transport patch) | socket lifecycle | **16 CLOSE in 5.3 min, 4 inside the burst. `1006` on every one** |
| **desktop B** (peer) | persistence | **16/20, missing [3, 4, 10, 17]**, unchanged on a second scan 8 min later |
| **desktop A** (self-sync fan-out) | persistence | **16/20, missing [3, 4, 10, 17]** — identical |

Zero warnings on both receivers (`sessionReplaced=0, unknownInbox=0,
decryptFailish=0`), zero duplicates, zero misfiled. **Common-mode loss at the
source is now established across FOUR independent rounds (U, X, Y, Q).**

### The finding: a clean two-sided band, with zero overlap

Seconds from each message's send to the **next `[WS-life] CLOSE`**:

| group | n | Δ to next CLOSE |
|---|---|---|
| **LOST** | 4 | **3.48, 3.18, 3.00, 1.43** |
| landed — *nearer* than every loss | 2 | 0.86, 0.66 |
| landed — *further* than every loss | 14 | 5.34, 5.50, 5.82, 7.39 … 15.83 |

**Every loss falls inside [1.43 s, 3.48 s] before a close, and not one survivor
falls inside that band.** The gaps on both sides are clean: nothing landed
between 0.86 and 1.43, nothing landed between 3.48 and 5.34.

Reading it:

- **>3.5 s out** — the connection is still alive; the frame is delivered.
- **1.4-3.5 s out** — the relay has already killed the connection, `readyState`
  still reads `OPEN`, `ws.send()` accepts the bytes and they are never
  delivered or retried. **This is the blind window, measured rather than
  inferred.**
- **<0.9 s out** — the failure surfaces *while this batch is being written*, so
  the existing `pendingEnvelopes` requeue catches it and flushes it on
  reconnect. **The last writes before detection are rescued; the earlier ones
  are not.** Round P observed that path directly (`socket lost mid-batch,
  requeued` ×6 then `flushed-pending` ×6).

That third bullet is exactly why the current requeue does not help: **its window
is ~1 s wide and the lethal window sits just outside it.**

### ⛔ The pre-registered prediction FAILED, and the failure is the useful part

Before reading either doctor, the predicted loss set was published as
**[4, 11, 18]**, derived from "the relay kills at OPEN+10.0 s, so everything
written between the kill and the client noticing is lost". Observed:
**[3, 4, 10, 17]** — one hit out of three, and three of the four real losses
unpredicted.

The failure was **systematic, not random**: in all three affected connections
the message just *before* the computed deadline was lost, and the message inside
the computed blind window *landed*. That one-message offset is what exposed the
requeue rescue at the near edge, which the naive model had no room for.

⚠️ **The requeue explanation is POST-HOC.** It was derived after seeing this
round, it is consistent with code already read and with Round P's direct
observation, and it is **not established**. It needs its own pre-registered
prediction in the next round before it is quoted as mechanism.

### ⛔ The radio-warmth hypothesis is REFUTED

The prediction was that an active burst keeps the radio hot, so pongs land
inside the relay's ~1 s budget and connections live *longer* than the 19.0 s
idle cadence. The opposite:

| window | connection lifetime |
|---|---|
| **during the burst** | n=4, min 12.4 s, **median 12.9 s**, max 14.2 s |
| outside the burst, same capture | n=14, median **15.4 s** |
| the 25.6-min idle capture | median **16.3 s** |

Sending every 2 s did not extend connection life; if anything it shortened it.
**Radio sleep is not why the pong is missed**, and the mechanism behind
`RN misses pongs` remains unexplained.

The consistent reading is that the observed "lifetime" is not connection life at
all but **time until the client noticed**: the relay kills on its own schedule
either way, and activity makes *detection* faster because a failed write
surfaces the error sooner. That also explains the shorter burst-window figures
without needing the connection to die sooner.

### Method notes

- Captured from a **master build** — the diag branch's `[DM-send wire]` probe
  was absent, so the round should have been unanalysable. It was recovered
  because the **burst button's JSONL lives on master** and carries
  `tsQueuedIso` per message, while `[WS-life]` carries `t=<epoch ms>` from the
  same device clock. `join-losses-to-closes.mjs --burst` does that join exactly.
  ⚠️ Do not rely on this: `[DM-send row]`/`[DM-recv wire]` were still missing,
  so nothing about per-target fan-out or inbound traffic could be checked.
- `validate-capture.mjs` rejected the capture **before the burst was sent** and
  named the cause correctly. The round ran anyway; the analysis above is what
  the burst record could rescue, not what the round was designed to produce.

Full analysis: [`2026-07-30-mobile-frames-lost-into-a-dying-websocket.md`](2026-07-30-mobile-frames-lost-into-a-dying-websocket.md).

---

## 2026-07-31 — ROUND R: the mechanism CONFIRMED by three pre-registered predictions

**The round that ends the mechanism question.** Round Q found the loss band but
explained its near edge *post-hoc*. Round R published three predictions before
any data was read, and all three held.

**Configuration:** rig properly armed this time (`git debug`, all probes
present), mobile A → account B, `R 1`…`R 20`, 2000 ms, 44.7 s wall,
08:48:35→08:49:20Z. Both desktops live.

| observer | class | result |
|---|---|---|
| phone (sender) | send record | **20/20 sent** |
| phone (rig) | send instrumentation | **120 `[DM-send row]` = 20 × 6 targets**, 20 `[DM-send wire]` |
| **desktop B** (peer) | persistence | **17/20, missing [2, 9, 16]** |
| **desktop A** (self-sync fan-out) | persistence | **17/20, missing [2, 9, 16]** — identical |

Zero warnings on both. **Common-mode loss now established across FIVE
independent rounds (U, X, Y, Q, R).**

### The three predictions, published before reading the doctors

| # | prediction | result |
|---|---|---|
| 1 | losses fall in a ~1.4-3.5 s band before a `CLOSE`; messages within ~1 s of a `CLOSE` survive | ✅ **losses at 3.24 / 3.29 / 2.81 s. Survivors nearest the close at 0.90 / 0.94 / 0.38 s. Zero survivors inside the band** |
| 2 | each near-edge survivor shows `socket lost mid-batch, requeued` then `flushed-pending` | ✅ **exactly. Each of R3, R10, R17 shows 6 REQUEUED ~1 s after send, then 6 FLUSHED on reconnect** |
| 3 | every message shows a full 6-target fan-out, lost ones included | ✅ **120/120 send rows** — replicates Round Z |

### The mechanism, stated exactly

Inside the burst: **3 CLOSEs, 18 REQUEUED, 18 FLUSHED.** 18 = 3 × 6. Each close
requeues and then flushes **exactly one message's fan-out** — the batch that was
mid-drain when the failure surfaced.

A message is six frames (one per device inbox). What happens to it depends
entirely on where it lands relative to the client noticing the socket is dead:

| written | fate |
|---|---|
| **> 3.5 s before detection** | connection still alive — delivered |
| **1.4-3.5 s before detection** | relay has already killed the connection, `readyState` still reads `OPEN`, `ws.send()` accepts all six frames, they are dropped from the queue as sent, never delivered, never retried → **LOST** |
| **< 1 s before detection** | the failure surfaces mid-drain, so all six frames are requeued and flushed on reconnect → **SURVIVES** |

**The rescue path already exists and works.** Its window is simply ~1 s wide,
and the lethal window sits immediately outside it.

### What this does to the fix

Layer 2 stops being speculative. It is no longer "design a replay scheme" — the
replay scheme is present, correct, and exercised on every drop. It only needs
its retention widened from *the batch currently draining* to *everything written
in the last ~5 s*, replayed on reconnect.

That also removes the objection raised against blanket replay (that re-sending
frames which already landed makes the receiver fail AEAD on a consumed ratchet
key, feeding crate bug 2a): frames inside the blind window **provably never
reached the relay** — five rounds of cold-drain and dual-store evidence — so
replaying them cannot produce a duplicate.

### Incidental observations, recorded not built upon

- **Close code `1000` appeared alongside the usual `1006`**, with
  `clean=false`, and twice an `OPEN` was followed by another `OPEN` ~2.6 s later
  with no `CLOSE` between. Suggests a second client or a reconnect race. Not
  investigated.
- Connection lifetimes across the whole capture are far more variable than the
  idle capture suggested: **min 1.8 s, median 15.4 s, max 60.5 s** (n=101). A
  60 s connection is much longer than anything the pong-deadline model predicts
  and is unexplained.
- **Operator note:** desktop A showed *more* missing before a page refresh, with
  one or two appearing after it. Both post-refresh scans agree on [2, 9, 16].
  Possibly late arrival inside the window rather than a cache effect; worth a
  deliberate before/after-refresh reading in a future round.

---

## 2026-07-31 — ROUND S: the candidate FIX, tested locally. 20/20, and the lethal band is now survivable

**First round with a fix applied.** A local `node_modules` patch
(`patch-rn-ws-retain.mjs`, mobile, gitignored) widens the existing send-retry
window: every frame handed to `ws.send` is retained for 6 s, and anything still
inside that window when the socket reopens is replayed. **No `quorum-shared`
publish, no rebuild, no link step** — the same patch mechanism already used for
the diag probes.

**Configuration:** rig armed + retain patch, Metro restarted with
`-ResetCache`, mobile A → account B, `S 1`…`S 20`, 2000 ms, 47.0 s wall,
09:29:19→09:30:06Z. Both desktops live.

| observer | class | result |
|---|---|---|
| phone (sender) | send record | 20/20 sent |
| phone (transport) | socket lifecycle | **8 CLOSE during the capture** — the conditions for loss were present |
| phone (fix) | replay | **6 `[WS-retain] replaying` events, 42 frames** (1, 3, 6, 7, 12, 13) |
| **desktop B** (peer) | persistence | **20/20, none missing, duplicates 0** |
| **desktop A** (self-sync fan-out) | persistence | **20/20, none missing, duplicates 0** |

Zero warnings on both (`sessionReplaced=0, unknownInbox=0, decryptFailish=0`).

### Why this is a real pass and not a lucky round

A clean 20/20 proves nothing on its own — a round in which the socket never
dropped would score the same. It dropped **8 times**. The decisive comparison is
per-message position relative to the next `CLOSE`:

| round | messages inside the lethal 1.4-3.5 s band | of those, lost |
|---|---|---|
| Q (unpatched) | 4 — at 3.48, 3.18, 3.00, 1.43 s | **4 of 4** |
| R (unpatched) | 3 — at 3.24, 3.29, 2.81 s | **3 of 3** |
| **S (patched)** | **3 — at 3.23, 2.16, 3.35 s** | **0 of 3** |

Across Q and R every single message written into that band died, 7 for 7. In S,
S2 (3.23 s), S7 (2.16 s) and S13 (3.35 s) sat in the same band and all three
landed. The near-edge cases the *old* requeue already handled behaved as before
(S3 at 0.86 s, S14 at 1.01 s).

### The safety question, answered

Replay necessarily re-sends some frames that did arrive, because the client
knows when it *noticed* the death, not when the relay caused it. **Both
receivers report `duplicates: 0` and `decryptFailish: 0`.** No duplicate message
surfaced and no decrypt-failure storm appeared, which is what the
already-routine redelivery path predicted.

### Limits — read before quoting this

- **One round.** Replication owed. Q and R each needed a second round before
  their findings were trusted, and this one is more consequential than either.
- **This is a local `node_modules` patch, not shipped code.** It proves the
  *mechanism* and sizes the window. The real change belongs in `quorum-shared`'s
  `RNWebSocketClient` and needs a PR, a version bump, and the lead dev's call on
  publishing.
- **It does not fix the cause.** Connections still died 8 times in ~47 s. This
  makes the loss survivable; only the relay-side `pongWait` change (#183 item 1)
  stops it happening.
- **The 6 s window is a first guess** sized from a measured ~3.5 s detection lag.
  It has not been tuned, and the cost of a larger window is duplicate volume.
- The armed markers were absent from the capture because they fire at bundle
  load, before the capture started. The `[WS-retain] replaying` lines are
  themselves proof the patched bundle ran — that string exists nowhere else.

---

## 2026-07-31 — ROUNDS T and U: the fix sized correctly. 20/20, and the one failure in between diagnosed the parameter

### Round T (6 s retention) — 19/20, and the miss is informative

`T 1`…`T 20`, 2000 ms, 47.0 s. Both desktops **19/20, missing [5]**, duplicates 0.
16 CLOSEs during the capture (roughly double Round S), 8 replay events.

**T5 was lost at Δ=5.02 s before its CLOSE — outside the 1.4-3.5 s band**, while
messages at 3.46, 3.31, 2.69, 1.05, 0.96 and 0.35 s all landed. So the fix
covered its band; T5 was a different failure.

The cause was a **sizing error, not a second mechanism**. Retention is measured
from send to **replay** (the reconnect), so the budget must cover the blind
window *and* the reconnect gap. That round's gap was **4.42 s**:

```
effective pre-drop coverage = RETAIN_MS − reconnect gap = 6.00 − 4.42 = 1.58 s
```

T5 was **9.43 s old** when the socket reopened, past the 6 s cutoff, so it was
pruned and never replayed. It also shows the blind window is **not fixed at
~3.5 s** — it exceeded 5 s on that connection.

### Round U (12 s retention) — 20/20, with the T5 failure mode covered

`U 1`…`U 20`, 2000 ms, 51.4 s. Both desktops **20/20, duplicates 0, zero
warnings**. 9 CLOSEs, 5 replay events carrying 170 frames. The capture confirms
the running build (`retained within 12000ms`).

**Five messages sat at the T5-like position (4-7 s before a drop): 3, 9, 10, 15,
16 — all landed.** Three of them were **9.68 / 9.92 / 10.32 s old at replay**,
so under the old 6 s window they would have aged out exactly as T5 did.

### The chain, across five rounds

| round | retention | result | what it establishes |
|---|---|---|---|
| Q | none | 16/20 | 4 lost, all inside the 1.4-3.5 s band |
| R | none | 17/20 | 3 lost, all inside it; mechanism confirmed by 3 pre-registered predictions |
| S | 6 s | **20/20** | 3 messages survived the band that had killed 7 of 7 |
| T | 6 s | 19/20 | one loss, diagnosed to retention being eaten by the reconnect gap |
| U | **12 s** | **20/20** | 3 messages rescued at ages 6 s would have dropped |

`duplicates: 0` and `decryptFailish: 0` on **every** patched round, so replay has
not produced visible duplicates or a decrypt-failure storm.

### Limits

- **Two clean rounds at 12 s is not proof of elimination.** Loss was 15-25% of
  messages, so a 20-message round has real chance of passing by luck; the
  per-message position analysis is what carries the weight, not the 20/20.
- **12 s is sized from observed worst cases** (blind window >5 s, reconnect gap
  4.4 s). A longer reconnect gap would eat it again. A design that keys off
  *connection generation* rather than a wall-clock budget would remove the
  sensitivity entirely, and is the better shape for the real implementation.
- **Still a local `node_modules` patch, not shipped code**, and it does not fix
  the cause — connections still died 9 times in ~51 s. Only the relay-side
  `pongWait` change (#183 item 1) stops that.
- **Receipts remain unexplained and unstable**: round T had T1-T4 missing
  receipts on mobile A; round U had T20 missing on desktop A with mobile A
  complete. The gaps move between rounds and devices with no pattern yet. Still
  `[UNCONFIRMED]`; do not build on it.

---

## 2026-08-01 — THE PUBLISHED-BUILD SMOKE ROUND: 20/20, but no socket data

**The first time the shipped `quorum-shared` code has run on a device.** Every
prior patched round (S, T, U) tested a local `node_modules` patch; this one
tested the published package, which is the gap
[`2026-07-31-dm-fix-shipped-confirm-and-measure-spaces.md`](2026-07-31-dm-fix-shipped-confirm-and-measure-spaces.md)
§3 exists to close.

⚠️ **Read this as a SMOKE TEST, not as that confirmation round.** It carries no
socket-lifecycle data, so it **cannot separate "the fix worked" from "the socket
never died during those seconds"**. §3 is still owed.

**Configuration:** mobile dev build → desktop, 20-message burst. Burst interval,
wall time, per-desktop breakdown and duplicate count were **not recorded**, and
**no round letter was used** — none should be treated as burned.

| observer | class | result |
|---|---|---|
| desktop | persistence | **20/20 landed** |
| phone | socket lifecycle | ⛔ **none — diag probes absent** |
| phone | replay events | ⛔ **none — no logcat capture was running** |

### What WAS verified about the build (2026-08-01, by inspecting the installed package)

This part is solid, and it settles "is it really the published code?":

| check | result |
|---|---|
| `quorum-mobile/package.json` | `"@quilibrium/quorum-shared": "2.1.0-39"` — a version, **not** `link:` |
| installed package | `2.1.0-39`, a real directory, not a link to the sibling checkout |
| shipped implementation present | `SendRetention`, `sealOnClose` on `onclose`, `replayRetainedFrames` on open |
| local patch applied? | **no** — `retained within`, `armed window=` and `__retain` all absent |
| retention active by default? | **yes**, no opt-in required: `12000 ms / 200 frames / 3 replays`. Mobile passes no options and does not need to |

### ⚠️ Both implementations log under the SAME `[WS-retain]` tag — record this

Grepping a capture for `WS-retain` does **not** tell you which one ran:

| what ran | the line it prints |
|---|---|
| **published 2.1.0-39** | `[WS-retain] replaying N frame(s) from the previous connection` |
| local patch | `[WS-retain] replaying N frame(s) retained within 12000ms (dropped M older)` |
| local patch, at startup | `[WS-retain] armed window=12000ms cap=…` |

This is the cheapest possible check that a round tested what it claims to have
tested, and it needs no rig.

### Why this round cannot be scored

At 15-25% loss a 20-message round has a real chance of passing on luck — which is
exactly why S/T/U were argued from per-message position relative to the next
`CLOSE` rather than from the 20/20. This round has no `[WS-life]` lines because:

- the diag probes were wiped by the reinstall that brought in `2.1.0-39`, and
  `git debug` had not been re-run (verified: `WS-diag`, `WS-life`, `WS-frame` all
  absent from the installed dist);
- no logcat capture was running during the burst.

**It still establishes something no earlier round did:** the published build runs
on a device, sends, and delivers a full burst with no visible breakage. That was a
real unknown, because the shipped implementation departs from the validated patch
in four ways (retention keyed to the socket close rather than a wall clock;
`pendingEnvelopes` flushes retained too; a per-frame replay cap; and
`BrowserWebSocketClient` fixed as well).

### The cheap upgrade for the next round

`[WS-retain] replaying …` is emitted by **the published package itself**, not by
the diag rig. So even a capture with no rig answers both questions at once if
those lines appear: it proves the published code ran, *and* that the socket died
and frames were rescued. With `git debug` armed on top, the full per-message join
is available again via `join-losses-to-closes.mjs`.

⛔ **Do not apply `patch-rn-ws-retain.mjs`** — the fix is in the package now, and
applying the patch on top would double-retain. `git debug` applies a *different*
patch (`patch-rn-ws-diag.mjs`, the instrumentation), which is still required.

---

## 2026-08-02 — SPACE HARNESS S1: a join delivers both halves, at N=2 members. `[NOT A RATE]`

**Class: `arrival` + persistence.** Desktop↔desktop, headless, both bots in one
Node process on production. `yarn harness space-basic`, four consecutive runs,
fresh throwaway accounts each time (a reused bot would already hold the row and
the message, and would "pass" with no exchange having happened).

Bot A creates a space and posts, bot B joins by invite link, A posts again.

| | run 1 | run 2 | run 3 | run 4 | run 5 |
|---|---|---|---|---|---|
| pre-join post — reachable ONLY by the sync exchange | ✅ | ✅ | ✅ | ✅ | ✅ |
| post-join post — also reachable by hub broadcast | ✅ | ✅ | ✅ | ✅ | ✅ |
| B member rows, 1 → 2 | ✅ 11.2 s | ✅ 10.5 s | ✅ 9.8 s | ✅ 10.6 s | ✅ 10.0 s |
| outbound action failures | 0 | 0 | 0 | 0 | 0 |
| receive failures (novel) | ⚠️ n/m | ⚠️ n/m | ⚠️ n/m | ⚠️ n/m | 0 |

> ⚠️ **`n/m` = not measurable, and it was originally recorded here as `0`.** The
> space receive path swallows every error in one terminal catch
> (`MessageService.ts:6110`) and reports it via **`console.error`**, while the DM
> path uses `logger.error` — and the harness tee was wired only to `logger`. Runs
> 1-4 therefore printed a receive-failure count that could not have been non-zero.
> Fixed in the second commit of desktop PR #297, which tees both sinks, splits
> novel from replay by ciphertext fingerprint, and adds a self-test requiring the
> counter to go 0 → 1 on a deliberately corrupt frame. **Run 5 is the first
> trustworthy `0`.** The delivery numbers in runs 1-4 stand — posts and member
> rows are read from IndexedDB, not from that tee.

Member rows are read from IndexedDB, not from a UI or an in-memory tally, and B
writes only its OWN row locally — so a second row can only have come off the
wire.

### ⚠️ What this is NOT, stated first because it is the likely misuse

**This is not a delivery rate, and it is not evidence the roster bug is absent.**
It runs at **2 members**; the reported failure
(`bugs/2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md`) is at ~79 and
is intermittent. Four samples at the wrong N cannot bound a rate at the right one.
That bug file records three confident wrong answers produced in one day, all from
promoting a short streak to a law; this row exists partly so the fourth is harder
to write.

### What it DOES establish

Two things that were previously unknown and could only be settled by running it:

1. **Nothing in space create / invite / join is passkey-interactive.** All
   `js_sign_ed448` over raw keys, same as DM send. This was the assumption that
   could have blocked the whole self-contained approach. It does not.
2. **The full desktop space path runs headlessly, end to end** — create, invite,
   join, triple-ratchet session establishment, hub broadcast, and the
   `requestSync` → `MemberDigest` → `MemberDelta` roster exchange. R2 ("measure
   Spaces — never done on any platform") no longer needs device time for the
   desktop↔desktop half.

Reported in `tasks/transport/2026-07-27-headless-space-harness.md`; code in
desktop PR #297. The rate is slice S2 and is not started.


---
*Last updated: 2026-08-02*
