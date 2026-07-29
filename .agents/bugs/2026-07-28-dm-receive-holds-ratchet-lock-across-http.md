---
type: bug
title: "Desktop DM receive holds the per-conversation ratchet lock across relay HTTP, so one slow ack stalls the whole conversation"
status: OPEN — ✅ **MECHANISM CONFIRMED BY MEASUREMENT 2026-07-29** via fault injection (§5-CONFIRMED). Stalling `/inbox/delete` by 30s on 1 call in 20 produced every predicted signature: lock holds in the `30-55s` bucket (max 31260ms), messages queued up to 31173ms, persistence collapsing to `CONTIGUOUS TAIL` gaps on every device with **zero** scattered gaps, while all 8 frame legs still arrived 101/101. The fix (§6) is now justified on evidence and has an acceptance test that can fail. ⚠️ Two clean healthy-relay runs preceded it and proved nothing either way — see §5-RESULT for why, and §5-CONFIRMED's caveats before quoting the magnitude (the harness shares one lock across all four devices, so its blast radius is inflated; and this is almost certainly latency, not permanent loss). The receive path awaits `deleteInboxMessages` / `ackProcessedFrame` (POST `/inbox/delete`, 22s mutate timeout, retried ×3) INSIDE `dmRatchetMutex.runExclusive(conversationId, …)`, so a single slow ack blocks every message on that conversation, in BOTH directions, for up to ~69s (see §1). A 4-device bench run showed one device persisting 52/100 messages while all 101 frames arrived and nothing failed to decrypt — consistent with this, but that run may have been taken against a degrading relay (see §4). ⚠️ **§5 has now been run against a verified-healthy relay and everything was clean: 100/100 on every device, and the lock histogram showed 1065 holds all under 555ms with none in the 15s+ buckets (§5-RESULT).** That does not refute §1, which is a reading of the source — it shows the coupling does not bite when the relay is fast, so a clean-relay run cannot settle this either way. Mobile does NOT have this shape and its pattern is the proposed fix (§6).
created: 2026-07-28
severity: medium — user-visible "messages not arriving" on desktop; likely LATENCY not permanent loss (§3), degrades with device count. ⚠️ NOT revisited after the 2026-07-28 review tripled the stall bound from 22s to ~69s: a conversation frozen for over a minute is closer to "broken" than "slow" from a user's seat, so re-rate this if §5 confirms the mechanism.
repo: quorum-desktop (mobile verified NOT affected — §6)
area: DM receive path / ratchet serialization / transport
related:
  - ".agents/tasks/2026-07-28-harness-multidevice-and-coverage.md (owner task — the bench work that surfaced this)"
  - ".agents/docs/transport-measurements.md (§ multi-device rows — the 52/100 measurement)"
  - ".agents/docs/transport-reliability-index.md (§3.2 — the finding in context; map for the whole investigation)"
---

# Desktop DM receive holds the ratchet lock across relay HTTP

> **For a fresh reviewer:** everything below §1 is read from code and can be
> verified without running anything. §3 and §4 are the parts I am *not* sure of,
> and they are flagged. Please attack §3 first — if it is wrong, the severity and
> the fix both change.

## §1. The defect

`MessageService.handleNewMessage` runs its receive critical section inside the
per-conversation ratchet mutex:

```
src/services/MessageService.ts:3858
  const dm = await dmRatchetMutex.runExclusive(conversationId, async () => {
```

Inside that lock it **awaits HTTP calls to the relay** — three shapes, all the
same POST `/inbox/delete`:

- `await this.deleteInboxMessages(…, this.apiClient)` — in the
  delete-conversation branches (`MessageService.ts:3911`, `4040`). This one
  **rethrows** on failure (`MessageDB.tsx:343-350`).
- `await this.ackProcessedFrame(freshKeys.receiving_inbox, message.timestamp)`
  on decrypt success (`MessageService.ts:3938`, `4058`; body at `350-356`) —
  same POST wrapped in a try/catch.
- `await this.retainOrDropUndecryptableFrame(…)` on decrypt **failure**
  (`MessageService.ts:3957`, `4074`): when the frame's retry budget is
  exhausted it awaits the same POST (`MessageService.ts:331`), and like the
  first shape it rethrows.

