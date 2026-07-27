---
type: bug
title: "DM delivery broken again on desktop↔desktop (the 2026-07-02 master report is NOT closed)"
status: OPEN, but the MECHANISM IS NOW MEASURED (rig=9, 2026-07-27). Frame decryption failure is a DETERMINISTIC FUNCTION OF POSITION IN THE DH SENDING CHAIN: position 0 fails 100%, position 1 ~90%, position 2 ~60%, position 3+ never fails — both directions. Failures are TRANSIENT; the same bytes decrypt on redelivery. This explains every reported symptom, including the inverted typing indicator (typing-start always lands at position 0) and 'messages arrive late in tight conversation' (half of all posts arrive late). No forked ratchet exists (proven with the DH epoch attached). EIGHT app-level mechanisms have now been proposed and killed (§3). The remaining explanation is below the app layer; the next step is offline replay of a position-0 frame, NOT another capture. Two defects of ours are separately confirmed and owed (§7 fixes 1 and 2).
created: 2026-07-26
severity: high (silent, user-visible message and reaction loss)
repo: quorum-desktop (cross-repo — mobile shares the accounts and the upstream causes)
area: DM Double Ratchet / session lifecycle / transport
entrypoint: true
related:
  - ".agents/bugs/2026-07-26-dm-desktop-to-desktop-captures.md (ALL round evidence, findings A-R — this file cites it by letter)"
  - ".agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md (mechanism catalogue — filed as solved, but the symptom RESURFACED; read it for history, not status)"
  - ".agents/docs/dm-ratchet-upstream-divergences.md (the 8 shipped divergences, lead-dev facing)"
  - ".agents/tasks/2026-07-17-dm-dead-session-autoheal.md (heal action 2 is exactly this failure)"
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md (DM internals)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md (3000-line master, rounds 1-29)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-session-confirm-row-mismatch-x3dh-every-send.md (authoritative SDK reading)"
  - "https://github.com/QuilibriumNetwork/quorum-mobile/issues/183 (the two UPSTREAM causes — not fixable here)"
---

# DM delivery is broken again, desktop↔desktop

> **START HERE if you are a fresh agent.** Three things you would otherwise get
> wrong in your first ten minutes:
>
> 1. **`.solved/2026-07-02-dm-message-delivery-unreliable-master.md` is filed as
>    SOLVED and the symptom has RESURFACED.** Good catalogue, bad status report.
> 2. **The mobile master says "desktop↔desktop has no issues."** Falsified.
> 3. **Seven confident mechanisms have been proposed here and all seven were
>    killed by the next measurement.** Read §3 before forming an eighth. In every
>    case the measurement was sound and the interpretation ran ahead of it — one
>    was retracted within minutes of being written.
>
> **Docs in `.agents/` are written by agents after the fact and can be wrong.
> When a doc and the code disagree, the code wins.**

---

## §1. Where this stands

| | state |
|---|---|
| Latest round (rig=10) | **controlled experiment**: init-wrapping removed from every frame, **position table unchanged**. Frame shape is not a variable. One message (`A10`) lost for good. |
| Symptom the user reports | messages arrive **laggy**; reactions and read receipts vanish; occasionally a message is gone for good |
| What the rig measures | **~40% of frames fail AEAD**, on a session both sides consider healthy |
| Why it usually looks fine | something **resends** seconds later and covers the loss (`retryDirectMessage` is the leading candidate, instrumented in rig=9) |
| Direction | **asymmetric in severity** — one round was 16/38 vs 0/38; the latest had failures both ways (A 6, B 48) |
| Earlier, worse state | 0 of 10 delivered both directions, permanent, until a manual reset |
| **THE MECHANISM** | failure is a **deterministic function of position in the DH sending chain**: pos 0 = 100% fail, pos 1 ≈ 90%, pos 2 ≈ 60%, **pos 3+ = 0%**, both directions |
| Recovery | **transient** — 38 of 41 failed frames decrypted on a later redelivery |
| Why the typing indicator is inverted | `typing-start` is the first frame after reading the peer's message, i.e. always **position 0**, the 100%-failure slot; the peer sees the *redelivered* copy a turn later |

The original reproduction pattern — works after a reset, use the same accounts on
mobile for days, return to desktop broken — **has still never been reproduced
deliberately** and remains the single most valuable thing to capture.

