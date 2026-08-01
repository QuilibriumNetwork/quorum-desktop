---
type: bug
title: "DM delivery broken again on desktop↔desktop (the 2026-07-02 master report is NOT closed)"
status: MECHANISM FULLY CHARACTERISED AND A CLIENT-SIDE MITIGATION IS VALIDATED (2026-07-27, finding AI — refines AE). The crate matches a skipped message key BY INDEX in the bucket filed under the receiver's pre-DH-step `current_receiving_header_key`, without checking that bucket belongs to the incoming frame's chain. A frame that opens a NEW sending chain and lands on an index present in that stale bucket is handed an OLD-chain key and fails AEAD; non-colliding indices decrypt normally. All three conditions hold in 139 of 139 recovered captured failures, the failing index set equals the stale bucket's index set exactly (5/5 synthetic configurations), and it is now REPRODUCIBLE ON DEMAND both against the bare crate and through the real client (`yarn harness dm-reorder`). ⚠️ AE's implied "the bucket's presence causes the failure" is NOT sufficient — controls show an in-order frame and non-colliding frames decrypt fine on a poisoned state. This also answers the lookup-vs-contents question §4 left open: it is the LOOKUP; the bucket's keys are valid and decrypt their own frames correctly. ⚠️⚠️ §5-B1 AS ORIGINALLY WRITTEN MUST NOT SHIP: pruning and persisting destroys the delayed frames whose keys live in that bucket (3/3 measured), converting recoverable latency into permanent loss. The safe form (B1′ — prune for the RETRY ONLY, re-file the bucket into the persisted state) is **MERGED to main as PR #265 (2026-07-27)**, measured at 32→0 failures over 56 new-chain frames with ZERO cost to delayed frames. ⚠️ THIS BUG STAYS OPEN: #265 removes the SYMPTOM on desktop only — the cause is upstream (quorum-mobile#183 item 1a, still open), the mitigation is NOT ported to mobile, and §5-D (what forms the bucket in the field) is unanswered. TEN app-level mechanisms remain dead (§3); three client defects are MERGED (§7). Evidence is filed upstream at quorum-mobile#183. Failures are TRANSIENT, so this is LATENCY WITH A LONG TAIL, not demonstrated loss.
created: 2026-07-26
severity: medium — user-visible lag and apparent loss; no permanent loss demonstrated since the init-envelope fix (see §1)
repo: quorum-desktop (cross-repo — mobile shares the accounts and the upstream causes)
area: DM Double Ratchet / session lifecycle / transport
entrypoint: true
related:
  - ".agents/tasks/transport/2026-07-26-dm-desktop-to-desktop-captures.md (ALL round evidence, findings A-AH across 8 capture rounds + offline ablation and synthetic harness rounds — this file cites it by letter)"
  - ".agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md (mechanism catalogue — filed as solved, but the symptom RESURFACED; read it for history, not status)"
  - ".agents/tasks/transport/dm-ratchet-upstream-divergences.md (the 8 shipped divergences, lead-dev facing)"
  - ".agents/tasks/transport/2026-07-17-dm-dead-session-autoheal.md (heal action 2 is exactly this failure)"
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md (DM internals)"
  - ".agents/tasks/2026-07-27-headless-dm-harness.md (headless bench: drives the REAL client in Node, both sides, no browser — see §5 and §6)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md (3000-line master, rounds 1-29)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-session-confirm-row-mismatch-x3dh-every-send.md (authoritative SDK reading)"
  - "https://github.com/QuilibriumNetwork/quorum-mobile/issues/183 (the upstream causes, lead-dev facing. Item 1a IS finding AE. Body rewritten 2026-07-27 and the old comment folded into it — the body is now the whole story)"
---

# DM delivery is broken again, desktop↔desktop

