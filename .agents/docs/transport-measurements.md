---
type: doc
title: "Transport & DM reliability — measurement log (every run, every number, one place)"
status: living — APPEND-ONLY. Add a row when a run produces a number; never rewrite a past row.
created: 2026-07-28
updated: 2026-07-29
area: WebSocket transport / DM Double Ratchet / delivery loss
related: docs/transport-reliability-index.md
---

# Transport & DM reliability — measurement log

**What this answers:** *what have we actually run, in what configuration, and what
did each result change?* Two weeks of capture rounds and bench runs produced
numbers scattered across five documents and three parallel chronologies (findings
A→AL in the captures archive, rounds 1-29 in the mobile master, and per-task
progress logs). None of those answers the question above on its own.

## Why this file is safe to consolidate, when the index deliberately is not

`docs/transport-reliability-index.md` refuses to carry status, and it is right to:
statuses are claims about the present, they go stale silently, and duplicating
them is what rotted the docs the index exists to navigate.

**Measurements are the opposite.** "On 2026-07-28, mobile client over Node's
WebSocket, fresh single-device accounts, 80/80 delivered" is true permanently,
whatever we later conclude it means. A measurement never needs updating — only
superseding by a newer measurement, which is a new row. That is why this is the
one document in the cluster that can safely be a single consolidated list.

## How to add a row

Append. Never edit a past row, even one that later turned out to be misleading —
add a newer row and a note. Every row must cite the doc that reported it, so any
number here can be traced back rather than taken on trust.

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

> ⭐ **The third class was added 2026-07-28, and its absence is why this went
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

### ⭐ The fan-out channel during that same run — operator observation

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-28 | `dm-loss` run 2, **same run as the row above** | the canonical accounts' OTHER devices — two desktop clients the operator had open and online | arrival | **~10 of 200 messages landed on one desktop, 0 of 200 on the other** | the fan-out channel behaved nothing like the peer channel *in the same run, at the same moment* | operator, observed live during the run; confirmed 2026-07-28 as desktop run 2 |

**This is the most consequential row in the file, and it reframes the one above
it.** In one run, on one pair of accounts, the peer channel was perfect (201/201
each way) while the self-sync fan-out to the same accounts' other devices was
close to total loss. The bench reported 0% and was *structurally blind* to the
channel that was failing — the ~3400 frames it excluded by design.

⚠️ **Qualifier, deliberately recorded:** this was observed in two desktop UIs, not
instrumented. A message could in principle arrive and be persisted without
rendering in a conversation that is not open. That is exactly why the next
scenario counts what `saveMessage` receives per device rather than what a UI shows
— see `tasks/2026-07-28-harness-multidevice-and-coverage.md`. Until that runs, treat
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

### ⭐⭐ 4 devices — the operator's symptom reproduces on the bench

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-28 | `dm-multidevice` | **one account with FOUR devices** + peer, all harness bots, Node, fresh account, 100 rounds | arrival **and** persistence | **every one of the 8 frame legs: 101/101, 0% loss. Zero decrypt failures anywhere.** But `dev1` persisted only **52/100** messages — in BOTH directions, the same count — while `dev2` and `dev3` persisted 100/100 | **first bench reproduction of the operator's symptom.** Loss between arrival and persistence, with no error of any kind | run log `2026-07-28T13-45-03` |
| 07-29 | `dm-multidevice` | **the same 4-device configuration**, re-run against a relay **verified healthy first** (`/` → 404, known user → 200). Fresh account, 100 rounds, 700ms gap, 180s settle | arrival **and** decrypt **and** persistence | **all 8 frame legs 101/101, 0% loss. Every device persisted 100/100 in BOTH directions** (dev0-dev3 and bob). 2 novel decrypt failures on dev3, both healed. **Ratchet lock: n=1065 holds, p50=29ms, p90=231ms, p99=370ms, max=555ms — every hold under 1s, ZERO in the 15-30s / 30-55s / >55s buckets** | **the 52/100 did NOT reproduce, and the lock-across-HTTP mechanism did not fire.** Re-points the row above at relay degradation rather than device count | run log `2026-07-29T05-52-51` |
| 07-29 | `dm-multidevice` **+ FAULT INJECTION** | same 4 devices / 100 rounds, but **`/inbox/delete` deliberately stalled 30s on a deterministic 1-in-20 of calls** (`HARNESS_FAULT_DELETE_DELAY_MS=30000`, rate 0.05 — 50 of 1016 calls hit). 300s settle | arrival **and** persistence | **All 8 frame legs still 101/101, 0% arrival loss** — but persistence collapsed: dev0 97/100, **dev1 50/58, dev2 25/27, dev3 23/23**, bob 85/100. **Every single gap is a `CONTIGUOUS TAIL`, not one scattered.** Lock: n=5745, **10 holds in the `30-55s` bucket, max=31260ms**; queued-behind-lock **max=31173ms** | ⭐ **MECHANISM CONFIRMED.** A slow inbox-delete holds the ratchet lock and stalls the conversation, exactly as §1 predicted by code reading | run log `2026-07-29T06-19-55` |

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

