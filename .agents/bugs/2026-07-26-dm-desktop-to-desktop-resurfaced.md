---
type: bug
title: "DM delivery broken again on desktop↔desktop (the 2026-07-02 master report is NOT closed)"
status: OPEN — root cause NOT established. NEXT ACTION IS NOT 'wait for it to break': run the 10-minute age-bound test in §1b. Upstream issue #183's main text was corrected 2026-07-26 (its desktop-is-immune claim was retracted). Two client-side leads open (init-envelope age bound; four session-prune sites), plus two upstream causes already filed (quorum-mobile issue #183). One real regression of ours was found and fixed (#259). One confidently-argued mechanism was RETRACTED the same day — read §5 before trusting anything here.
created: 2026-07-26
severity: high (silent, user-visible message and reaction loss)
repo: quorum-desktop (cross-repo — mobile shares the accounts and the upstream causes)
area: DM Double Ratchet / session lifecycle / transport
entrypoint: true
related:
  - ".agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md (the mechanism catalogue — filed as solved, but the symptom RESURFACED; read it for history, not for status)"
  - ".agents/docs/dm-ratchet-upstream-divergences.md (the 8 shipped divergences, lead-dev facing)"
  - ".agents/tasks/2026-07-17-dm-dead-session-autoheal.md (heal action 2 is exactly this failure; downgraded on an assumption this bug disproves)"
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md (DM internals)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md (3000-line master, rounds 1-29 — PART I is current, PART II is archive)"
  - "quorum-mobile/.agents/bugs/2026-07-24-dm-session-confirm-row-mismatch-x3dh-every-send.md (contains the authoritative SDK reading)"
  - "https://github.com/QuilibriumNetwork/quorum-mobile/issues/183 (the two UPSTREAM root causes — not fixable in this repo)"
---

# DM delivery is broken again, desktop↔desktop

> **START HERE if you are a fresh agent.** This file is the current entry point
> for the DM-not-arriving investigation. Two things you would otherwise get
> wrong within your first ten minutes:
>
> 1. **`.agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md`
>    is filed as SOLVED. The symptom has resurfaced.** That document is an
>    excellent mechanism catalogue and a poor status report. Do not conclude the
>    bug is fixed because it lives in `.solved/`.
> 2. **The mobile master says "desktop↔desktop has no issues."** That was true
>    when written and is now **falsified** — see §2. Several conclusions in both
>    masters rest on it.
>
> **Docs in `.agents/` are written by agents after the fact and can be wrong.
> When a doc and the code disagree, the code wins.** This exact instruction
> caught a wrong conclusion in this investigation on 2026-07-26 (§5).

---

## §1. Current state (2026-07-26, end of day)

| | state |
|---|---|
| Before reset | desktop↔desktop **0 of 10 delivered, both directions**, permanent |
| After manual reset | all messages deliver |
| Later the same evening | delivers, but **laggy**; some frames land minutes late |
| Reactions | occasionally late; earlier in the day, permanently lost |

**The user's reproduction pattern, in their words:** desktop↔desktop works after
a reset; they then use the *same two accounts* on mobile for a few days; on
returning to desktop it is broken again. This has not yet been reproduced
deliberately — it is the single most valuable thing to capture.

### §1b. What to do next — in order

**Nothing here requires waiting for the bug to reappear.**

1. **Run the 10-minute age-bound test** (lead 1 in §4). Close desktop; from the
   peer, reset the session and send one message; wait >10 minutes; reopen
   desktop on the diag build; watch for `STALE init envelope IGNORED`. It fires
   ⇒ lead 1 confirmed and the cause is ours. It does not ⇒ lead 1 is dead and
   the prune (lead 2) becomes prime suspect. Either outcome is progress, and it
   does not depend on the user's mobile-usage pattern.
2. **Use the diag build as the everyday desktop client.** Both leads are now
   instrumented, so the next natural breakage self-diagnoses:
   `[DM-prune ui]`/`[DM-prune send]` ⇒ lead 2; `STALE init envelope IGNORED` ⇒
   lead 1; neither, with frames arriving and failing AEAD ⇒ upstream.
3. **Awaiting a decision from the user, not more evidence:** the dead-session
   detector (§4.4). Auto-reset silently, or prompt the user? Given this bug's
   history a prompt is the safer first step. Do not build it without that call.
4. **Small and safe, buildable now:** de-duplicate `targetInboxes` (§7) —
   observed live sending the same reaction twice to one inbox.

