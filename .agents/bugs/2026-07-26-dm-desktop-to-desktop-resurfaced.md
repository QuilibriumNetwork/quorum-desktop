---
type: bug
title: "DM delivery broken again on desktop↔desktop (the 2026-07-02 master report is NOT closed)"
status: ROOT CAUSE FOUND 2026-07-27, upstream in the channel crate. Not fixable in this repo; all client-side work is DONE AND MERGED. Frame decryption failure is a deterministic function of position in the DH sending chain: positions 0-2 fail ~100%, position 3+ never fails, both directions. Failures are TRANSIENT — the same bytes decrypt on redelivery — so this is LATENCY WITH A LONG TAIL, not demonstrated message loss. It explains every symptom: lag, the inverted typing indicator, and messages arriving so late they are assumed lost. TEN app-level mechanisms have been proposed and killed (§3), including every form of forked ratchet and, by controlled experiment, frame shape itself. Three client defects were found and are MERGED to main (§7). Evidence is filed upstream at quorum-mobile#183. A fresh agent's next action is in §5 — it is NOT more local capturing.
created: 2026-07-26
severity: medium — user-visible lag and apparent loss; no permanent loss demonstrated since the init-envelope fix (see §1)
repo: quorum-desktop (cross-repo — mobile shares the accounts and the upstream causes)
area: DM Double Ratchet / session lifecycle / transport
entrypoint: true
related:
  - ".agents/bugs/2026-07-26-dm-desktop-to-desktop-captures.md (ALL round evidence, findings A-AB across 7 capture rounds — this file cites it by letter)"
  - ".agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md (mechanism catalogue — filed as solved, but the symptom RESURFACED; read it for history, not status)"
  - ".agents/docs/dm-ratchet-upstream-divergences.md (the 8 shipped divergences, lead-dev facing)"
  - ".agents/tasks/2026-07-17-dm-dead-session-autoheal.md (heal action 2 is exactly this failure)"
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md (DM internals)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md (3000-line master, rounds 1-29)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-session-confirm-row-mismatch-x3dh-every-send.md (authoritative SDK reading)"
  - "https://github.com/QuilibriumNetwork/quorum-mobile/issues/183 (the two UPSTREAM causes — not fixable here)"
---

# DM delivery is broken again, desktop↔desktop

> **START HERE if you are a fresh agent.** In order:
>
> 1. **The client-side work is finished and merged.** Do not start by hunting for
>    a bug in this repo — ten app-level mechanisms have already been proposed and
>    killed (§3), and the three real defects found along the way are shipped (§7).
> 2. **Read §3 before forming a theory.** Every one of those ten was argued
>    confidently and then disproved by the next measurement. In every single case
>    the measurement was sound and the interpretation ran ahead of it; one was
>    retracted within minutes of being written, and one reached a commit message
>    before the user caught it.
> 3. **Your next action is §5**, and it is probably not another capture — §5 opens
>    with three tools that answer questions offline, one of which needs no log and
>    no devices at all. The tool that found the root cause arrived last, after ten
>    hypotheses had been killed the expensive way.
> 4. Two older documents will mislead you: `.solved/2026-07-02-dm-message-delivery-unreliable-master.md`
>    is filed SOLVED and the symptom RESURFACED (good catalogue, bad status), and
>    the mobile master's "desktop↔desktop has no issues" is falsified.
>
> **Docs in `.agents/` are written by agents after the fact and can be wrong.
> When a doc and the code disagree, the code wins.**

---

## §1. Where this stands

