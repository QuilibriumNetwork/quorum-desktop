---
type: task
title: "DM desktop↔desktop — capture archive (round data and retracted mechanisms)"
status: in-progress
created: 2026-07-27
related:
  - ".agents/issues/transport/2026-07-26-dm-desktop-to-desktop-resurfaced.md (the entry point — read that first)"
---

# Capture archive — DM desktop↔desktop

> This file exists so the entry point stays readable. It holds the **full
> per-round evidence** and the **detailed retractions**. Nothing here is a status
> report; every conclusion drawn from this data lives in the entry point, and
> where the two disagree the entry point wins because it is newer.
>
> Findings are lettered A-O in the order they were established, and the entry
> point cites them by letter.

---

## §2a. The 2026-07-27 age-bound capture (dual-client, both `rig=6`)

Protocol: receiver closed completely; sender reset the session and sent exactly
one message (`age-test-1`); 17.6 minutes elapsed; receiver reopened; then
`age-test-2` (sender→receiver) and `age-test-3` (receiver→sender).

### Finding A — lead 1 CONFIRMED. The guard destroys legitimate messages.

```
STALE init envelope IGNORED
  fp=90c0635f  envelopeAgeSeconds=1057
  envelopeTimestamp  = 1785137056356
  newestRowTimestamp = 1785136882458
```

**The envelope was 173,898 ms (~174 s) NEWER than the newest row it would have
replaced.** Rules 2 and 3 would both have accepted it. It was refused solely by
rule 0, the flat `INIT_ENVELOPE_MAX_AGE_MS` bound. The frame was then deleted
server-side, and the salvage path is bounded on *payload* age by the same 10
minutes, so nothing was recovered: **`age-test-1` is permanently lost, with no
user-visible trace.** Confirmed on screen, not just in the log.

This closes the question §4.1 asked. Wall-clock age is a bad staleness proxy for
an offline receiver, exactly as suspected.

### Finding B — but it SELF-HEALS, so it is not the permanent-death mechanism.

`age-test-2` and `age-test-3` both delivered. The sender simply minted a fresh
init on its next send and the conversation recovered. Lead 1 therefore explains
**messages lost while you are away**; it does **not** explain a conversation
that stays dead. Do not close this bug on the strength of fixing it.

### Finding C — the capture caught a better suspect: session churn.

The sender minted **three** init envelopes to the receiver's device inbox
`QmccZfeHAW`, two of them 4.2 s apart:

| wall clock | sender | receiver |
|---|---|---|
| 09:24:15 | init `90c0635f` (the deliberate reset) | refused — finding A |
| 09:43:04 | init `62a3e428` | `SESSION REPLACED` |
| 09:43:08 | init `c75ef445` (**+4.2 s**) | `SESSION REPLACED` again |
| 09:43:25 | frame `71b8f51c` → session inbox `QmRvBkFbk7` | **AEAD failure** |
| 09:43:28 | frame `791e5d4c` → session inbox `QmRvBkFbk7` | **AEAD failure** |

Offline replay (`dr-replay.mjs`) on both failures:

```
state: root=090859d9 sLen=3 pS=0 rLen=3 pR=0 skipped=1
frame: inbox=QmRvBkFbk7Fd signed=yes
  [1] unseal: OK
  [i] frame is an INIT envelope (carries user_address)
  [2] ratchet: FAILED -> Decryption failed: aead::Error
      state unchanged? rLen 3 -> 3
```

Each rebuild discards the receiver's current session. Two rebuilds 4.2 s apart
put the two sides on different ratchets, and the sender's next frames no longer
open. **This is the prime suspect for the permanent break** and it matches the
already-filed mobile behaviour (`...-x3dh-every-send.md`). Lead 0 in §4.

### Finding D — what this capture does NOT establish

- **Whether the conversation recovered.** The receiver log was saved at 09:43:38,
  **10 seconds** after the last failure, while the sender kept sending
  (`52983c6c` at 09:43:39, past the end of the receiver log). Recovery is
  unknown. This is the §5 truncation trap, hit again — the follow-up capture
  must wait a full 5 minutes before saving.
- **Lead 2 is not implicated here.** Zero `[DM-prune ui]` and zero
  `[DM-prune send]` on either client, on a build that carries the probes
  (`rig=6` confirmed on both). That is meaningful silence, not blind silence —
  but it is one capture, not an exoneration.

### Finding E — a rig blind spot, fix before trusting `path=`

`[DM-recv wire]` logged **`path=dr`** for both failing frames, yet the replay
proves they were **init-wrapped** (they carry `user_address`). The `path` field
reports which code path the receiver took — which follows the arrival inbox —
**not the shape of the frame**. An init-wrapped frame addressed to the session
inbox is therefore invisible as such in the wire log. Anyone reasoning about
`path=init` counts from an existing log is undercounting. Either add a
`wrapped=` field or read `path` strictly as "which branch ran".

> Capture files were local to the reporter's machine and contain real key
> material. They are not committed and are not linked here.

---

## §2b. The 2026-07-27 churn capture — session churn EXONERATED, confirm-state mismatch FOUND

Protocol: both clients open throughout, 10 messages alternating direction, ~30 s
apart. Both `rig=6`. Logs saved 8 s apart. **All 10 messages delivered on both
sides**; the user noticed one missing read receipt, A→B.

### Finding F — lead 0 (session churn) did NOT fire. It is not the mechanism.

Across both logs: **zero `SESSION REPLACED`, zero `STALE init envelope
IGNORED`, zero `[DM-prune ui|send]`, zero `[DM-ack collision]`.** On a build that
carries every one of those probes, verified on both clients. The churn seen on
2026-07-26 was incidental to the reset, not the cause. **Demote lead 0.**

And yet B still failed 9 frames. So the failures happen with no session
replacement, no prune, and no stale-init refusal at all.

### Finding G — the real signature: A and B disagree about whether the session is confirmed.

The live A→B channel is inbox `QmRvBkFbk7`. Frame-by-frame, joined by fingerprint:

```
25 sent, 16 decrypted, 9 failed, 0 never arrived      (36% loss, one direction)
```

- **All 9 failures are init-wrapped** (`dr-replay.mjs`: `frame is an INIT
  envelope (carries user_address)`), delivered to the **session** inbox.
- **B's receive gate ran 36 times and took `InboxDecrypt` 36 times**
  (`sendingPubEmpty=false`, never once `Confirm`).