### ⭐ The 07-29 re-run — the reproduction did not hold

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

### ⭐⭐ The 07-29 fix validation — and the partial fix that passed every other test

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

### ⭐⭐ The 07-29 fault-injected run — the lock mechanism, measured

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

### ⭐⭐⭐⭐ 2026-07-29 — THE SENDER ISOLATED: same account, same receiver, two runtimes

**The most discriminating measurement in this file.** Two senders, the same real
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

### ⭐⭐⭐ 2026-07-29 — a LIVE production capture, on a real desktop, not a bench

The only row in this file that is not a bench run or a UI observation: an actual
browser console log from the operator's desktop (account B), captured while a
harness run drove the peer account.

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-29 | **operator's real desktop, live** | production build in a browser, real aged account, harness driving the peer | **persistence** | **366 `DM frame for unknown inbox — no encryption state` — 366 DISTINCT frame timestamps, each once.** Two inboxes, 183 each. **36 `⚠️ SESSION REPLACED by init envelope`**, all one conversationId, all fresh (`envelopeAgeSeconds` -1/0/1). **Zero delete failures.** | ⭐ **first direct evidence of a client-side loss path in production**, and the first measurement taken in a browser rather than Node | operator console log |

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
[`bugs/.solved/2026-07-29-session-replacement-strands-in-flight-frames.md`](../bugs/.solved/2026-07-29-session-replacement-strands-in-flight-frames.md) — **read §7 first**, the original write-up was wrong on its central claim.

### ⭐⭐⭐ 2026-07-29 — THE SYMPTOM REPRODUCED ON THE BENCH, healthy relay, no injection

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-29 | `dm-multidevice` **canonical** | **aged account A** with 2 harness devices (`user-a` + the new `user-a-obs`) + `user-b`, 200 rounds, 700ms gap, **600s settle**, relay healthy, **no fault injected**, lock fix in place | arrival + decrypt + **persistence** | **all 4 frame legs 201/201, 0% loss.** bob 200/200, dev0 200/200 — but **`user-a-obs` persisted 100/200 in BOTH directions**, `CONTIGUOUS TAIL from #101` in both. Decrypt failures dev0=80, dev1=17, bob=46. Lock max 412ms | ⭐ **the operator's ~10-of-200 symptom, on the bench, automated** | run log `2026-07-29T10-07-26` |

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

### ⭐ Persistence on AGED accounts (`dm-loss` canonical) — closes one of two blind cells

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

### ⭐ Cross-platform (`dm-cross`) — the last empty cell in the 2×2

| when | run | configuration | class | result | what it changed | source |
|---|---|---|---|---|---|---|
| 07-29 | `dm-cross` smoke | mobile↔desktop, 5 rounds, **20s settle** | — | 4/8 "delivered" | ⛔ **not a measurement** — settle far too short, and the gaps were at the HEAD not the tail. Recorded only so nobody re-derives it as a finding | run log |
| 07-29 | `dm-cross` | **mobile↔desktop on one bench**, two processes/two repos, Node `ws`, WASM, fresh throwaways, 1 device each, 40 rounds each way, 180s settle | arrival | **mobile→desktop 40/40, 0.0%. desktop→mobile 39/40, missing only #1.** 79/80 total | ⭐ **the field's reported worst direction is CLEAN on the bench.** Completes the 2×2; no bench configuration now reproduces the field loss | run log `run-1785314457979` |

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

## ⭐⭐⭐ 2026-07-29 (afternoon) — the U-run cross-store check: the loss is COMMON-MODE AT THE SOURCE

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

## ⭐⭐⭐ 2026-07-29 (afternoon) — the preview-build V-run: NOT a dev-vs-prod datapoint, but a new bug

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
   `bugs/2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md`.
3. **Spurious conversation rows on both desktops**: desktop A carries an
   "Unknown User" row with B's address (preview "U20", zero unique messages —
   `duplicates: 0` proves no extra copies); desktop B carries the ghost
   self-conversation whose profile backfill 404s on B's own address. Both
   minted around the stale device's activity.
4. ⚠️ Timing caveat, recorded for honesty: desktop A's probe reading was taken
   ~25s after the last send; the absence was re-confirmed visually ~1h later,
   but no second probe reading was taken.

---
*Last updated: 2026-07-29*
