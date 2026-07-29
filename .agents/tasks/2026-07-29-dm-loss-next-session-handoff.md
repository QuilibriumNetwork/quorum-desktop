---
type: task
title: "Handoff — where the DM loss investigation actually stands, and the operator's four open questions"
status: OPEN — orientation for a fresh session. No code work queued; the next move is answering the questions in §3.
created: 2026-07-29
area: DM delivery / transport / debugging methodology
repo: quorum-desktop (+ quorum-mobile)
related:
  - "docs/transport-reliability-index.md (the map — read §1 items 6c/6d first)"
  - "docs/transport-measurements.md (§ THE SENDER ISOLATED — the key row)"
  - "quorum-mobile#183 (upstream; its §2 now carries the isolation evidence)"
---

# Handoff — DM loss, end of 2026-07-29

## §1. The one thing to know

**The sender is isolated.** Same account, same receiving desktop, same relay,
minutes apart, both counts read from the receiver's own local store:

| sender | runtime | delivered |
|---|---|---|
| the operator's **mobile app** | **RN native socket + uniffi crypto** | **16/20**, then **17/20** |
| a **harness bot as the same account** | Node `ws` + WASM | **20/20** |

Losses were scattered (`T1,5,13,17` / `U2,5,10`), still absent 10+ minutes later.
Everything common to both rows — receiving client, relay, account state,
multi-device fan-out — is exonerated by one row being perfect.

During the loss the receiver logged **zero** decrypt failures and **zero**
missing-state drops, and its storage agreed exactly with the rendered
conversation. **The frames were never received at all.**

## §2. What shipped, and what did NOT

**Merged to `main`, NOT deployed** (deliberately — the operator asked to hold):

| PR | what |
|---|---|
| #270 | receive handler no longer awaits the relay; 14 sites. Confirmed by fault injection, validated under 66 injected 30s stalls |
| #271 | `yarn harness:cross` — mobile↔desktop on one bench, two processes via mobile's rendezvous. quorum-mobile unchanged |
| #272 | per-message persistence counting, canonical mode, two stall detectors |
| #273 | unplaceable frames retained instead of a delete that named the wrong mailbox |
| #274 | `dm-session-churn`, plus the docs for all of the above |

**Five hypotheses died today.** Lock deadlock, proportional ceiling, permanent
destruction, session-replacement-under-load, and a "latency not loss" reframing.
Two real code defects were found and fixed along the way; **neither was the field
symptom**. That ratio is the honest shape of the day and is recorded in the bug
files rather than smoothed over.

⚠️ `bugs/.solved/2026-07-29-session-replacement-strands-in-flight-frames.md` — code
defects real and fixed, **causal claim retired**. Read its §8 then §7 before §1.

## §3. The operator's four open questions — the actual agenda

These came at the end of the session and are the reason it stops here rather than
continuing. They are good questions and none of them has been investigated.

### 3.1 Could this be the DEV environment rather than the product?

Both the failing sender (mobile) and the receiving desktop were **development
builds**. Nothing in this investigation has ruled out that the loss is an artifact
of dev tooling — Metro bundler, hot reload, dev-mode React double-invocation,
unminified timing, a dev-only WebSocket shim.

The operator half-remembers a past test against a **production preview build**
specifically to check this, but not the result. **Find it or redo it.** If a
production build does not lose messages, everything downstream changes.

This is cheap and should probably go first.

### 3.2 Why can we not just READ the answer out of the debug branches?

Both repos have debug branches carrying **very verbose logging**, built during
earlier capture rounds precisely to answer "why did this message not land". The
operator's fair challenge: *with that much instrumentation, why is this still hard?*

Nobody this session looked at those branches. Worth establishing:
- which branches, in which repo, and whether they still apply cleanly
- what they log at the **send** side on mobile (the now-isolated suspect)
- whether a mobile debug build would show a frame reaching `ws.send` and never arriving
- whether their logs were ever collected from the *sending* side rather than the receiving side

If those branches already log the send path, running one capture on them may be
far cheaper than anything else proposed here.

### 3.3 Why has this been so hard to pin down?

Worth answering explicitly, because the pattern keeps repeating. Contributing
factors observed today:

- **Every measurement answered a narrower question than it appeared to.** Frame
  arrival ≠ decrypt ≠ persistence ≠ display. Three separate 0% results meant less
  than they looked like.
- **Instruments that could not express the failure.** The lock histogram samples
  in a `finally`, so a hold that never returns is never sampled — `max=412ms` read
  as healthy while a device had stopped entirely.
- **Intermittency.** Any single observation is a coin flip; two runs 20 minutes
  apart gave 0/0 and 42/0 on the same counters.
- **Benches that lacked the trigger, not the bug.** Volume without churn, churn
  without volume; fresh accounts never replace a session.
- **Confounds we introduced.** The harness re-registering bots churned sessions on
  the operator's account and produced a 366-drop capture that was probably our own
  artifact.

### 3.4 Is a third measurement run worth it?

Two runs isolate the variable (15% and 20%). A third would tighten the rate but
not change the conclusion. Cheap if the operator is willing: send `V 1`…`V 20`
from mobile, then `await window.__probe.report('V')` on the desktop.

## §4. The receiver-side probe (reusable, paste into the desktop console)

Hooks the logger and reads IndexedDB directly. `report(prefix)` returns landed
count, missing numbers, and warning counts since install. **Timing matters: take
the reading DURING a failure.** Counts taken while messages were landing came back
0/0 and said nothing. Full snippet in this session's transcript; rebuild from
`quorum_db` → object store `messages` → filter `content.text`.

## §5. What NOT to do

- **Do not build another client-side fix on current evidence.** Arrival, decrypt,
  persistence, display, all four platform pairings, aged accounts, fan-out and
  session churn all measure clean. Something client-side may still be wrong, but
  nothing currently points at it.
- **Do not re-run green benches.** `dm-loss`, `dm-multidevice` and `dm-cross` on
  healthy relays add nothing. Only fault-injected or trigger-carrying runs do.
- **Do not reopen the session-replacement bug** without new evidence; three
  purpose-built runs and two production readings all failed to support it.
- **Do not run the harness against the operator's canonical accounts** while they
  are taking readings — it churns sessions and contaminates the counters. This
  already happened once.

---
*Last updated: 2026-07-29*