The mutate timeout is **22 seconds per attempt** (`defaultMutateTimeout`,
`src/api/baseTypes.ts:862`), and the client **retries mutations twice** on
timeout/5xx with 1s/2s backoff (`fetchWithRetry`, `baseTypes.ts:150-196`; only
4xx is not retried). So a fully timing-out delete holds the lock for up to
**22+1+22+2+22 ≈ 69s**, not 22s. In the app, `timeoutRetryDecayFactor: 0.3`
(`QuorumApiContext.tsx:33`) shrinks repeat-call timeouts (floor 6.6s), so the
in-app worst case is ~23-49s; the harness client sets no decay factor
(`harness/transport.ts:44`), so bench stalls run the full ~69s.

**Consequence:** one slow inbox-delete blocks *every* message on that
`conversationId` for tens of seconds — up to ~69s. Both directions of a DM
share one conversationId (`<partner>/<partner>` — `MessageService.ts:686`
receive, `:968` send), so both stall together.

`KeyedMutex`'s own documentation warns about exactly this
(`quorum-shared/src/utils/keyedMutex.ts`):

> *"Do NOT hold the lock across transport delivery: if the delivery queue's
> callbacks also take this lock, waiting for delivery inside the lock is a
> circular wait. Note that an async callback returning a promise gets
> auto-flattened — returning a delivery promise from `fn` silently extends the
> critical section until delivery."*

The **send** paths follow that guidance, returning the delivery promise wrapped as
`{ sent }` so it is not awaited inside the lock
(`MessageService.ts:983`, `ActionQueueHandlers.ts:672`). The **receive** path does
not.

## §2. Why the ack does not need to be inside the lock

The lock exists to serialize *ratchet state* — read state, advance, save — because
concurrent operations fork it. The inbox delete is not part of that: by the time it
runs, the encryption state has already been persisted, and the delete's only job is
to stop the relay redelivering a frame we have finished with.

Its failure is already treated as harmless. `ackProcessedFrame` catches and only
warns:

```
src/services/MessageService.ts:350-356
  catch (err) {
    logger.warn('[MessageService] failed to ack a processed DM frame (will be redelivered)', err);
  }
```

So the code already accepts "this may fail, the frame will be redelivered". Waiting
up to a minute for something whose failure is a no-op buys nothing.

## §3. ⚠️ What this predicts — LATENCY, not loss. ATTACK THIS FIRST.

If this is the mechanism, messages are **not dropped**. They are queued behind the
lock and processed late; a longer tail should recover them.

That distinction matters enormously, and this investigation has repeatedly
mistaken one for the other — see the master report's *"failures are TRANSIENT, so
this is LATENCY WITH A LONG TAIL, not demonstrated loss."*

**Do not accept "messages went missing" as evidence for this bug without checking
whether they later arrived.**

## §4. The measurement that suggested it, and why it is not yet proof

`yarn harness dm-multidevice` with `HARNESS_MD_DEVICES=4`, 100 rounds, fresh
generated account (run log
`src/dev/tests/harness/logs/2026-07-28T13-45-03-227Z-dm-multidevice.jsonl`):

```
all 8 frame legs:   101/101 arrived, 0.0% loss
decrypt failures:   0 everywhere
A.dev1 persisted:   52/100 messages   (BOTH directions, same count)
A.dev2, A.dev3:     100/100
```

Fits the mechanism on every axis: both directions equal (one lock), no error
raised (the ack swallows its own), all frames arrived (the socket is upstream of
this), worse with device count (4 devices ⇒ ~4× the delete traffic ⇒ more chance of
a slow call), and clean at 2 devices.

⚠️ **But it is one run, one device of three extras, and the relay may have been
degrading during it.** That run finished at 15:51; `api.quorummessenger.com` was
returning 502 on every path by 15:53 and stayed down for over an hour. A degrading
relay is precisely the condition that makes this mechanism bite, so the run cannot
be treated as a clean product measurement.

## §5. What would confirm it

1. **Re-run against a healthy relay:**
   `HARNESS_MD_DEVICES=4 HARNESS_MD_ROUNDS=100 yarn harness dm-multidevice`
2. **Read the gap report** the scenario now prints. It says whether the missing
   numbers are a **CONTIGUOUS TAIL** or **SCATTERED**:
   - contiguous tail ⇒ the device stopped processing at a moment ⇒ **backlog, this bug**
   - scattered gaps ⇒ per-message drops ⇒ **a different bug; this one does not explain it**
