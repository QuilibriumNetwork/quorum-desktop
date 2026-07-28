---
type: bug
title: "Desktop DM receive holds the per-conversation ratchet lock across relay HTTP, so one slow ack stalls the whole conversation"
status: OPEN — MECHANISM IDENTIFIED BY CODE READING, NOT YET CONFIRMED BY MEASUREMENT. The receive path awaits `deleteInboxMessages` / `ackProcessedFrame` (POST `/inbox/delete`, 22s mutate timeout) INSIDE `dmRatchetMutex.runExclusive(conversationId, …)`, so a single slow ack blocks every message on that conversation, in BOTH directions, for up to 22s. A 4-device bench run showed one device persisting 52/100 messages while all 101 frames arrived and nothing failed to decrypt — consistent with this, but that run may have been taken against a degrading relay (see §4) and the confirming evidence (§5) has not been collected. Mobile does NOT have this shape and its pattern is the proposed fix (§6).
created: 2026-07-28
severity: medium — user-visible "messages not arriving" on desktop; likely LATENCY not permanent loss (§3), degrades with device count
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

Inside that lock it **awaits HTTP calls to the relay**:

- `await this.deleteInboxMessages(…, this.apiClient)` — POST `/inbox/delete`
- `await this.ackProcessedFrame(freshKeys.receiving_inbox, message.timestamp)`
  (`MessageService.ts:350-356`), which is the same POST wrapped in a try/catch

The mutate timeout is **22 seconds** (`defaultMutateTimeout`,
`src/api/baseTypes.ts:862`). There is no separate, shorter timeout for this call.

**Consequence:** one slow inbox-delete blocks *every* message on that
`conversationId` for up to 22s. Both directions of a DM share one conversationId
(`<partner>/<partner>`), so both stall together.

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
22 seconds for something whose failure is a no-op buys nothing.

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
generated account (run log `logs/2026-07-28T13-45-03-227Z-dm-multidevice.jsonl`):

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
3. Optionally, time the lock: log how long `runExclusive` holds `conversationId` on
   the receive path. A visible cluster near 22s would be conclusive.

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
- Do not move the *state save* out of the lock. Only the ack.
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