**Do not** re-derive the retracted mechanism in §5, and do not read the two
masters' status lines as current (see the banner at the top of this file).

---

## §2. What is PROVEN (measured, not argued)

From the 2026-07-26 dual-capture (both clients instrumented, joined by envelope
fingerprint), independently re-derived by a second agent from the raw logs:

- **Frames arrive and cannot be decrypted.** 21 of 21 of the peer's message
  frames reached the receiver and failed AEAD. **Not transport loss** in that
  direction.
- **568 failures were only 36 distinct frames**, redelivered ~16× each. Raw
  failure counts massively overstate distinct events — always de-duplicate by
  fingerprint before reasoning about volume.
- **15 of those 36 were never sent during the capture** — pre-existing stuck
  frames from before the window.
- **The two directions fail differently.** The peer reached us on one inbox;
  our sends went to seven inboxes and the receiver was listening on **none** of
  them. One side dies loudly (AEAD failures), the other silently (addressed at
  inboxes nobody reads).
- **A client can hold a dead session beside a healthy one** and keep listening
  on both forever. One inbox took 90 frames healthily while another failed
  everything it received. **Nothing detects this.**
- **Our init-envelope guards were NOT involved**: zero `STALE init envelope
  IGNORED`, zero `SESSION REPLACED` across the whole failing capture.
- **The `#253` timestamp-collision theory is refuted** for these captures: the
  `[DM-ack collision]` detector was armed and fired **zero** times. (Caveat: it
  only sees collisions among frames that *arrived*.)
- **The upstream crate fork is real and reproducible.** An agent ran
  `quorum-mobile/.agents/scripts/dr-advanced-start-fork.mjs` against the real
  wasm: a receiver whose first processed frame sits at position ≥2 has the
  sender's direction **permanently** dead; position 1 self-heals after one loss.

---

## §3. What is RULED OUT (do not re-investigate without new evidence)

- **Desktop's Confirm-vs-InboxDecrypt branch predicate is CORRECT.** See §5 —
  this was the day's biggest wrong turn. Verified against the SDK:
  `ConfirmDoubleRatchetSenderSession` throws when `inbox_public_key !== ''`,
  `DoubleRatchetInboxDecrypt` throws when `=== ''`, and the predicate selects
  exactly the function whose precondition holds. `DoubleRatchetInboxDecrypt`
  **already unwraps init-wrapped frames itself** (`channel.ts` ~L1174).
- **The `SyntaxError: ... is not valid JSON` in DM decrypt logs is not a
  serialization bug.** The crypto core returns its error string in the plaintext
  slot instead of throwing, so `JSON.parse` chokes on it. It means *AEAD
  failure*. Fixed to report itself honestly in PR #260.
- **#235, #252, #256, #258 and the per-device-signing group (#244/#245/#249/#250)
  are exonerated** for this failure. The signing work is space-scoped
  (`sendHubMessage(spaceId)`, `participant`/`space.spaceId` gates) and does not
  touch DM frame signing.

---

## §4. OPEN LEADS, ranked

1. **The init-envelope absolute age bound vs an offline receiver.**
   `INIT_ENVELOPE_MAX_AGE_MS = 10 minutes` (`src/utils/initEnvelopeGuard.ts`),
   and rule 0 fires **before** the no-rows check, unconditionally. Refused
   envelopes are **deleted server-side**. The guard's stated assumption is *"a
   legitimate init envelope is seconds old"* — true only if the receiver is
   online. A legitimate envelope minted while desktop was closed for days is
   days old on arrival and is destroyed. **This fits the "away for days, come
   back broken" pattern exactly.** Do NOT simply raise the bound: it exists
   because 26-hour and 60-day-old zombie envelopes were observed resurrecting
   dead sessions. The real flaw is that wall-clock age is a bad proxy for
   staleness when the receiver has been away.
   **Cheap test:** close desktop, reset + send from the peer, wait >10 min,
   reopen desktop, watch for `STALE init envelope IGNORED`.
2. **Four session-prune sites deleting healthy sessions.** Three in the send
   paths (`MessageService.ts`, submit/edit/retry — run on *every send*) and one
   in a `useEffect` in `src/components/direct/DirectMessage.tsx` that fires
   **whenever registration data changes**. All delete any session whose `tag` is
   absent from the current device-registration fetch, which is a *cached* React
   Query read. Mobile-created rows carry a non-device-inbox tag, so mobile use
   on the same accounts is a plausible trigger. All four were silent (three
   unlogged, one below capture level) and are now instrumented.
