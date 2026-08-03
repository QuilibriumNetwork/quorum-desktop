---
type: bug
title: "A reconnecting client starves control-message processing for minutes, so every sync-request expires unread and a new joiner is answered by nobody"
status: in-progress
priority: medium
created: 2026-08-02
updated: 2026-08-03
severity: was "a new member is answered by NOBODY and stays at 1 member row indefinitely" — that path now self-repairs; what remains is control frames read minutes late
area: space sync / control-message scheduling / announce-keys backlog / SyncService expiry
repos: quorum-desktop (observed), possibly the relay
related_bugs:
  - "2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md"
  - "2026-07-20-announce-keys-flooding-unbounded-admissions.md (its benign twin — see §5)"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
  - ".agents/issues/transport/README.md"
---

# Sync requests expire unread, behind a reconnect backlog

## §0. ✅ CONFIRMED IN THE HARNESS — and the failing line is captured

> Added 2026-08-02, after §5b step 1 ("confirm the backlog reading **before**
> writing code") was carried out. Everything from §1 down is the original field
> investigation and still stands. This section supersedes its *framing*: the
> backlog reading is right, and the step that actually fails is not the one the
> title implies.

### It reproduces on demand, with a dose-response curve

`yarn harness space-backlog` (desktop PR #298). B joins a space, goes offline, A
posts M messages into it, then B returns and joins a **second** space whose owner
holds a 79-member roster. The retained flood and the roster handshake compete for
B's single serial inbound queue — the field condition, made deterministic.

| backlog | frames B received | roster delivered | median lag |
|---|---|---|---|
| 0 | 15 | **100%** (2/2) | 5.1 s |
| 100 | 417 | **100%** (2/2) | 23.0 s |
| 300 | 1201 | **0%** (0/2) | — both ended `rows=1/80` |

`rows=1/80` is §1's symptom verbatim. Delivery stops exactly where the lag
crosses `DEFAULT_SYNC_EXPIRY_MS` (30 s).

**The control arm was already run and had been misread.** `yarn harness
space-rate` measures 15/15 at 2, 25 and 79 members on FRESH accounts with no
backlog — which is precisely what §5b step 1 asked for ("repeat with an account
used recently... if the handshake then completes, the diagnosis is settled"). It
completes, every time. Roster size is exonerated as a variable in the same run:
flat ~4.7 s from 2 to 79 members.

### 🔴 The failing step, captured

The harness traces the real services' own log lines and attributes them per bot.
At 300 backlog messages:

```
requestSync=4   sync-info=12   Adding candidate=0
No suitable candidates=2   sync-delta=0   member delta=0

sync-info from: …, hasSession: true, isExpired: true
sync-info payload: {"messageCount":1,"memberCount":80,"hasSummary":true}
sync-info: No active session or expired, ignoring
```

**Twelve `sync-info` replies arrived, each advertising the complete 80-member
roster, and B discarded every one.** The peer answered, the answer arrived, and
the receiver refused it on its own expiry bookkeeping.

This is **§3's stale-answer corollary**, not §2's "nobody answers". In the field
capture both were present and §2 got the emphasis; under controlled conditions
§3 is the one that kills it. Worth correcting, because the two point at different
fixes.

### ⚠️ "Retry more" is NOT the fix — this run rules it out

Read `requestSync=4`. **B already retried three extra times, and every retry
failed identically.** Twelve offers, zero accepted. More retries produce more
offers to discard, because the frames are not late — **they arrive in time and are
read too late.** Expiry is judged at *processing* time, not at *arrival* time.

That also explains why desktop #296's convergence check could not rescue this —
though the precise reason took one more pass to get right, and getting it right
is what turned the fix from "invent a scheduler" into a five-line move. See
[§0b](#0b--shipped--the-roster-half-is-fixed-desktop-300) below.

### ✅ THE FIX SHAPE IS VALIDATED — measured 2026-08-03, before any fix was written

`space-backlog` gained a late re-ask arm: when the roster fails during the flood,
ask again once the flood has drained. Nothing else changed.

| | result |
|---|---|
| asking **during** the flood | **0/2** |
| asking **after** it drains | **2/2**, `rows=80/80` both times |

**The request is not wrong — its TIMING is.** Nothing needs to change about the
30 s expiry, and nothing needs to change about accepting offers. The ask simply
has to wait until the reply can be processed.

This is why `requestSync=4` mattered: it already re-asks three extra times, but
all of them fire *during* the flood, so all of them are wasted. Re-asking once
the queue is quiet succeeds immediately.

#### 🔴 And it rules out the larger candidate — fix (b) is NOT small

Tracing the code before proposing a diff found **three gates on the same window,
across two repos**:

| # | where | effect |
|---|---|---|
| 1 | `MessageService` sync-info handler (desktop) | `No active session or expired, ignoring` |
| 2 | shared `addCandidate` | `Session expired` — candidate silently dropped |
| 3 | shared `hasActiveSession` | **deletes** the session outright |

Desktop keeps its OWN candidate list (`syncInfo.current[spaceId].candidates`) and
only transfers it into shared inside `initiateSync` — where gate 2 re-checks the
same window. So "accept a good offer without an open session" would have to relax
all three; relaxing one changes nothing, and relaxing all three changes semantics
for mobile too.

## §0b. ✅ SHIPPED — the roster half is fixed (desktop #300)

> Added 2026-08-03. The fix is in `main`. **The roster symptom is repaired; the
> underlying head-of-line blocking is not** — see "What this does NOT fix".

### The reason #296 could not fire — corrected, and it is the whole fix

The framing above ("it hangs off the `sync-info` handler, so the repair is gated
on the step that is failing") was **imprecise, and the imprecision hid a small
fix behind an imagined large one.**

The `sync-info` handler *does* run. All twelve frames reach it. What actually
happened is narrower: the two calls that drive the convergence check —
`noteAdvertisedRoster` and `scheduleRosterConvergenceCheck` — sat **inside** the
`hasSession && !isExpired` branch. So the offers were discarded by the expiry
gate *before* the tracker ever saw them. No target was learned, no check was
armed, and #296 went silent in precisely the failure it was written for.

That is a **wiring** defect, not a missing mechanism.

### The change

Move those two calls out of the gate ([`MessageService.ts`, `sync-info`
handler](../../../src/services/MessageService.ts)). What a peer advertises is
true whether or not our own request window is still open; the gate answers a
different question — *"may we sync FROM this offer, in this session?"* — and
still answers it, unchanged. `noteAdvertisedRoster` now returns whether it
recorded a usable target, so a check is armed only when there is something to
converge to.

**No new mechanism, and no "quiet" heuristic had to be invented.** The two open
judgment calls from the previous section dissolved: the convergence check is
already debounced per space, so it fires once the answers *stop* arriving —
which is already the quiet moment the re-ask needs. The detector was there.

### Result

`space-backlog` with its simulated late re-ask **disabled** (`HARNESS_BACKLOG_LATE_REASK=0`),
so this measures the product path and not the scenario's own scaffolding:

| backlog | trials | delivered | rate | median lag |
|---|---|---|---|---|
| 0 | 2 | 2 | 100% | 4.8 s |
| 300 | 2 | 2 | **100%** | 79.5 s |

The 300 row was **0%** before. The healthy path is unchanged (4.7 s → 4.8 s), and
the two 300 trials landed 79.8 s and 79.3 s — 0.5 s apart across independent
runs, which is a timer firing rather than luck.

Also verified: the two new tests **fail** with the fix reverted, so they are
load-bearing. Full suite 58 files / 888 tests green.

### What this does NOT fix

- **The head-of-line blocking itself.** A reconnecting client still drains its
  inbound queue serially and still reads perishable control frames minutes late.
  This fix means the roster *recovers* afterwards; it does not make the frames
  timely. Everything from §1 down still stands as the description of that.
- **Every field report.** The harness cannot host the socket conditions that
  need real devices. The claim is "fixes the backlog-starvation path", not
  "fixes the field".
- ~~**A flood longer than the re-ask ladder.**~~ ✅ **ANSWERED 2026-08-03 — no
  ceiling in the tested range.** Swept to 1200 messages / 4806 frames, 4× the load
  the fix was validated on, and it still delivers 100%. The ladder never
  exhausts.

  | backlog | frames | median lag | rate |
  |---|---|---|---|
  | 300 | 1203 | 79.5 s | 100% |
  | 600 | 2410 | 182 s | 100% |
  | 1200 | 4806 | **456.5 s** | 100% |

  ⚠️ **A first pass at 1200 reported 0/2 and that reading was WRONG.** The
  observation window was set to 360 s; the trials converge at ~456 s, so they
  were cut off shortly before succeeding. It was briefly read as "the re-ask
  ladder is exhausted" — a mechanism asserted with no evidence. Recorded because
  the mistake is more useful than the result: the harness could not see the
  roster check's own decisions at all (`roster` matched none of its
  `TRACE_PATTERNS`), so there was nothing to check the guess against. Fixed in
  `src/dev/tests/harness/spaceBot.ts`.

- 🔴 **LATENCY is now the real defect.** 456 s is seven and a half minutes of a
  user looking at truncated addresses with no sign that anything is happening.
  The mitigation recovers, but it cannot recover *promptly* — the re-ask only
  succeeds once the flood has drained, so recovery time is bounded below by drain
  time. **This is the argument for fixing the head-of-line blocking itself rather
  than tuning the ladder**, and it is why raising `MAX_ROSTER_REASKS` would be
  the wrong move: the ladder is not what is failing.

- **Per-frame cost rises with queue depth, and is UNEXPLAINED.** 66 ms/frame at
  300, 75.5 at 600, 95 at 1200 — 44% worse at 4× load. It is NOT the O(n²)
  inbound queue (`WebsocketProvider.tsx:196` spread-copies the whole array on
  every arrival; `:55` `.slice(1)` copies it on every dequeue) — at 4800 frames
  that is ~11.5 M pointer copies each way, tens of milliseconds against a
  456,000 ms run. Those copies are free waste and worth removing, but they are
  not the cause. Profile before theorising; likely suspects are IndexedDB growth
  and React re-render churn, but that is a list of suspects, not a finding.

### Cost

A client in many spaces can now send up to two extra `sync-request` broadcasts
per space where it previously sent none. The debounce places them after each
space's flood has drained rather than during it, but it is more traffic than
before in exactly the congested case.

### Still to do

1. **Two open verification questions**, both OPTIONAL and neither blocking — see
   §0c for the recipes and for the honest argument about whether they are worth
   anyone's time.
2. Fix (a) and fix (c) below remain open; this repaired the roster symptom, not
   the scheduling.

## §0d. THE ROOT FIX — design + safety analysis (2026-08-03)

> This is the section to read before touching the inbound path. #300 is a
> mitigation and has been taken as far as one can go: the roster arrives, but at
> 1200 backlog it takes **456 s**, and that cannot improve while the re-ask must
> wait for the flood to drain. Recovery is bounded below by drain time.

### The mechanism, corrected

Not "a single FIFO queue with no priority" — that was wrong.
`processInbound` (`src/components/context/WebsocketProvider.tsx:83-133`) drains
the **entire** queue into a map keyed by inbox address, then runs each inbox's
frames as a concurrent promise chain. Strict order holds only *within* one inbox.

The barrier is different and more specific: **once a batch starts, every
newly-arrived frame waits for that whole batch to complete.** `processInbound`
returns immediately while `inboundProcessingRef` is held (`:84-86`), so frames
arriving mid-flood merely accumulate. A 1 s interval (`:216-226`) re-triggers, so
nothing strands permanently.

So B's `sync-info` is not queued *behind* 4806 frames by ordering — **it is not in
the batch at all**, and the batch has 4806 frames left to process. Minutes.

⚠️ **This kills the obvious fix.** Sorting control frames to the front *within* a
batch does nothing, because the perishable frame arrives after the batch was
assembled.

### ⛔ THE DESIGN CHANGED — read this before the sections below

> **2026-08-03, after four independent reviews (security, correctness,
> architecture, cross-platform).** The original proposal was *bounded chunks
> **plus a stable partition** that floats perishable frames to the front*.
>
> **The partition is CUT.** Every serious hazard the reviews found attaches to
> the prioritisation half; none attach to the chunking half. And chunking alone
> is expected to fix the bug. See "The revised design" and "Why the partition was
> cut" below.
>
> The sections after this one are kept as written because the reasoning is worth
> reading — but ⚠️ **one of them (ground (c)) was REFUTED**, and that refutation
> is the single most important thing in this issue. Do not read them as current.

### The revised design: bounded chunks only, no reordering

Process a bounded slice, **yield to the event loop**, re-read the queue (now
containing whatever arrived meanwhile), continue. FIFO is preserved exactly —
nothing is reordered, so no frame can overtake another.

The batch stops being a commitment and becomes a rolling window. A frame arriving
mid-flood waits **at most one chunk** instead of the remainder of the backlog.

**Why this is expected to be sufficient.** MEASURED: ~95 ms/frame at 1200
backlog. A 100-frame chunk is therefore ~9.5 s — comfortably inside the 30 s sync
window, which is all that is needed. (Mobile's 250 would be ~24 s: it fits, but
with no margin. Prefer ~100 on desktop, and treat it as a measured choice, not a
guess.)

**Prior art, already in production.** READ: `quorum-mobile`'s
`WebSocketContext.tsx` (`processMessageQueue`, ~:5277-5537) already does exactly
this — `splice(0, MAX_BATCH_DRAIN_SIZE)` with `MAX_BATCH_DRAIN_SIZE = 250`, in a
`while` loop that re-reads the queue after every slice and yields with
`await new Promise(resolve => setTimeout(resolve, 0))` between them. Mobile has
**no** prioritisation. So the half being kept is field-proven and the half being
cut is the novel, dangerous one.

⚠️ **The yield must be a real macrotask yield** (`setTimeout(…, 0)`), not merely
an `await` on an already-resolved promise. This is not a detail — today's code
*already* awaits every frame individually and the bug still reproduces at 456 s,
which proves per-frame awaits are not sufficient on their own. Get this wrong and
the rewrite ships, passes `space-backlog` at 300 (where the existing awaits
happen to yield often enough), and still fails the field case at depth.

**Demand a unit test that asserts a frame enqueued DURING chunk processing is
visible in the very next chunk.** An end-to-end latency measurement can pass for
the wrong reason; this cannot.

### Why the partition was cut — four independent findings

1. 🔴 **It could silently destroy chat history.** `rekey`/`kick` are sent as
   `type: 'sync'` (`src/services/SpaceService.ts:955-993`), encrypted with the
   OLD config key so current members can open them. Ordinary posts are hub
   broadcasts — the deprioritised class. Float the rekey ahead of older posts and:
   the rekey handler **unconditionally overwrites** the space's single config key
   row (`MessageService.ts:5302-5307`; `space_keys` has compound key
   `['spaceId','keyId']`, so it is a true replace with no versioning), every hub
   unseal reads the config key **fresh from the DB at decrypt time**
   (`:4590-4639`, no per-frame key epoch), and the older posts now fail to
   decrypt. **And then they are deleted** — see
   `2026-08-03-a-space-frame-that-fails-to-decrypt-is-deleted-from-the-relay.md`.
   Permanent silent loss for an innocent bystander, in exactly the
   reconnect-onto-backlog scenario this fix targets. Strictly worse than the bug
   being fixed.
2. 🟠 **The priority lane is claimable by anyone, for free.** The
   `outerEnvelope.type` check runs on raw JSON **before any signature or
   decryption check**. Forging a frame that claims priority costs nothing and
   needs no key material; the victim then runs a real WASM `UnsealSyncEnvelope`
   on it, on the main thread. That makes the existing denial of service *more
   precise* — an attacker can specifically deny the priority mechanism to the
   people who need it. Member inbox addresses are learnable from ordinary `join`
   broadcasts.
3. **The discriminator is wrong in both directions.**
   - **Too narrow:** `sync-request` is a BROADCAST, sent via `SealHubEnvelope` as
     `type: 'group'` (`src/services/SyncService.ts:497,530`) — the one outlier
     among sync payloads. So a congested *responder* would never prioritise
     incoming requests, leaving the symmetric half of §2's "nobody can sync with
     anybody" untouched. `update-profile` identity announces are also hub
     broadcasts, so the filed issue whose symptom is literally "members render as
     a truncated address" would get zero benefit.
   - **Too broad:** `synchronizeAll` chunks a space's full history into payloads
     of up to **5 MB**, each tagged `type: 'sync'` (`SyncService.ts:59-206`). The
     tag does not mean "small perishable control frame"; it also means "I am
     dumping my entire history at you". Prioritising it would push multi-megabyte
     bulk transfers ahead of DM traffic.
4. **Starvation reversal.** Under sustained sync load, ordinary chat processing
   loses ground to control traffic — bounded by chunk width, but a real cost that
   was unstated in the original design.

**If prioritisation is ever revisited**, the reviews agree the envelope type is
the wrong discriminator: perishability should be declared by the EMITTER in the
outer plaintext JSON (additive, backward-compatible, old clients ignore it), not
inferred by the receiver from a transport wrapper. Put the check behind a single
`isPerishable(envelope)` so widening it is one line. And classify **once at
enqueue** in `ws.onmessage` into two queues rather than re-partitioning the
remaining queue at every boundary — cheaper, and correct by construction rather
than emergent.

### Historical — the original design and its safety argument

> ⚠️ Kept for the reasoning. **Ground (c) below is REFUTED** — see the correction
> at the end of this subsection. Do not treat any of it as the current plan.

### ✅ The discriminator is free — no decryption needed

The blocking question was whether a frame's class can be known without decrypting
it. It can:

```js
const outerEnvelope = JSON.parse(message.encryptedContent);   // :4598
if (outerEnvelope.type === 'sync') { … }                       // :4601
```

The outer envelope is **plaintext JSON**. `type === 'sync'` marks a directed sync
envelope; anything else is a hub broadcast. No crypto, no key lookup.

### ✅ Safety: reordering `type: 'sync'` cannot break the ratchet

Three findings, each READ from code, that together make this far safer than
"reordering the message pipeline" sounds:

1. **`type: 'sync'` is emitted only by `SyncService`, `SpaceService` and
   `ConfigService`.** The DM path never produces one. So prioritising sync frames
   **never reorders DM traffic**.
2. **The DM path is a different branch and already has its own mutex.**
   `MessageService.ts:4314` — `if (keys.sending_inbox)` selects the Double
   Ratchet path, and its own comment describes it as a *"Ratchet critical
   section — serialized per conversation (see `dmRatchetMutex`)"*, which re-reads
   state inside the lock precisely so concurrent frames cannot fork the ratchet.
   **DM correctness does not depend on inbound queue order.**
3. **Space envelope decryption is stateless.** `UnsealSyncEnvelope` and
   `UnsealHubEnvelope` (`:4604`, `:4623`) take only the hub key and config key,
   read from the DB at decrypt time. No session state threads through them, so
   space frames carry no ordering constraint at the crypto layer.

#### 🔴 CORRECTION — grounds (a) and (b) hold; ground (c) is REFUTED

Independent security review, 2026-08-03. Grounds (a) and (b) were each verified
true. **Ground (c)'s premise is true and its conclusion is false**, and the gap
between them is the most important lesson in this issue.

The two functions genuinely take no ratchet-state parameter. But the conclusion
drawn — *"so space frames carry no ordering constraint at the crypto layer"* —
does not follow, because the constraint does not live **inside** those calls. It
lives in **what they read from the DB between invocations**, which is exactly
what reordering perturbs:

- `getSpaceKey(spaceId, 'config')` is read fresh on every unseal (`:4590-4639`).
- `rekey` replaces that row outright (`:5302-5307`).
- So the order in which a `rekey` and an older post are processed decides whether
  the post can be decrypted **at all**.

**The config key IS the state.** "This function takes no state parameter" is not
the same claim as "this operation is order-independent", and treating them as
interchangeable is what produced a design that could destroy user data.

A second, unproven companion risk from the same review: the space's single
encryption-state row (`spaceId/spaceId`) carries `id_peer_map`/`peer_id_map`,
read-modify-written **unlocked** by both the hub-class `join` handler
(`:4876-4902`) and the sync-class `sync-delta` peer-map handler (`:6098-6126`).
`dmRatchetMutex` is never applied to a `spaceId/spaceId` conversation. Today this
is safe only because both classes share one inbox and run strictly FIFO. It was
traced as *probably* benign (both writes are additive keyed merges that converge)
but **not every field either handler touches was traced**. If prioritisation is
ever revisited, finish that audit first.

### Remaining risk — the honest list

- ~~**Application-level ordering inside space traffic.**~~ ✅ **RESOLVED
  2026-08-03.** The concern was that a `sync-delta` and a hub post delivering the
  same message could duplicate it if reordered. They cannot: the `messages`
  object store is declared `keyPath: 'messageId'`
  (`src/db/messages.ts:253-255`) and writes go through `store.put(message)`
  (`:1419`), which is an **upsert** — the same `messageId` overwrites rather than
  inserting a second row. Message writes are idempotent by id.

  (The store lives in `quorum-desktop/src/db/messages.ts`, NOT in
  `quorum-shared` — an earlier note said otherwise and was wrong.)

  ⚠️ **This was RIGHT FOR THE WRONG REASON, corrected 2026-08-03.** Upsert-by-id
  rules out **duplication**. It does NOT rule out **resurrection** — a
  `sync-delta` delete reordered against a still-queued original post. What
  actually protects that is an unrelated pre-existing mechanism: `saveMessage()`
  checks `isMessageDeleted()` (`MessageService.ts:2394`) and both the sync-delta
  path and the live post path funnel through it. There is a closed bug of exactly
  this shape — `issues/.done/2025-12-18-deleted-messages-reappear-via-sync.md`.
  The conclusion stands; the reasoning that reached it did not.

  ⚠️ **The "mitigating context" below was also wrong.** It claimed sync deltas and
  live posts already race today. They do not: a space has exactly ONE inbox
  address, so hub-broadcast and directed-sync frames for that space land in the
  **same** per-inbox promise chain and are processed strictly FIFO
  (`WebsocketProvider.tsx:113-119`). Reordering across that pair is not an
  existing interleaving whose timing would shift — **it is new, and the partition
  is what would introduce it.** That error is what made the config-key hazard
  invisible in the original analysis.
- **Chunk size.** Too small and per-chunk overhead dominates; too large and the
  barrier is rebuilt. Needs measuring, not guessing.
- **Blast radius.** This touches the path every frame in the app takes. #300
  touched one branch of one handler; this is not comparable, and the DM harness
  scenarios are the regression net that makes it testable at all.

### Acceptance test — ⛔ `space-backlog` CANNOT validate this fix

> **Corrected 2026-08-03.** I pre-registered `space-backlog` at 1200 as the
> acceptance test ("median lag must collapse from 456 s to seconds"). **That is
> invalid**, and believing it was is the most consequential process error in this
> issue.

**The harness never runs `processInbound`.** Inbound frames go through
`WsTransport.dispatch` (`src/dev/tests/harness/transport.ts:138,246-274`), a
hand-written mirror that is **one single global serial promise chain**
(`this.chain = this.chain.then(...)`). The real app instead drains into a Map
keyed by inbox and runs those groups **concurrently** via `Promise.allSettled`
(`WebsocketProvider.tsx:92-124`). Different structures.

So a change to `processInbound` produces **no** movement in `space-backlog`. The
fix would have been "validated" against an instrument structurally incapable of
observing it.

Two consequences worth keeping straight:

- The 456 s figure is **still meaningful** as "reconnect backlogs cause severe
  multi-minute starvation" — and the arithmetic is exact: 4806 frames × 95 ms =
  456.57 s vs 456.5 s measured, so the reply really did wait for essentially the
  entire backlog. What it is NOT is a mechanism-faithful measurement of
  `processInbound`.
- One reviewer traced the scenario's timing and found B joins S2 only *after*
  reconnect, so S2's inbox was not subscribed when the early snapshots were
  taken — meaning the real `processInbound`'s cross-inbox concurrency would not
  have rescued it either. The two models converge here **by coincidence of
  timing, not by structure.** Do not generalise from that.

**The real acceptance test does not exist yet.** See §0e.

⚠️ **But that test alone is NOT sufficient, and believing it was is a mistake
this issue nearly repeated.** Three gaps, all found by review rather than by
running anything:

1. **It cannot see the responder-side failure.** In `space-backlog` only the
   JOINER is under backlog; the peer that must answer never is. So the symmetric
   half of §2's "nobody can sync with anybody" is invisible to it. **Needed: a
   variant where the responder is mid-backlog when the request arrives.**
2. **There is no unit test of `processInbound` at all** (confirmed by grep —
   nothing under `src/dev/tests` touches it). The single most load-bearing
   property of the revised design — that a frame enqueued DURING chunk processing
   is visible in the next chunk — has no test and cannot be inferred from an
   end-to-end latency number, which can pass for the wrong reason.
3. **The DM harness scenarios must be run even though DM safety is argued by
   construction.** `dm-loss`, `dm-multidevice`, `dm-reorder` exist precisely
   because "argued safe by code reading" has been wrong here before — the
   ratchet-lock-across-HTTP bug passed every test except the one that mattered
   (see `measurements.md`).

## §0e. What the verification round established, and the order to work in

> 2026-08-03. Six independent reviews (security, correctness, architecture,
> cross-platform, per-frame cost, diagnosis re-derivation). This section is the
> current state of knowledge. Where it contradicts §0d, this wins.

### 📏 MEASURED at last — the instrument exists (desktop #306)

> Added 2026-08-03, after building the missing test. Everything below this
> subsection was established by READING. This part was established by RUNNING,
> and it sharpens the diagnosis.

`src/dev/tests/components/websocketInboundPickup.unit.test.tsx` drives the real
provider with a fake socket. Deterministic result:

> A frame injected after 40 frames of a **400-frame relay dump** is handled at
> **position 400** — it waits **360 frames** — despite being on a DIFFERENT
> inbox, one that would have run concurrently had it been in the batch at all.

**The defect reproduces on demand, outside the harness, in ~15 seconds.**

#### ⚠️ The sharpened mechanism, and it is NOT "a frame waits for the batch"

Two earlier attempts measured **nothing**, and why they failed is most of the
value:

| arrival shape | where the late frame landed |
|---|---|
| whole flood delivered synchronously | position **1 of 13** |
| evenly spaced, 4× faster than processing | waited **9 frames of 500** |

Both are real behaviours; neither is the bug. The correct statement is:

**The wait is bounded by the frames REMAINING IN THE BATCH THAT IS ALREADY
RUNNING.** It only becomes large when the whole backlog is already inside one
batch when the late frame arrives.

Under spread-out arrival, batches grow geometrically (each drains what
accumulated during the last) but stay small, and the wait is trivial. Under a
**relay dump** — thousands of retained frames landing essentially at once, which
is exactly a reconnect — one batch swallows the lot and the wait is the whole
backlog.

**This is why the fix is worth building and also why it is narrower than it
sounded:** bounded chunks help enormously in the dump case, which is the field
case, and are close to a no-op for ordinary live traffic. Anyone measuring this
must reproduce the dump shape or they will measure nothing and conclude there is
no bug.

### ⛔ FALSIFIED — bounded chunks do NOT fix this. Measured, then discarded.

> 2026-08-03. The fix was **implemented** and run against the instrument from
> #306. It does not work, the code was discarded, and this is the most useful
> negative result in the issue.

| configuration | frames the late frame waited |
|---|---|
| no fix (single unbounded batch) | **360** |
| bounded chunks, 100 frames | **262** |
| bounded chunks, **10** frames | **352** |

Making the chunk **10× smaller made it slightly worse.** The variation is noise,
not a trend. Chunk size is simply not the variable.

#### Why — and the error is in the framing, not the code

The diagnosis was "the frame is not in the running batch, so let it into one
sooner." That is true and irrelevant. **Being in the batch does not help a frame
that is at the BACK of a FIFO queue.** Letting it in one chunk earlier moves it
from position 401 to position 361; it still waits for every frame ahead of it.

Restated correctly, and this is what the numbers say:

> **The wait is the number of frames QUEUED AHEAD of it, times the per-frame
> cost.** Batching, chunking and grouping change how those frames are packaged.
> None of them change how many are in front.

#### What that leaves — three levers, and chunking is not one

1. **Prioritisation** — move the perishable frame forward. The only lever that
   attacks queue POSITION. Cut earlier because `rekey`/`kick` ride `type: 'sync'`
   and would overtake older posts. ⚠️ Note #305 changed this picture: frames that
   fail to open are now retained and retried rather than destroyed, so the
   failure is no longer *permanent*. It is still a failure — the old config key
   is gone, so the retries also fail until the budget expires. **Making
   prioritisation safe requires versioning the space config key** (keep the
   previous one for a grace window), which is the security review's condition (b).
   That is now the main open design question.
2. **Fewer frames in the queue** — attack the SOURCES of backlog rather than its
   scheduling. This is why
   `2026-08-03-a-typing-frame-is-never-acked-so-the-relay-may-redeliver-it-forever.md`
   just became much more interesting: un-acked frames are redelivered on every
   reconnect forever, so any such leak is a permanently growing queue depth. Same
   for `2026-07-20-announce-keys-flooding-unbounded-admissions.md`. **Halving the
   queue halves the wait, with none of prioritisation's risk.**
3. **Cheaper frames** — ~15 sequential IndexedDB round trips each. Real, but a
   constant factor, and the `getSpace` attempt showed the easy-looking wins are
   entangled with authorization gates.

#### What was kept

The instrument (#306). It did its job on its first outing: it falsified a fix
that four reviews, including two adversarial ones, had all treated as sound in
principle. Nobody caught this by reading — the numbers caught it in ten minutes.

### ✅ Confirmed: the mechanism

Two reviewers derived it independently from the code rather than from the
description. `processInbound`'s drain (`WebsocketProvider.tsx:92-103`) is a
**one-time snapshot**; nothing in the running batch re-reads
`messageQueue.current`; the `inboundProcessingRef` guard makes every re-entrant
call a no-op until `Promise.allSettled` resolves. **The wait is bounded by the
duration of the in-flight batch** — not by one chunk, not by the 1 s interval.

Ruled out as a competing cause: the `invokable` 1 s timer churn
(`MessageService.ts:5605-5620`) lives inside the `hasSession && !isExpired`
branch, which never fires under backlog because `isExpired` is always true by
then.

### 🔬 The cost is I/O-shaped, not CPU-shaped

READ, by tracing one space POST frame end-to-end: **~15 sequential, individually
awaited IndexedDB round trips per frame** (14 reads + 1 write). The crypto is the
cheap part — `UnsealHubEnvelope`'s body is synchronous when a config key exists,
and `js_verify_ed448` is not even awaited. Every DB call is a genuine macrotask
yield (`fake-indexeddb` uses `setImmediate` deliberately; real IndexedDB has the
same task-based completion semantics).

Three consequences:

1. **The operator's report that the UI does NOT feel frozen is correct and now
   explained.** A frame is many short synchronous bursts separated by ~15 real
   yields. An earlier claim in this investigation that the app "freezes" was
   wrong.
2. **UI responsiveness and the head-of-line bug are independent facts.** The
   yields happen constantly; they simply do not help a frame that was never added
   to the running batch.
3. **The Web Worker option is dead.** Moving cheap synchronous crypto off-thread
   does not touch a cost dominated by sequential storage round trips.

⚠️ **Corrects a claim in §0d.** It argued "per-frame awaits already exist and the
bug still reproduces, therefore per-frame awaits do not yield enough." Wrong: the
awaits DO yield to macrotasks — that is precisely how the queue reaches 4806
frames, since `ws.onmessage` fires throughout. The bug is that **nothing ever
re-reads the queue**. "Does not yield" and "does not look again" are different
failure modes. The `setTimeout(…, 0)` guidance stays as defensive practice for
the rewrite, but it is NOT evidence about today's bug.

### ⚠️ Harness fidelity — two gaps, both material

1. **It does not run `processInbound`** (see the acceptance-test section above).
2. **Its storage is in-memory.** `fake-indexeddb` is a red-black tree; real
   IndexedDB is disk-backed. The *yield structure* transfers; the *magnitude*
   does not. **Do not quote 66-95 ms/frame as a prediction of field latency.**
3. **It is blind to a field-only cost.** With no UI mounted, the React Query
   updates hit an early return. In the real app with a conversation open, that
   path rewrites growing page arrays and triggers real re-renders. Field
   per-frame cost could be materially worse than anything measured here.

The unexplained 44% per-frame growth: top candidate is **GC pressure** as the
run's live heap grows (`transport.arrived` alone retains every frame). The
store's O(log n) growth explains only ~19%. Not measured — do not assert it.

### ❌ The "free win" is NOT free — investigated and dropped 2026-08-03

A review reported `getSpace(spaceId)` read **three times per frame** and called
deduping it a no-risk ~13% saving. **On inspection that is wrong, and the reasons
are worth recording so it is not re-proposed.**

The three reads are in different functions, each conditionally reached, and each
feeds a **security gate**:

| site | gate it feeds |
|---|---|
| `MessageService.ts:4749` | signature verification (`space.isRepudiable`) |
| `:6319` | the `@everyone` mention gate (`space.roles`) |
| `:2995` (inside `addMessage`) | read-only channel enforcement, explicitly fail-secure on a missing space |

They are not repeated lookups on one path. Deduping means either threading the
row through function signatures, or caching it — and **caching is hazardous
here**: control frames (`join`, `kick`, role updates) MUTATE the space, so a
memoised row can feed a stale `isRepudiable` or stale roles into an authorization
decision. That trades a performance nudge for a security regression.

A safe subset exists — `:4749` and `:6319` sit on the message path inside one
function with no space mutation between them, so one read could serve both. That
is 1 of ~15 round trips (~7%), on a number measured in a harness whose absolute
magnitudes are already known not to transfer to the field (see the fidelity
gaps above). Not worth touching an authorization-gating file for.

**Lesson, and it generalises:** "no behaviour change and no risk" was asserted
about code that gates message authorization. Verify what a read is FOR before
calling its removal free.

### The order to work in

1. ✅ **DONE — the instrument exists** (desktop #306). See the measured section
   above. Its assertion is deliberately written to FLIP when the fix lands:
   `expect(waitedFrames).toBeGreaterThan(floodSize * 0.5)` becomes an upper
   bound of about one chunk. **A green run on the current assertion after a fix
   means the fix did not take.**
2. ❌ **DROPPED — the `getSpace` dedupe is not free.** See above; it touches
   authorization gates.
3. ⛔ **DROPPED — bounded chunks do not fix it.** Built, measured against (1),
   falsified, discarded. See the FALSIFIED section above. **Do not re-propose it
   without first explaining how it changes queue POSITION**, which is the only
   thing that matters.
4. ✅ **DONE — desktop #305.**
   `2026-08-03-a-space-frame-that-fails-to-decrypt-is-deleted-from-the-relay.md`
   is fixed and filed in `.done/`.
5. **NEW, and unquantified:**
   `2026-08-03-a-typing-frame-is-never-acked-so-the-relay-may-redeliver-it-forever.md`.
   A typing frame returns before the inbox ack. If the relay retains those, every
   typing indicator ever sent accumulates and is redelivered on every reconnect —
   a permanently growing backlog that sits UPSTREAM of all of this and that no
   amount of client-side chunking would fix. The code path is confirmed; whether
   the relay retains them is not, and that is a binary experiment.

Optional, if per-frame timing is ever wanted directly: stamp `arrivedAt` in
`transport.ts`'s `ws.on('message')` and timestamp `spaceBot`'s trace lines. Then
`processedAt − arrivedAt` for the surviving `sync-info` measures the gap directly
instead of inferring it from aggregate arithmetic. Both bots share a process, so
there is no clock-skew concern.

## §0c. Optional verification — recipes, so nobody re-derives them

> Added 2026-08-03. **Neither of these is blocking.** The fix is merged, additive,
> desktop-only, and measured not to touch the healthy path. Both are recorded
> here because working them out took a research pass, and that pass should not
> have to happen twice.

> ⚠️ **Default to A, not B.** Hand-driven UI testing is a LAST RESORT in this
> project — the operator's time is the scarcest resource, and a manual run is
> n=1, unrepeatable and slow to interpret. If a question can be pushed into the
> harness, push it into the harness, even if that costs an afternoon of scenario
> work. Reach for B only when something genuinely cannot be observed any other
> way (real sockets, real Electron, real UI rendering). Test A below needs zero
> human time and answers the more valuable question.

### First, the honest case for NOT bothering

The instinct "harness green is not enough, verify in the field" comes from real
precedent in this project: the DM investigation found defects a Node bench could
not see for weeks (the ratchet lock held across an HTTP round trip, the
session-replacement orphaned inbox). **That precedent does not transfer here.**
Those escaped because they depended on things the bench structurally could not
reproduce — React Native's native socket, the uniffi crypto bridge, real HTTP
latency inside a lock.

Desktop #300 is pure application-layer control flow: two calls moved from inside
an `if` to outside it. There is no transport-, runtime-, or crypto-specific
reason a browser would execute that branch differently from a Node bot running
the same TypeScript. **The marginal information gain is narrow.** Do not treat
these as owed work.

### A. ✅ DONE 2026-08-03 — the re-ask ladder under a flood that outlasts it

> **Answered: there is no ceiling up to 1200 messages / 4806 frames.** See the
> table in §0b. Kept below for the method, and because the sweep is worth
> re-running whenever the ladder constants or the drain path change.
>
> ⚠️ Use a window of **at least 900 s** at 1200 backlog. The first attempt used
> 360 s, the trials need ~456 s, and the resulting 0/2 was misread as a real
> ceiling.

The allowance is 2 re-asks per space per 15-minute window with a 60 s cooldown
(`src/utils/rosterConvergence.ts`). If a real flood outlasts that ladder, the fix
is silently useless in exactly the case it was written for. The 300-message
harness flood drains far too fast to tell us.

This is a dose-response question, which is what the harness is for:

```
HARNESS_BACKLOG_SIZES=600,1000,1500 yarn harness space-backlog
```

Costs no human time. **This is strictly more valuable than the manual test
below** — it answers something a one-shot manual run structurally cannot.

### B. One real two-client run — ~15 minutes, no tooling needed

⚠️ **The naive version of this test is worthless and will mislead you.** A fresh
joiner with a quiet queue converges 100% *with or without the fix* (`backlog=0`
is 100% in every table above). Leave-and-rejoin on its own therefore returns
green regardless. It is the same false-confidence pattern that produced three
wrong answers during this investigation.

**Use CPU throttling instead of a large flood.** Verified: there are no Workers
anywhere in the message pipeline — decrypt, verification and the WASM calls all
run synchronously on the renderer main thread inside one mutex-gated loop
(`src/components/context/WebsocketProvider.tsx:83-133`, `:193-201`). Chrome's CPU
throttle suspends that whole thread, so WASM slows identically to JS. Slowing the
drain reproduces the same race as enlarging the flood, and leaves the **real,
unmodified 30 s window** in place.

Sizing, from the measurements above: `backlog=100` was 417 frames in 23.0 s, so
~55 ms/frame. At 6× that is ~330 ms/frame, which passes 30 s with **well under
100 messages**. Tens, not hundreds — no flood script required.

**Steps** (test accounts A and B, both non-owners of the ~78-member space S2):

1. B leaves S2. Leaving genuinely resets B: `SpaceService.deleteSpace`
   (`src/services/SpaceService.ts:654-685`) deletes B's encryption states, every
   space message, every member row, every space key, strips the spaceId from
   config and deletes the space record. **Confirm it** in `/dev/db-inspector` —
   `space_members` for S2 must read 0. Do not take the cleanup on faith.
2. B quits the app (socket closed — the backlog is retained-frame replay).
3. Post a few dozen messages into a scratch space containing only A and B. The
   scratch space keeps the flood off anything real.
4. B relaunches, sets DevTools → Performance → CPU throttling to **6×**, then
   joins S2 via a **fresh invite link** (the old registration is gone).
5. Filter the console on `sync-info` and `roster`.

**Pass requires BOTH lines, in this order:**

```
sync-info: No active session or expired — cannot sync from this offer, roster check armed: true
roster did not converge for QmXXX: have 1, best peer advertised 79 (short by 78) — asking again
```

Then confirm the final row count in `/dev/db-inspector`.

**Scoring rules, fixed in advance:**

- **Roster converges but those lines are absent → NULL RUN, not a pass.** The fix
  was never exercised; the queue drained inside the window and the ordinary fast
  path did the work. Raise the throttle and rerun.
- **71-78 of 80 is a PASS, not a failure.** That structural gap is documented and
  the thresholds (`MIN_ROSTER_SHORTFALL = 10`, `MIN_ROSTER_COVERAGE = 0.75`) were
  deliberately set above it.
- **A red result may be a different, known bug.** `2026-06-13-space-members-missing-no-join-row.md`
  and `2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md` sit
  in this exact area and would look like "the fix failed".
- **n = 1 proves little.** Even the harness runs 2+ iterations per row.

**Prerequisites that will otherwise waste the run:**

- **Dev build, mandatory.** `logger` is a no-op in production
  (`2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md`), and
  `/dev/db-inspector` is gated on `NODE_ENV === 'development'` — a prod build
  loses both signal sources at once and leaves only the rendered member list,
  which has its own open bugs and cannot distinguish "fixed" from "never fired".
- **Watch the socket.** The relay pings every 9 s with a 10 s pong deadline.
  Pong is most likely handled in the browser's network stack, off the main
  thread, so throttling should not drop the connection — but that is INFERRED,
  not verified. Start at 6×, confirm the connection survives a minute, and only
  then go higher.

### Why the obvious cheaper shortcuts do not work

Recorded so they are not re-proposed:

- **Reusing the space's existing history as the backlog.** Does not work. The
  relay model is a per-inbox mailbox retained until the client explicitly acks by
  deleting; the `listen` frame carries no cursor, offset or timestamp at any of
  its ~10 call sites. A client that already processed and acked its history will
  not receive it again. A backlog requires frames that queued while it was away.
- **Flooding the space B rejoins.** Does not work. B must be a *member* to
  receive a flood, but B must *leave* to become a fresh joiner. Those cannot be
  the same space — hence the scratch space.
- **Shrinking the sync expiry in a local build** (`src/services/SyncService.ts:52`
  hardcodes `requestExpiry: 30000`; desktop does not read the shared constant).
  Works, but dropping it to ~2 s puts it *below* the healthy round trip of
  4.7-5.1 s, so every join trips the gate and backlog stops being the variable.
  It becomes a valid test of a different claim — "does the fix recover when
  offers always arrive late" — and should be written up as such if used.

### Backlogs accumulate without anyone posting

Worth knowing for interpreting field reports, and it means real users hit this
more easily than the harness suggests:

- Every client's reconnect fires `announceProfileToAllSpacesOnConnect` and
  `announceDeviceKeys` for every space it belongs to, queueing frames into every
  other member's inbox. **MEASURED**: a long-absent account once received ~352
  retained `announce-keys` frames at once, driving ~650 serial decrypts and
  blocking for minutes — see `2026-07-20-announce-keys-flooding-unbounded-admissions.md`.
- One logical message is ~9-12 frames once multi-device accounts are involved.
  The harness's single-device bots still saw ~4 frames per message (300 posts →
  1197 frames), so **the cliff is between ~417 and ~1201 FRAMES**, and message
  count is a poor proxy for it.
- Un-acked frames never expire. Anything the client failed to delete (a crash
  mid-processing, an unknown inbox, a failed delete) stays on the relay and is
  redelivered on every subsequent `listen`, so a backlog can accumulate silently
  across many past sessions.

### The three repair points, cheapest first

> ⚠️ **Corrected 2026-08-03.** The first version of this table proposed "judge
> expiry against the frame's ARRIVAL timestamp". **No such check exists**, so
> that fix was written against a mechanism that is not there. What
> `MessageService.ts:5565-5566` actually evaluates is our OWN outstanding
> request's window:
>
> ```js
> const sessionExpiry = this.syncInfo.current[spaceId]?.expiry;   // set to Date.now() + 30s when WE asked
> const isExpired = sessionExpiry ? sessionExpiry <= Date.now() : true;
> ```
>
> So the question it asks is **"how long ago did I ask"**, evaluated at
> PROCESSING time. B asked at T+0, A replied at T+1, B read the reply at T+200,
> and B's own ask-window had closed. The incoming frame's age is never consulted.
> Read this before proposing anything.

| # | fix | note |
|---|---|---|
| **b** | **do not require an open session to use a good offer** — accept it, or remember the peer and its `memberCount` for the next `requestSync` | §5b step 4. The only one of the original three that survives contact with the code, because it does not depend on the window at all |
| **c** | stop bulk frames queueing ahead of perishable control frames | §5b step 2, the real scheduling fix, biggest blast radius. Attacks the cause rather than the symptom |
| **d** | keep the ask-window OPEN while we are demonstrably behind (e.g. anchor it to processing progress rather than wall clock) | replaces the retracted (a). Unvalidated, and it risks acting on a genuinely stale summary — the same objection that rules out simply raising the expiry |

⚠️ **Do not treat any of these as ready.** The reproduction is solid; the fix
analysis is one code-read old, and its first version was already wrong once.

⚠️ **Still do NOT simply raise `DEFAULT_SYNC_EXPIRY_MS`** (§5b step 3). Nothing
here changes that: a longer window means acting on a summary that is minutes
stale, converting a visible failure into a silent one.

### ⚠️ How faithfully does the harness model a real user? Enumerated, not assumed

The DM harness benched 0% loss for weeks against a failure that was real, because
it could not host the trigger. The same question has to be asked here, and the
answer is "partly" — with the gaps written down rather than left to be
rediscovered:

| gap | why it might matter | status |
|---|---|---|
| the target space holds ~0 messages, so the member delta is the **only** payload | — | ✅ **RESOLVED 2026-08-03, and the premise was false.** The `join` control message is itself a message digest, so the responder builds **2 payloads even with zero posts** and the joiner receives `isFinal=false` then `isFinal=true` carrying all 79 members. Every space scenario has been exercising the field shape from the start. Payload count is not the variable |
| ONE responder | — | ✅ **MOOT.** The message-count-first sort was fixed upstream in quorum-shared #73 (`31185b3`), whose commit message cites this exact field case (90/79/72, synced with the 72). Desktop consumes shared via `link:`, so it already has it. A scenario reproducing that defect would test a bug that no longer exists |
| backlog is space POSTS; the field's was `announce-keys` | different handler (`processDeviceKeyStatement`), possibly different per-frame cost | untested assumption |
| ONE space | the field user was in **six**, all flooding on the same reconnect | not modelled |
| all peers are desktop | mobile never ANSWERS a sync request, so a real joiner's usable responder pool is much smaller than the member count suggests | not modelled |
| fresh accounts, seconds-old sessions | real clients carry months of ratchet state and several devices per account | partly unfixable |
| socket behaviour | the DM lesson: needs real devices | permanently out of reach |

**A green harness result covers only the variables the harness actually varies.**

> Two of the rows above were closed on 2026-08-03 by *checking* rather than by
> building: one premise was false, and the other described an already-fixed bug.
> Both checks took under two minutes. The payload one had already cost ~40
> minutes of scenario-building before it was checked — the order matters more
> than the checking does.
The 15/15 at 79 members is true and narrow; it was measured on a one-payload
exchange with a single responder.

### What this does NOT establish

That the backlog is the **only** cause in the field. The harness cannot host the
socket behaviour that needs real devices ("Why every bench was green",
`issues/transport/measurements.md`), and nothing here rules it out. What is
established is that a reconnect backlog is a **sufficient** cause — and, because
the failure is now deterministic, **any candidate fix can be validated before it
ships**: 0% either becomes 100% or it does not.

### What it changes elsewhere

- **`2026-07-20-announce-keys-flooding-unbounded-admissions.md` is rated LOW
  because it needs an attacker. It does not.** A legitimate backlog produces the
  same starvation, and the consequence is not "slower control-message
  processing" — it is that the sync handshake is unavailable for minutes after
  every reconnect, which is exactly the window a new joiner needs it. That
  severity should be revisited.
- **`2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md`** ends with "STOP
  TESTING THIS BY HAND — it needs the harness". The harness exists and has
  answered two of its three questions: it is not roster size, and it is not
  intermittent-by-luck — it is deterministic given a backlog.

## §1. The measurement

A two-client join on 2026-08-02. User B joined "Quilibrium Community"
(`QmZM3AKwKf…`), where user A holds **79** member rows. B ended with **1** (its
own) and did not move over ~2 minutes.

B's console, filtered on sync, explains it in two numbers.

**B rejected every genuine sync-request it received:**

```
sync-request: Expired, ignoring        × 3
sync-request: Ignoring our own broadcast × 4
sync-request: Calling informSyncData   × 0      ← it never answered ANYONE
```

**And how late were they?** The handler logs `expiry` and `now`, and
`expiry = sentAt + 30s` (`DEFAULT_SYNC_EXPIRY_MS`), so arrival-after-send is
`(now - expiry) + 30`:

| observation | past expiry | ⇒ delivered after |
|---|---|---|
| 1 | 210s | **240s** |
| 2 | 209s | **239s** |
| 3 | 211s | **241s** |
| 4 | 210s | **240s** |

⚠️ **"Delivered after" is the wrong reading — see §5.** These numbers measure
the gap between a frame's expiry and the moment this client *processed* it, and
those are only the same thing if the client reads frames as they arrive. It does
not. The consistency (209/210/211) initially looked like a fixed poll interval
somewhere in the transport; §5 gives a better explanation and it is not the
network.

(Two further samples were ~161,000s — about 45 hours. Those are ancient
redelivered frames, a separate matter, but they confirm the relay retains and
re-delivers control messages indefinitely.)

## §2. Why this makes the roster fixes unreachable

B broadcast a `sync-request` for **six** spaces. The result, every time:

```
[SyncService] initiateSync: No suitable candidates   × 6
```

**Zero `sync-info` responses arrived for any of them.** So:

- **Peer selection cannot help** (shared #73). Choosing the best peer is
  meaningless when no peer answers.
- **The convergence check cannot fire** (desktop #296). ⚠️ **Corrected
  2026-08-03 and now FIXED — see [§0b](#0b--shipped--the-roster-half-is-fixed-desktop-300).**
  The reason given here is wrong: `sync-info` *does* arrive (twelve of them). The
  frames were discarded by the expiry gate before reaching the tracker, because
  the two calls that arm the check sat inside that gate. Desktop #300 moved them
  out.
- **The digest and delta fixes cannot help** (#71, #290, #295). Nothing gets far
  enough to build a delta.

Everything shipped on 2026-08-01/02 sits downstream of a handshake that never
completes. This does not make that work wrong — it repaired real defects, and
A's side demonstrably works (§4) — but it explains why the joiner's number did
not move, and it should be fixed **first**.

### The symmetry that makes it total

B rejects everyone's requests as expired. There is no reason peers treat B's
differently, so B's requests are being dropped by them for the same reason.
**Nobody can sync with anybody**, and the failure is silent on both ends: the
asker logs "No suitable candidates" and the answerer logs "Expired, ignoring",
and neither has any idea the other exists.

## §3. The stale-answer corollary — also observed

B's log contains two `sync-info` responses offering **79** and **90** members.
Both were **discarded**:

```
sync-info from: QmaqgoJ4MuW3, hasSession: false, sessionExpiry: undefined, isExpired: true
sync-info payload: {messageCount: 2, memberCount: 79, hasSummary: true}
sync-info: No active session or expired, ignoring
```

They arrived at log lines **288 and 305**, while B's own `requestSync` for that
space did not happen until line **1853**. So they were answers to a request from
BEFORE a page reload, arriving after the session that would have accepted them
was gone.

A ~240s delivery latency against a 30s window makes this the normal case, not an
edge case: by the time an answer arrives, the asker has usually forgotten it
asked. **Two peers offering a complete roster were on the wire and both were
thrown away.**

## §4. ✅ What this rules IN — the shipped code works

A's console shows both new lines from desktop #296, behaving exactly as designed:

```
roster did not converge for QmZM3AKwKfMp: have 79, best peer advertised 90 (short by 11) — asking again
roster check for QmZM3AKwKfMp: not asking (cooling-down) — have 79, best offer 90
```

So the convergence check fires, computes the shortfall correctly, re-asks, and
the cooldown then holds it — including the typed reason. **When a `sync-info`
does arrive, the whole mechanism works.** The problem is exclusively that they
mostly do not.

Note also that A, with 79 rows, was told about a peer holding **90**. The better
peer exists and is reachable; A simply had no answer to act on in time.

## §5. 🔵 STRONGEST LEAD — it is not the network, it is a RECEIVER-SIDE BACKLOG

The "~240s delivery latency" framing above is almost certainly wrong. The frames
are not slow to arrive; **B is slow to get to them.**

B's log is dominated by `announce-keys`:

| line | count |
|---|---|
| `calling decrypt with inbox_private_key length: 56` | **659** |
| `Using config key, privKey length: 56` | **649** |
| `Control message received: announce-keys` | **352** |
| `Control message received: sync-request` | 7 |

The announce-keys run from log line **245 to 4040** — the entire capture, still
going when it was saved. The three expired `sync-request`s sit at lines
**2211, 2225 and 3998**, interleaved in that flood.

**B is a test account that had not been opened in a long time.** On reconnect the
relay delivers its whole retained backlog at once, and every frame costs a
decrypt. Several hundred serial decrypts is minutes of work, and a `sync-request`
that lands in the middle of it is not read until the queue reaches it — by which
time its 30-second window is long gone.

That is **head-of-line blocking**, and it explains everything the earlier
framing could not:

- why it is not congestion (nothing is congested; the frame is sitting in a
  queue behind hundreds of decrypts);
- why **A shows none of this** — A is used regularly, has no backlog, and
  answered 10 sync-requests with zero expiries;
- why B answered **nobody** for **four minutes** across **all six** of its
  spaces at once.

### ⚠️ This makes it a known bug's benign twin

`.agents/issues/.open/2026-07-20-announce-keys-flooding-unbounded-admissions.md` filed
the *malicious* version: a member can flood `announce-keys` without bound, and it
names the impact as storage bloat plus **slower control-message processing**.
Its severity is rated LOW because it needs an attacker.

**No attacker is required.** A legitimate backlog produces the same head-of-line
blocking, and the consequence is not "slower" — it is that the sync handshake
becomes *completely unavailable* for minutes after every reconnect. That is
exactly the window in which a new joiner needs it. **That bug's severity rating
should be revisited in light of this.**

### The consistency, re-read

209/210/211 seconds looked like a fixed poll interval. Under this reading it is
simply the size of the backlog: several hundred frames × a few hundred
milliseconds of decrypt each, arriving in a burst, so anything caught in it
comes out roughly the same amount late. **The number to measure is decrypt
throughput, not network latency.**

## §5b. What to do, cheapest first

1. **Confirm the backlog reading with a clean B.** Repeat §6 with an account
   used recently, OR with B left open until the `announce-keys` flood stops
   before it joins. If the handshake then completes, the diagnosis is settled
   and the roster fixes get their real test. **Do this before writing any code.**
2. **Stop control-message processing from queueing behind bulk frames.** If (1)
   confirms, the fix is about scheduling, not about sync: a `sync-request` is
   worthless once stale, while an `announce-keys` is not, so the cheap frames
   should not be able to starve the perishable ones.
3. **Only then reconsider `DEFAULT_SYNC_EXPIRY_MS`** (30s,
   `quorum-shared/src/sync/utils.ts`). ⚠️ **Do NOT simply raise it.** If the
   cause is a processing backlog, a longer window just means acting on a summary
   that is minutes stale — the expiry is doing its job correctly and the bug is
   elsewhere. Raising it would convert a visible failure into a silent one.
4. **Should a `sync-info` with no open session be usable?** Independent of the
   above (§3). The offer it carries — a peer's inbox and its member count — is
   not obviously worthless just because our window closed. Cheapest safe version:
   remember the offer without acting on it, and let the next `requestSync` prefer
   a peer already known to hold more.

## §6. How to reproduce

1. Two accounts, two browser profiles, both on the local dev build.
2. A established in a space with many members, app open.
3. B joins that space.
4. On BOTH, open DevTools and filter the console on `sync-request`.

**Expected:** the receiver logs `Calling informSyncData`.
**Actual:** it logs `Expired, ignoring`, with `now - expiry ≈ 210000`.

The `expiry` and `now` values are already printed by
`MessageService`'s `sync-request` handler — no new instrumentation needed.

---
*Last updated: 2026-08-03*