| | state |
|---|---|
| rig=11 | **regression round, all three fixes merged: nothing moved.** Position table identical, no new failure mode, **zero posts lost** — the one that looked lost arrived after the capture. A second device on one account made no measurable difference. |
| **Latest round (reset, rig=11)** | **a FRESH session does not fail.** All delivered, no lag, no issues; A logged 0 decrypt failures against 60 the round before. Positions 0-2 went from 12/12 failing to 2/15. See finding AC |
| Symptom the user reports | messages arrive **laggy**; reactions and read receipts vanish; occasionally a message seems gone for good |
| ⚠️ Severity | **latency with a very long tail, not confirmed loss.** Every "lost" post that was rechecked later had simply arrived (finding AB). No round before rig=11 rechecked, so their loss counts are unverified. The one *confirmed* permanent loss is the init-envelope guard deleting a frame server-side — now fixed. |
| What the rig measures | **~40% of frames fail AEAD**, on a session both sides consider healthy |
| Why it usually looks fine | the frame is **redelivered** and decrypts on a later attempt. Recovery can take longer than a whole capture round, so short captures cannot tell loss from latency (finding AB) |
| Direction | varies by round; both directions fail. Early rounds looked one-directional, later ones did not |
| Earlier, worse state | 0 of 10 delivered both directions, permanent, until a manual reset |
| **ROOT CAUSE** | ⚠️ **FOUND — finding AE.** When `skipped_keys_map` holds a bucket under the receiver's **current receiving header key**, the crate's decrypt takes that bucket and fails instead of deriving the key normally. **63 of 65 captured failures across 6 rounds decrypt when that ONE bucket is deleted** and nothing else changes. In a typical case the bucket held 3 keys of 62 — removing the other 59 changes nothing. Minimal repro in the archive; upstream, not fixable here |
| ~~mechanism~~ (superseded, kept for the reasoning) | ⚠️ **REVISED — see finding AD.** On an AGED session, failure is near-total at chain positions 0-2 and absent from 3+. On a FRESH session the same positions are clean. **Chain position is where the failure lands, not what causes it.** The leading correlate is the accumulated skipped-keys map, which grew 2 → 20 → 23 → 37 across the day as the failure rate rose — but that is a hypothesis, not a conclusion (failures also *create* skipped keys, so cause and effect are circular on current evidence) |
| Recovery | **transient** — nearly all failed frames decrypt on a later redelivery. All recovery counts in the archive are LOWER BOUNDS, because captures were saved at ~2 minutes |
| Why the typing indicator is inverted | `typing-start` is the first frame after reading the peer's message, i.e. always **position 0**, the 100%-failure slot; the peer sees the *redelivered* copy a turn later |

The original reproduction pattern — works after a reset, use the same accounts on
mobile for days, return to desktop broken — **has still never been reproduced
deliberately** and remains the single most valuable thing to capture.

**The one-line summary:** a stale entry in the ratchet's skipped-keys map, under
the key the receiver is currently using, makes the crate fail frames it could
decrypt. It builds up with use, every failure adds another, and a reset clears it
— which is why the conversation degrades over days and works again after a reset.

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

## §4. Leads — one still live, the rest closed

**0. THE MECHANISM — the first frames of every DH sending chain cannot be
decrypted on arrival.** *(measured rig=9; archive findings T, U, V)*

```
position in sending chain:  0     1     2     3+
A->B failure rate:        100%   86%   67%    0%
B->A failure rate:        100%  100%   60%    0%
```