3. **UPSTREAM — quorum-mobile issue #183.** (a) the crate fork above;
   (b) the node write path silently dropping frames that were signed and handed
   to an open socket, reproduced phone↔phone at 32% one direction. Neither is
   fixable here. **Its main text was CORRECTED on 2026-07-26** (not just
   commented — the body itself): it previously told the lead dev that
   "desktop to desktop virtually never loses frames, so it never fires there",
   which framed the crate bug as mobile-only and would have de-prioritised the
   fix. The retraction, this bug's d↔d reproduction, and the fingerprint-joined
   21/21 arrive-and-fail evidence are now in item 1. Item 2 gained a scope note
   saying desktop has never been measured for the write drop, so its
   mobile-only framing must not be read as desktop being unaffected.
   **If you produce new d↔d evidence, update that issue body — the lead dev
   reads it, not this file.**
4. **No dead-session detection.** See §2. The detector should require
   *retry-exhaustion on a session with zero successes*, never first-failure —
   the healing-lag class recovered 51/51 in the mobile rounds and must not
   trigger a reset.

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

## §6. THE RIG — how to capture (read before booking any test time)

**Branch: `diag/dm-frame-join`** (local, never merge — it logs real key
material). Never merge it; rebase it forward onto `main`:

```
git fetch origin && git rebase origin/main diag/dm-frame-join   # rebase + switch to it
git checkout main                                               # back to normal work
```

There is a local alias for the first line (`git debug`), but it lives in this
clone's git config, so do not assume it exists — use the full command above.

The startup marker **enumerates the probes the build carries**:

```
[DM-diag] armed (desktop dm-frame-join) rig=6 probes=recv-wire,send-wire+ts,recv-branch,xpdump,prune
```

**No marker, no round** — a capture from a stale build is invalid, and this has
silenced a whole round before. Check the `rig=` number matches on **both**
clients: on 2026-07-26 one client was two builds behind and had no prune probes,
making its silence unreadable.

| probe | what it answers |
|---|---|
| `[DM-send wire] fp= to= sentAt=` | did we send it, to which inbox, when |
| `[DM-recv wire] fp= inbox= ts= path=init\|dr` | did it arrive, on which inbox, via which receive path |
| `[DM-recv branch] fp= branch=` | Confirm or InboxDecrypt, and why |
| `[XPDUMP]` | full ratchet state + sealed frame, for offline replay |
| `[DM-prune ui\|send]` | a session was DELETED, and which tag |
| `[DM-ack collision]` | a delete-by-timestamp would have taken a sibling frame |

**Capture protocol**
1. Both clients on the diag build, hard-reload, confirm the marker and matching
   `rig=` on both.
2. Console: **empty text filter, level = Warnings + Errors.** Every probe is
   `warn`/`error`; `logger.debug` never reaches the console at all (shared
   logger `minLevel` is `log`).
3. Send numbered messages so content maps to frames.
4. **Wait 2-3 minutes before saving.** Otherwise in-flight frames score as
   losses.
5. Save both consoles. Record what you *saw on screen* — **device observation
   outranks the rig**; that is how a 21-frame phantom loss was caught on mobile.

**Offline replay** — the highest-value tool, needs zero device time:
```
node E:/GitHub/Quilibrium/quorum-mobile/.agents/scripts/dr-replay.mjs <desktop.log>
```
Reassembles `[XPDUMP]` chunks and re-runs the real failing decrypt against the
real wasm core. It reports whether the seal opened, whether the frame was init
-wrapped, and whether the ratchet failed.

> ⚠️ `[XPDUMP]` lines contain **REAL KEY MATERIAL**. Throwaway test accounts
> only. Keep the logs local — never paste raw log regions into a GitHub issue
> (round data goes upstream as curated tables). Delete them when this closes.

---

## §7. Shipped 2026-07-26

| PR | state | what |
|---|---|---|
| #259 | **merged** | `orderSessionsForSend` in the offline action-queue send path — #254 patched four online sites and missed this fifth one. Offline-composed DMs only, so not the cause of this bug, but a genuine incomplete rollout. |
| #260 | open | a failed DM decrypt reports itself as a decrypt failure instead of a JSON `SyntaxError`. Diagnosis only, no behaviour change. |

**Noted, not fixed:** `targetInboxes` is not de-duplicated, so two rows sharing
a tag cause the same frame to be encrypted and sent twice to one target.

---

*Last updated: 2026-07-26*
