---
type: task
title: "Harness coverage: multi-device DM delivery, then the cells no bench reaches"
status: in-progress
priority: medium
created: 2026-07-28
updated: 2026-07-29
area: headless harness / DM delivery / multi-device fan-out
repos: quorum-desktop (primary) + quorum-mobile
related: issues/transport/measurements.md, issues/transport/index.md, quorum-mobile#183
---

# Harness coverage — multi-device first, then the unreached cells

## ⚠️ Why this exists: the benches were blind, and we now know to what

Four bench runs reported 0% loss. All four are real. All four used **one device per
account**, and `dm-loss` joins send-vs-arrive **only** for frames addressed to an
inbox the peer bot subscribes to — everything fanned out to the accounts' other
devices is excluded by design, as "unobserved, not observed-good".

During desktop `dm-loss` run 2, on the canonical accounts, the operator had two
desktop clients open and online. The bench reported **201/201 each way, 0% loss**.
Those same two desktops received **~10 of 200 messages, and 0 of 200**.

Same run. Same accounts. Same minutes. The channel the bench measured was perfect;
the channel it structurally could not see was close to total loss.

That is why the manual testing kept showing dropped messages while the bench went
green. **The two were never measuring the same thing.** Nothing about the earlier
nulls was wrong; they were nulls about a narrower channel than they appeared to
describe, and the write-up now says so (`measurements.md`).

**Untested channels, on both platforms, to date:**

1. the **self-sync copy** — a sender's own other devices
2. the **peer's second device**

Both are on the normal DM send path: desktop fans out to
`self.device_registrations.concat(counterparty.device_registrations)`
(`src/services/MessageService.ts:3016-3021`).

## Goal

Make the harness able to exercise the delivery paths the product actually uses, so
debugging continues on the bench instead of on devices. Multi-device first, because
a live observation already implicates it.

---

## Scenario 1 — `dm-multidevice` (quorum-desktop) ⬅ BUILD FIRST

Two bots share ONE account (two devices), a third bot is the peer. Assert
**per-device** arrival.

### ⛔ Do NOT use the canonical test accounts

They already carry 5+ device registrations, and `loadOrCreateBot` mints a NEW
device per bot *name* and merges it into the registration
(`src/dev/tests/harness/identity.ts:141-153`). Running this on canonical accounts
would permanently add devices to shared accounts, fan out to ghost inboxes we
cannot observe, and confound the exact variable being isolated.

Generate a throwaway account in-scenario and hand the SAME key to two bots:

```ts
const kp = JSON.parse(channel_raw.js_generate_ed448());
const KEY_A = Buffer.from(kp.private_key).toString('hex');   // ed448: 57 bytes = 114 hex chars
const aPhone  = await createBot(`md-a-phone-${stamp}`,  { privateKeyHex: KEY_A });
const aLaptop = await createBot(`md-a-laptop-${stamp}`, { privateKeyHex: KEY_A });
const bob     = await createBot(`md-b-${stamp}`);
```

`createBot` takes the **account** from `privateKeyHex` and the **device** from
`name` (`identity.ts:133-137`).

### Create them SEQUENTIALLY, never `Promise.all`

Registration is a read-modify-write: each bot fetches the current device list, then
posts a merged registration (`identity.ts:141-153`). Concurrent creation drops one
device. This is not a style preference — it silently produces a one-device account
and the whole scenario then measures nothing.

### STEP 1 — prove the premise before measuring anything

Fetch account A's registration and assert **both** bots' `inboxAddress` are present.
Assert **membership, not a count** — a count passes for the wrong reasons. On a
fresh account it happens to be exactly 2, which is why a count would look right even
if the wrong devices were registered.

If either is missing: **stop and report.** The premise is wrong and every downstream
number would be meaningless.

### STEP 2 — assert PER-DEVICE arrival

Send N messages A→B. Each message must land on:

- both of B's devices, **and**
- A's own second device (the self-sync copy)

**Aggregate counting is exactly how Finding AA looked green** — it recorded that a
second device "made no measurable difference" without ever asking what that second
device received. Extend `dm-loss`'s send-vs-arrive accounting with a per-target-inbox
dimension rather than writing new counting; the existing fingerprint join is the part
that has already been debugged.

### Count persistence, not rendering

The 10-of-200 observation came from watching two UIs. A message can arrive and be
persisted without rendering in a conversation that is not open. Count what
`saveMessage` receives per device — that is the whole reason to do this on the bench
rather than by hand, and it means a green result here does not contradict what was
seen live; it *distinguishes* delivery from display.

### Bench-lie risks — both directions

- The sender's device list must be fetched **after** the second device registers, or
  a red result is a harness artifact rather than a product defect (cf. PR #264, where
  two bench defects made the bench lie).