> **START HERE if you are a fresh agent.** In order:
>
> 0. **2026-07-27: the mechanism is fully characterised, reproducible on demand, and
>    the client-side mitigation is MERGED** (PR #265). Run `yarn harness dm-reorder`
>    to watch the production failure happen in ~35 seconds. Findings AI/AJ/AK/AL in §1.
>    **The remaining work items are (a) porting the mitigation to mobile, and (b) §5-D
>    — what supplies the out-of-order delivery that forms the bucket in the field.**
>    Neither needs another capture round. *(Updated 2026-07-28: this item previously
>    said the live work was "reviewing and merging branch `feat/dm-stale-bucket-retry`";
>    that branch merged as PR #265 on 2026-07-27.)*
> 1. **The client-side work up to that point is finished and merged.** Do not start
>    by hunting for a bug in this repo — ten app-level mechanisms have already been
>    proposed and killed (§3), and the three real defects found along the way are
>    shipped (§7).
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
| **ROOT CAUSE** | ⚠️ **FOUND — finding AE, mechanism completed by finding AI.** The crate matches a skipped message key **by index** in the bucket filed under the receiver's *pre-DH-step* `current_receiving_header_key`, without checking that bucket belongs to the incoming frame's chain. A frame opening a NEW sending chain, at an index present in that stale bucket, gets an OLD-chain key and fails AEAD. **139 of 159 captured failures** (the whole corpus on disk, de-duplicated — larger than the 65 first recorded) decrypt when that ONE bucket is removed, and **139/139 of them show all three conditions**. Upstream, not fixable here — but see §5-B1′, which removes the symptom |
| **Reproducible on demand** | ✅ **YES, since 2026-07-27** — no devices, no aged session, no waiting. Out-of-order delivery within a chain forms the stale bucket; the sender's next chain then fails at exactly the colliding indices. `node .agents/tools/dm-debug/dr-prune-safety.mjs` (crate level, deterministic) and `yarn harness dm-reorder` (through the real client). See finding AI |
| ~~mechanism~~ (superseded, kept for the reasoning) | ⚠️ **REVISED — see finding AD.** On an AGED session, failure is near-total at chain positions 0-2 and absent from 3+. On a FRESH session the same positions are clean. **Chain position is where the failure lands, not what causes it.** The leading correlate is the accumulated skipped-keys map, which grew 2 → 20 → 23 → 37 across the day as the failure rate rose — but that is a hypothesis, not a conclusion (failures also *create* skipped keys, so cause and effect are circular on current evidence) |
| Recovery | **transient** — nearly all failed frames decrypt on a later redelivery. All recovery counts in the archive are LOWER BOUNDS, because captures were saved at ~2 minutes |
| Why the typing indicator is inverted | `typing-start` is the first frame after reading the peer's message, i.e. always **position 0**, the 100%-failure slot; the peer sees the *redelivered* copy a turn later |

The original *field* pattern — works after a reset, use the same accounts on mobile
for days, return to desktop broken — has still never been reproduced by following
those steps. **But the failure mode itself no longer needs it:** the mechanism is
reproducible on demand in seconds (finding AI), so nothing further is blocked on
capturing an aged session. What the field pattern would still add is *how the
bucket comes to exist in normal use*, which remains unmeasured (§5-D).

**The one-line summary:** the ratchet keeps the message keys of frames it had to
skip, filed under the sending chain they belong to — and when the sender starts a
new chain, the crate matches those saved keys **by position number alone**, without
checking they belong to this chain. So the first frames of every new chain get
handed a key from the old one and fail. It accumulates with use, every failure adds
another saved key, and a reset clears the lot — which is why a conversation degrades
over days and works again after a reset.

> **Bench refinement (headless harness, 2026-07-27):** "builds up with use" is NOT
> message-count alone. A run of the REAL client headless in Node (both sides, fresh
> accounts, 60–82 concurrent msgs each way) accumulated **zero** skipped keys and
> **zero** failures, narrowing the accumulation trigger to time / cross-platform /
> reset, NOT volume. A first run *did* fail, but a fresh-account control falsified
> it as stale queued frames from account reuse, not load.
> ⚠️ **This conclusion still holds but the original measurement did not support it
> — see finding AJ.** The harness could not see decrypt failures at all when that
> run was made (the receive path catches `DmDecryptError` and returns `handled`, so
> nothing propagated), and every bot shared one IndexedDB. Both are fixed; on the
> fixed bench a fresh pair still shows 0 skipped keys and 0 novel failures, so the
> claim is now genuinely evidenced.

> ### Bench findings, 2026-07-27 (offline ablation + headless harness)
>
> **AI — the mechanism, completing AE.** Three conditions are jointly necessary:
> (a) a bucket exists under the receiver's `current_receiving_header_key`; (b) the
> incoming frame opens a NEW sending chain, so the receiver takes a DH step;
> (c) the frame's index *within that new chain* collides with an index present in
> the stale bucket. The crate then applies an old-chain message key and fails AEAD.
> - **139/139** recovered captured failures satisfy all three (whole corpus on
>   disk, de-duplicated by envelope fingerprint: 159 dumps, 139 recover, 20 do not).
> - The failing index set **equals** the stale bucket's index set, exactly, across
>   5/5 synthetic configurations (bucket `[0]`…`[0,1,2,3,4]`).
> - **Controls that could have falsified it and did not:** the bucket's mere
>   presence is *not* sufficient (an in-order frame and non-colliding new-chain
>   frames both decrypt on a poisoned state); and skipped keys from a previous
>   chain are filed correctly under the *old* header key, so cross-DH-step
>   withholding alone poisons nothing.
> - **This settles §4's open lookup-vs-contents question: it is the LOOKUP.** The
>   bucket's contents are valid — those keys decrypt their own frames correctly
>   (measured, 3/3). They are simply being applied to the wrong chain.
> - **It mechanically explains the retired position table.** The indices that get
>   skipped in practice are the low ones, so the stale bucket holds 0,1,2… and
>   every subsequent DH chain fails at exactly its first positions and is clean
>   from there. Position was never causal; it is where the collision lands.
>
> **AJ — two harness defects that invalidated earlier bench numbers.** Both found
> by controls, both fixed:
> 1. **Every bot shared one database.** `MessageDB` hardcodes `DB_NAME='quorum_db'`
>    and all bots use one global `fake-indexeddb`, so two bots were one client with
>    two `MessageService` instances writing the same rows. Each then subscribed to
>    the other's session inboxes (`refreshSubscriptions` reads every
>    `encryption_states` row), so **41–48% of all arrivals were the bot's OWN
>    outbound ciphertext** — each an unavoidable AEAD failure.
>    ⚠️ It was tempting to conclude the same inflates the browser rounds, since the
>    app's `setResubscribe` uses the identical rule. **A control killed that:**
>    `dr-self-echo.mjs` finds **0 self-echo in 2709 distinct captured browser
>    arrivals**, so the ~40% figure in this table is NOT explained by it. Harness
>    artifact only. Fixed with a per-bot database name.
> 2. **The harness could not see decrypt failures.** They never propagate out of
>    `handleNewMessage`. Fixed by teeing the failure log line, and failures are now
>    split into **novel** vs **replay** — a frame the bot already decrypted once is
>    refused by design, and replays dominate a raw count. Only novel failures mean
>    anything. (Also: re-subscribing after every frame made the relay re-push its
>    queue in a loop, turning 3 expected failures into 437; the harness now
>    re-subscribes only when the inbox set changes, as the app does.)
>
> **AK — the B1 mitigation, measured.** Naive B1 (prune the bucket, decrypt,
> persist) **must not ship**: it destroys 3/3 of the delayed frames whose keys live
> in that bucket, which are exactly the frames redelivery recovers today. **B1′**
> (prune for the retry only, re-file the bucket into the persisted state) recovers
> **32→0** failures over 56 new-chain frames per arm with **zero** delayed-frame
> failures in either arm. See §5-B1.
>
> **AL — desktop↔desktop transport loss is 0%, first measurement (#183 item 2).**
> The upstream lead is "the node write path drops a fraction of frames handed to an
> open socket, 32% one direction phone↔phone"; d↔d had never been measured.
> `yarn harness dm-loss`, fresh accounts, 300 rounds each way, 12 min of sending
> plus a **20-minute** redelivery tail:
>
> | | A→B | B→A |
> |---|---|---|
> | frames addressed to an inbox the peer subscribes to | 301 | 301 |
> | arrived (joined by ciphertext fingerprint) | **301** | **301** |
> | missing | **0** | **0** |
>
> Zero novel decrypt failures on either side. Read it precisely:
> - **It does not refute item 2.** Different platform and network path; this says
>   nothing about phone↔phone.
> - Each app-level message produced **2** outbound frames per side (602 raw), only
>   301 of them addressed to an inbox this peer subscribes to. The rest are
>   multi-device fan-out to addresses outside this pair and are excluded from the
>   denominator — if they were *supposed* to land here, that exclusion would hide
>   the loss. Worth confirming separately.
> - Arrival counts are asymmetric (313 vs 371) purely because bob received more
>   redeliveries (70 replays vs 12). The de-duplicated join is unaffected, and this
>   is exactly why raw counters must never be quoted.

---

## §2. What is established (evidence: [captures archive](2026-07-26-dm-desktop-to-desktop-captures.md))

- **THE ROOT CAUSE: a stale skipped-keys bucket, matched by index against the
  wrong chain.** A bucket under the receiver's *current* receiving header key makes
  the crate fail frames it could decrypt — specifically the frames that open the
  sender's NEXT chain at an index that bucket happens to hold. 139/159 captured
  failures (whole corpus, de-duplicated) decrypt when only that bucket is removed,
  and 139/139 of those show the full signature. Upstream, in the crate.
  *(AE + AI, §4 lead 0)*
- **The failure is reproducible on demand, from a pristine session.** Out-of-order
  delivery within one chain forms the bucket; the sender's next chain then fails at
  exactly the colliding indices — 5/5 synthetic configurations, and through the real
  client (`yarn harness dm-reorder`). No aged session, no devices, no waiting. *(AI)*
- **The bucket's presence alone is NOT sufficient**, and the index collision is what
  discriminates: on a poisoned state, an in-order frame and any new-chain frame at a
  non-colliding index both decrypt normally. *(AI — control)*
- **A FRESH session does not exhibit the failure.** Post-reset, positions 0-2
  went from 12/12 failing to 2/15, and one client logged 0 failures against 60
  the round before. Independently corroborated synthetically: 1920 frames on
  fresh sessions across six delivery regimes, zero failures. **So chain position
  alone is not sufficient to cause anything.** *(AC, AF)*
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

**0. THE ROOT CAUSE — a skipped-keys bucket under the receiver's CURRENT
receiving header key.** *(finding AE, archive §2j — offline ablation, no devices)*

When `skipped_keys_map` contains a bucket indexed by the receiver's **current**
receiving header key, the crate's decrypt path takes that bucket and fails,
instead of falling through to normal chain-key derivation. The message key it
needs is derivable; it never gets there.

```
baseline, exactly as captured ...................  0 / 65 decrypt
drop ONLY skipped_keys_map[current_recv_header] .. 63 / 65 decrypt   ← the bucket
drop ONLY the next-recv-header bucket (control) ..  0 / 65
keep only the current-recv-header bucket .........  0 / 65
previous_sending_chain_length = 0 ................  0 / 65
current_receiving_chain_length = 0 ...............  0 / 65
swap current ↔ next receiving header key .........  0 / 65
```

**Not "fewer keys is better":** in a representative case the map held 62 keys
across 20 buckets and the poisoning bucket held **3**. Deleting those 3 decrypts
the frame; deleting the other 59 changes nothing. Frame and state are otherwise
byte-identical between the failing and succeeding runs.

**It explains every symptom on record**, including the oldest one nothing else
ever did: works after a reset (the reset discards the map), degrades over days
(every failure adds another skipped key — a feedback loop), redelivery recovers
(the state has moved past that header key by then), and failures cluster at chain
positions 0-2 (that is where a receiver consults skipped keys after a DH turn).

> ⚠️ **The position table is a SYMPTOM, not the mechanism — finding AD.** An
> earlier version of this lead read *"THE MECHANISM — the first frames of every DH
> sending chain cannot be decrypted"* with a 100/86/67/0% table. **That framing is
> retired.** A fresh session shows the same positions behaving normally (finding
> AC: positions 0-2 went from 12/12 failing to 2/15 after a reset, and one client
> logged zero failures against 60 the round before). Position is where the failure
> *lands*; the bucket is what *causes* it. Correct this wherever you find it.

**Where it is NOT:** app code does not implement the ratchet. Ten app-level
mechanisms are dead (§3), every form of forked ratchet is excluded with the DH
epoch attached, and frame shape is excluded twice over — by the rig=10 controlled
experiment, and structurally by reading the SDK (finding AG: in
`DoubleRatchetInboxEncrypt` the inner `DoubleRatchetEncrypt` call happens *before*
the `sent_accept` branch and is identical on both sides of it, so init-wrapping
cannot alter the inner ciphertext).

**~~Still open, and both upstream:~~ RESOLVED 2026-07-27 — it is the LOOKUP.**
The question was whether the lookup consults a bucket it shouldn't or the bucket
*contents* were written wrong earlier. Ablation cannot separate them, but
*inspection* can, and it did not need the crate source: the bucket's keys decrypt
their own frames correctly (3/3 measured), so the contents are valid — they are
being matched **by index** against a frame from a different chain. See finding AI
and `dr-prune-safety.mjs`. This is the sharpest thing we can hand upstream: not
"skipped-key handling misbehaves" but "the skipped-key lookup does not verify that
the bucket's header key belongs to the frame's chain".
→ **Filed upstream** as **item 1a** of [#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183), the
issue's lead item. The body was rewritten 2026-07-27 to put it first, correct the
desktop↔desktop attribution previously given to the fork, and absorb the standalone
comment (since deleted). **That body is now the whole upstream story.**
**Not fixable here — but see §5 option B, which AE newly makes possible.**

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
— the only live lead.** Body rewritten 2026-07-27 and the standalone comment
folded into it, so the body is the whole story. Its shape:

- **item 1** — crate, skipped-key handling around the DH ratchet step
  - **1a** = finding AE, the poisoning bucket. What our live traffic shows.
  - **1b** = the advanced-start fork. Deterministic repro, but its live impact
    is now stated as UNQUANTIFIED — the d↔d failure once cited for it is
    attributed to 1a, and no production failure is cleanly 1b-shaped.
- **item 2** — the node write path dropping frames handed to an open socket,
  32% one direction phone↔phone. **Now measured desktop↔desktop for the first
  time: 0% loss, both directions, 301 frames each way with a 20-minute redelivery
  tail** (finding AL, `yarn harness dm-loss`). That does not refute item 2 — it
  bounds it to platforms/paths other than d↔d, and it removes transport loss as an
  explanation for the d↔d symptom.

Neither is fixable here. **If you produce new d↔d evidence, add it there — the
lead dev reads that issue, not this file.**

**4. No dead-session detection.** The detector must require *retry-exhaustion on
a session with zero successes*, never first-failure — the healing-lag class
recovered 51/51 in the mobile rounds and must not trigger a reset.
**Awaiting a product decision, not evidence:** auto-reset silently, or prompt?
Given this bug's history, prompt is the safer first step. Do not build without it.

---

## §5. Next action

**Nothing this repo can do will FIX the root cause** — it is in a crate we have no
source for. The app is exhausted as an explanation, the three real client defects
are merged, and the evidence is filed upstream.

⚠️ **But "cannot fix the cause" is not "cannot fix the symptom."** An earlier
version of this section said "everything this repo can do has been done"; that
predated AE.

> **STATE OF PLAY, 2026-07-27 (read this before picking anything below).**
> The mechanism is fully characterised (AI), reproducible on demand in seconds with
> no devices, and **the client-side mitigation is MERGED to main as PR #265**
> (2026-07-27): 32→0 failures with no cost to delayed frames (§5-B1′). Transport
> loss is measured at 0% d↔d (AL).
>
> **The open questions are now narrow:** what supplies the out-of-order delivery
> that forms the bucket in the field (§5-D); whether the mitigation behaves on
> mobile↔desktop traffic; and porting it to mobile, which does not have it.
> *(Updated 2026-07-28 — this block previously said the highest-value action was
> getting that branch reviewed and merged.)*
>
> ⚠️ And note what AJ says about this bench: two harness defects silently produced
> wrong numbers before controls caught them. Treat any new harness measurement as
> suspect until a control could have falsified it.

### FIRST: the offline tools that answer questions without a capture round

Ten hypotheses in this investigation were killed the slow way — book a round, ask
the operator for attention, wait, read logs. The tool that finally found the root
cause needed **none of that** and arrived last. Do not repeat that ordering.

| tool ([`.agents/tools/dm-debug/`](../../tools/dm-debug/)) | answers | needs |
|---|---|---|
| `dr-ablate.mjs` | **what CAUSES a failure** — re-runs a real captured decrypt while changing ONE state property at a time; a load-bearing property announces itself by making the frame decrypt | a saved log |
| `dr-replay.mjs` | is this failure genuine and reproducible, or an app-level race | a saved log |
| `dr-advanced-start-fork.mjs` | reproduces the upstream crate's advanced-start fork from a pristine X3DH pair | **nothing** — no log, no devices |
| `dr-position-table.mjs` | drives **fresh** sessions through six delivery regimes and scores failure by chain position. 1920 frames, zero failures — corroborates AC, and is ⛔ **not** evidence the crate is clean (a fresh session has no poisoning bucket). Its unrealised value is the session-ageing test below | **nothing** |
| `dr-prune-safety.mjs` | **the mechanism and the mitigation.** Reports, per captured failure, what the frame actually *is* (its index in its own chain, whether it drove a DH step, whether that index collides with the stale bucket) and whether recovery is real or a re-accepted duplicate. Its synthetic half **builds the poisoning condition from a pristine X3DH pair** and answers the questions the failure-only corpus cannot — above all "does the prune break a frame that would otherwise succeed" | a log (optional; `--synthetic-only` needs **nothing**) |
| `dr-self-echo.mjs` | does a client receive its OWN outbound frames? Joins `[DM-send wire]` against `[DM-recv wire]` in one client's log. **0 of 2709 captured browser arrivals** — which is how the harness's 41-48% self-echo was identified as a bench artifact and not the cause of the ~40% failure rate | a log |

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

### AND: a headless harness that drives the REAL client — `src/dev/tests/harness/`

New 2026-07-27. The offline tools above replay/ablate a *captured* failure; this
runs the **whole real desktop client** (real `MessageService` + `MessageDB` on
fake-indexeddb + ws transport + wasm core) in Node — both sides of a conversation
in one process, one clock, any volume, unattended. NOT a reimplementation: inbound
frames go through the real `handleNewMessage`, outbound through the real
`submitMessage` → action queue → socket. It registers throwaway accounts on the
live relay; needs **no devices, no browser, and no diag branch** — it instruments
from the outside and writes `[XPDUMP]` records `dr-ablate`/`dr-replay` read
unchanged.

```
yarn harness dm-basic     # two bots exchange DMs both ways; merged both-sides log
yarn harness dm-volume    # concurrent bidirectional load, samples skipped_keys
yarn harness dm-receive   # a bot decrypts a DM you send from a browser
```

On any decrypt failure a bot auto-writes `logs/<ts>-<bot>.xpdump.log` → feed
straight to `dr-ablate.mjs`.

**Use it to:** run controlled experiments in minutes instead of booking a round
(the fresh-vs-reused-account control that produced the §1 bench refinement took
~5 min); regression-test a fix once one lands; measure the transport claim
(item 2) by counting send-vs-arrive over hours.

**It DOES now reproduce the production failure** (finding AI): `yarn harness
dm-reorder` withholds the head of a sending chain to form the stale bucket, then the
sender's next chain fails at exactly the colliding indices. `yarn harness
dm-stale-bucket` runs that cycle at scale with the mitigation off and on. So
`importSession.ts` (lift a degraded row out of a browser) is **no longer needed** —
the degraded state can be built from scratch.

**Cannot:** it is the desktop protocol + service layer, **not the UI and not
mobile**. Volume alone still does not age a session (§1 refinement).

⚠️ **Read AJ before trusting a harness number.** Two defects in this bench produced
confidently wrong measurements (a shared IndexedDB across bots, and an observer
blind to decrypt failures). Both are fixed and documented in
`src/dev/tests/harness/README.md`, but the lesson is the general one: give every
harness claim a control that could falsify it. Full plan + env gotchas:
[headless DM harness task](../../tasks/2026-07-27-headless-dm-harness.md).

### If you are here because the user reports DM lag or a missing message

That is the known symptom of the unresolved upstream cause. **Do not start a new
investigation.** Confirm it matches (§1), then either wait on
[#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183) or pick up
option B below.

### A. Waiting on upstream — the honest default

The root cause is filed as item 1a of [#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183)
(body rewritten 2026-07-27). It bears on item 1b: the fork needs establishment-phase
frame loss as a trigger, and our data shows chain-start frames fail on first
attempt essentially always, so the trigger is systematic rather than incidental.

**If the lead dev replies asking for evidence**, we can re-run instrumented rounds
(§6) against any build. We deliberately did NOT promise to hand over state blobs:
captures contain live ratchet state, they live only on the operator's machine, and
they are not going in a public issue.

### B. Mitigation we control — B1′ is BUILT AND MEASURED, B2 is now redundant

**B1. ~~Prune the poisoning bucket and retry.~~ VALIDATED, BUT ONLY IN THE B1′
FORM — implemented on branch `feat/dm-stale-bucket-retry`, 2026-07-27.**

> ⚠️ **B1 as originally written above is DESTRUCTIVE. Do not ship it.** The three
> blocking questions are now answered, and the answer to (2) is bad: those keys are
> the ONLY way to read genuinely out-of-order frames, and a receiving chain cannot
> be run backwards to re-derive them. **Pruning and persisting destroyed 3 of 3
> delayed frames that decrypt without it** — and those are precisely the frames
> redelivery recovers today. Naive B1 would have traded recoverable latency for
> permanent loss and looked like a fix while doing it.

**The three questions, answered:**

1. *Does pruning break a frame that would otherwise succeed?* **Yes** — the frames
   whose keys are in the bucket. Note the original plan ("run the variant across
   all captured successes") **cannot be executed**: `[XPDUMP]` fires only inside the
   two decrypt-failure catch blocks, so the corpus contains **zero** captured
   successes by construction. It was answered synthetically instead, where one
   state holds both the retried frame and the bucket's own frames.
2. *What is lost?* Everything in the bucket, irrecoverably — see above.
3. *Do the non-recovering failures differ?* Yes. On the full corpus 20 of 159 do
   not recover; they sit on near-empty maps (`rLen=3, buckets=1, keys=1`) and 2
   have no current-header bucket at all. Consistent with genuine replays, as
   guessed.

**B1′ — the form that is safe, and what makes it safe.** Use the pruned state as a
*decrypt input only*, then re-file the bucket under its own header key in whatever
state gets persisted. The retried frame drove a DH step, so by the time the state
is saved that header key is **no longer current** and cannot poison again, while
the delayed frames it serves still decrypt.

Measured (`yarn harness dm-stale-bucket`, 8 cycles per arm, fresh accounts both):

| | retry OFF | retry ON |
|---|---|---|
| stale bucket formed | 8/8 cycles | 8/8 cycles |
| AEAD failures on new-chain frames | **32** of 56 | **0** of 56 |
| failures on the DELAYED frames | 0 | **0** ← the regression that matters |

**And measured against REAL degraded production state**, not just bench-built
sessions. Each `[XPDUMP]` record holds the complete `EncryptionState` row *and* the
frame that failed against it, so the shipped helper can be run against the field
corpus directly — no export, no device
(`DM_LOG_DIR=<logs> yarn harness replay-captured`):

| | |
|---|---|
| distinct captured failures (54 logs, de-duplicated) | 159 |
| recovered by the **shipped** code | **139 (87%)** |
| recoveries that preserved the bucket's keys | **139/139** |
| not recovered | 20 (near-empty maps; 2 have no current-header bucket) |

That figure matches `dr-prune-safety.mjs` exactly, which is the point of running
both: the analyzer open-codes the mutation, so a divergence between it and
`dmStaleBucketRetry.ts` would otherwise go unnoticed.

Implementation: [`src/utils/dmStaleBucketRetry.ts`](../../src/utils/dmStaleBucketRetry.ts)
(pure, 14 unit tests) wired into **both** decrypt branches of
`handleNewMessage`. Two things a future editor must not undo:

- **The retry has to wrap the decrypt AND `parseDecryptedMessage`.** A DM decrypt
  failure does *not* reject — the crate returns a result whose `message` carries
  `Decryption failed: aead::Error`, and `parseDecryptedMessage` is what throws.
  A first version wrapped only the decrypt call and silently never fired.
- **The re-file step is not optional.** Removing it is exactly naive B1.

There is a kill switch (`staleBucketRetry.enabled`) because this is a workaround
for a defect in a dependency we have no source for. It is inert on a healthy
session: no bucket under the current key means one JSON parse and no retry.

**Still to do before merge:**
- Decide whether the `logger.warn` on each recovery is wanted in production or
  should be sampled.
- Confirm it in a browser. Everything above is protocol + service layer; nothing
  has run the UI.
- ⚠️ **Mobile↔desktop is worth doing but is NOT a correctness gate**, and an earlier
  version of this section wrongly implied it was. The retry is purely
  receiver-side: it keys off the receiver's own ratchet state and never inspects
  the frame's origin, so a mobile-sent frame cannot reach a different branch.
  What cross-platform traffic would measure is **how often buckets form in real
  use** — the §5-D trigger question — not whether the mitigation is sound.

**B2. Trigger redelivery on decrypt failure instead of waiting for it.**

**Recovery already works; it is just slow.** Failed frames decrypt on redelivery,
and the whole user-visible symptom is how long that takes. If redelivery were
triggered **on decrypt failure** rather than waited for, most of the lag and the
inverted typing indicator would shrink *without* the upstream fix.

Unbuilt and unscoped. It is mitigation, not a cure, and it must not weaken the
retention that makes recovery possible in the first place. Start from
`UndecryptableFrameTracker` (`src/utils/frameRetry.ts`) and the skip-and-keep path
in the receive handler.

> **B1′ has landed, so B2 is now mostly redundant** — B1′ recovers the frame on the
> first delivery, so there is no wait to shorten for the failures it covers. B2 would
> only help the residue B1′ does not recover (20 of 159 in the corpus, which look like
> genuine replays and would not benefit either). **Do not build B2 without first
> measuring what fraction of failures survive B1′ in real traffic.**

### C. The one fix never exercised live

The init-envelope age-bound fix (§7) is merged but no round has triggered it,
because it only fires for a client that has been offline past the window. To
confirm: close one client, reset and send ONE message from the peer, wait 15+
minutes, reopen on a diag build, and check that `STALE init envelope IGNORED` does
**not** fire and the message arrives. Fifteen minutes with the client closed, so
it costs no attention.

### D. ~~Still never reproduced deliberately~~ — REPRODUCED 2026-07-27, and what is left

**The failure mode is reproduced deliberately**, in seconds, with no devices:
`yarn harness dm-reorder` (real client) and `dr-prune-safety.mjs` (bare crate).
Finding AI. Anything that needed "a genuinely broken session to look at" can stop
waiting.

**What that does NOT answer, and is now the only open question here:** *how the
stale bucket comes to exist in ordinary use.* Forming it requires a later frame of a
sending chain to be processed before an earlier one, and the relay delivers in
order — so on the bench it takes deliberate withholding. In the field something
supplies that reordering: frame loss followed by redelivery, a reconnect, or
cross-platform behaviour. Volume alone does not (§1 bench refinement).

That is what the original field pattern would still buy — not the failure, but its
*trigger*. It is also the one question that bears on whether the mitigation in
option B1 is enough on its own, or whether the reordering source is itself worth
fixing. Cheap next probe: instrument how often a real client processes a chain's
frames out of order, which needs one counter and no capture round.

### E. ~~Separate the confounds behind the feedback-loop hypothesis~~ — LARGELY ANSWERED

§2i's story was "map grows → more failures → map grows", flagged as a hypothesis
because `skipped` is confounded with session age, DH epoch count and traffic, and
failures also *create* skipped keys.

**What AI settles.** Ageing is not required at all: the failure needs one stale
bucket and one index collision, and a session two messages old will do. So the
"grow the map without ageing the session / age it without growing the map" experiment
is no longer the pivotal test — the causal arrow is established directly, by building
the state and observing that the failing index set equals the bucket's index set.

**The feedback loop is real but secondary.** Each failure does leave a skipped key,
which enlarges the bucket and widens the range of colliding indices. That explains
gradual degradation. It is not what starts it.

**What is still open is narrower and is now stated in §5-D:** what supplies the
out-of-order delivery that creates the first bucket in the field. That is a question
about the transport and the client's processing order, not about the ratchet.

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

> **Before booking a two-browser round, ask if the headless harness can answer it
> instead** (§5, `src/dev/tests/harness/`). For anything below the UI — protocol,
> session lifecycle, transport counts, reproducing/measuring a failure mode — it
> runs both sides in one Node process with no devices and no attention cost. Book a
> manual round only for UI behaviour, mobile, or a genuinely aged real session the
> harness cannot yet synthesise. The two-browser rig below remains the tool for
> those.

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
in [`.agents/tools/dm-debug/`](../../tools/dm-debug/) **in this repo**, alongside the existing console snippets, because `.agents/` is
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