- **B→A is completely clean** — 22 branch decisions, zero failures. The failure
  is one-directional, as §2 predicted.

Map that onto the code and it is exact:

| side | gate | what it means |
|---|---|---|
| A, send | [`MessageService.ts:1183`](../../src/services/MessageService.ts#L1183) — `set.sending_inbox.inbox_public_key === ''` → `DoubleRatchetInboxEncryptForceSenderInit` | A's row says **unconfirmed** ⇒ force an init envelope |
| B, receive | [`MessageService.ts:4094`](../../src/services/MessageService.ts#L4094) — same predicate → `Confirm` vs `InboxDecrypt` | B's row says **confirmed** ⇒ route to `InboxDecrypt` |

**A thinks the session is unconfirmed; B thinks it is confirmed.** A force-inits,
B InboxDecrypts, the ratchet cannot open the frame, B logs *"skipping frame,
keeping session"* — and because B never installs the session, **A is never told
it is confirmed, so A force-inits again.** The disagreement is self-perpetuating
and nothing in the code repairs it. This is the desktop instance of the mobile
file `2026-07-24-dm-session-confirm-row-mismatch-x3dh-every-send.md`.

Note the frame is addressed to the **session** inbox, not the device inbox —
the force-init path reuses the row's existing target. That is why these frames
reach `InboxDecrypt` at all (and why §5's falsified premise mattered).

### Finding H — the failures are permanent and they accumulate

Failed frames arrive **2-3×** each (redelivered) and fail every time; successful
frames arrive exactly 1×. B's `skipped_keys_map` grows by exactly **one per
failure event** across the capture (skipped = 2 → 3 → 4 → 5 → 6). So every
failure permanently litters the ratchet with a skipped key and leaves an
undeletable frame cycling on the inbox.

### Finding I — RETRACTED. Seven targets per side is consistent with multi-device.

**This finding originally claimed "86% of all DM traffic is sent to inboxes
nobody reads". That claim was wrong and is withdrawn.** It is recorded here
rather than deleted because the reasoning error is the reusable part.

What was measured (this part stands):

```
A targets: QmRvBkFbk7 QmYTED4Bqs QmTCcmbzP6 QmZBRDjrJg QmbbgTUtcr QmdvayLzts QmfXtZttnf
B targets: QmYW3avfTD QmNsHYeYaA QmWHzJSMnF QmYTED4Bqs QmZBRDjrJg QmdvayLzts QmfXtZttnf
Targeted by BOTH senders:  QmYTED4Bqs QmZBRDjrJg QmdvayLzts QmfXtZttnf
```

Why the conclusion was wrong: **the test accounts have several devices connected,
and only two clients were captured.** DM fan-out addresses the peer's devices
*and* the sender's own other devices — [L1167](../../src/services/MessageService.ts#L1167)
filters out only `keyset.deviceKeyset.inbox_keyset.inbox_address`, i.e. *this*
device, not the rest of the account's. So seven targets per side is what a
multi-device account is supposed to produce, and a large overlap between A's and
B's target sets is *expected*, not anomalous: both are addressing the same shared
population of devices minus themselves. The five or six targets that carried no
traffic in this capture are simply the devices that were not open in front of the
reporter. Nothing in a two-client log can distinguish "dead row" from "device
that was not running".

**The error, stated generally, is the §5 lesson wearing a new hat:** *a capture
of 2 of N participants cannot support a claim about all N.* The inbox lists were
real; "read by nobody" was an inference about clients that were never observed.

**What survives, and it is the part that mattered:** the A→B failure measurement
is a fingerprint-join between the two clients that *were* captured, on the single
inbox both agreed on (`QmRvBkFbk7`). 9 of 25 frames failed there. Findings F, G,
H, J and K are untouched by this retraction.

**The open question this leaves:** whether *any* stale rows exist is now
unmeasured, not disproven. `[DM-send dup]` (rig=7) answers the sharper and more
useful version — whether the same tag appears twice in one send — and that is
what §8 fix 2 should be decided on. To measure the broader question properly
would need every device of both accounts capturing at once.

### Finding K — why the user saw no loss: a resend masks it, and that is dangerous

The obvious objection to finding G is *"if 36% was lost, why did all 10 messages
arrive?"* It was checked, not assumed. Classifying each of the 25 frames by the
call stack that produced it:

```
  4  FAIL  USER TYPED (DirectMessage.tsx)     <-- real messages, not just receipts
  3  FAIL  auto: delivery-timer / on-message-received
  2  FAIL  auto
  9  ok    USER TYPED
  7  ok    auto
```

**Four user-typed messages failed.** They arrived anyway because every failure is
followed by a success on the same channel within seconds:

```
fail 09:52:44 -> next ok 09:53:05   +20s
fail 09:53:50 -> next ok 09:54:13   +23s
fail 09:55:00 -> next ok 09:55:17   +17s
fail 09:55:40 -> next ok 09:55:42   +2s
fail 09:56:24 -> next ok NONE — 251s of silence, nothing recovered it
```

Eight of nine failures were covered. The **one that was not** is the last frame
of the capture, and it is an auto/receipt-origin frame — which is precisely the
**one missing read receipt the user reported**. The exception proves the rule.

**Strongly supported, not yet proven:** a resend carries the same payload and
covers the loss. Proving it needs the message id on both frames, which is exactly
what §8 fix 4 now logs (`msgId=`). Until a capture on `rig=7` shows a failed
frame's `msgId` reappearing on a later successful frame, treat this as the
leading explanation rather than an established fact.

**Two consequences that change what to do:**

1. **This is almost certainly the "laggy, frames land minutes late" symptom in
   §1.** The conversation is not slow; it is failing and retrying. Latency is the
   visible shadow of silent frame loss.
2. **DO NOT remove whatever is doing the resending before fixing the
   confirm-state mismatch.** The masking is a *resend seconds later*, not the
   multi-device fan-out — the recovery frames arrive 17-23 s after the failure,
   far too late to be part of the same send. Whatever retry that is, it is
   currently the only thing standing between this bug and visible message loss.
   Identify it before touching it.
   **Note the correction:** an earlier version of this list told the reader that
   de-duplicating `targetInboxes` would strip the masking. That conflated two
   different mechanisms — per-send fan-out and a delayed resend — and the timing
   above rules out the former. Whether the dedup is safe is simply
   **undetermined**, and `[DM-send dup]` on rig=7 is what decides it.

### Finding J — what is NOT yet explained

The failures are not uniform: they alternate in a strict rhythm — a **failing
pair**, then a **succeeding triple**, repeating, for the whole capture. If A's
row were simply stuck unconfirmed, all 25 frames would be init-wrapped and all 25
would fail. Something makes A alternate between the two branches at line 1183.

**Do not guess at this.** The rig cannot currently see it: there is no send-side
probe reporting which branch line 1183 took, or what the row's
`sending_inbox.inbox_public_key`/`tag`/`receiving_inbox` were. Add that probe
(§8 fix 4) and one short capture answers it. A hypothesis worth *testing*, not
asserting: [`MessageService.ts:1167`](../../src/services/MessageService.ts#L1167)
does not de-duplicate `targetInboxes`, and
[`MessageService.ts:1178`](../../src/services/MessageService.ts#L1178) resolves
each tag with `sets.find(...)`, which returns the **same first row** for a
repeated tag — so a duplicated tag re-encrypts one row twice from one starting
state. Whether that is what produces the pairs is unproven.

**A dead call-site hypothesis, recorded so nobody re-runs it:** the send stacks
for failing and succeeding frames are **identical**
(`MessageService.ts:1243` inside `runExclusive`). The failures do not come from a
different code path.

---

## §2c. The rig=7 capture — lead 0 FALSIFIED, and the probe had two holes

Protocol: both clients open, ~10 messages alternating, both `rig=7`, logs saved
9 s apart. **All messages landed; A's messages lagged noticeably toward the end.**
B logged 42 decrypt failures (16 distinct frames); A logged zero.

### Finding L — the send branch does NOT predict failure. Lead 0 is dead.

This was the whole point of rig=7, and it went against the hypothesis.
Restricting to the 38 frames A sent that **B actually received** (fingerprint
join, so no inference about unobserved clients):

```
   13  InboxEncrypt     -> FAILED
   15  InboxEncrypt     -> decrypted ok
    3  (no branch record) -> FAILED
    7  (no branch record) -> decrypted ok
   all of them on ONE inbox: QmRvBkFbk7
```

**Zero `ForceSenderInit` frames failed. The failures and the successes came from
the same branch, on the same inbox, in the same direction.** `sendingPubEmpty`
was `false` throughout — A considers that session confirmed, and so does B.

So §2b finding G was wrong. It read "the failing frames are init-wrapped"
(true, from replay) as "the sender took the force-init branch" (false). The SDK's
`DoubleRatchetInboxEncrypt` can itself emit an init-wrapped frame; wire shape does
not identify the branch. **Retract lead 0 as the discriminator.** The two sides
agreeing that a session is confirmed does not stop ~40% of frames failing.

### Finding M — the rig=7 probe was defective. Two holes, and one bad reading.

Recorded in full because the failure mode is the reusable part.

1. **Only one of the two send paths was instrumented.** DM frames leave through
   two structurally identical encrypt loops that were never de-duplicated:
   `MessageService.encryptAndSendDm` (reactions, edits, deletes, read-acks) and
   `ActionQueueHandlers.sendDm` (**the primary text path**). The probe went into
   the first only. That is exactly the "no branch record" column above — not
   missing data, a whole function with no instrument on it. Fixed in rig=8 by
   moving the probe into one shared helper called from both loops.
2. **`msgId` and `type` logged `undefined` on every line**, because the probe
   read `messageContent.messageId` and these payloads carry the id under
   different keys per call site.
3. **Consequence — a wrong reading was produced and must not be reused.** An
   analysis pass over that data reported *"13 failures, 13 masked by a resend, 0
   permanently lost"*. That is an **artifact**: every frame shared the same
   `undefined` id, so every frame matched every other as "the same message". The
   §2b finding K question — does a resend cover the loss — is **still
   unanswered**. rig=8 is what answers it.

### Finding N — §2b finding I's retraction is now positively confirmed

Not merely "unmeasurable" — measured. Of A's seven targets, **B received frames
on exactly one** (`QmRvBkFbk7`, the live session inbox). The other six were never
received by B *and every frame to them used `ForceSenderInit`* — precisely what
rows for other devices that have never replied should look like. The seven-target
fan-out is normal multi-device behaviour, as the user said. Nothing is wasted;
the other six simply belong to devices that were not part of this capture.

### Finding O — the duplicate-encrypt hypothesis is dead

`[DM-send dup]` fired **zero** times across ~490 frames on a build that carries
it. `targetInboxes` contained no repeated tag. §2b finding J's proposed mechanism
is retired, and §8 fix 2 is confirmed to be a **no-op** on this evidence rather
than a risky change. The probe stays armed so the conclusion is continuously
re-verified.

### What is left standing

- Frames fail AEAD on a live, mutually-confirmed session, **one direction only**,
  at roughly 40%. B→A had zero failures in the same capture.
- No session churn, no prune, no stale-init refusal, no duplicate encrypt.
- Failed frames redeliver (2-5×) and fail every time.
- All user messages arrived, and **A's messages lagged** — the symptom §2b
  finding K predicted, still unproven as to mechanism.

### The next question, and the signal added to answer it

If both sides agree the session is confirmed and the branch is identical, the
remaining candidate is that **A's sending ratchet forked** — two frames leaving
at the same chain position, of which the peer can only ever open one. Nothing in
the rig has ever been able to see the chain position. rig=8 adds it:
`sLen=<before>-><after>` on every `[DM-send branch]` line.

**Read it like this:** if two frames to the same inbox ever leave with the same
`sLen` *before* value, the ratchet forked and that is the mechanism. If `sLen`
increments cleanly 1,2,3… across every frame and failures still occur, the fork
theory dies too and the remaining suspect is upstream (§4.3) — at which point
the `dr-replay.mjs` evidence and the 40% one-directional loss should go to
issue #183, which is where the lead dev reads.

---


---

## §5. RETRACTED — argued confidently on 2026-07-26, then disproved

**Claim:** *"Desktop's receive path dispatches on its own stored state rather
than the arriving frame's shape, so an init envelope from an unconfirmed peer is
routed to `DoubleRatchetInboxDecrypt`, fails AEAD forever, and deadlocks the
conversation permanently."*

**Why it was wrong:** the SDK's `DoubleRatchetInboxDecrypt` already detects
`user_address` and unwraps the inner message before decrypting, and the two SDK
functions have complementary preconditions that desktop's predicate matches
exactly. Independently refuted by a reviewer, which also found that an
unconfirmed sender addresses its frames to the *device* inbox, so they never
reach that branch at all.

**The retraction STANDS, and is now confirmed by measurement rather than by
argument** (2026-07-27, §2a finding C). Offline replay of two real failures shows
an init-wrapped frame routed to `InboxDecrypt`, unwrapped correctly
(`[1] unseal: OK`, `frame is an INIT envelope`), and failing only afterwards at
the ratchet step. Routing was never the problem.

**But one supporting claim in the paragraph above is now FALSIFIED, and it
matters:** *"an unconfirmed sender addresses its frames to the device inbox, so
they never reach that branch at all."* Both failing frames were init-wrapped and
arrived on the **session** inbox (`QmRvBkFbk7`), not the device inbox. So
init-wrapped frames **do** reach the `InboxDecrypt` branch. That branch handles
them correctly, so the conclusion is unaffected — but do not reuse the premise.
Anything else resting on "init-wrapped ⇒ device inbox" needs rechecking.

**How it happened:** the mechanism was built from app code plus doc claims and
presented as settled before reading the protocol authority (the SDK). The log
evidence was sound; the interpretation ran ahead of it.

**The lesson, which cost real time twice today:** *absence of a log line is not
evidence of absence of an event until you have checked that the line covers
every path the event can take.* Two destructive paths were invisible during the
failing capture — the stale-init refusal (downgraded to `debug` three days
earlier) and all four prune sites. A third variant: **a capture stopped too
early scores in-flight frames as losses.** A "5-frame loss" on 2026-07-26 was
purely capture truncation; the frames arrived after the log was saved.

---


---

## §2d. The rig=8 capture (2026-07-27) — first controlled message loss

Protocol: both clients open, 10 messages alternating, both `rig=8`, logs saved
8 s apart. **A2 and A10 (from user A) never arrived.** A's messages lagged
throughout. A logged 6 decrypt failures, B logged 48.

This is the first round in which **real user messages were lost under
observation**, rather than lost-and-silently-resent.

### Finding P — the lost messages were INVISIBLE to the rig

**Zero `type=post` frames appear in either send-branch log.** The capture whose
purpose was to explain lost posts contains no record of a post being sent.

Cause: there are **five** `DoubleRatchetInboxEncrypt*` call sites, and rig=8
instrumented two of them.

| # | site | mutex? | rig=8 | ran in this capture |
|---|---|---|---|---|
| 1 | `MessageService.encryptAndSendDm` (reactions, edits, deletes, acks) | ✅ L1156 | ✅ | yes — all 182 records |
| 2 | `MessageService.submitMessage` | ✅ L3199 | ❌ | **yes — this is where A2/A10 went** |
| 3 | `MessageService.submitMessage` (acks-piggybacked variant) | ✅ L3388 | ❌ | probably |
| 4 | `MessageService.retryDirectMessage` | ✅ L6840 | ❌ | probably — see finding K |
| 5 | `ActionQueueHandlers.sendDm` (offline-composed) | ❌ **none** | ✅ | **no** — `[ActionQueue:sendDm]` never logged |

All five now log in rig=9, each with its own `site=`.

### Finding Q — RETRACTED IN THE SAME SESSION: "the ratchet forked"

**Claim made and withdrawn within minutes.** The rig=8 data showed one target's
`sLen` returning to 0 seven times, which was read as seven forked ratchets.

**It is not a fork.** `current_sending_chain_length` **resets to 0 on every DH
ratchet step** — that is the Double Ratchet working exactly as specified. The
peer replied seven times, so there were seven DH steps. The same logs carry
`previous_sending_chain_length` values of 7 and 4, which is that mechanism
announcing itself.

**Why it was wrong:** the probe was designed to test for a fork and then the
first pattern that *looked* like one was accepted, without checking whether the
protocol produces that pattern legitimately. Same failure mode as findings G and
I: a measurement was real, the interpretation ran ahead of it.

**What a valid fork test requires:** two frames sharing **(target, epoch, sLen)**.
The epoch is the DH generation, identified by the ratchet root key, which changes
exactly once per DH step. rig=9 logs `root=` for this. `(target, sLen)` alone is
meaningless and must never be used again — the helper says so at the point of use.

### Finding R — a real latent defect: the offline send path takes no ratchet lock

`ActionQueueHandlers.ts` contains **zero** `dmRatchetMutex` calls.
`MessageService.ts` guards the same read → encrypt → save section in **six**
places, and the comment at
[MessageService.ts:1141-1153](../../src/services/MessageService.ts#L1141)
describes precisely the failure an unguarded version causes: *"two concurrent
callers reading the same state fork the ratchet (the losing save is silently
erased and the peer can no longer derive keys for the erased branch →
aead::Error on every subsequent frame)"*.

**Scope, honestly:** that path handles offline-composed DMs and **did not run in
this capture**, so it is not this bug's cause. It is a genuine latent defect
found while looking for something else, and it should be fixed on its own merits.

### What the rig=8 data does show, still unexplained

Failures cluster at the **start of each sending chain**: frames at `sLen 0->1`
and `1->2` failed repeatedly, frames at higher positions in the same chain
succeeded. Across ~7 chains and both directions.

That shape — the first frames after a DH step failing, later ones surviving — is
close to the known upstream crate behaviour already recorded in §2 (*"a receiver
whose first processed frame sits at position ≥2 has the sender's direction
permanently dead; position 1 self-heals after one loss"*). **Not yet a claim.**
rig=9 tests it with the epoch attached.

---

## §2e. The rig=9 capture (2026-07-27) — the mechanism, measured

Protocol: both clients open, alternating messages, both `rig=9` (all five send
sites instrumented). **All messages delivered; some arrived late in tight
back-and-forth.** User also reported, across all four rounds, that the **typing
indicator shows at the wrong time** — you don't see the peer typing, then their
indicator appears a turn later while you are typing.

A: 287 send-branch records (217 `encryptAndSendDm`, 70 `submitMessage*`),
30 decrypt failures. B: 294 records, 35 failures.

### Finding S — there is NO forked ratchet. Definitively.

With the DH epoch attached, the valid fork test finally ran:

```
A: 287 frames, 287 distinct (target, root, sLen)   -> no fork
B: 294 frames, 294 distinct (target, root, sLen)   -> no fork
```

Every frame occupies a unique position in a unique epoch. **Lead 0b is dead**,
and with it the last hypothesis that pointed at our locking.

### Finding T — failure is a pure function of POSITION IN THE SENDING CHAIN

This is the cleanest signal the investigation has produced.

| position in chain | A→B failure rate | B→A failure rate |
|---|---|---|
| **0** | **100%** (0 ok / 7 failed) | **100%** (0 ok / 8 failed) |
| **1** | **86%** (1 / 6) | **100%** (0 / 7) |
| **2** | 67% (1 / 2) | 60% (2 / 3) |
| 3 | **0%** (7 / 0) | **0%** (5 / 0) |
| 4 | **0%** (4 / 0) | **0%** (3 / 0) |
| 5-8 | **0%** | **0%** |

**The first two or three frames after every DH ratchet step fail. Everything from
position 3 onward succeeds, in both directions, without exception.**

### Finding U — the failures are TRANSIENT; the frames decrypt on redelivery

| direction | failed then later decrypted | never decrypted |
|---|---|---|
| A→B | **19** | **0** |
| B→A | **19** | 3 (2 read-ack, 1 delivery-ack — likely capture truncation) |

So the retained-frame + redelivery path *is* the recovery mechanism, and it works.
This retires the §2b finding K question: nothing exotic is masking the loss, the
frames simply arrive, fail, and succeed on a later attempt.

### Finding V — this explains every symptom the user reported, exactly

**The typing indicator inversion.** `typing-start` is the *first thing sent after
reading the peer's message*, and reading the peer's message is what triggers the
DH ratchet step. So `typing-start` is almost always at **position 0 of a fresh
chain — the 100%-failure slot.** Measured: 7 of A's typing-starts and 7 of B's
sat at position 0, and all of them failed and recovered late. The indicator the
peer eventually sees is the *redelivered* frame, landing a turn later — which is
precisely the "opposite of what should happen" the user described.

**"All messages delivered, but tight conversation lags."**

| direction | posts ok first try | posts LATE | posts lost |
|---|---|---|---|
| A→B | 5 | **5** | **0** |
| B→A | 5 | **4** | **0** |

**Half of all real messages arrive late**, none were lost this round. A post sent
after a pause sits at position 3+ (typing/ack frames consumed 0-2) and succeeds;
a post fired off quickly in a tight exchange sits at a low position and is
delayed. The user's "some lag in tight convo" is this table.

### What this points at

The receiver cannot open the first frames of a new DH sending chain on first
attempt, but opens the same bytes on a later attempt. App code does not implement
the ratchet — it hands frames to `DoubleRatchetInboxDecrypt`. **This is below the
app layer**, and it is adjacent to the upstream behaviour already recorded in §2
(*a receiver whose first processed frame sits at position ≥2 has the sender's
direction permanently dead; position 1 self-heals after one loss*) — though ours
is transient rather than permanent, so it is related, not identical.

**Do not call this proven upstream yet.** The honest statement is: the failure is
a deterministic function of DH-chain position, recovers on redelivery, occurs
symmetrically in both directions, and is not explained by any app-level mechanism
tested across four rounds. The `[XPDUMP]` records for these failures are the
material to settle it — replay a position-0 frame against the real wasm and
determine whether the core can be made to open it without the redelivery.

### Probe defect worth noting

An analysis pass initially reported "no `post` frames at all" and drew a
conclusion about posts from an empty set. Cause: the analysis regex used
`site=(\w+)`, and `\w` excludes hyphens, so every `site=submitMessage-acks` line
was silently dropped. The probe was fine; the reader was wrong. **Analysis
scripts need the same scepticism as probes — an empty result is a claim about
your regex before it is a claim about the system.**

---

## §2f. Offline replay + SDK reading (2026-07-27) — one real defect, one near-miss

### Finding W — `sent_accept` never reaches the SDK, so EVERY DM frame is init-wrapped

**Confirmed in code and in captured data. This is ours.**

The SDK decides frame shape on one field
([channel.ts:988](../../../quilibrium-js-sdk-channels/src/channel/channel.ts#L988)):

```ts
const ciphertext = state.sent_accept
  ? js_encrypt_inbox_message({ ... plaintext: envelope.envelope })   // plain DR frame
  : js_encrypt_inbox_message({ ... plaintext: JSON.stringify({       // INIT-WRAPPED
      return_inbox_address, return_inbox_encryption_key,
      return_inbox_public_key, return_inbox_private_key,
      user_address, identity_public_key, tag,
      display_name, user_icon, message: envelope.envelope,
    }) });
```

Our send path never supplies it. `orderSessionsForSend` builds its session objects
with `JSON.parse(r.state)`, and `sent_accept` is **not in that JSON** — it is a
sibling DB column (`sentAccept`), written on save and never merged back on read.

Verified against real capture data, not just by reading: across 12 `[XPDUMP]`
state blobs the top-level keys are exactly

```
ratchet_state   receiving_inbox   sending_inbox   tag        (12/12, no sent_accept)
```

So `state.sent_accept` is `undefined` on **every send**, the SDK always takes the
`else` branch, and **every DM message this app sends is wrapped in an
InitializationEnvelope** carrying the session setup material (return inbox keys,
identity public key, display name, icon) instead of just the ratchet envelope.
The client re-announces setup on every frame rather than only until the session
is established. **The cost is payload size on every DM, and protocol tidiness.**

> ⚠️ **CORRECTION (2026-07-27, same day).** An earlier version of this finding —
> and of the fix commit message — described this as "shipping a private key in
> every frame", which reads as a disclosure bug. **That was wrong.** Both
> branches of the ternary wrap their payload in `js_encrypt_inbox_message`,
> sealed to the recipient's inbox encryption key, so the setup material is
> encrypted in transit exactly like message content and is readable only by the
> intended peer. The `return_inbox_private_key` is a per-session write credential
> the protocol deliberately hands that peer so it can sign frames to the inbox;
> it is not an identity or account key, and nothing here is exposed to the
> network. Severity is **low** — efficiency and correctness, not security.
>
> How the error happened, since it is instructive: the replay output was read as
> `frame is an INIT envelope (carries user_address)` and the presence of key
> material in that structure was reported without checking what wrapped it. The
> contradiction was in the same output — the tool prints `[1] unseal: OK`
> *before* it can identify the envelope, which is only possible because the
> payload was encrypted. **Evidence that disproves a claim is worth nothing if
> you stop reading at the line that supports it.** Caught by the user pushing
> back on the claim rather than accepting it.

The receive side handles the wrapping correctly (unwraps, then ratchet-decrypts
the inner envelope), which independently re-confirms the §5 retraction.

### Finding X — NEAR-MISS: "all 24 failures are init-wrapped" proves nothing

Offline replay of every failing frame in the rig=9 round:

```
A: 12/12 failures — unseal OK, frame is an INIT envelope, ratchet FAILED
B: 12/12 failures — unseal OK, frame is an INIT envelope, ratchet FAILED
```

24 of 24, both directions. That looks like a smoking gun and **is not one.**
By finding W, *every* frame is init-wrapped — successes included. Init-wrapping is
a **constant, not a discriminator**, and a constant cannot explain a failure that
only affects positions 0-2.

This was one inference away from becoming the ninth dead hypothesis. The tell was
asking "what would the successful frames look like?" — and the answer, from the
SDK source, was "identical". **When a property holds for 100% of failures, check
whether it also holds for 100% of successes before calling it a cause.**

### What the replay DOES establish

- The failure **reproduces deterministically** against the real wasm core using
  the real captured state. It is not an app-level race, a serialization artifact,
  or a timing effect.
- The outer seal opens every time; only the ratchet step fails.
- Receiving states carry **20-23 skipped keys**, i.e. a large accumulated backlog
  of frames never opened in order.

Position 0-2 failure remains unexplained, and still points below the app layer.

### Untested hypothesis, recorded so it is not lost

On the init-wrapped path the SDK returns a `sending_inbox` built from the
**envelope's** `return_inbox_*` fields, and the receive path saves it. Since every
frame is init-wrapped (finding W) and failed frames redeliver repeatedly, a
**redelivered old frame may overwrite the receiver's `sending_inbox` with values
from an older envelope.** Not observed, not claimed — but it is a concrete way
constant init-wrapping could interact with redelivery, and it is cheap to probe.

---

## §2g. The rig=10 CONTROLLED EXPERIMENT (2026-07-27) — frame shape is irrelevant

The first round in this investigation that changes one variable and re-measures,
rather than adding observation. Build = rig=9 probes **plus the `sent_accept`
fix**, so frames are no longer init-wrapped. Everything else identical.

### The manipulation worked

```
rig=9  (before fix): 12 of 12 sampled failing frames carry user_address
rig=10 (after fix):   0 of 12 sampled failing frames carry user_address
```

Init-wrapping is gone from the wire. This is also the first independent
confirmation that finding W's fix does what it claims.

### Finding Y — the position table is UNCHANGED. Shape does not matter.

| position | A→B rig=9 | A→B rig=10 | B→A rig=9 | B→A rig=10 |
|---|---|---|---|---|
| 0 | 100% | **100%** | 100% | **100%** |
| 1 | 86% | **100%** | 100% | **100%** |
| 2 | 67% | **100%** | 60% | **75%** |
| 3 | 0% | 40% | 0% | 20% |
| 4 | 0% | 0% | 0% | 20% |
| 5+ | 0% | **0%** | 0% | **0%** |

Same structure, both builds, both directions: **early positions fail, later
positions never fail.** Removing the one app-controlled property of the frame
changed nothing about which frames fail.

Overall per-frame failure rate is also unchanged — A→B was 15 of 31 received
frames (48%) at rig=9 and 17 of 38 (45%) at rig=10. *(The raw `DM decrypt failed`
line count rose from 30→42 and 35→52, but that counter includes redeliveries;
de-duplicated by fingerprint the rate is flat. Another instance of the §2 rule:
always de-duplicate before comparing volumes.)*

The failure window looks about one position wider at rig=10, but each cell holds
only 4-5 frames, so that is **within noise and must not be read as the fix making
things worse.** A larger round would be needed to claim any difference.

### What this eliminates

**Frame shape is not a variable in this failure.** Init-wrapping was the last
app-controlled property of an outgoing frame that could plausibly have mattered,
and it has now been experimentally removed with no effect. Combined with the nine
already-dead app-level hypotheses (entry point §3), the app has essentially been
exhausted as an explanation.

### Delivery outcome

`A10` (a real message) was **lost for good** — 1 post, A→B, never decrypted on
any redelivery. B→A lost nothing. Lag and the inverted typing indicator behaved
exactly as in previous rounds.

| direction | posts ok | posts late | posts LOST |
|---|---|---|---|
| A→B | 6 | 3 | **1** |
| B→A | 8 | 2 | 0 |

### Verdict on the fix

**Safe to merge.** Delivery behaviour is indistinguishable from the previous
round, per-frame failure rate is flat, and no new failure mode appeared. The
redundancy concern raised before the round (that init-wrapping might be
compensating for early-chain loss) is **not supported** — removing it changed
nothing, because recovery comes from redelivery, not from re-announcement.

### Verdict on the bug

This is the strongest evidence yet that the cause is **below the app layer**.
The remaining action is the write-up for
[#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183), carrying
the position table from two independent builds and the fact that frame shape was
experimentally excluded.

---

## §2h. The rig=11 regression round (2026-07-27) — all three fixes merged

First round against `main` carrying all three client fixes: `sent_accept`
restored, the init-envelope age bound scoped to the no-rows case, and the offline
send path holding the ratchet lock.

### Finding Z — no regression, and the underlying bug is untouched

| | rig=10 (1 fix) | rig=11 (3 fixes) |
|---|---|---|
| position 0-2 failure | 100% | **100%** |
| position 4+ failure | ~0% | **~0%** |
| forked ratchet | none (539/539) | **none (567/567)** |
| posts lost | 1 (A→B) — *see correction* | **0** (`B10` arrived after the capture) |
| `STALE init envelope IGNORED` | 0 | **0** |
| `SESSION REPLACED` / prune / send-dup | 0 | **0** |

The three fixes are orthogonal to the position mechanism and the data says so:
nothing moved. Critically **zero** stale-init refusals, which is the probe that
would have caught the age-bound change misfiring.

**The age bound is NOT exercised by this round at all** — it only fires when a
client has been offline past the window. Confirming that fix needs the original
protocol: close one client, reset and send one message from the peer, wait 15+
minutes, reopen. Recorded so nobody reads this round as validating it.

### Finding AB — CORRECTION: `B10` was not lost. It arrived minutes after the capture.

Reported lost during the round and scored as `LOST-FOR-GOOD` by the analysis,
because it never decrypted inside the saved log. **It then arrived on its own,
after both logs were saved.** So this round lost nothing; redelivery recovered
every single post.

**This invalidates waiting-in-the-capture as a test for loss, at any length the
operator will tolerate.** The written protocol said 5 minutes; the operator was
in fact saving at ~2 minutes in **every** round, because these rounds are tedious
and long waits do not get done. Both numbers are too short — this recovery
outlasted the entire tail of the round.

The fix is not a longer wait. It is to stop asking the capture that question:
save at 2 minutes, then glance at the conversation 20-30 minutes later. That
costs no attention and is the only way loss has ever actually been established
here. §6 now says so.

**Also note what the short window does NOT damage.** The position table measures
whether a frame fails on its FIRST delivery attempt, which is independent of how
long anyone waits afterwards — so the core result stands unaffected. What the
short window makes unreliable is only the split between "recovered late" and
"never recovered": every recovery count in this file is a LOWER BOUND.

**It also puts the earlier loss claims in doubt.** `A10` (rig=8) and `A10`
(rig=10) were both recorded as permanently lost on exactly this evidence — absent
from the log window, never rechecked afterwards. They were probably late too.
**Treat "posts lost" in every round before this one as unverified**, and re-read
those tables as "not yet arrived when we stopped looking".

The one loss that is NOT in doubt is `age-test-1` (finding A): the init-envelope
guard **deleted that frame server-side**, so there was nothing left to redeliver.
Deletion is permanent in a way that failing to decrypt is not — which is exactly
why that guard was the fix worth shipping.

**Net effect on severity:** this is a latency bug with a very long tail, not
(so far as anything measured shows) a message-loss bug. The user-visible harm is
lag, an inverted typing indicator, and messages that arrive so late they are
assumed lost.

### Finding AA — a second device on one account made no measurable difference

Account B had a mobile client online for the first half of the round (through
post 5), giving a natural before/after:

| direction | mobile ONLINE | mobile OFFLINE |
|---|---|---|
| A→B | 7/18 failed (39%) | 10/23 failed (43%) |
| B→A | 7/19 failed (37%) | 13/21 failed (62%) |

A→B is flat. B→A looks worse *without* the extra device, which is the opposite of
"the extra device causes trouble", and with ~20 frames per cell it is noise.
**No evidence the second device matters.** Worth knowing because multi-device was
a live suspicion earlier (§3 row 6) and this is the first time it has been
directly, if accidentally, tested.

Session fan-out stayed at 7 inboxes throughout — rows persist whether a device is
online or not — so the disconnect is invisible in the fan-out and had to be split
by time.

### Note on test cadence

The operator believed messages were 3-7 s apart; measured post-to-post intervals
were **12-18 s alternating**, i.e. ~30 s per side. Recorded because the mechanism
predicts that *faster* exchange is *worse* — every reply triggers a DH step, so a
tighter conversation spends proportionally more frames at chain positions 0-2.
A genuinely rapid round is therefore an untested and probably harsher case.

---

## §2i. The reset round (2026-07-27) — THE POSITION LAW IS NOT A LAW

Protocol: both clients `rig=11` (all three fixes), **one-sided reset**, then 5
messages each. Operator report: *"all msg delivered, no lags, no issues"*, and a
mobile client on account B showed everything **in real time**.

### Finding AC — a fresh session does not exhibit the failure

| chain position | A→B pre-reset (rig=11) | A→B **post-reset** | B→A pre-reset | B→A **post-reset** |
|---|---|---|---|---|
| 0 | 100% | **29%** (2/7) | 100% | **0%** |
| 1 | 100% | **0%** | 100% | **0%** |
| 2 | 100% | **0%** | 100% | **0%** |
| 3 | 75% | **0%** | 100% | **0%** |

Client A logged **0 decrypt failures** this round, against **60** in the previous
one. B logged 5, of which 3 were leftover frames arriving on the *old* session.

**This is not a sampling artifact.** Pre-reset, positions 0-2 were 12 received
and 12 failed. Post-reset, the same positions were 15 received and 2 failed. The
2 remaining failures were `read-ack` frames at position 0 and both recovered.

### Finding AD — "positions 0-2 always fail" was a property of an AGED session

§2e stated the failure as a deterministic function of chain position. **That
framing is wrong and must be corrected wherever it appears**, including upstream.
Chain position is where the failure *lands*; it is not what *causes* it. A fresh
session shows the same positions behaving normally.

The state fingerprints from this round make the difference visible. B's three
old-session failures replay against:

```
state: root=441307d1 sLen=10 pS=7 rLen=11 skipped=37     <- the aged session
```

while the new session's two failures sit at:

```
state: root=3746edc4 sLen=0 pS=4 rLen=1 skipped=2
state: root=b26aed02 sLen=0 pS=4 rLen=1 skipped=4
```

**`skipped` is the accumulated skipped-keys map.** Across the day it grew 2 → 20
→ 23 → **37**, and the failure rate grew with it. After a reset it is back to
single digits and the conversation is clean.

### Hypothesis, explicitly NOT a conclusion

A session degrades as its skipped-keys map grows, and it grows *because* of these
failures — each undecryptable frame leaves a gap behind. That is a positive
feedback loop, and it would explain the oldest observation in this file: **"works
after a reset, breaks again after days of use."**

**Do not treat this as established.** `skipped` is confounded with session age,
number of DH epochs, and total traffic; and because failures *create* skipped
keys, cause and effect are circular on this evidence alone. What is established
is the negative result: **a fresh session does not fail, so nothing about chain
position alone is sufficient to cause the failure.**

The test that would separate them: age a session deliberately (or replay one
forward) and see whether failure rate tracks `skipped` independently of elapsed
time. Offline replay can do this with no device time.

### What this does NOT change

- Redelivery still recovers; nothing was lost this round.
- The three merged fixes remain sound — this round is also their cleanest run.
- The asymmetric-state window opened by the `sent_accept` fix **did not fire**:
  `branch=Confirm` appeared (so the state was genuinely entered, unlike rig=11
  where it never occurred) and there were **zero** `invalid initialization
  envelope` errors. That fix is now validated on the path that stresses it.

---

## §2j. ROOT CAUSE — the skipped-keys bucket under the CURRENT receiving header key

Offline ablation, no device time. Method: take a real captured failure, change
**one** property of the ratchet state, re-run the identical decrypt against the
real wasm. Tool: `.agents/tools/dm-debug/dr-ablate.mjs` (in this repo).

### Finding AE — 63 of 65 captured failures decrypt once one bucket is removed

**65 failures, 6 independent capture rounds, both clients:**

| variant | decrypts |
|---|---|
| baseline (exactly as captured) | **0 / 65** |
| `skipped_keys_map = {}` | **63 / 65** |
| **drop ONLY `skipped_keys_map[current_receiving_header_key]`** | **63 / 65** |
| drop ONLY the *next*-recv-header bucket | 0 / 65 |
| keep only the current-recv-header bucket | 0 / 65 |
| `previous_sending_chain_length = 0` | 0 / 65 |
| `current_receiving_chain_length = 0` | 0 / 65 |
| swap current ↔ next receiving header key | 0 / 65 |

**It is not "fewer keys is better".** In a representative case the map held 62
keys across 20 buckets, and the poisoning bucket held **3**. Deleting those 3
makes the frame decrypt; deleting the other 59 changes nothing. The frame, the
state and every other field are byte-identical between the failing and succeeding
runs.

Split by load: **59 of 59** failures on a map with ≥20 keys recover; 4 of 6 on
small maps do. The 2 that never recover are on near-empty maps and are most
likely genuine replays.

### What the bug is

When the skipped-keys map contains a bucket indexed by the receiver's **current**
receiving header key, the crate's decrypt path takes that bucket and fails,
instead of falling through to normal chain-key derivation. The message key it
needs is derivable; it just never gets there.

### Why this explains everything on file

- **Fresh session works, aged session fails** (finding AC) — a fresh session has
  no such bucket.
- **A reset fixes it** — the reset discards the map. This is the oldest
  observation in this investigation and it now has a mechanism.
- **Positions 0-2 fail, 3+ never do** (finding T) — the early positions of a new
  chain are exactly where the receiver consults skipped keys after a DH step.
  Position is where the bug *lands*; the bucket is what *causes* it.
- **It degrades over days** — every undecryptable frame leaves another skipped
  key behind, so the bucket refills. A genuine feedback loop.
- **Redelivery recovers** — later state has moved on and the poisoning bucket is
  no longer under the current header key.

### Minimal reproduction for upstream

1. Any Double Ratchet state whose `skipped_keys_map` has an entry under
   `current_receiving_header_key`.
2. `js_double_ratchet_decrypt(state, frame)` → `Decryption failed: aead::Error`.
3. Delete **only** that one bucket, leave everything else byte-identical.
4. Same call → decrypts correctly.

### Caveats, stated plainly

This identifies **where** the failure is produced, not the defective line in the
crate. The ablation shows the bucket is load-bearing; reading the crate's skipped
-key lookup is what will show why. Ablation also cannot rule out that the bucket
contents are themselves wrong (written badly earlier) rather than the lookup
being wrong — both are consistent with this data, and both are upstream.

---

## §2k. Synthetic corroboration (2026-07-27) — a FRESH session cannot be made to fail

Tool: [`dr-position-table.mjs`](../../tools/dm-debug/dr-position-table.mjs). Builds
pristine sessions from real X3DH material and drives the real wasm through six
delivery regimes, scoring first-attempt failure by chain position — the same
quantity the live rig measures. No device time, no logs, seconds per run.

### Finding AF — 1920 synthetic frames, zero failures at every position

| regime | pos 0 | pos 1 | pos 2 | pos 3+ |
|---|---|---|---|---|
| strict alternation, 1 frame/turn | 0% | — | — | — |
| strict alternation, 4-frame burst | 0% | 0% | 0% | 0% |
| crossing sends, 1 frame/turn | 0% | 0% | — | — |
| crossing sends, 4-frame burst | 0% | 0% | 0% | 0% |
| crossing + reordered delivery | 0% | 0% | 0% | 0% |
| strict alternation + reordered | 0% | 0% | 0% | 0% |

20 independent runs of the most realistic regime: **0/20 showed any failure.**

**This was run before §2j existed and read at the time as a puzzle. It is not
one.** Every session the harness builds is FRESH, so its skipped-keys map never
develops the poisoning bucket finding AE identifies. The harness was testing the
one condition under which the bug is known not to fire. **Finding AF is therefore
independent synthetic corroboration of finding AC, and nothing more.**

> ⛔ **Do not cite AF as evidence the crate is clean.** It measures a fresh
> session. Both AC (real devices, post-reset) and AF (synthetic) say the same
> thing: no accumulated map, no failure.

### Finding AG — init-wrapping cannot affect the inner decrypt, by construction

Established by *reading* [`channel.ts:976-1043`](../../../quilibrium-js-sdk-channels/src/channel/channel.ts#L976),
not by measuring. In `DoubleRatchetInboxEncrypt` the inner `DoubleRatchetEncrypt`
call happens at L987, **before** the `state.sent_accept` branch at L988, and its
result is identical on both sides of it — only the outer `js_encrypt_inbox_message`
sealing differs.

So the init-wrap/plain choice **structurally cannot** change the inner ratchet
ciphertext. This corroborates the rig=10 controlled experiment (finding Y) from a
completely different direction, and it is cheaper: a code read, not a capture
round. Worth remembering as a method — the TypeScript half of the SDK is readable
and several questions that were answered with device time were answerable there.

### Finding AH — a responder that sends before receiving forks PERMANENTLY

Scenario X in the script, included only because it is fork-shaped. If the
responder encrypts before it has ever decrypted anything, its entire first burst
(4/4 frames) is undecryptable and **never recovers** across any number of
redeliveries — unlike every failure in this investigation, which is transient.

**The app cannot reach this state** (a responder learns a conversation exists by
receiving), so this is not a cause of anything on file. Recorded because it is
adjacent to [#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183)
item 1, and because a permanent fork produced from clean X3DH material in four
lines of driver code may interest the lead.

### The experiment this tool is now positioned to run — NOT YET BUILT

§2i names the open test and this harness is the natural place for it:

> *age a session deliberately (or replay one forward) and see whether failure
> rate tracks `skipped` independently of elapsed time.*

Captured evidence cannot separate those confounds, because failures also create
skipped keys. A **synthetic** harness can, because it controls both independently:
grow the map without ageing the session, age the session without growing the map.
That would turn the feedback-loop hypothesis in §2i into a conclusion or kill it,
and it would test whether the poisoning bucket ever arises **naturally** or only
appears in states that got there by some other route.
