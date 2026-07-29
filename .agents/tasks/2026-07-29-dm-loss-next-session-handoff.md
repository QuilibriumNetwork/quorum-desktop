---
type: task
title: "Handoff — where the DM loss investigation actually stands, and the operator's four open questions"
status: OPEN — §3.1 and §3.2 ANSWERED by research 2026-07-29 (inline below). What remains needs the operator: Run A (§3.5), which answers §3.1's redo and §3.4 in one 20-message run.
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

**✅ ANSWERED 2026-07-29 — the past test was found, and it does NOT settle the question.**

The half-remembered test is **Runs 3–5 of 2026-07-21**, recorded in
`quorum-mobile/.agents/bugs/2026-07-20-mobile-desktop-message-transport-delay-loss-master.md` §5,
all on the prod-preview build (`build-prod-variant.ps1` → third app id `….preview`):

- **Run 5 (prod-preview): DMs both directions 5/5, with receipts — clean.** But
  n=5, and the report itself flags it as "a DIFFERENT device/account pairing
  whose sessions happened to be healthy" — not the failing pairing. Five
  messages cannot speak to a 15–20% loss rate (P(no loss) ≈ 0.85⁵ ≈ 44% even if
  the bug were present).
- **Run 3 (prod-preview): SPACE mobile→desktop 4/5, one permanently lost** —
  proves loss in general "ships to prod, not a dev artifact", but spaces use a
  different transport (hub-log), so it does not answer the DM question.
- The ~10s DM send **latency** bug reproduced on BOTH the preview build and the
  real live app (2026-07-24 bug file) — production transport is not healthy,
  but that is latency, not loss.

**The uncomfortable corollary:** every DM-loss capture with send-side
confirmation (rounds 27 and 29 — the whole evidence base of #183 item 2) ran on
**dev builds**, because the rig only works there (release Hermes logs never
reach logcat; desktop's XPDUMP probe deliberately bails out of non-dev builds).
And the 2026-07-29 sender-isolation runs used the operator's dev-build mobile
app. So the dev-environment hypothesis is **not excluded by anything on file**
— the only prod-build DM datapoint is 5 clean messages on a healthy pairing.
The redo is genuinely needed; see §3.5 Run A.

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

**✅ ANSWERED 2026-07-29 — they do log the send path, they WERE run on the
sending side, and they already gave everything they are capable of giving.**

Branch inventory (verified against both repos' git, all local-only, never pushed):

| repo | branch | head | state |
|---|---|---|---|
| mobile | **`diag/dm-frame-trace`** — THE rig | 07-27, 5 commits | **merges clean onto current master** (dry-run `git merge-tree`); enter with `git debug`, never by SHA |
| mobile | `debug/transport-trace` (WSTRACE, space era) | 07-21 | superseded by the rig |
| mobile | `debug/dm-cross-platform-trace`, `test/dm-fix-instrumented`, `test/dm-instrumented-v2` | 07-25 | earlier XPTRACE iterations, superseded |
| desktop | `diag/dm-frame-join` (rig=11) | 07-27, 14 commits | ⚠️ **now CONFLICTS with main** — PRs #270–#274 rewrote the receive path it instruments; its `git debug` will stop at "REBASE FAILED". Not needed for the current agenda (the §4 receiver probe measures without instrumentation), but budget resolution time before any future desktop capture |

What the mobile rig logs **at the send side**: `[DM-send wire]` at prepare-end,
plus the `patch-rn-ws-diag.mjs` node_modules patch that logs **every individual
frame AT the `ws.send` call** — length, target inbox, `bufferedAmount`, and a
mid-batch `readyState` check. (`git debug` re-applies the patch; it dies on
every `yarn install`, which is what invalidated round 25.)

**"Why can't we just read the answer out of them?" — we did.** Rounds 27 and 29
ran the rig on the phones; the local `mobile-xptrace/` archive (25 traces,
including round 29's two phones) is exactly those send-side logs. That is where
#183 item 2 comes from: every lost frame was confirmed handed to `ws.send`,
signed, correct inbox, socket open — and never arrived, never redelivered. The
instrumentation answered the question it can reach.

**Why that didn't finish it:** the rig's deepest probe is the call into RN's JS
`WebSocket`. Below it — RN bridge → native module (okhttp on Android) → wire →
node write path — no client-side log exists, and the protocol has no write ack.
The three remaining discriminators, none tried: (a) a native-layer probe in the
debug build (log okhttp's `send()` return value and queue state — RN ignores
that boolean, a plausible silent-drop point), (b) an on-path packet capture,
(c) node-side logs — the standing #183 ask.

**What one more rig run WOULD add:** the 07-29 T/U isolation runs used a plain
dev build, so there is no send-side trace of those exact losses. §3.5 Run B
closes that.

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
- **(added by the §3.2 research)** The deepest send-side instrument stops at the
  JS/native boundary, and the two instruments cannot be combined: the rig needs a
  dev build, a prod-preview build is a logging black box. So "instrumented" and
  "production-like" have never been true of the same run — which is also why §3.1
  is still open.

### 3.4 Is a third measurement run worth it?

Two runs isolate the variable (15% and 20%). A third would tighten the rate but
not change the conclusion. Cheap if the operator is willing: send `V 1`…`V 20`
from mobile, then `await window.__probe.report('V')` on the desktop.

**→ Superseded by §3.5 Run A: make the third run a PREVIEW-BUILD run.** Same
protocol, same cost, and it answers §3.1 at the same time. A third dev-build run
only tightens a rate we already trust; a preview-build run branches the whole
investigation.

## §3.5 The two candidate runs (operator required, ~15 min each once built)

Both use the §4 receiver probe unchanged; they differ only in what the phone runs.
They are mutually exclusive instruments (§3.3 last bullet), so they are two runs,
not one.

**Run A — dev-vs-prod (do this first).**
1. `quorum-mobile/.agents/scripts/build-prod-variant.ps1` (~6 min warm, ~30 min
   cold; installs as the third app id `….preview`, guarded against overwriting
   the live app). Sign into the test account — a preview build was already a
   registered device on the shared test accounts during the July rounds, so this
   likely mints no new registration; if it does, it is one, once.
2. Send `V 1`…`V 20` from the preview build to the desktop account.
3. Desktop console: `await window.__probe.report('V')` — **during/right after,
   and again 10 minutes later** (§4's timing rule).
- **20/20 ⇒ the loss is a dev-environment artifact** — everything downstream
  reprioritizes, and the dev-tooling stack (Metro, dev WebSocket path, dev-mode
  React) becomes the suspect list. **Losses ⇒ dev environment exonerated**, the
  rate tightens (§3.4 satisfied), and #183 item 2 gains a production datapoint.

**Run B — send-side trace of the actual symptom (only if Run A loses messages).**
1. In quorum-mobile: `git debug` (verified: rebases clean onto current master),
   confirm the BUILD CHECK lines, dev-start on the phone.
2. Same `W 1`…`W 20` + probe protocol, but also capture logcat
   (`capture-xptrace.bat`) on the phone.
- Every lost message then has a per-frame record at `ws.send` (target inbox,
  readyState, bufferedAmount). All-clean-yet-missing ⇒ loss is below JS or at
  the node, on the operator's own account→desktop path — item 2's shape,
  captured on the live symptom for the first time. Any anomaly ⇒ the first
  client-side lead anyone has had.

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
