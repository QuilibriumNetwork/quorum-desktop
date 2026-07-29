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
*Last updated: 2026-07-29*