3. **Read the lock-hold histogram — this is the DIRECT test and it is already
   built.** `src/dev/tests/harness/lock-probe.ts` wraps the `dmRatchetMutex`
   singleton from outside (no product change, the code under measurement is the
   code that ships) and `dm-multidevice` prints a summary at the end of every run:

   ```
   ==== RATCHET LOCK HOLD TIMES (bug 2026-07-28, §5.3) ====
   lock holds: n=… p50=… p90=… p99=… max=…
     <100ms  (crypto only)              …
     15-30s  ⚠ 1 timed-out attempt      …
     30-55s  ⚠ 2 attempts               …
     >55s    ⚠ 3 attempts (full retry)  …
   ```

   - holds in single-digit ms ⇒ the lock is doing crypto only; **the mechanism is
     not firing on this run**
   - holds clustering at the retry multiples ~22s / ~45s / ~69s (harness, no decay)
     or 6.6-15.4s (in-app, decay 0.3) ⇒ **confirmed**

   ⚠️ Do **not** test only for "≈22s". Mutations retry twice, so a stalled ack
   lands near 45s or 69s and never near 22s — the criterion this section
   originally carried would have produced a false negative.

   This works **even on a run where nothing goes missing**, which makes it
   stronger evidence than the gap shape in step 2: it measures the mechanism
   rather than inferring it from consequences.

   The probe has its own offline self-test (`yarn harness lock-probe`, no relay
   needed) proving it records hold time, queue time, and throwing critical
   sections — run it first if a result looks surprising, so an instrument fault is
   ruled out before a product conclusion is drawn.

## §5-RESULT. The confirmation run was taken 2026-07-29 — clean on every signal

Relay checked healthy first (`/` → 404, known user → 200), then the exact command
from §5.1 with `HARNESS_MD_DEVICES=4 HARNESS_MD_ROUNDS=100 HARNESS_MD_GAP_MS=700
HARNESS_MD_SETTLE_MS=180000`. Run log
`src/dev/tests/harness/logs/2026-07-29T05-52-51-054Z-dm-multidevice.jsonl`
(provenance checked against the runner's start time — an earlier session misread
an older log as its own).

```
all 8 frame legs:   101/101 arrived, 0.0% loss
persisted:          100/100 on bob and on dev0, dev1, dev2, dev3 — both directions
decrypt failures:   dev3=2 (both healed; it still persisted 100/100), 0 elsewhere
lock holds:         n=1065  p50=29ms  p90=231ms  p99=370ms  max=555ms
                      <100ms   638
                      100ms-1s 427
                      15-30s / 30-55s / >55s: ZERO
queued behind lock: p50=51ms  max=482ms
```

Taking the three signals of §5 in order:

1. **§5.1 re-run** — the 52/100 did not reproduce. Same device count, same round
   count, opposite result.
2. **§5.2 gap shape** — not printed, because nothing was missing. No information
   either way.
3. **§5.3 lock histogram** — **the mechanism did not fire.** Every hold under one
   second, none within a factor of twenty of even one timed-out attempt. Checked
   at all three retry multiples (~22s/~45s/~69s), not only 22s, per the warning
   in that section. The zero is real and not a reporting gap: `summariseLockHolds`
   omits empty buckets (`lock-probe.ts:105`), and the unconditional `max=555ms` in
   the header corroborates it independently, as does the absence of any `slowest:`
   line (those print only above 1s).

### What this changes, and what it deliberately does not

**It does not refute §1.** That the lock wraps relay HTTP is read from the source
and this run does not touch it. What the run constrains is *when* the coupling
bites: on a healthy relay the POST returns in well under a second, so the lock is
never held long enough to stall anything.

**It weakens §4's evidence considerably.** The 52/100 came from a run that
finished at 15:51 while the relay was 502ing by 15:53 for over an hour. §4 already
flagged that. A clean result at identical parameters on a verified-healthy relay
points that measurement at relay degradation rather than at a device-count
threshold.

⚠️ **A null here is exactly what the mechanism predicts here, so this run cannot
distinguish "no bug" from "no trigger".** That is the important limitation and it
should stop the obvious next move: **another clean 4-device run adds nothing.**
What would discriminate is making the POST slow — fault injection on
`/inbox/delete` (delay past the 22s mutate timeout) or a run taken while the relay
is genuinely degraded — and then reading the same histogram. If holds appear in
the 15-30s / 30-55s / >55s buckets and messages go missing together, the mechanism
is confirmed; if holds stay short while messages still go missing, §1 is not the
explanation and the search moves elsewhere.

⚠️ **Inference, not measurement, but it is the one hint in the data:** the holds
are bimodal — 638 under 100ms, 427 between 100ms and 1s — rather than massed low
where crypto-only work would sit. That is *consistent with* a network round trip
inside the critical section, which is what §1 claims is there. The probe times the
hold and does not observe its contents, so this is a pointer for the next
experiment, not evidence the coupling fired.

