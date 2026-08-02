---
type: bug
title: "A reconnecting client starves control-message processing for minutes, so every sync-request expires unread and a new joiner is answered by nobody"
status: ✅ CONFIRMED 2026-08-02 — §5b step 1 is DONE. Reproduced on demand in the harness with a dose-response curve, and the failing line is captured. See §0. The mechanism is NOT what the title says — read §0 before §1
priority: HIGH — this is upstream of every roster fix shipped 2026-08-01/02; none of them can work while it holds
created: 2026-08-02
updated: 2026-08-02
severity: a new member of a space is answered by NOBODY and stays at 1 member row indefinitely
area: space sync / control-message scheduling / announce-keys backlog / SyncService expiry
repos: quorum-desktop (observed), possibly the relay
related_bugs:
  - "2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md"
  - "2026-07-20-announce-keys-flooding-unbounded-admissions.md (its benign twin — see §5)"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
  - ".agents/tasks/transport/README.md"
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

That also explains why desktop #296's convergence check cannot rescue this: it
hangs off the `sync-info` handler, so the repair is gated on the very step that
is failing.

### The three repair points, cheapest first

| # | fix | note |
|---|---|---|
| **a** | judge expiry against the frame's **arrival** timestamp rather than when we got round to it | smallest change, and it directly matches what was measured |
| **b** | **do not discard a usable offer just because our window closed** — remember it and let the next `requestSync` prefer a peer already known to hold more | this is §5b step 4, and it is now evidence-backed rather than speculative |
| **c** | stop bulk frames queueing ahead of perishable control frames | §5b step 2, the real scheduling fix, biggest blast radius |

⚠️ **Still do NOT simply raise `DEFAULT_SYNC_EXPIRY_MS`** (§5b step 3). Nothing
here changes that: a longer window means acting on a summary that is minutes
stale, converting a visible failure into a silent one.

### What this does NOT establish

That the backlog is the **only** cause in the field. The harness cannot host the
socket behaviour that needs real devices ("Why every bench was green",
`tasks/transport/measurements.md`), and nothing here rules it out. What is
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
- **The convergence check cannot fire** (desktop #296). It hangs off the
  `sync-info` handler, and no `sync-info` arrives.
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

`.agents/bugs/2026-07-20-announce-keys-flooding-unbounded-admissions.md` filed
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
*Last updated: 2026-08-02*
