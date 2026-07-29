---
type: doc
title: "Transport & DM reliability — cross-repo index (every doc, PR and issue in one place)"
status: living — this is a MAP, not a status report. Every row links to the doc that owns the status.
created: 2026-07-28
updated: 2026-07-29
area: WebSocket transport / DM Double Ratchet / spaces hub-log / receipts
repos: quorum-desktop + quorum-mobile + quorum-shared + upstream (channel crate, node write path)
---

# Transport & DM reliability — cross-repo index

**Purpose:** the July 2026 transport work spans two repos, ~45 documents, ~50 PRs and
one upstream GitHub issue. This file exists so you can hand an agent **one path**
instead of hunting for links.

> **To brief an agent, paste this:**
>
> ```
> Read quorum-desktop/.agents/docs/transport-reliability-index.md first — it indexes
> every transport/DM doc across quorum-desktop, quorum-mobile and quorum-shared.
> Follow its read-first ladder (§2) before forming a theory.
> ```

⚠️ **This file does not carry status.** Statuses move daily and duplicating them
here would rot. Each row points at the doc that owns it. The two exceptions are §2
(the ladder, which is about reading order) and §8 (statuses verified against git and
found stale in their own files).

## §0. How to read the paths in this file

**Every path here is repo-qualified and deliberately NOT a relative link**, because
this index is read from both repos. Prefix any path with the checkout root:

| repo | root (this machine) |
|---|---|
| `quorum-desktop/` | `E:\GitHub\Quilibrium\quorum-desktop\` |
| `quorum-mobile/` | `E:\GitHub\Quilibrium\quorum-mobile\` |
| `quorum-shared/` | `E:\GitHub\Quilibrium\quorum-shared\` |

The three repos are **siblings**, so from inside any one of them `../quorum-mobile/...`
also resolves. If you are already in the repo a path names, drop the prefix.

---

## §1. The whole situation in seven sentences

1. For ~6 months, messages between clients were delayed, sometimes apparently lost, and DM receipts often never rendered.
2. It was never one bug: it is a stack of cooperating defects across space-receive, DM-receive, DM-session lifecycle, send-side durability, and receipts.
3. **The app-side layer is now largely fixed** — ~30 client PRs across both repos in July 2026, catalogued in §7.
4. **Two root causes remain outside the app repos**, both filed upstream as [quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183): a skipped-key lookup bug in the `channel` crate, and a slice of node inbox writes vanishing with no client-visible signal.
5. The crate bug (#183 item 1a) is **fully characterised, reproducible on demand in seconds, and mitigated client-side** on desktop (PR #265).
6. The node write-loss (#183 item 2) is measured on mobile senders (up to 32%, strongly directional), and **0% on every headless bench** — but every one of those benches measured only whether frames ARRIVED (§3.1); it is not fixable from any client, and needs node-side logs.
6b. **A separate failure lives past arrival**: with four devices on one account, every frame arrived and decrypted while one device persisted only half the messages, no error raised (§3.2). ⚠️ **The 2026-07-29 re-run against a verified-healthy relay was clean on every device and did not reproduce it** — the original run was probably taken against a degrading relay. The failure *class* (persistence, past arrival) remains the right thing to measure; this particular reproduction does not stand.
7. Remaining client-side work is send-side durability on mobile spaces, receipt truthfulness runtime verification, and hygiene items (ghost devices, junk state rows).

---

## §2. Read-first ladder

Read in this order. Stop when you have what you need — do not read the 3115-line
master first.

| # | read | why |
|---|---|---|
| 1 | **this file** | the map |
| 1b | `quorum-desktop/.agents/docs/transport-measurements.md` | **the numbers.** Every run, its configuration, its result, and what it changed — append-only. Read it before quoting any figure, and add to it after any run |
| 2 | `quorum-mobile/.agents/tasks/2026-07-24-transport-reliability-START-HERE.md` | the consolidated *transport* orientation: what shipped, what is left, and the verified fact that mobile and desktop use **different transports** for spaces |
| 3 | `quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md` | the *DM ratchet* entry point: root cause, the ten dead hypotheses (§3), the offline tools (§5) |
| 4 | [quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183) | the two upstream causes, lead-dev facing. Self-contained; the best single summary of the crypto findings |
| 5 | `quorum-desktop/.agents/docs/dm-ratchet-upstream-divergences.md` | the 8 shipped divergences from the upstream DR implementation, and why each exists |

> ⚠️ **Docs in `.agents/` are written by agents after the fact and can be wrong.
> When a doc and the code disagree, the code wins.** Several documents in this index
> are known to mislead — see §8.

---

## §3. The upstream issue — [quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183) (OPEN)

One issue, two independent problems. Body rewritten 2026-07-27; it is now the whole
story and needs no captures.

| item | what | evidence | client-side status |
|---|---|---|---|
| **1a** | `channel` crate matches a skipped message key **by index** in the bucket filed under the receiver's *pre-DH-step* `current_receiving_header_key`, without checking the bucket belongs to the incoming frame's chain. New-chain frames at colliding indices get an old-chain key and fail AEAD | 139/159 captured failures show the full signature; failing index set *equals* the stale bucket's index set (5/5 synthetic); deterministic repro `yarn harness dm-reorder` | **mitigated on desktop** — PR #265 (retry-only prune, re-files the bucket; 32→0 failures, zero cost to delayed frames). Not ported to mobile |
| **1b** | a receiver whose FIRST processed frame is at chain position > 0 forks permanently at the next DH turn | deterministic repro, `dr-advanced-start-fork.mjs` (needs no log, no devices) | not mitigated |
| **2** | node write path: a slice of `direct` inbox writes vanishes silently — reaches `ws.send`, socket open, signed, correct inbox, never arrives, never redelivered | mobile→mobile 8/25 lost one direction and 0/18 the reverse, same hub, same minutes; earlier rounds ~12%; **desktop↔desktop 301/301 both ways, 0% loss** | **unfixable client-side** — no write ack exists in the protocol. Needs node logs for a test window |

Asks on the issue: node-side logs for a capture window; whether per-writer/per-inbox
node state could make one direction lose a third of its writes; and whether a
protocol-level **write ack** is feasible (it would close the last loss class).

## §3.1. What the benches actually cover — read before quoting a 0% result

> ⭐ **UPDATED 2026-07-28: the benches stopped being all-green.** `dm-multidevice`
> reproduced the operator's symptom — see §3.2. Everything below still holds, but
> the reason the earlier nulls were narrow turns out to be more specific than
> "several variables differ": **they were all measuring the wrong layer.**
>
> ⚠️ **AMENDED 2026-07-29: the reproduction did not hold.** The re-run against a
> verified-healthy relay was clean on every device (§3.2). The point of this
> section is unchanged and is the durable part — the earlier nulls measured
> **arrival** only, and a persistence failure is invisible to them — but the
> benches are, on today's evidence, green again. Do not cite §3.2 as a standing
> reproduction.

Four separate 0%-**arrival**-loss results exist. **None of them contradicts the
field loss, and it would be a serious error to read them as "the transport is
fixed."** Each bench differs from the field configuration in more than one
variable, so what they collectively establish is narrower than it looks: *both
clients' send/receive logic delivers frames cleanly when run in Node, on fresh
accounts, over the WASM crypto build.*

Note the word **arrival**. That is the only class any of these rows measured, and
§3.2 is a failure in a different one.

**→ Every run and every number lives in [`docs/transport-measurements.md`](transport-measurements.md).**
That file is the append-only log; this section is only the summary that matters
for reading the issue. Add new results there, not here.

| # | configuration | client | transport | crypto | accounts | result |
|---|---|---|---|---|---|---|
| A | desktop bench, 07-27 | desktop | Node `ws` | WASM | fresh throwaway | 301/301 both ways, **0%** |
| A2 | desktop bench, 07-28 | desktop | Node `ws` | WASM | fresh throwaway | 201/direction, **0%** |
| B | desktop bench, 07-28 | desktop | Node `ws` | WASM | **canonical, aged, multi-device** | 201/direction measurable, ~9 frames/msg fan-out, **0%** |
| C | mobile bench, 07-28 | **mobile** | Node `ws` | WASM | fresh throwaway, 1 device | 80/80 both ways, **0%** |
| D | **field, round 29** | mobile | **RN native** | **uniffi** | real devices | **8/25 lost one way (32%), 0/18 the reverse** |

A and A2 are **different runs**, not one result reported twice — an earlier version
of this table collapsed them, which is what prompted the measurement log.

**C vs D differ in four variables at once** — transport, crypto backend, account
shape and OS — so C does **not** isolate RN's native socket, and any claim that it
does is unsupported. The pair that *is* close to single-variable is **A vs C**
(same transport, same crypto, same account shape, different client): that pair says
mobile's client logic is no worse than desktop's in Node, and nothing more.

Consequently the live suspects for D remain undistinguished:

1. RN's native WebSocket write path
2. the uniffi bridge (`parseNativeResult`, base64/JSON round-trips, ratchet mutex under real native timing) — note the harness proved the two crypto backends genuinely disagree on error conventions, so "same crate" does not mean "same behaviour"
3. real-account state: aged sessions, ghost devices, multi-device fan-out
4. device network conditions

**The cheapest experiment that would discriminate**, still not run:
**mobile↔desktop on one bench** (§6 item 8) — the field's reported worst case, and
the only cell no bench covers at all.

*(A previous version of this section also proposed running the mobile bench on the
canonical accounts. That is now superseded and should NOT be done: it would
permanently add devices to shared accounts and fan out to ghost inboxes we cannot
observe. §3.2's approach — one generated account, several bots — gives real
multi-device with none of that cost.)*

---

## §3.2. ⭐ The multi-device finding — a failure class no bench was measuring

**2026-07-28, `dm-multidevice`, four devices on one generated account, 100 rounds:**

```
all 8 frame legs:   101/101 arrived,  0.0% loss
decrypt failures:   0 everywhere
A.dev1 persisted:   52/100 messages  (BOTH directions, same count)
A.dev2, A.dev3:     100/100
```

Every frame arrived. Nothing failed to decrypt. One device kept **half** the
messages, with no error raised anywhere.

**This is why weeks of green benches meant less than they appeared to.** `dm-loss`
counts frames, so it would have reported this run as flawless — which is precisely
what it did on the canonical accounts while the operator watched messages fail to
land on a second desktop. The failure is **between the socket and `saveMessage`**,
a layer no scenario looked at until this one. The measurement log now carries a
third result class, `persistence`, for exactly this.

**It needs more than one extra device.** At 2 devices, 100 rounds, everything was
clean. That fits the operator's 5+ device accounts and explains why every earlier
bench — all of them one device per account — was green.

**The identical 52 in both directions is the informative detail.** A per-message
drop would not hit two independent streams equally; a device that stopped
processing at one moment would. That points at a receive-pipeline stall rather than
per-message loss. The scenario now reports WHICH message numbers are absent, since
"stopped at #52" and "dropped every other one" are different bugs.

⚠️ **Not confirmed — and the 2026-07-29 re-run did not reproduce it.** One run, one
device of three extras. All five bots also share one Node process, so a
harness-specific starvation effect is not excluded — though `dev2` and `dev3` being
perfect in that same process argues against it.

**The confirmation run was taken on 2026-07-29**, once the outage that blocked it
had cleared (`api.quorummessenger.com` was 502ing on every path from ~15:53 on
07-28; relay health was verified before starting this time). Same 4 devices, same
100 rounds:

```
all 8 frame legs:   101/101 arrived, 0.0% loss
persisted:          100/100 on every device, both directions
ratchet lock:       n=1065 holds, max=555ms, ZERO above 1s
```

**The 52/100 did not reproduce, and the lock histogram shows the
lock-across-HTTP mechanism did not fire.** The most likely reading is that the
07-28 run was taken against the relay as it degraded — which the row above already
flagged as possible.

⚠️ **This does not clear the receive path.** A clean run on a healthy relay is
exactly what the mechanism predicts on a healthy relay, so it cannot separate "no
bug" from "no trigger". **Another green 4-device run adds nothing**; discriminating
needs a *slow* `/inbox/delete` (fault injection or a degraded relay) with the same
histogram read. Full detail in
[`bugs/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md`](../bugs/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md) §5-RESULT.

### A second, untested path to the same symptom

Worth recording as a **hypothesis, not a finding**: the DM send path fetches both
registrations to build its device fan-out, and a failed fetch is caught and falls
back rather than failing loudly. A sender that cannot read the peer's registration
builds a **shorter device list** — which would look exactly like "the message
reached some devices and not others", and would be invisible to any frame-level
count because every frame it did send arrives. Today's 502 outage shows those
fetches do fail in production. This does **not** explain the 52/100 run (the relay
was healthy and all frames arrived), but it is a plausible second route to the same
field symptom, and how each client handles a registration-fetch failure mid-conversation
has never been examined.

---

## §4. Document index by area

Paths are repo-qualified — see §0.

### A. Entry points & orientation

| path | what it is |
|---|---|
| `quorum-mobile/.agents/tasks/2026-07-24-transport-reliability-START-HERE.md` | **transport entry point.** Consolidated status, the different-transports table, Layer 1 / Layer 2 split |
| `quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md` | **DM ratchet entry point.** Root cause, 10 dead hypotheses, offline tools, the rig |
| `quorum-mobile/.agents/bugs/2026-07-20-mobile-desktop-message-transport-delay-loss-master.md` | master report for mobile↔desktop. §0 is the remaining-work list |
| `quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md` | the 3115-line master, rounds 1-29. Reference, not a read-through |
| `quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-captures.md` | **archive only** — round data + findings A→AL + retracted mechanisms. Cited by letter from the entry point |

### B. Root-cause investigation (crypto / ratchet)

| path | what it is |
|---|---|
| `quorum-desktop/.agents/bugs/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md` | ⭐ **desktop receive awaits relay HTTP inside the per-conversation ratchet lock** (22s mutate timeout), so one slow ack stalls the conversation in both directions. Found by reading; confirmation owed. Mobile verified unaffected, and its pattern is the proposed fix |
| `quorum-mobile/.agents/bugs/.solved/2026-07-24-dm-session-confirm-row-mismatch-x3dh-every-send.md` | authoritative SDK reading: confirm wrote to a row the send path never read. **Solved** (#177) |
| `quorum-mobile/.agents/bugs/2026-06-13-desktop-to-mobile-messages-fail-decryption-invalid-signature.md` | earlier cross-platform decrypt/signature failure. Needs a full retest |
| `quorum-mobile/.agents/bugs/2026-07-19-multidevice-inbox-key-breaks-verified-signer-auth.md` | multi-device inbox keys broke every verified-signer authorization |
| `quorum-desktop/.agents/bugs/.solved/2026-07-17-dm-aead-error-frame-drops.md` | unserialized ratchet state read-modify-write across 5 writer paths |
| `quorum-desktop/.agents/bugs/.solved/2026-07-17-dm-decrypt-failure-destroys-session-FIX-SPEC.md` | a single decrypt failure destroyed the whole session |
| `quorum-desktop/.agents/tasks/2026-07-17-dm-dead-session-autoheal.md` | detect a dead session via missing receipts and repair without a manual reset |
| `quorum-desktop/.agents/tasks/.deferred/2026-07-17-dm-dedupe-before-decrypt.md` | skip redelivered frames before they reach the ratchet |

### C. Send-side reliability

| path | what it is |
|---|---|
| `quorum-mobile/.agents/tasks/2026-07-24-layer1-durable-send-remove-preflight-throw.md` | **Layer 1** — remove the pre-flight `!isConnected` throw on all 10 send sites (DM + space) |
| `quorum-mobile/.agents/tasks/2026-07-21-fix-space-append-send-loss-ack-resend.md` | **Layer 2** — resend `log-append` when the hub ack does not come. Mobile-only |
| `quorum-mobile/.agents/bugs/2026-07-26-spaces-log-append-ack-ignored-silent-write-loss.md` | the ack *is* received and discarded, so a dropped space message is invisible to the sender |
| `quorum-mobile/.agents/bugs/2026-07-23-dm-send-websocket-not-connected-abort-and-failed-ux.md` | ~10-15% of DM sends aborted loudly and were never queued; no retry wired |
| `quorum-mobile/.agents/bugs/2026-07-24-dm-send-latency-10s-production.md` | ~10-11s per DM send, reproduces in production |
| `quorum-mobile/.agents/tasks/2026-07-24-check-space-send-latency-same-bugs.md` | do space sends have the same latency bugs DMs had? |
| `quorum-desktop/.agents/bugs/.solved/2025-12-19-websocket-processqueue-stuck-blocking-outbound.md` | historical: the outbound queue wedging |

### D. Receipts

| path | what it is |
|---|---|
| `quorum-mobile/.agents/tasks/2026-07-26-receipt-truthfulness-delivery-gated-reads.md` | **a read ack must never invent a delivery.** Code complete on all three platforms; two-device runtime check still owed |
| `quorum-mobile/.agents/bugs/2026-07-24-dm-false-receipt-ticks-on-undelivered-message.md` | ticks appeared on a message that never landed |
| `quorum-mobile/.agents/tasks/2026-07-27-mobile-piggyback-receipt-acks-on-outgoing-dms.md` | mobile never piggybacks receipt acks on outgoing DMs — half the port is missing |
| `quorum-mobile/.agents/tasks/2026-07-24-mobile-dm-delivery-receipt-messageid-mismatch.md` | outgoing `messageId` differed between the stored and wire copies |
| `quorum-desktop/.agents/tasks/2026-07-27-combined-receipt-ack-and-protocol-options.md` | **proposed, for review** — combined receipt ack + two deeper protocol options |
| `quorum-desktop/.agents/docs/features/messages/dm-receipts.md` | how receipts work (reference) |
| `quorum-mobile/.agents/tasks/.done/2026-07-19-dm-receipt-pipeline-and-global-toggles.md` | the mobile receipt pipeline + global toggles |

### E. Sessions, multi-device, hygiene

| path | what it is |
|---|---|
| `quorum-mobile/.agents/tasks/.done/2026-07-25-mobile-per-device-conversation-inbox.md` | conversation inbox keypairs must be **per device**, not per conversation. **Done** (#180); a narrower residual loss lives in the divergence master §20-undecies |
| `quorum-desktop/.agents/tasks/2026-07-21-device-registration-ghost-accumulation-cross-platform.md` | ghost devices accumulate on every reset; desktop fans sends to each ghost inbox forever |
| `quorum-mobile/.agents/tasks/2026-07-24-ghost-session-prune-with-registration-sourced-list.md` | prune ghost sessions from DM sends using a registration-sourced device list |
| `quorum-mobile/.agents/bugs/2026-07-26-reset-app-data-stale-cipher-key-bricks-messages-db.md` | Reset App Data leaves a stale SQLCipher key cached; the next re-onboard bricks every chat |
| `quorum-desktop/.agents/bugs/2025-12-09-encryption-state-evals-bloat.md` | junk encryption-state rows bloating config sync |
| `quorum-mobile/.agents/tasks/.done/2026-07-17-serialize-dm-ratchet-state-keyedmutex.md` | the mobile mirror of the desktop ratchet mutex |
| `quorum-mobile/.agents/tasks/.done/2026-07-23-bounded-retry-inbox-poison-skiplist.md` | bounded-retry + skip-list for undecryptable inbox envelopes |
| `quorum-mobile/.agents/tasks/.done/2026-07-23-port-confirm-sender-session-to-mobile.md` | port `ConfirmDoubleRatchetSenderSession` so sessions confirm instead of churning |
| `quorum-mobile/.agents/tasks/.done/2026-07-23-port-init-envelope-staleness-guard-to-mobile.md` | port desktop's init-envelope staleness guard |

### F. Harnesses & offline tools — **reach for these before booking device time**

All of these live in **quorum-desktop**.

| path | what it is |
|---|---|
| `quorum-desktop/.agents/tools/dm-debug/README.md` | **the tool index.** 6 browser console snippets + 6 node CLI tools |
| `quorum-desktop/.agents/tools/dm-debug/dr-ablate.mjs` | **cheapest tool in the repo, arrived last.** Re-runs a captured decrypt while changing ONE state property at a time. Found the root cause in one run over logs already on disk. Add a case to its `VARIANTS` array to test a hypothesis in seconds |
| `quorum-desktop/.agents/tools/dm-debug/dr-prune-safety.mjs` | the mechanism + the mitigation. `--synthetic-only` needs no log at all |
| `quorum-desktop/.agents/tools/dm-debug/dr-advanced-start-fork.mjs` | runnable evidence for #183 item 1b. Needs nothing |
| `quorum-desktop/.agents/tools/dm-debug/dr-position-table.mjs` | ⛔ 1920 frames, zero failures — corroborates finding AC, and is **not** evidence the crate is clean |
| `quorum-desktop/.agents/tools/dm-debug/dr-replay.mjs` | is this failure genuine, or an app-level race |
| `quorum-desktop/.agents/tools/dm-debug/dr-self-echo.mjs` | does a client receive its own outbound frames? (0 of 2709 — killed the self-echo theory) |
| `quorum-desktop/src/dev/tests/harness/README.md` | **headless desktop harness** — drives the REAL desktop client in Node, both sides, no browser, no devices |
| `quorum-mobile/dev/harness/README.md` | **headless MOBILE harness** — drives the REAL mobile client in Node. Renders mobile's own `WebSocketProvider` (its DM receive path has no non-React seam), one bot per process |
| `quorum-desktop/.agents/tasks/.done/2026-07-27-headless-dm-harness.md` | the desktop harness build spec |
| `quorum-desktop/.agents/tasks/2026-07-27-cross-platform-dm-harness.md` | the mobile harness spec. **Slices 1-3 DONE** (mobile PRs #189-#193); slice 4 (mobile↔desktop) not started. Its progress log carries the findings and the measured results |
| `quorum-desktop/.agents/tasks/2026-07-27-headless-space-harness.md` | **spec, not started** — same for space message delivery |
| `quorum-mobile/.agents/tasks/.done/2026-07-26-mobile-to-mobile-two-device-round.md` | first-ever mobile↔mobile round; produced the #183 item 2 directional evidence |

Harness commands — run from the **quorum-desktop** checkout:

```bash
yarn harness dm-basic          # two bots exchange DMs both ways, merged log
yarn harness dm-volume         # concurrent bidirectional load, samples skipped_keys
yarn harness dm-receive        # a bot decrypts a DM you send from a browser
yarn harness dm-reorder        # reproduces the production failure in ~35s
yarn harness dm-stale-bucket   # the same cycle at scale, mitigation off vs on
yarn harness dm-loss           # send-vs-arrive accounting (the #183 item 2 measurement)
yarn harness dm-reset-recover  # recovery after a session reset
yarn harness dm-multidevice    # N devices on ONE account — the §3.2 finding
```

`dm-multidevice` takes `HARNESS_MD_DEVICES=N` (default 2; the finding needs 4).
It generates its own throwaway account and hands the same key to N bots, so it
gives real multi-device **without touching the canonical accounts** — which must
not be used for this, as every run would permanently add a device to them.

⚠️ **It is the only scenario that measures the `persistence` class.** The others
count frames, and a message that arrives, decrypts, and is then dropped is
invisible to them.

`dm-loss` also takes `HARNESS_LOSS_CANONICAL=1` to run on the canonical aged
multi-device accounts instead of fresh throwaways (row B of §3.1).

Mobile harness commands — run from the **quorum-mobile** checkout:

```bash
yarn harness:smoke   # offline, no keys, no network
yarn harness         # every scenario (HARNESS_OFFLINE=1 skips the networked ones)
yarn harness:dm      # TWO processes, one bot each, loss reported per direction
```

Knobs: `HARNESS_ROUNDS`, `HARNESS_SEND_INTERVAL_MS`, `HARNESS_SETTLE_MS`.
`HARNESS_LOG_DEBUG=1` enables mobile's own `logger.debug` (subscriptions, routing);
`HARNESS_CRYPTO_DEBUG=1` names the crate call behind a crypto failure.

> ⚠️ **`leftOnMyInbox` in the mobile run summary is not decoration.** Frames still
> queued on a device inbox arrived and were *refused*; an empty inbox with missing
> messages means they were never posted. A delivery count alone cannot tell those
> apart, and during development that distinction turned an apparent 100% loss into
> 40 frames delivered perfectly and rejected by the receiver's session.

Offline analysis — also from the **quorum-desktop** checkout (no devices, no browser):

```bash
node .agents/tools/dm-debug/dr-ablate.mjs       <saved-console.log> [...]
node .agents/tools/dm-debug/dr-prune-safety.mjs --synthetic-only    # needs nothing
node .agents/tools/dm-debug/dr-advanced-start-fork.mjs              # needs nothing
```

> ⚠️ Logs containing `[XPDUMP]` hold **real ratchet key material**. Throwaway test
> accounts only, keep them local, never paste raw regions into an issue.

### 📁 The captured-log archive — held locally, NOT in this repo

68 raw capture logs from rounds ~10-29 (25-27 July 2026) exist as a **local
archive on the capture operator's machine**. They are deliberately not in this
repo and not shared: a large share carry live ratchet key material.

**The path is intentionally not recorded here** — it is a personal machine path,
meaningless on anyone else's checkout. Ask the operator, or look in the private
agent memory vault under `projects/quorum-desktop/`.

The archive is organised by **what a tool can do with each file** rather than by
date, since the filenames already carry dates. If you hold a copy, mirror this:

| folder | what | key material |
|---|---|---|
| `xpdump-corpus/` (26) | console captures containing `[XPDUMP]` state dumps — what `dr-ablate` and `replay-captured` consume | **YES** |
| `console-no-xpdump/` (17) | console captures with no state dumps | no |
| `mobile-xptrace/` (25) | on-device frame traces. Includes **round 29's two phones** (`R58MA1HP46R`, `ZY22K3XRLP`) — the sole evidence base for #183 item 2 | no |

Point the replay scenario at whichever directory holds your corpus:

```bash
DM_LOG_DIR="<your corpus dir>" yarn harness replay-captured
```

Without `DM_LOG_DIR` that scenario **skips silently**, so it looks like it passed
while testing nothing.

⚠️ **The archive is irreplaceable** — the rigs have moved on and several rounds
cannot be re-captured. It is recorded here at all because an agent had to ask
where the logs were and nothing pointed at them.

**⚠️ The DR tools exist in BOTH repos and the two copies DIFFER.** `dr-ablate.mjs`,
`dr-replay.mjs` and `dr-advanced-start-fork.mjs` are in `quorum-mobile/.agents/scripts/`
as well (plus a mobile-only `dr-core-harness.mjs`). **Desktop's copies in
`.agents/tools/dm-debug/` are canonical** — that is where they were consolidated
(commit `0e9aaaae2`) precisely because **quorum-desktop's `.agents/` is git-tracked
while quorum-mobile's `.agents/` is gitignored** (`quorum-mobile/.gitignore:49`).
Consequences: mobile's `.agents/` has no git history and nothing in it is recoverable
after deletion, and any fix you make to a mobile copy of a DR tool is invisible to
everyone else. Run and edit the desktop copies.

### G. Architecture reference

| path | what it is |
|---|---|
| `quorum-mobile/.agents/docs/message-transport-architecture.md` | **DMs and spaces, cross-platform.** The canonical transport architecture doc |
| `quorum-desktop/.agents/docs/dm-ratchet-upstream-divergences.md` | the 8 shipped divergences from upstream DR + the two open upstream questions. Lead-dev facing |
| `quorum-desktop/.agents/docs/debugging/dm-architecture-and-debug-playbook.md` | DM internals and the debug ladder |
| `quorum-mobile/.agents/docs/inbox-envelope-lifecycle-and-poison-guard.md` | envelope lifecycle, the undecryptable hoard, the bounded-retry guard |
| `quorum-desktop/.agents/docs/cryptographic-architecture.md` | overall crypto architecture |
| `quorum-desktop/.agents/docs/quorum-db-schema.md` | IndexedDB schema, including encryption-state stores |

### H. Historical context (pre-July, useful for mechanism, not for status)

| path |
|---|
| `quorum-desktop/.agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md` — ⚠️ filed SOLVED, symptom **resurfaced**. Read as a mechanism catalogue |
| `quorum-desktop/.agents/bugs/.solved/2026-03-19-standalone-delivery-ack-unreliable.md` |
| `quorum-desktop/.agents/bugs/.solved/triple-ratchet-state-save-destroys-invite-fields.md` |
| `quorum-desktop/.agents/bugs/.solved/2025-12-18-dm-send-fails-address-undefined.md` |
| `quorum-desktop/.agents/reports/action-queue/002-websocket-queue-starvation.md`, `005-dm-sync-non-deterministic-failures.md`, `010-dm-registration-inbox-mismatch-fix.md`, `011-dm-debug-console-snippets.md` |

---

## §5. The capture rig (read before booking any test time)

The DM diagnostic instrumentation lives on **local, never-pushed branches**; neither
`main` nor `master` carries it.

- **Mobile:** branch `diag/dm-frame-trace`, entered with **`git debug`** — it refuses a dirty tree, rebases the rig onto master, re-applies the `node_modules` transport patch (wiped by every `yarn install`), and prints a BUILD CHECK proving which probes are compiled in.
- **Never check out the rig by SHA.** `git debug` rebases, so SHAs written in docs go stale immediately. A round captured from a stale head already faked 21 losses once.
- **Rig docs:** §D of `quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md`, plus `quorum-mobile/.agents/scripts/README.md`.
- **Desktop:** §6 of `quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md`. The headless harness (§4-F) has replaced most of the need for it.

---

## §6. Open work

Ranked. Each item names the doc that owns it — go there for detail.

| # | item | owner doc | repo |
|---|---|---|---|
| 0 | ⭐ **Desktop receive holds the ratchet lock across relay HTTP** — one slow ack stalls a whole conversation, both directions, up to 22s. Mechanism identified by reading; needs one clean bench run to tell backlog from loss. Mobile is NOT affected and its pattern is the fix | `bugs/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md` | desktop |
| 1 | **Node write-loss (#183 item 2)** — blocked on node-side logs / a write ack. Nothing client-side left | [#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183) | upstream |
| 2 | **Layer 2: space `log-append` resend on missing hub ack** — the proven ~1/5 space loss. Mobile-only (desktop has no hub log) | `quorum-mobile/.agents/tasks/2026-07-21-fix-space-append-send-loss-ack-resend.md` | mobile |
| 3 | **Receipt truthfulness two-device runtime check** — code shipped on all three platforms, verification owed by both clients | `quorum-mobile/.agents/tasks/2026-07-26-receipt-truthfulness-delivery-gated-reads.md` | both |
| 4 | **Mobile piggyback receipt acks** — half the port is missing | `quorum-mobile/.agents/tasks/2026-07-27-mobile-piggyback-receipt-acks-on-outgoing-dms.md` | mobile |
| 5 | **Port the #265 stale-bucket mitigation to mobile** — desktop-only today | `quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md` §5-B1′ | mobile |
| 6 | **Decide the combined-receipt-ack / protocol options** — proposed, awaiting review | `quorum-desktop/.agents/tasks/2026-07-27-combined-receipt-ack-and-protocol-options.md` | both |
| 7 | **What supplies the out-of-order delivery that forms the stale bucket in the field?** — the one remaining live question on the crate bug | `quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md` §5-D | — |
| 8 | **Cross-platform harness — slice 4 only.** The mobile bot EXISTS (mobile PRs #189-#193, mobile↔mobile measured 0%); what is missing is mobile↔desktop on one bench, plus the canonical-multi-device mobile run. Both are named in §3.1 as the experiments that would actually discriminate | `quorum-desktop/.agents/tasks/2026-07-27-cross-platform-dm-harness.md` | both |
| 9 | Hygiene: ghost-device deregistration, junk encryption-state prune, dev-env latency | §4-E | both |

---

## §7. PR ledger

The July 2026 transport work, so you can find the diff without trawling git log.

### quorum-desktop

| PR | date | what |
|---|---|---|
| 236 | 07-17 | serialize DM Double Ratchet state per conversation |
| 237 | 07-17 | consume `KeyedMutex` from quorum-shared |
| 238 | 07-17 | refuse stale init envelopes that silently replaced healthy sessions |
| 243 | 07-19 | SECURITY: authorize update-profile by verified signer (inbox_address poisoning) |
| 244/245/249/250 | 07-20→21 | per-device signing keys (send + receive + gate fix) |
| 248 | 07-21 | sync per-conversation DM settings across a user's devices |
| 252 | 07-25 | DM session reset must keep inbox routing, or the peer's messages vanish |
| 253 | 07-25 | stop deleting DM frames that would decrypt moments later |
| 254 | 07-25 | send with the NEWEST session for a device, so a peer's reset propagates |
| 255 | 07-25 | refuse ancient init envelopes even when no session rows exist |
| 256 | 07-26 | DM init path no longer silently destroys the embedded first message |
| 258 | 07-26 | receipt truthfulness (a read ack must never invent a delivery) |
| 259 | 07-26 | order DM sessions in the offline action-queue send path too |
| 260 | 07-26 | report a failed DM decrypt as a decrypt failure, not a JSON syntax error |
| **263** | 07-27 | **headless DM harness** — drive the real client in Node |
| **264** | 07-27 | reproduce the DM decrypt failure on demand + fix two defects that made the bench lie |
| **265** | 07-27 | **the #183 item 1a mitigation** — recover frames the upstream lookup rejects, without discarding the keys |
| 266 | 07-28 | `dm-loss` gains canonical-account mode (`HARNESS_LOSS_CANONICAL=1`) — row B of §3.1 |
| 267 | 07-28 | apply named read acks, so a lost delivery ack can still reach the second tick |
| 268 | 07-28 | test: a lost delivery ack still earns both ticks (+ two comment corrections) |

Also merged direct to main 2026-07-27 (no PR): `6b7c4fb6c` hold the ratchet lock on
the offline DM send path · `286079f86` stop the init-envelope age bound destroying
legitimate re-inits · `47ffb9b19` give the SDK back `sent_accept`.

### quorum-mobile

| PR | date | what |
|---|---|---|
| 160/162/168 | 07-19→21 | space control-message auth signatures, multi-device signing, per-device signing keys |
| 164 | 07-20 | DM delivery and read receipts |
| 165 | 07-20 | fix DM messages silently dropping by serializing encryption state updates |
| **169** | 07-23 | **space receive** — flow-control hub-log catch-up so queue overflow can't wedge the cursor |
| **170** | 07-23 | **DM receive + sessions** — watchdog, poison skip-list, staleness guard, `ConfirmSenderSession`, receipt interception |
| 171-174 | 07-23 | inline DM receipts on mobile (+ media overlay, unsigned indicator) |
| **175** | 07-24 | **Layer 1 durable send** — queue on disconnect, sent-on-transmit (DM + space) |
| 176 | 07-24 | eliminate per-send SecureStore + registration-fetch overhead |
| 177 | 07-24 | DM sessions reach the confirmed state; hear and sign every session inbox |
| 178 | 07-25 | stop DM ratchet state resurrecting or regressing in the write queue |
| 179 | 07-25 | send with the NEWEST session for a device |
| **180** | 07-25 | **per-device conversation inbox** — multi-device sessions stop overwriting each other |
| 181 | 07-26 | DM receive failures are no longer silent |
| 182 | 07-26 | flat DM control frames no longer crash the save and redeliver forever |
| 186 | 07-27 | self-echo guards compared against a stale null user closure |
| 188 | 07-27 | receipt truthfulness (mobile side) |
| **189-192** | 07-27→28 | **headless mobile harness**, slices 1-3: toolchain, crypto seam (WASM in place of uniffi), storage/platform shims, mobile's own transport over Node's WebSocket |
| **193** | 07-28 | **the mobile↔mobile measurement** — two headless mobile clients, 80/80 delivered, 0% loss. Also: the two crypto backends disagree on error conventions; simultaneous session open forks the pair |

### quorum-shared

| commit | what |
|---|---|
| `f55b363` (#66) | receipt truthfulness: a read ack must never invent a delivery |
| `5ce6bc7` (#59) | `KeyedMutex` — per-key FIFO async lock (consumed by both clients' ratchet serialization) |
| `61b001f` (#61) / `5241124` (#62) | receive-side authorization primitives + per-device space signing key statements |

---

## §8. Status hygiene — reconciled 2026-07-28

A pass over this cluster found eight docs whose status contradicted git. **All eight
are now corrected in their own files**, so the table below is a record of what was
done, not a list of live traps.

### Moved, because they are verifiably complete

Each had both a confirmed merge **and** recorded runtime/device verification.

| doc | evidence | moved to |
|---|---|---|
| `quorum-mobile/.agents/bugs/.solved/2026-07-24-dm-session-confirm-row-mismatch-x3dh-every-send.md` | PR #177 merged; live-verified (session confirmed ~16s after first send via the peer's receipt, survives restarts) | `.solved/` |
| `quorum-mobile/.agents/tasks/.done/2026-07-25-mobile-per-device-conversation-inbox.md` | PR #180 merged; 80/80 tests green, three reviews, device-verified 0/3 → 5/5 both directions | `.done/` |
| `quorum-mobile/.agents/tasks/.done/2026-07-21-dev-env-receive-deaf-investigation.md` | PRs #169 + #170 merged; all receive-side fixes shipped | `.done/` |

In each case a **residual** issue remains but is owned by a different doc (the
divergence master, its §20-undecies, and master report §7d respectively). The task
being done and the area being fully fixed are not the same thing.

### Status corrected in place, no move

| doc | was | now |
|---|---|---|
| `quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md` | "the live work item is reviewing and merging branch `feat/dm-stale-bucket-retry`" | that branch **merged** as PR #265, 2026-07-27. **Bug stays OPEN** — the cause is upstream, the mitigation is desktop-only, §5-D unanswered |
| `quorum-desktop/.agents/tasks/.done/2026-07-27-headless-dm-harness.md` | `IN PROGRESS — slice 1` | DONE, PRs #263 + #264. Slice 4's one remaining item (`importSession.ts`) was made **unnecessary** by the later repro work |
| `quorum-mobile/.agents/tasks/.done/2026-07-19-dm-receipt-pipeline-and-global-toggles.md` | "pending device test (not merged)" | shipped in #164, completed by #170, UI in #171-#174 |
| `quorum-mobile/.agents/bugs/2026-07-23-dm-send-websocket-not-connected-abort-and-failed-ux.md` | `OPEN — analyzed` | **half fixed, stays open.** The abort is fixed (#175, grep-verified); the retry/failed-timeout UX was moved to the deferred Layer 2 |
| `quorum-mobile/.agents/tasks/2026-07-24-transport-reliability-START-HERE.md` | "Layer 1 (PR #175 OPEN)" | merged 2026-07-24 |

### Code shipped, runtime verification owed — deliberately NOT moved

Both have their code confirmed present, but the gate each doc set for itself is a
two-device runtime check that has not been recorded. They stay open until it is.

| doc | code verified 2026-07-28 | owed |
|---|---|---|
| `quorum-mobile/.agents/tasks/2026-07-24-layer1-durable-send-remove-preflight-throw.md` | all 9 send hooks clean; "WebSocket not connected" appears nowhere in the repo | on-device airplane-mode test |
| `quorum-mobile/.agents/tasks/2026-07-24-mobile-dm-delivery-receipt-messageid-mismatch.md` | `onMutate` mints the nonce/messageId once and passes them via `variables._nonce`/`_messageId` | ✓ appears mobile → desktop, two devices |

### Still correctly self-flagged, but they still catch people

- `quorum-desktop/.agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md` lives in `.solved/` and the symptom **resurfaced**. It stays there only because many docs link that path. Mechanism catalogue, not a status report.
- The mobile master's early claim that **"desktop↔desktop has no issues" is falsified** (finding AE onward).

### Dead hypotheses — do not re-investigate

**Ten** app-level mechanisms were proposed confidently and then disproved by the next
measurement. One was retracted within minutes; one reached a commit message before
the user caught it. They are enumerated in **§3 of**
`quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md`.
Read that section before forming a theory, and prefer §4-F's offline tools over
booking a capture round — the tool that found the root cause needed no devices and
arrived last.

---

## §9. Handoff block

Copy-paste to brief an agent on a specific slice.

**Crypto / ratchet work:**
```
quorum-desktop/.agents/docs/transport-reliability-index.md                     (map — read first)
quorum-desktop/.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md     (§3 dead ends, §5 tools)
quorum-desktop/.agents/docs/dm-ratchet-upstream-divergences.md
quorum-desktop/.agents/tools/dm-debug/README.md
https://github.com/QuilibriumNetwork/quorum-mobile/issues/183
```

**Transport / send-side work:**
```
quorum-desktop/.agents/docs/transport-reliability-index.md                     (map — read first)
quorum-mobile/.agents/tasks/2026-07-24-transport-reliability-START-HERE.md
quorum-mobile/.agents/docs/message-transport-architecture.md
quorum-mobile/.agents/bugs/2026-07-20-mobile-desktop-message-transport-delay-loss-master.md   (§0 = remaining work)
```

**Receipts work:**
```
quorum-desktop/.agents/docs/transport-reliability-index.md                     (map — read first)
quorum-mobile/.agents/tasks/2026-07-26-receipt-truthfulness-delivery-gated-reads.md
quorum-desktop/.agents/tasks/2026-07-27-combined-receipt-ack-and-protocol-options.md
quorum-desktop/.agents/docs/features/messages/dm-receipts.md
```

---

## Maintaining this file

Add a row when a transport/DM doc is created; update §7 when a transport PR merges;
update §8 when you verify or fix a stale status. Keep paths repo-qualified (§0) —
this file is read from both repos, so relative links break. Do **not** copy statuses
in from the linked docs; that is what rotted the docs this file exists to navigate.

**New measurements go in `docs/transport-measurements.md`, not here.** That file is
append-only and is the only consolidated list in this cluster that is safe to keep,
because a measurement — unlike a status — never goes stale; it is only ever
superseded by a newer row. §3.1 here carries just the summary needed to read the
upstream issue, and points at the log for everything else.

A pointer stub lives at `quorum-mobile/.agents/docs/transport-reliability-index.md`
so an agent starting in that repo finds this file. It carries no content — do not
duplicate anything into it.

**Before moving anything to `.solved/` or `.done/`:** a merged PR is not verification.
Require both a confirmed merge *and* a recorded runtime/device result, and check
whether a residual issue needs re-homing into another doc first — three of the moves
recorded in §8 had one. If the only thing missing is a device check you cannot run,
correct the status in place and say what is owed, rather than moving.

⚠️ **`.agents/update-index.py` silently strips hand-written annotations from
`INDEX.md`** — it regenerates every line from frontmatter. After running it, re-add
the bold ENTRY POINT / 🗺️ notes on this file and on the resurfaced-DM bug.

---
*Last updated: 2026-07-29*