Both directions, no exceptions above position 2. Failures are **transient** —
nearly all failed frames decrypt on a later redelivery, and every recovery count
in this file is a **lower bound** because captures are saved at ~2 minutes
(finding AB). This accounts for every symptom on record: the inverted typing
indicator (`typing-start` is the first frame after reading the peer's message, so
it always occupies position 0), the lag in tight conversation, and messages that
look lost because the redelivery had not landed yet.

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
→ **Filed upstream 2026-07-27**:
[#183 comment](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183#issuecomment-5090004304).
Nothing further is actionable in this repo; see §5.

**1. ~~The init-envelope absolute age bound.~~ FIXED AND MERGED** 2026-07-27 (§7).
Kept here only for the reasoning, which generalises: wall-clock age was the wrong
test because a zombie is **older** than the rows it would replace while a
legitimate re-init is **newer** — the relative rules already encoded that and the
absolute bound overrode them. Any future change here must keep the 26-hour and
60-day zombies refused; extend
[initEnvelopeGuard.unit.test.ts](../../src/dev/tests/utils/initEnvelopeGuard.unit.test.ts),
never relax it. **Not yet exercised by a live round — see §5 option C.**

**2. Four session-prune sites deleting healthy sessions.** *(not implicated in
either 07-27 capture — zero prune lines on builds carrying the probes; still
open on one round of evidence, but demoted)* Three in the send paths
(submit/edit/retry, run on *every send*) and one in a `useEffect` in
[DirectMessage.tsx](../../src/components/direct/DirectMessage.tsx) firing whenever
registration data changes. All delete sessions whose `tag` is absent from a
*cached* React Query read; mobile-created rows carry a non-device-inbox tag.

**3. UPSTREAM — [quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183)
— now the only live lead.** (a) the crate fork; (b) the node write path dropping
frames handed to an open socket, 32% one direction phone↔phone. Neither is
fixable here. Its body was corrected 07-26 to retract a "desktop is immune"
claim, and our position table was added as a
[comment](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183#issuecomment-5090004304)
on 07-27. **If you produce new d↔d evidence, add it there — the lead dev reads
that issue, not this file.**

**4. No dead-session detection.** The detector must require *retry-exhaustion on
a session with zero successes*, never first-failure — the healing-lag class
recovered 51/51 in the mobile rounds and must not trigger a reset.
**Awaiting a product decision, not evidence:** auto-reset silently, or prompt?
Given this bug's history, prompt is the safer first step. Do not build without it.

---

## §5. Next action

**Everything this repo can do about the root cause has been done.** The mechanism
is measured, the app is exhausted as an explanation, the three real client defects
are merged, and the evidence is filed upstream. Read that before opening an editor.

### FIRST: three tools that answer questions without a capture round

Ten hypotheses in this investigation were killed the slow way — book a round, ask
the operator for attention, wait, read logs. The tool that finally found the root
cause needed **none of that** and arrived last. Do not repeat that ordering.

| tool ([`.agents/tools/dm-debug/`](../tools/dm-debug/)) | answers | needs |
|---|---|---|
| `dr-ablate.mjs` | **what CAUSES a failure** — re-runs a real captured decrypt while changing ONE state property at a time; a load-bearing property announces itself by making the frame decrypt | a saved log |
| `dr-replay.mjs` | is this failure genuine and reproducible, or an app-level race | a saved log |
| `dr-advanced-start-fork.mjs` | reproduces the upstream crate's advanced-start fork from a pristine X3DH pair | **nothing** — no log, no devices |

```
node .agents/tools/dm-debug/dr-ablate.mjs <log> [...more logs]
```

**To test a new hypothesis, add a case to `dr-ablate`'s `VARIANTS` array.** It
runs against every captured failure on disk in seconds — 65 of them at the time of
writing, spanning six rounds and both clients. If a hypothesis cannot be phrased
as "this state property is load-bearing", ask whether it is testable at all before
spending device time on it.

Old logs live wherever the operator saved them (historically a `logs/` folder on
the Desktop, with an `OLD/` subfolder for previous rounds). They contain **real
ratchet key material** — keep them local.

### If you are here because the user reports DM lag or a missing message

That is the known symptom of the unresolved upstream cause. **Do not start a new
investigation.** Confirm it matches (§1), then either wait on
[#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183) or pick up
option B below.

### A. Waiting on upstream — the honest default

The position table is filed at
[#183 comment](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183#issuecomment-5090004304)
(2026-07-27). It bears on that issue's item 1: the fork needs establishment-phase
frame loss as a trigger, and our data shows chain-start frames fail on first
attempt essentially always, so the trigger is systematic rather than incidental.

**If the lead dev replies asking for evidence**, we can re-run instrumented rounds
(§6) against any build. We deliberately did NOT promise to hand over state blobs:
captures contain live ratchet state, they live only on the operator's machine, and
they are not going in a public issue.

### B. Mitigation we control — the best remaining value here

**Recovery already works; it is just slow.** Failed frames decrypt on redelivery,
and the whole user-visible symptom is how long that takes. If redelivery were
triggered **on decrypt failure** rather than waited for, most of the lag and the
inverted typing indicator would disappear *without* the upstream fix.

This is unbuilt and unscoped. It is mitigation, not a cure, and it must not
weaken the retention that makes recovery possible in the first place. Start from
`UndecryptableFrameTracker` (`src/utils/frameRetry.ts`) and the skip-and-keep path
in the receive handler.

### C. The one fix never exercised live

The init-envelope age-bound fix (§7) is merged but no round has triggered it,
because it only fires for a client that has been offline past the window. To
confirm: close one client, reset and send ONE message from the peer, wait 15+
minutes, reopen on a diag build, and check that `STALE init envelope IGNORED` does
**not** fire and the message arrives. Fifteen minutes with the client closed, so
it costs no attention.

### D. Still never reproduced deliberately

The original report — works after a reset, use the same accounts on mobile for
days, return to desktop broken. Nobody has reproduced it on purpose. It remains
the single most valuable capture available, and no round so far has attempted it.

### Structural facts to carry into ANY code change here

- **There are FIVE DM encrypt sites**, structurally near-identical and never
  de-duplicated: `encryptAndSendDm`, `submitMessage` ×2, `retryDirectMessage`,
  and `ActionQueueHandlers.sendDm`. **Anything added to one must be added to all
  five.** Two probe rounds each missed the site that mattered, and one shipped
  defect existed purely because a fifth site had drifted (archive finding P).
- **`sLen` alone means nothing** — it resets to 0 on every DH step. Always pair it
  with `root` (§3 row 7).
- **De-duplicate frames by fingerprint before quoting any count.** Raw failure
  counters include redeliveries and have overstated volume three separate times.
- **A short capture cannot establish loss.** See §6 step 4.

---

## §6. THE RIG — how to capture (read before booking any test time)

**Branch: `diag/dm-frame-join`** (local, never merge — it logs real key
material). Rebase it forward onto main before every round:

```
git fetch origin
git log --oneline origin/main..main        # is LOCAL main ahead of origin?
git rebase main diag/dm-frame-join        # rebase onto LOCAL main, then switch to it
git checkout main                          # back to normal work
```

> ⚠️ **Rebase onto `main`, NOT `origin/main`.** An earlier version of this file
> said `origin/main`, and on 2026-07-27 that would have silently stripped all
> three merged client fixes out of the diag build — they were committed to local
> main and had not been pushed. A round on that build would have been read as
> "the fixes changed nothing" when the fixes were not in it. Check the second
> command above: if local main is ahead, `origin/main` is the wrong base.

**Then prove the build is what you think it is**, because a marker only reports
probes, not which fixes are compiled in:

```
grep -c "set.sent_accept = r.sentAccept" src/utils/sessionSelection.ts   # sent_accept fix
grep -c "dmRatchetMutex" src/services/ActionQueueHandlers.ts             # offline lock
grep -n "existingRowTimestamps.length === 0" src/utils/initEnvelopeGuard.ts  # age bound scoped
```

**`git debug` does all of the above.** The alias lives in this clone's
`.git/config` (not committed, so a fresh clone will not have it). It was rewritten
2026-07-27: it previously encoded the `origin/main` mistake, and since the operator
had been told to run it before every round, the bug was in the tool rather than in
anyone's habits. It now rebases onto local main and prints the fix-presence checks,
so the safe path is also the shortest one. Expected output:

```
--- BUILD CHECK (marker only reports probes, this reports fixes) ---
<diag head commit>
rig=11 probes=ALL-3-FIXES,...
sent_accept fix : 1  (want >=1)
offline lock    : 3  (want >=1)
age-bound fix   : 3  (want >=1)
local main ahead of origin by N commits
```

Any of those three reading `0` means the build does **not** contain that fix and
the round would be misattributed. Stop and rebase properly.

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
4. **Save after ~2 minutes.** That is enough for everything this rig actually
   measures, and it is what the operator will realistically do — an earlier
   version of this file demanded 5 minutes and was simply not followed, which is
   worse than an honest number. **Save both consoles at the same moment**; a
   69-second skew between them cost the tail of one capture.

   **What 2 minutes CANNOT tell you: whether a message was lost.** Recovery by
   redelivery has been observed taking longer than an entire round (finding AB).
   Any "lost for good" count read off a short capture is really "had not arrived
   when we stopped looking". Do not report loss from the log window.

   **How to answer the loss question without waiting:** save at 2 minutes as
   normal, then simply glance at the conversation 20-30 minutes later and note
   whether anything that looked missing has turned up. No console, no
   babysitting, no attention cost. That is the only way loss has ever actually
   been established here.
5. Record what you *saw on screen* — **device observation outranks the rig**.
   That is how a 21-frame phantom loss was caught on mobile.

**Offline analysis** — see the tool table in §5, which is where a fresh agent
should meet these. Both log-driven tools live
in [`.agents/tools/dm-debug/`](../tools/dm-debug/) **in this repo**, alongside the existing console snippets, because `.agents/` is
gitignored in quorum-mobile where they were originally written — the copies there
were never tracked and would not survive a fresh clone. They resolve the SDK
relative to the repo, or set `SDK_DIR=`.

```
node .agents/tools/dm-debug/dr-replay.mjs <desktop.log>   # reproduce a failure
node .agents/tools/dm-debug/dr-ablate.mjs <desktop.log>   # find what CAUSES it
```

`dr-replay` reassembles `[XPDUMP]` chunks and re-runs the real failing decrypt
against the real wasm core: whether the seal opened, whether the frame was
init-wrapped, whether the ratchet failed.

`dr-ablate` is what found the root cause. It re-runs the same decrypt while
changing **one** property of the ratchet state at a time, so a property that is
load-bearing announces itself by making the frame decrypt. **Add a variant to its
`VARIANTS` array to test any new hypothesis against 65 real captured failures in
seconds** — that is far cheaper than a capture round, and it is how ten dead
hypotheses could have been killed faster.

> ⚠️ `[XPDUMP]` lines contain **REAL KEY MATERIAL**. Throwaway test accounts only.
> Keep logs local — never paste raw log regions into a GitHub issue (round data
> goes upstream as curated tables). Delete them when this closes.

---

## §7. Client fixes — all three MERGED to main 2026-07-27

None of these caused the position-failure mechanism; all three were real defects
found while chasing it, and each was validated before merge.

| fix | what it was | evidence |
|---|---|---|
| **`sent_accept` never reached the SDK** | `orderSessionsForSend` parsed only `r.state`, but the flag lives in the sibling `sentAccept` column, so the SDK init-wrapped **every** frame — re-sending session setup material forever instead of until established. **Not** a disclosure issue: both branches seal the payload to the recipient's inbox key. | archive W, Y. Validated live: 12/12 frames carried setup material before, 0/12 after, delivery unchanged |
| **init-envelope age bound destroyed legitimate re-inits** | the 10-minute bound ran first and unconditionally, so a reset that arrived while the user was away was refused **and deleted server-side**. Measured on an envelope 174 s *newer* than the rows it would replace. Now scoped to the no-rows case, which is what its own rationale described. | archive A. **The only confirmed permanent message loss in this investigation** |
| **offline send path took no ratchet lock** | `ActionQueueHandlers.sendDm` did read→encrypt→save with no lock while `MessageService` guards the same sequence in six places. Latent — that path never ran in any capture. | archive R. Regression test verified to FAIL without the lock (`read:v0, read:v0`) |

**Validated together** by the rig=11 regression round: position table identical,
no new failure mode, zero stale-init refusals (archive Z). The age-bound fix is
the exception — see §5 option C.

### Retired — investigated and found NOT to be defects

- **De-duplicate `targetInboxes`.** Raised on an observation that turned out to be
  a misread. `[DM-send dup]` fired **zero** times across rounds, and with `msgId`
  attached **0 of 133 (message, target) pairs repeat**. No duplicate sends exist.
- **Seven target inboxes per side.** Normal multi-device fan-out (§3 row 6), and a
  round where one account had a second device online showed no measurable
  difference (archive AA).

**Earlier, unrelated:** #259 (`orderSessionsForSend` in the offline send path —
the fifth site #254 missed); #260 (a failed DM decrypt reports itself honestly
instead of as a JSON `SyntaxError`).

---

*Last updated: 2026-07-27*