- **The same applies to B→A.** Bob must fetch A's registration after *both* of A's
  devices exist, or his replies legitimately reach only one and that is our bug, not
  the product's.

### A named hypothesis this scenario tests

Both clients carry **self-echo guards**, and mobile's discards a channel-less
self-echo outright. If a guard is over-broad, "0 of 200 on the second device" is
exactly the shape it would produce.

⚠️ `dr-self-echo.mjs` (0 of 2709) is **not** reassurance here. It asked whether a
client receives its *own* frames back on the *same* device. Whether a *second device
of the same account* accepts a sync copy is a different question, and unasked.

### Hygiene

Timestamped bot names mean `.state/` gains a file per run. Correct for
throwaway-per-run accounts (no accumulation on any account that matters), but the
scenario should clean up its own state files or the directory grows without bound.

---

## Scenario 2 — mobile↔desktop on one bench

**✅ DONE 2026-07-29 as PR #271** (`yarn harness:cross`) — two processes paired via
mobile's file rendezvous, quorum-mobile unchanged. Measured: mobile→desktop 40/40,
desktop→mobile 39/40. See `measurements.md` and the closed spec,
`issues/.done/2026-07-27-cross-platform-dm-harness.md` (slice 4).

## Scenario 3 — multi-device on the MOBILE harness

The same two-bots-one-account trick, using mobile's `loadOrCreateIdentity`, which
already accepts a `privateKeyHex`. Blocked only by scenario 1 proving the shape.

⚠️ On mobile each bot needs its **own process** (module singletons; see
`quorum-mobile/dev/harness/bot.ts`), so two devices of one account means two
processes plus the peer — three in total. `run-two-bots.mjs` generalises to N roles.

---

## ⭐ Offline analysis (2026-07-28) — a mechanism that fits the 52/100, and it may be latency

Found by reading, while the relay was down. **Not confirmed**, and it changes what
the 4-device result probably means.

### The receive path holds the ratchet lock across network I/O

`MessageService.handleNewMessage` runs its critical section inside
`dmRatchetMutex.runExclusive(conversationId, …)` (`MessageService.ts:3858`), and
inside that lock it awaits **HTTP calls to the relay**:

- `this.deleteInboxMessages(…, this.apiClient)` — POST `/inbox/delete`
- `this.ackProcessedFrame(…)` — which is the same POST, wrapped

`defaultMutateTimeout` is **22 seconds** (`src/api/baseTypes.ts:862`).

So a single slow inbox-delete blocks **every** message on that conversation for up
to 22s. At the bench's 700ms send gap that is ~31 messages backed up per stall;
two or three stalls across a 100-message run accounts for the ~48 that were
missing.

`KeyedMutex`'s own documentation warns about precisely this shape:

> *"Do NOT hold the lock across transport delivery… an async callback returning a
> promise gets auto-flattened — returning a delivery promise from `fn` silently
> extends the critical section until delivery."*

The SEND paths follow that guidance (they wrap the delivery promise as `{ sent }`,
`MessageService.ts:983`, `ActionQueueHandlers.ts:672`). The RECEIVE path does not —
it awaits HTTP directly inside the lock.

### Why this fits every feature of the result

| observation | explained by |
|---|---|
| both directions stopped at the same count | one lock, one `conversationId` — A↔B share it |
| no error raised anywhere | `ackProcessedFrame` catches and only `logger.warn`s |
| all frames arrived (101/101) | the socket is unaffected; this is downstream of it |
| clean at 2 devices, broken at 4 | 4 devices ⇒ ~4× the delete traffic ⇒ more chances of a slow call |
| one device of four | whichever device's calls happened to be slow |

### ⚠️ It predicts LATENCY, not loss — and that changes the finding

If this is the mechanism, the missing messages were **not dropped**; they were
still queued behind the lock when the run's settle window closed. They would land
with a longer tail. This investigation has mistaken exactly this for loss before —
see the master's "failures are TRANSIENT, so this is LATENCY WITH A LONG TAIL, not
demonstrated loss".

**The distinguishing evidence is already instrumented:** the gap report says
whether the missing numbers are a CONTIGUOUS TAIL (backlog) or SCATTERED (real
drops). That one line decides between two very different bugs.

### ⚠️ And the run may have been degraded

The 4-device run finished at 15:51. `api.quorummessenger.com` was returning 502 on
every path by 15:53. The relay was plausibly already degrading *during* the run,
which is exactly the condition that makes this mechanism bite. **Re-run against a
healthy relay before treating 52/100 as a product measurement.**

### ✅ 2026-07-29 — that re-run was done, and it was clean

