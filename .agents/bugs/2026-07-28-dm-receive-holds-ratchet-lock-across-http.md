---
type: bug
title: "Desktop DM receive holds the per-conversation ratchet lock across relay HTTP, so one slow ack stalls the whole conversation"
status: OPEN — MECHANISM IDENTIFIED BY CODE READING, NOT YET CONFIRMED BY MEASUREMENT. The receive path awaits `deleteInboxMessages` / `ackProcessedFrame` (POST `/inbox/delete`, 22s mutate timeout, retried ×3) INSIDE `dmRatchetMutex.runExclusive(conversationId, …)`, so a single slow ack blocks every message on that conversation, in BOTH directions, for up to ~69s (see §1). A 4-device bench run showed one device persisting 52/100 messages while all 101 frames arrived and nothing failed to decrypt — consistent with this, but that run may have been taken against a degrading relay (see §4) and the confirming evidence (§5) has not been collected. Mobile does NOT have this shape and its pattern is the proposed fix (§6).
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
- Check the other `runExclusive` sites for the same shape before assuming this is
  the only one: `MessageService.ts:983, 3012, 3195, 3477, 3858, 6610` and
  `ActionQueueHandlers.ts:672`. 983 and 672 are known-good (they wrap as
  `{ sent }`); the rest have not been audited for network calls inside the lock.

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
*Last updated: 2026-07-28*

## Review Log
**2026-07-28 - claude-fable-5**: Verified every code claim against desktop and mobile sources; corrected the stall bound, added a third locked HTTP shape, fixed the run-log path, widened the confirmation criterion.
- Stall bound was understated ~3x: fetchWithRetry (baseTypes.ts:150-196) retries mutations twice on timeout/5xx with 1s/2s backoff, so a timing-out /inbox/delete holds the lock up to ~69s in the harness (no decay factor, transport.ts:44) and ~23-49s in the app (decay 0.3, QuorumApiContext.tsx:33) — sec1 rewritten
- Third HTTP shape inside the lock was unlisted: retainOrDropUndecryptableFrame (3957/4074) awaits the same POST at MessageService.ts:331 when the retry budget is exhausted, and rethrows unlike ackProcessedFrame — added to sec1 and the sec6 care list
- sec5.3 lock-timing criterion (cluster near 22s) could false-negative a retried ack — now anchored to ~22/45/68s retry multiples plus decayed 6.6-15.4s values
- Run-log path corrected to src/dev/tests/harness/logs/
- Everything else verified accurate: runExclusive site list complete (983/3012/3195/3477/3858/6610 + AQH 672), keyedMutex doc quote faithful, persist-before-ack ordering holds (3918/4047 before 3938/4058), mobile-unaffected claims all confirmed in quorum-mobile (lock only in services/crypto, deleteProcessedEnvelope fire-and-forget at WebSocketContext.tsx:188-201), DM conversationId <partner>/<partner> confirmed, gap report exists in dm-multidevice.scenario.test.ts:91-95
