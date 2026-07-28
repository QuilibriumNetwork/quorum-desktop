---
type: doc
title: "Transport & DM reliability — measurement log (every run, every number, one place)"
status: living — APPEND-ONLY. Add a row when a run produces a number; never rewrite a past row.
created: 2026-07-28
updated: 2026-07-28
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
investigation has been conflating two different failures:

| class | meaning |
|---|---|
| **arrival** | did the frame reach the peer at all? A miss here is transport loss |
| **decrypt** | it arrived — did it open? A miss here is a crypto/session failure, and is usually transient |

A frame that arrives and fails AEAD is **not** lost. Reporting it as loss is how
"desktop↔desktop loses 100% of messages" got written down when what actually
happened was that every frame arrived and none decrypted.

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

> ⚠️ The 07-27 run (301/direction) and the 07-28 run 1 (201/direction) are
> **different runs**, not two reports of one. An earlier version of the index's
> §3.1 matrix collapsed them into a single row; finding that is what prompted this
> file.

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
*Last updated: 2026-07-28*