**Severity re-rating deferred.** The §-header warning asks for a re-rate if §5
confirms the mechanism. It did not, so `medium` stands unchanged.

## §5-CONFIRMED. ✅ Fault injection, 2026-07-29 — every predicted signature fired

The two clean runs above could not decide this, because a lock held across a *fast*
POST looks identical to a lock not held across a POST at all. So the trigger was
supplied: `HARNESS_FAULT_DELETE_DELAY_MS=30000 HARNESS_FAULT_DELETE_RATE=0.05`
stalls a deterministic 1-in-20 of `/inbox/delete` calls by 30s
(`harness/transport.ts`, off unless set). Same 4 devices, same 100 rounds, 300s
settle. Run log `2026-07-29T06-19-55-844Z-dm-multidevice.jsonl`. 50 of 1016 calls
were stalled.

```
FRAME LEVEL   all 8 legs: 101/101 arrived, 0.0% loss      <- transport untouched
PERSISTED     dev0 97/100   dev1 50/100 & 58/100
              dev2 25/100 & 27/100   dev3 23/100 & 23/100   bob 85/100
GAP SHAPE     CONTIGUOUS TAIL on every device, every direction. ZERO scattered.
LOCK          n=5745  p50=15ms  p90=29ms  p99=242ms  max=31260ms
                <100ms  5382 | 100ms-1s 349 | 1-5s 4 | 30-55s ⚠ 2 attempts  10
              slowest: 31260ms, 30690ms, 30439ms, 30374ms, 30329ms
QUEUEING      p50=0ms  max=31173ms                      <- a message waited 31s
```

Against §5's own criteria, in order:

1. **§5.1 re-run with a trigger** — persistence collapsed while arrival stayed
   perfect. The failure sits exactly where §1 says it does: between the socket and
   `saveMessage`.
2. **§5.2 gap shape** — **`CONTIGUOUS TAIL` on every device in every direction,
   not one scattered gap.** This is the criterion that discriminates backlog from
   per-message drops, and it came back unanimously for backlog. Both directions of
   a device stop at nearly the same message (dev3: 23 and 23; dev2: 25 and 27) —
   the one-lock-per-conversation prediction.
3. **§5.3 lock histogram** — the injected 30s appears *as lock hold time*. Ten
   holds in `30-55s` with a max of 31260ms. The lock is demonstrably held across
   the HTTP call. This is the direct measurement §5.3 was built for.

### ⚠️ What this does NOT license