**The one-line summary:** the first two or three frames after every DH ratchet
step cannot be decrypted on arrival, and only land on redelivery. That is the lag,
that is the inverted typing indicator, and that is the message loss when a
redelivery does not get its chance.

---

## §2. What is established (evidence: [captures archive](2026-07-26-dm-desktop-to-desktop-captures.md))

- **Frames arrive and cannot be decrypted.** Not transport loss. Fingerprint-
  joined across both clients; 21/21 in one round, 16/38 in another. *(§2, F, L)*
- **Raw failure counts massively overstate events.** Failed frames are never
  deleted, so they redeliver 2-5× and re-fail each time. 568 failures were 36
  distinct frames. **Always de-duplicate by fingerprint before reasoning.** *(§2, H)*
- **A client can hold a dead session beside a healthy one** and listen on both
  forever. Nothing detects this. *(§2)*
- **The init-envelope age guard destroys legitimate messages.** Measured: an
  envelope 174 s *newer* than every row it would replace was refused for being
  17.6 min old, and its message was permanently lost. Self-heals on the next
  send. **This is a real defect of ours — see §4 lead 1.** *(A, B)*
- **The upstream crate fork is real and reproducible** against the real wasm: a
  receiver whose first processed frame sits at position ≥2 has the sender's
  direction permanently dead. *(§2)*
- **Failures accumulate.** Each one adds a skipped key to the peer's ratchet and
  leaves an undeletable frame cycling on the inbox. *(H)*

---

## §3. Dead hypotheses — do NOT re-investigate without new evidence

Each of these was argued confidently and then killed. The cost of re-deriving one
is a full round.

