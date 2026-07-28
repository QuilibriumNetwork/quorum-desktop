---
type: task
title: "Harness coverage: multi-device DM delivery, then the cells no bench reaches"
status: IN PROGRESS — scenario 1 (dm-multidevice) being built
created: 2026-07-28
updated: 2026-07-28
area: headless harness / DM delivery / multi-device fan-out
repos: quorum-desktop (primary) + quorum-mobile
related: docs/transport-measurements.md, docs/transport-reliability-index.md, quorum-mobile#183
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
describe, and the write-up now says so (`docs/transport-measurements.md`).

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

The field's reported worst case, and the only configuration **no** bench covers.
Specced as slice 4 of `tasks/2026-07-27-cross-platform-dm-harness.md`. Cheap now
that both bots exist.

## Scenario 3 — multi-device on the MOBILE harness

The same two-bots-one-account trick, using mobile's `loadOrCreateIdentity`, which
already accepts a `privateKeyHex`. Blocked only by scenario 1 proving the shape.

⚠️ On mobile each bot needs its **own process** (module singletons; see
`quorum-mobile/dev/harness/bot.ts`), so two devices of one account means two
processes plus the peer — three in total. `run-two-bots.mjs` generalises to N roles.

---

## Coverage: what the bench can and cannot reach

| path | covered? | by |
|---|---|---|
| desktop↔desktop DM, 1 device each | ✅ | `dm-loss`, `dm-basic` |
| mobile↔mobile DM, 1 device each | ✅ | `harness:dm` |
| decrypt failure / stale bucket | ✅ | `dm-reorder`, `dm-stale-bucket`, `dr-*` |
| session reset + recovery | ✅ | `dm-reset-recover` |
| **self-sync copy to own 2nd device** | ❌ | scenario 1 |
| **peer's 2nd device** | ❌ | scenario 1 |
| **mobile↔desktop** | ❌ | scenario 2 |
| mobile multi-device | ❌ | scenario 3 |
| RN native WebSocket | ❌ **by construction** | needs a device; the bench exists to remove it |
| uniffi bridge | ❌ **by construction** | WASM only in Node |
| native batch decrypt | ❌ **by construction** | native-only, no WASM equivalent |
| SQLCipher at rest | ❌ **by construction** | shim drops `PRAGMA key` |
| spaces / hub log | ❌ | `tasks/2026-07-27-headless-space-harness.md` (unstarted) |

The four "by construction" rows are why a green bench never means the product is
healthy — it means the layers the bench covers are healthy.

---

## After every run

Append a row to `docs/transport-measurements.md`: date, what ran, configuration
(**including device count per account**), result, and what it changed. Record the
class, `arrival` or `decrypt`.

---
*Last updated: 2026-07-28*