Relay verified healthy first (`/` → 404, known user → 200). Same 4 devices, same
100 rounds, 700ms gap, 180s settle. Run log
`src/dev/tests/harness/logs/2026-07-29T05-52-51-054Z-dm-multidevice.jsonl`.

```
all 8 frame legs:   101/101 arrived, 0.0% loss
persisted:          100/100 on bob and dev0-dev3, BOTH directions
decrypt failures:   dev3=2, both healed; 0 elsewhere
ratchet lock:       n=1065  p50=29ms  p90=231ms  max=555ms
                    ZERO holds in 15-30s / 30-55s / >55s
```

**The 52/100 did not reproduce and the lock mechanism did not fire.** The gap
report printed nothing because nothing was missing, so the CONTIGUOUS-TAIL vs
SCATTERED question is still unanswered — that signal needs a run where messages
actually go missing.

This supports the paragraph above: the 07-28 result was most likely relay
degradation, not a device-count threshold. It does **not** show the receive path is
sound — a null on a healthy relay is what the mechanism predicts on a healthy
relay. See the bug report's §5-RESULT for what would actually discriminate
(a slow `/inbox/delete`, injected or observed), and note that **repeating this run
on a healthy relay adds nothing.**

### Why it is still worth fixing either way

Even as pure latency, this says user-visible delivery degrades **non-linearly**
when the relay is slow, and gets worse with every device on the account. A 22s
stall on one HTTP call should not stop a conversation's message processing. The
acknowledgement is best-effort by design (its failure is caught and ignored), so
there is no reason for it to be awaited inside the ratchet critical section at all.

**Candidate fix, not yet attempted:** move the inbox-delete/ack outside the lock —
the state is already persisted by then, and the ack's own failure path is already
"it will be redelivered".

### ✅ Checked mobile (read-only, 2026-07-28): it does NOT have this shape

Mobile is structurally immune, for three independent reasons:

| | desktop | mobile |
|---|---|---|
| where the ratchet lock sits | around the whole receive critical section (`MessageService.ts:3858`) | inside `services/crypto/encryption-service.ts` only — the crypto layer |
| does the lock wrap network I/O? | **yes** — awaits `deleteInboxMessages` / `ackProcessedFrame` | **no** — `encryption-service.ts` performs no network I/O and does not import an API client |
| how the inbox ack is issued | `await`ed inside the lock, 22s mutate timeout | `deleteProcessedEnvelope` returns **`void`**; dispatched `.catch(() => {})`, never awaited |
| lock in the receive handler | yes | none — `runExclusive` appears nowhere in `context/` |

**Two consequences.**

1. **This mechanism is desktop-only, so it cannot explain the mobile↔mobile field
   loss (round 29).** That stays #183 item 2. Do not let this finding absorb it.
2. **It does fit what the operator observed**, because those two clients were
   *desktops*: ~10 of 200 on one, 0 of 200 on the other, during a run in which the
   peer channel was perfect. Desktop is exactly the platform with the defect.

**Mobile's pattern IS the fix.** Desktop should dispatch the delete and not await
it, catching and ignoring failure — which is what mobile already does, and what
desktop's own `ackProcessedFrame` already implies by swallowing its error. That
makes the fix "adopt the sibling platform's existing shape" rather than a new
design, which is about as low-risk as a change to this path can be.

## Coverage: what the bench can and cannot reach

| path | covered? | by |
|---|---|---|
| desktop↔desktop DM, 1 device each | ✅ | `dm-loss`, `dm-basic` |
| mobile↔mobile DM, 1 device each | ✅ | `harness:dm` |
| decrypt failure / stale bucket | ✅ | `dm-reorder`, `dm-stale-bucket`, `dr-*` |
| session reset + recovery | ✅ | `dm-reset-recover` |
| **self-sync copy to own 2nd device** | ✅ | `dm-multidevice` (PR #269) |
| **peer's 2nd device** | ✅ | `dm-multidevice` (PR #269) |
| **mobile↔desktop** | ✅ | `dm-cross` (PR #271) |
| mobile multi-device | ❌ | scenario 3 |
| RN native WebSocket | ❌ **by construction** | needs a device; the bench exists to remove it |
| uniffi bridge | ❌ **by construction** | WASM only in Node |
| native batch decrypt | ❌ **by construction** | native-only, no WASM equivalent |
| SQLCipher at rest | ❌ **by construction** | shim drops `PRAGMA key` |
| spaces / hub log | ❌ | `2026-07-27-headless-space-harness.md` (unstarted) |

The four "by construction" rows are why a green bench never means the product is
healthy — it means the layers the bench covers are healthy.

---

## After every run

Append a row to `measurements.md`: date, what ran, configuration
(**including device count per account**), result, and what it changed. Record the
class, `arrival` or `decrypt`.

---
*Last updated: 2026-07-29*