| # | hypothesis | killed by | date |
|---|---|---|---|
| 1 | Receive path routes init envelopes to the wrong SDK function, deadlocking forever | SDK reading + replay: `DoubleRatchetInboxDecrypt` already unwraps init frames; the branch predicate is correct | 07-26 |
| 2 | `#253` timestamp collision takes sibling frames | `[DM-ack collision]` armed, fired **zero** times | 07-26 |
| 3 | Repeated X3DH churns the session | **zero** `SESSION REPLACED` in a capture with 9 failures | 07-27 |
| 4 | The two sides disagree about confirm state, so the sender force-inits | failures and successes came from the **same** branch (`InboxEncrypt`, `sendingPubEmpty=false`); zero `ForceSenderInit` frames failed | 07-27 |
| 5 | A duplicated tag makes one row encrypt twice | `[DM-send dup]` fired **zero** times across ~490 frames | 07-27 |
| 6 | 86% of DM traffic goes to inboxes nobody reads | these accounts are **multi-device**; fan-out to the peer's devices *and* your own others is correct, and a 2-client capture cannot see the rest | 07-27 |
| 10 | Frame **shape** (init-wrapping) causes or worsens the failure | **experimentally excluded** at rig=10: the `sent_accept` fix removed init-wrapping (0/12 frames carry `user_address`, was 12/12) and the position table was unchanged in both directions. Per-frame failure rate flat (48% → 45%). | 07-27 |
| 9 | "All 24 failing frames are init-wrapped, so init-wrapping is the cause" | **every** frame is init-wrapped (finding W) — successes included. A constant cannot discriminate. Caught before it was reported as a cause | 07-27 |
| 8 | A forked sending ratchet (any form) | rig=9 with the DH epoch attached: **287/287 and 294/294 frames occupy a unique `(target, root, sLen)`**. No fork exists. Our locking is not implicated. | 07-27 |
| 7 | The sending ratchet forked (one target's `sLen` returned to 0 seven times) | `current_sending_chain_length` **resets to 0 on every DH ratchet step** — that is the protocol working. Seven peer replies, seven DH steps. `previous_sending_chain_length` = 7 and 4 in the same logs. **`(target, sLen)` proves nothing; a fork needs `(target, root, sLen)`** | 07-27 |

Also ruled out, on separate evidence: the `SyntaxError: not valid JSON` in decrypt
logs is an AEAD failure reporting itself badly (fixed, #260); and #235, #252,
#256, #258 plus the per-device-signing group (#244/#245/#249/#250) are exonerated
— that work is space-scoped and does not touch DM frame signing.

**The recurring error, stated once:** *a frame's shape on the wire does not tell
you which code branch produced it, and the absence of a log line is not the
absence of an event until you have checked that the line covers every path.*
Hypotheses 1, 4 and 6 all died of this.

---

## §4. Open leads, ranked

**0. THE MECHANISM — the first frames of every DH sending chain cannot be
decrypted on arrival.** *(measured rig=9; archive findings T, U, V)*

```
position in sending chain:  0     1     2     3+
A->B failure rate:        100%   86%   67%    0%
B->A failure rate:        100%  100%   60%    0%
```

Both directions, no exceptions above position 2. Failures are **transient** — 38
of 41 failed frames decrypted on a later redelivery. This accounts for every
symptom on record: the inverted typing indicator (`typing-start` is the first
frame after reading the peer's message, so it always occupies position 0), the
lag in tight conversation, and message loss when a redelivery never gets its
chance.

**Where it is NOT:** app code does not implement the ratchet. It selects a
session, calls `DoubleRatchetInboxEncrypt`, and hands arriving frames to
`DoubleRatchetInboxDecrypt`. Eight app-level mechanisms have been proposed and
killed (§3), including every form of forked ratchet (row 8, proven with the DH
epoch attached). What remains is the ratchet implementation itself — adjacent to
the upstream behaviour in §2, though ours is transient where that one is
permanent, so *related, not identical*.

**Now supported by a controlled experiment.** rig=10 removed init-wrapping — the
last app-controlled property of an outgoing frame — and the position table did not
move (§3 row 10). Ten app-level hypotheses are dead, every form of forked ratchet
is excluded with the DH epoch attached, and frame shape is excluded by
manipulation rather than by argument.
→ **The remaining action is the write-up for
[#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183)**, not
another local capture (§5).

**1. CONFIRMED DEFECT, fix owed — the init-envelope absolute age bound.**
`INIT_ENVELOPE_MAX_AGE_MS = 10 min` in [initEnvelopeGuard.ts](../../src/utils/initEnvelopeGuard.ts);
rule 0 fires **before** the no-rows check and refused envelopes are deleted
server-side. It destroys legitimate re-inits whenever the receiver was offline.
**Do NOT simply raise the bound** — it exists because 26-hour and 60-day zombie
envelopes were seen resurrecting dead sessions, and a bigger number just moves
the line. Wall-clock age is the wrong test; the signal that separates the cases
is already there — a zombie is **older** than the rows it replaces, a legitimate
re-init is **newer**, which is exactly what rules 2 and 3 encode. Any fix must
keep those zombies refused: extend
[initEnvelopeGuard.unit.test.ts](../../src/dev/tests/utils/initEnvelopeGuard.unit.test.ts),
never relax it.

**2. Four session-prune sites deleting healthy sessions.** *(not implicated in
either 07-27 capture — zero prune lines on builds carrying the probes; still
open on one round of evidence, but demoted)* Three in the send paths
(submit/edit/retry, run on *every send*) and one in a `useEffect` in
[DirectMessage.tsx](../../src/components/direct/DirectMessage.tsx) firing whenever
registration data changes. All delete sessions whose `tag` is absent from a
*cached* React Query read; mobile-created rows carry a non-device-inbox tag.

**3. UPSTREAM — [quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183).**
(a) the crate fork; (b) the node write path dropping frames handed to an open
socket, 32% one direction phone↔phone. Neither is fixable here. Its body was
corrected 07-26 to retract a "desktop is immune" claim. **If you produce new d↔d
evidence, update that issue — the lead dev reads it, not this file.**

**4. No dead-session detection.** The detector must require *retry-exhaustion on
a session with zero successes*, never first-failure — the healing-lag class
recovered 51/51 in the mobile rounds and must not trigger a reset.
**Awaiting a product decision, not evidence:** auto-reset silently, or prompt?
Given this bug's history, prompt is the safer first step. Do not build without it.

---

## §5. Next action

1. ~~Offline replay.~~ ~~Re-measure after the `sent_accept` fix.~~ **BOTH DONE.**
   The failure reproduces deterministically against the real wasm, and survives
   removal of init-wrapping unchanged (§2g).
2. **Merge the `sent_accept` fix** (§7 fix 2). Validated by the rig=10 round: no
   regression, per-frame failure rate flat, no new failure mode.
3. **Write up [#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183)** —
   this is now the main action. Carry: the position table from **two independent
   builds**, the fact that frame shape was excluded by manipulation, the
   transient-recovery data (failures decrypt on redelivery), and that it is
   symmetric across directions. Curated tables only — **never raw log regions**,
   they contain key material.
2. **Then, and only with that result**, take the position-rate table to
   [#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183) — it is
   the strongest evidence this investigation has produced, and the lead dev reads
   that issue, not this file.
3. **Independent of the root cause:** ship the §7 fix 1 (age bound) and fix 2
   (missing mutex). Both are defects on their own merits.
4. **Worth considering regardless:** the recovery already works — failed frames
   decrypt on redelivery. If redelivery were *faster* or triggered on failure
   rather than waited for, most of the user-visible lag would disappear even
   without a root-cause fix. Treat as mitigation, not a fix.

**Structural facts to carry into any code change here:**

- **There are FIVE DM encrypt sites, not one.** `encryptAndSendDm`,
  `submitMessage` ×2, `retryDirectMessage`, and `ActionQueueHandlers.sendDm` —
  structurally near-identical, never de-duplicated. **Anything added to one must
  be added to all five.** Two successive probe rounds each missed the site that
  mattered; the full table with mutex status is in the archive (finding P).
- **Something resends and masks the loss.** `retryDirectMessage` is the leading
  candidate and is labelled in rig=9. It is currently the only thing standing
  between this bug and routine visible message loss — identify it before touching
  anything that looks like redundancy.
- **`sLen` alone means nothing.** See §3 row 7. Always pair it with `root`.

---

## §6. THE RIG — how to capture (read before booking any test time)

**Branch: `diag/dm-frame-join`** (local, never merge — it logs real key
material). Rebase it forward onto `main`:

```
git fetch origin && git rebase origin/main diag/dm-frame-join   # rebase + switch to it
git checkout main                                               # back to normal work
```

There is a local alias for the first line (`git debug`), but it lives in this
clone's git config, so do not assume it exists.

> **Commit docs on `main`, never on this branch.** The diag branch is never
> merged, so anything committed here is lost. Keep doc edits in the working tree
> and commit them after switching back.

The startup marker **enumerates the probes the build carries**:

```
[DM-diag] armed (desktop dm-frame-join) rig=9 probes=recv-wire,send-wire+ts,recv-branch,send-branch+root+slen+msgid(ALL 5 send sites),send-dup,xpdump,prune
```

**No marker, no round.** Check `rig=` matches on **both** clients — on 2026-07-26
one client was two builds behind and its silence was unreadable.

| probe | what it answers |
|---|---|
| `[DM-send wire] fp= to= sentAt=` | did we send it, to which inbox, when |
| `[DM-recv wire] fp= inbox= ts= path=` | did it arrive, on which inbox. ⚠️ `path` is the **branch taken** (which follows the arrival inbox), **not the frame's shape** — an init-wrapped frame on a session inbox logs `path=dr`. Never count init envelopes from this field. |
| `[DM-recv branch] fp= branch=` | Confirm or InboxDecrypt, and why |
| `[DM-send branch] fp= site= target= branch= sendingPubEmpty= root= sLen=a->b pS= msgId= type=` | which branch and which of the **five** send sites produced this frame, its DH epoch (`root`) and position (`sLen`), and what it carried. Joins to the peer by `fp`. ⚠️ **`sLen` resets to 0 on every DH step — never read it without `root`** (§3 row 7). |
| `[DM-send dup]` | one tag appeared twice in a fan-out |
| `[XPDUMP]` | full ratchet state + sealed frame, for offline replay |
| `[DM-prune ui\|send]` | a session was DELETED, and which tag |
| `[DM-ack collision]` | a delete-by-timestamp would have taken a sibling frame |

**Capture protocol**
1. Both clients on the diag build, hard-reload, confirm the marker and matching
   `rig=` on both.
2. Console: **empty text filter, level = Warnings + Errors.** Every probe is
   `warn`/`error`; `logger.debug` never reaches the console (shared logger
   `minLevel` is `log`).
3. Send numbered messages so content maps to frames.
4. **Wait 5 full minutes before saving**, and **save both consoles at the same
   moment**. On 2026-07-27 a receiver log ended 10 s after the last failure while
   the sender was still sending, and the round's most important question went
   unanswered; a 69-second skew between the two saves cost the tail of another.
5. Record what you *saw on screen* — **device observation outranks the rig**.
   That is how a 21-frame phantom loss was caught on mobile.

**Offline replay** — highest value per minute, zero device time:
```
node E:/GitHub/Quilibrium/quorum-mobile/.agents/scripts/dr-replay.mjs <desktop.log>
```
Reassembles `[XPDUMP]` chunks and re-runs the real failing decrypt against the
real wasm core: whether the seal opened, whether the frame was init-wrapped,
whether the ratchet failed.

> ⚠️ `[XPDUMP]` lines contain **REAL KEY MATERIAL**. Throwaway test accounts only.
> Keep logs local — never paste raw log regions into a GitHub issue (round data
> goes upstream as curated tables). Delete them when this closes.

---

## §7. Owed fixes — client-side defects found while chasing this

Three are real, confirmed, and independent of the root cause. Ship them on their
own merits; none of them is known to fix the position-0 failure.

| # | fix | confidence | risk / note |
|---|---|---|---|
| **1** | **The init-envelope age bound destroys legitimate messages.** `INIT_ENVELOPE_MAX_AGE_MS = 10 min` in [initEnvelopeGuard.ts](../../src/utils/initEnvelopeGuard.ts); rule 0 fires **before** the no-rows check and the refused envelope is deleted server-side. Measured: an envelope **174 s newer** than every row it would replace was destroyed for being 17.6 min old, and its message was lost with no trace (finding A). | **confirmed, measured, user-visible** | **Do NOT just raise the bound** — it exists because 26-hour and 60-day zombies were seen resurrecting dead sessions. Age is the wrong test; a zombie is *older* than the rows it replaces and a legitimate re-init is *newer*, which rules 2 and 3 already encode. Extend [the unit tests](../../src/dev/tests/utils/initEnvelopeGuard.unit.test.ts) first. |
| 2 ✅ | **`sent_accept` never reaches the SDK** *(low severity — efficiency, not security)*, so **every** DM frame is init-wrapped. `orderSessionsForSend` builds sessions from `JSON.parse(r.state)`, but the flag lives in the sibling `sentAccept` DB column and is never merged back (finding W). Every message therefore re-sends session setup material (return inbox keys, identity public key, display name, icon) instead of only until the session is established. **Not a disclosure issue** — both branches seal the payload to the recipient's inbox key, so it is encrypted in transit exactly like message content. Cost is payload size, not exposure. | **confirmed, fixed, and VALIDATED live** (rig=10: 0/12 frames now carry `user_address`) | Re-sent setup material on every frame. **Re-measured after the change: no regression** (§2g), so the pre-round concern that this redundancy was compensating for frame loss is not supported. Ready to merge. |
| **3** | **`ActionQueueHandlers.sendDm` takes no ratchet lock.** Zero `dmRatchetMutex` calls in the whole file, for the same read→encrypt→save section `MessageService` guards in **six** places (finding R). | **confirmed by inspection** | Latent — that path handles offline-composed DMs and did not execute in any capture, so it is **not** this bug's cause. The hazard is spelled out verbatim at [L1141-1153](../../src/services/MessageService.ts#L1141). |
| 4 | No dead-session detection (§4 lead 4) | design gap, not a defect | **Awaiting a product decision, not evidence.** Must key on *retry-exhaustion with zero successes*, never first-failure — the healing-lag class recovered 51/51 on mobile and must not trigger a reset. |
| 5 | The root-cause fix | — | Unknown; position-0 failure still unexplained. |

**Structural hazard, not a bug:** there are **five** near-identical DM encrypt
loops (`encryptAndSendDm`, `submitMessage` ×2, `retryDirectMessage`,
`ActionQueueHandlers.sendDm`) that have never been de-duplicated. Two successive
probe rounds each instrumented the wrong one, and fix 3 exists only because one of
the five drifted out of sync with the others. Worth consolidating.

### Retired — investigated and found NOT to be defects

- **De-duplicate `targetInboxes`.** Raised early on an observation of "the same
  reaction sent twice to one inbox". **That observation was wrong** — the two
  frames had different ids. Measured twice since: `[DM-send dup]` fired **zero**
  times across ~490 frames, and with `msgId` attached, **0 of 133 (msgId, target)
  pairs repeat** in either direction. No duplicate sends exist. Nothing to fix.
- **Seven target inboxes per side.** Normal multi-device fan-out (§3 row 6).

**Shipped 2026-07-26:** #259 (`orderSessionsForSend` in the offline action-queue
send path — the fifth site #254 missed); #260 (a failed DM decrypt reports itself
honestly instead of as a JSON `SyntaxError`).

---

*Last updated: 2026-07-27*