- **The magnitude is a harness artifact.** `dmRatchetMutex` is a process-wide
  singleton and DM conversationIds are `<partner>/<partner>`, so all four of A's
  devices contend on ONE key (bob's address) — the `slowest:` list shows only two
  distinct keys for five bots. In production each device is a separate browser
  with its own lock, so a stalled ack stalls that device alone. The 97→50→25→23
  ladder is largely bots blocking each other. **Cite the mechanism, not the
  numbers.**
- **This is almost certainly latency, not loss** — as §3 insisted. 50 × 30s ≈
  1500s of stall across 2 keys versus a 300s settle: the backlog could not have
  drained before counting stopped. Proving permanence needs a settle longer than
  the injected stall budget.
- **It still does not explain the field symptom** (§7 stands). Desktop-only, and
  it needed an injected 30s stall to fire. Do not let it absorb
  quorum-mobile#183 item 2.
- **bob's 246 novel decrypt failures** are unexplained by this bug and are
  probably the known reorder/stale-bucket class, provoked by frames being
  redelivered while the session advanced. Worth a look, not part of this finding.

### The fix now has an acceptance test that can fail

Re-run the identical injection after applying §6. Expected: **no holds in
`30-55s`, no contiguous tails, persistence back to 100/100.** That is a real
before/after, and it is only obtainable with injection — on a healthy relay the
before and after are both green, which is what made the first two runs
uninformative.

## §6. ✅ Mobile is NOT affected — and its pattern is the fix

Verified by reading (2026-07-28, read-only):

| | desktop | mobile |
|---|---|---|
| ratchet lock placement | wraps the whole receive critical section (`MessageService.ts:3858`) | only inside `services/crypto/encryption-service.ts` (crypto layer) |
| lock wraps network I/O? | **yes** | **no** — that file has no network calls and imports no API client |
| inbox ack | `await`ed inside the lock | `deleteProcessedEnvelope` returns **`void`**; dispatched `.catch(() => {})`, never awaited |
| lock in the receive handler | yes | none — `runExclusive` appears nowhere in `context/` |

**Proposed fix: adopt mobile's shape.** Dispatch the inbox delete without awaiting
it, ignore its failure. Desktop's own `ackProcessedFrame` already swallows the
error, so this changes *when* the call happens, not what happens when it fails.

**Do not** simply shorten the timeout. That reduces the stall without removing it,
and leaves the coupling between relay latency and message processing in place.

### Care required

- The delete must still fire **after** the encryption state is persisted, or a
  crash between the two loses a frame the relay would otherwise redeliver.
  (Verified ordering today: save at `MessageService.ts:3918`/`4047` precedes
  ack at `3938`/`4058` — preserve it.)
- Do not move the *state save* out of the lock. Only the ack.
- The fix must cover **all three shapes in §1**, not just `ackProcessedFrame` —
  the give-up path inside `retainOrDropUndecryptableFrame`
  (`MessageService.ts:331`) and the delete-conversation branches (`3911`,
  `4040`) hold the lock the same way.
- Those two shapes **rethrow** on failure today (the ack swallows). Making them
  fire-and-forget silences an error the inbound loop currently catches and
  logs — acceptable (redelivery covers it, and `MessageDB.tsx:345` already
  logs loudly before rethrowing), but it is a behavior change; keep the
  `.catch` logging.
- ✅ **The other `runExclusive` sites were audited 2026-07-29 and are clean — the
  fix scope is exactly this one site.** All seven: `MessageService.ts:983, 3012,
  3195, 3477, 3858, 6610` and `ActionQueueHandlers.ts:672`. `983` and `672` were
  already known-good (they wrap the delivery promise as `{ sent }`). `3012`,
  `3195`, `3477` and `6610` each `await` only `this.messageDB.getEncryptionStates`
  / `deleteEncryptionState` / `saveEncryptionState` / `getConversation`, which are
  defined in `src/db/messages.ts` — a file containing **no** reference to
  `apiClient`, `QuorumApiClient`, `fetch(` or any URL. Local IndexedDB only, no
  relay HTTP inside those locks. **`3858` (the receive path) is the sole site with
  the defect**, via the three shapes listed in §1.

## §7. Scope — what this does NOT explain

**It does not explain the mobile↔mobile field loss** (issue
[quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183)
item 2, round 29: 8 of 25 frames lost one direction, 0 of 18 the reverse, both
phones instrumented). Mobile does not have this defect (§6), and that loss is at
the *frame* layer — frames never arrived — whereas this bug is entirely downstream
of arrival. **Do not let this finding absorb #183 item 2.**

It **is** consistent with the operator's live observation during a canonical
`dm-loss` run: two of their **desktop** clients received ~10 of 200 and 0 of 200
messages while the bench's peer channel measured 201/201, 0% loss. Desktop is the
platform carrying this defect, and `dm-loss` counts frames, so it was blind to it.

---
*Last updated: 2026-07-29*

## Review Log
**2026-07-28 - claude-fable-5**: Verified every code claim against desktop and mobile sources; corrected the stall bound, added a third locked HTTP shape, fixed the run-log path, widened the confirmation criterion.
- Stall bound was understated ~3x: fetchWithRetry (baseTypes.ts:150-196) retries mutations twice on timeout/5xx with 1s/2s backoff, so a timing-out /inbox/delete holds the lock up to ~69s in the harness (no decay factor, transport.ts:44) and ~23-49s in the app (decay 0.3, QuorumApiContext.tsx:33) — sec1 rewritten
- Third HTTP shape inside the lock was unlisted: retainOrDropUndecryptableFrame (3957/4074) awaits the same POST at MessageService.ts:331 when the retry budget is exhausted, and rethrows unlike ackProcessedFrame — added to sec1 and the sec6 care list
- sec5.3 lock-timing criterion (cluster near 22s) could false-negative a retried ack — now anchored to ~22/45/68s retry multiples plus decayed 6.6-15.4s values
- Run-log path corrected to src/dev/tests/harness/logs/
- Everything else verified accurate: runExclusive site list complete (983/3012/3195/3477/3858/6610 + AQH 672), keyedMutex doc quote faithful, persist-before-ack ordering holds (3918/4047 before 3938/4058), mobile-unaffected claims all confirmed in quorum-mobile (lock only in services/crypto, deleteProcessedEnvelope fire-and-forget at WebSocketContext.tsx:188-201), DM conversationId <partner>/<partner> confirmed, gap report exists in dm-multidevice.scenario.test.ts:91-95
