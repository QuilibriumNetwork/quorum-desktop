---
type: task
title: "Transport & DM reliability — START HERE. What is open, what is blocked, what is not work at all"
status: in-progress
priority: medium
created: 2026-08-01
area: WebSocket transport / DM Double Ratchet / spaces / receipts
repos: quorum-desktop + quorum-mobile + quorum-shared + upstream
related:
  - "index.md (THE MAP — every doc, PR and issue. The archive of how the reasoning moved)"
  - "measurements.md (THE NUMBERS — append-only, never rots)"
  - "runbook.md (THE PROTOCOL — follow before any device round)"
---

# Transport & DM reliability — START HERE

> 📁 **The whole issue lives in this one folder: `.agents/tasks/transport/`.**
> Consolidated 2026-08-01 from `docs/`, `bugs/` and `tasks/`, where 17 files had scattered
> across three folders over five weeks. Bugs, tasks and reference material sit side by side
> here on purpose — **the organising principle is the issue, not the file type.**
>
> ⚠️ **Two things this folder deliberately does NOT contain**, so you don't go hunting:
> - **The mobile half.** `quorum-mobile/.agents/` is gitignored, so its transport docs cannot
>   move here and have no git history. Rows below name them with a `quorum-mobile/` prefix.
> - **The tooling.** Scripts and harnesses stay at `.agents/scripts/` and
>   `.agents/tools/dm-debug/`, because they are run by path from docs, tasks and commands alike.
>
> `.done/` and `.solved/` files stayed where they were. **This folder is live work only** —
> if something here is finished, move it out to the normal `.done/` or `.solved/` home.

**Read this page before the index.** The index is 700+ lines and is the *archive*: it
records how the reasoning moved, including everything that was retracted. This page is one
screen and answers the only two questions you usually have — **what is open, and whose is it.**

> **To brief an agent, paste this:**
>
> ```
> Read quorum-desktop/.agents/tasks/transport/README.md first (what is open),
> then issues/transport/index.md §2 (the read-first ladder).
> Never quote a figure without checking issues/transport/measurements.md.
> ```

## Where it stands, in one paragraph

For ~6 months a share of messages between clients were delayed or silently lost. It was
never one bug. **The app-side layer is now largely fixed** (~30 client PRs across three repos
in July 2026). **Three root causes remain, and all three are below our code**: the relay
kills any client >1 s late on a pong (the big one, and the cause of the mobile DM loss), and
two bugs in the upstream `channel` crate. The client-side damage from the relay bug is
**shipped and survivable** as of 2026-07-31; the causes are the lead dev's, filed as
[quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183).

## The state vocabulary

| state | meaning |
|---|---|
| 🔴 `BLOCKED-UPSTREAM` | we cannot fix it. It needs the lead dev. Do not build around it without saying so |
| 🟠 `OWED-A-ROUND` | no code needed — it needs the operator, devices, and an hour |
| 🟢 `READY-TO-BUILD` | unblocked, ours, someone just has to do it |
| 📘 `LIVING-REFERENCE` | **never completes.** A protocol, a log, or a map. Not a work item |
| 📦 `ARCHIVE` | historical evidence. Read-only |

---

## 🔴 BLOCKED-UPSTREAM — four causes, none of them ours

| # | what | next action | doc |
|---|---|---|---|
| U1 | ⭐ **Relay pong deadline is ~6× too tight.** Pings every 9.0 s, 10.0 s deadline only a pong refreshes, kills TCP with no close frame. **The cause of the mobile DM loss** | `pongWait` 10→60 s, `pingPeriod` 9→54 s. **#183 item 1.** Self-verifying: `relay-pong-probe.mjs nopong 90` should survive ~60 s instead of dying at 10 s | `2026-07-30-mobile-frames-lost-into-a-dying-websocket.md` |
| U2 | **Crate: skipped-key lookup matches by index** without checking the bucket belongs to the frame's chain | **#183 item 2a.** Mitigated on desktop (PR #265); crate still wrong for everyone | `2026-07-26-dm-desktop-to-desktop-resurfaced.md` |
| U3 | **Crate: late-join fork.** A receiver whose first frame sits at chain position ≥2 forks permanently at the next DH turn | **#183 item 2b.** Deterministic repro exists. **Unmitigated on both platforms** | `tools/dm-debug/dr-advanced-start-fork.mjs` |
| U4 | **Node write path: residual vanished writes.** Most of the original evidence is now explained by U1; a directional asymmetry (32% one way, 0% the reverse) is not | **#183 item 3.** Needs node-side logs, or a protocol write-ack | `measurements.md` |

**U1 is the one to push.** It is a two-line config change, he can verify it himself in a
minute, and it is the only change that stops connections dying — everything we shipped merely
makes the loss survivable. Connections still died **9 times in 51 seconds** during the round
that scored 20/20.

## 🟠 OWED-A-ROUND — no code, just device time

| # | what | why it matters | doc |
|---|---|---|---|
| R1 | ⭐ **Confirm the shipped send-retention fix on a device** | The 20/20 rounds tested a *local patch*; the merged code differs in four ways. An 08-01 smoke round landed 20/20 but had **no socket data**, so it cannot be scored | `2026-07-31-dm-fix-shipped-confirm-and-measure-spaces.md` §3 |
| R2 | ⭐ **Measure Spaces — never done, on any platform, ever** | Every claim about the Spaces write path is code-reading. Verified that space writes share the DM outbound queue, so the shipped fix *should* already cover them. Untested. **⏳ May no longer need device time for the desktop↔desktop half** — B7's S2 would measure it headlessly. Mobile still needs a round | same file, §4 |
| R3 | **Receipt-truthfulness two-device runtime check** | Code shipped on all three platforms; verification owed by both clients. **Blocks B2** | `quorum-mobile/.agents/tasks/.done/2026-07-26-receipt-truthfulness-delivery-gated-reads.md` |
| R4 | **Desktop ack self-echo guard** — multi-device run | Desktop lacks mobile's `senderId !== self` guard. Fan-out confirmed; damage unconfirmed | `2026-08-01-desktop-ack-self-echo-guard.md` |

⚠️ **Before any round: read the runbook, and run `validate-capture.mjs`.** Round 25 was
captured, analysed and thrown away because that check was left to a human. Round Q was nearly
lost the same way.

## 🟢 READY-TO-BUILD — ours, unblocked

| # | what | size | doc |
|---|---|---|---|
| B1 | **Desktop has no send retention at all** — it doesn't consume the shared client that got the fix. ⏳ **Route DECIDED 2026-08-04: Option B** (port `SendRetention` into the existing provider), not A — adopting `BrowserWebSocketClient` would drag in `flushOutbound` + `DISCONNECT_GRACE_MS`, which have no shared equivalent, and desktop would be that client's first-ever consumer. **Re-sized small → medium**: three hazards found while scoping, incl. a silent replay-ordering trap | medium | `2026-08-01-desktop-send-retention-gap.md` |
| B10 | **`flushOutbound` reports success on `bufferedAmount` alone** — split out of B1 on 2026-08-04. Same blind window, but on the revoke-device-before-wipe path, so a false "delivered" is followed by a wipe that destroys the means of retrying. **B1 does not fix it** (that caller reloads the page, so there is no next connection to replay on) | small-medium | `2026-08-04-flushoutbound-reports-delivered-on-bufferedamount-alone.md` |
| B2 | **DM dead-session auto-heal — heal action 2 only** (dead-direction re-init). Heal action 1 is subsumed by send retention. Two proven causes behind it (U3 + the stale-returning-device bug). ⚠️ **Gated on R3** | medium | `2026-07-17-dm-dead-session-autoheal.md` |
| B3 | **Stale-returning-device: sends vanish and misfile.** Severity high, real-user shape (reinstall, long-idle second phone). Mechanism demonstrated live; code-path reading owed | medium | `2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md` |
| B4 | **Port the #265 stale-bucket mitigation to mobile** — desktop-only today, so mobile still suffers U2 | small | `2026-07-26-dm-desktop-to-desktop-resurfaced.md` §5-B1′ |
| B5 | **Space `log-append` ack-resend** (Layer 2) — the ack arrives and is discarded, so a dropped space message is invisible to its author. Mobile-only (desktop has no hub log) | small | `quorum-mobile/.agents/tasks/2026-07-21-fix-space-append-send-loss-ack-resend.md` |
| B6 | **Mobile piggyback receipt acks on outgoing DMs** — half the port is missing | small | `quorum-mobile/.agents/tasks/2026-07-27-mobile-piggyback-receipt-acks-on-outgoing-dms.md` |
| B7 | **Headless space harness** — ⏳ **S0+S1 done and green (PR #297)**: a bot creates a real space, a second joins by invite and gets both the post and the member roster. **S2 is the deliverable and is not started** — it is the slice that produces a RATE, which is the whole point. Makes R2 repeatable instead of manual, and is the instrument the roster bug asks for by name | medium | `2026-07-27-headless-space-harness.md` |
| B8 | **Hygiene**: ghost-device deregistration, junk encryption-state prune | small | index §4-E |
| B9 | ⚠️ **Lower value than it looks:** harness scenario 3 (mobile multi-device), and tooling T3/T4. Green benches on healthy relays add nothing now that the mechanism is confirmed, and T3's question was answered from the desktop by the relay probe | — | `2026-07-28-harness-multidevice-and-coverage.md`, `2026-07-29-transport-debug-workflow-and-tooling.md` |

## 📘 LIVING-REFERENCE — these never complete, and that is correct

**If you were wondering which of these are "done": none of them, ever.** They are protocols,
logs and maps. This is the section that was confusing, because one of them used to sit in
`tasks/`.

| doc | what it is | when you touch it |
|---|---|---|
| `index.md` | **the map + the archive.** Every doc, PR, issue; the retracted theories; the status-hygiene record | add a row when a doc is created; update §7 when a PR merges |
| `measurements.md` | **the numbers.** Append-only, and the only file here that cannot rot — a measurement is only ever superseded | **append after every run.** Never rewrite a past row |
| `runbook.md` | **the protocol** for operator-assisted rounds: the 6 rules, the estate, burned letters, step-by-step. *(Moved out of `tasks/` on 2026-08-01 — it is not a work item)* | update when a tool or rule changes |
| `dm-ratchet-upstream-divergences.md` | the 8 shipped divergences from upstream DR. Lead-dev facing | when a divergence is added or retired |
| `issue-183-body.md` | the upstream issue body | when #183 is edited |
| `docs/debugging/dm-architecture-and-debug-playbook.md` | DM internals + the debug ladder | reference |
| `docs/features/messages/dm-receipts.md` | how receipts work | reference |
| `tools/dm-debug/README.md` | 6 console snippets + 6 node CLI tools. **Reach for these before booking device time** | when a tool is added |

## 📦 ARCHIVE

| doc | what |
|---|---|
| `2026-07-26-dm-desktop-to-desktop-captures.md` | round data + findings A→AL + retracted mechanisms. Cited by letter from the entry point. Read-only |

---

## The two things you can verify yourself, in seconds, without an agent

```bash
cd quorum-desktop
node .agents/scripts/relay-pong-probe.mjs nopong 90   # U1: dies at ~10s. Survives ~60s once fixed
yarn harness dm-reorder                                # U2: reproduces the crate bug in ~35s
```

Both root causes that still affect users are things you can watch happen on your own machine.
Use them — including to check whether the lead dev's fix has landed, rather than waiting to
be told.

## Read-next ladder

1. **this page** — what is open
2. `measurements.md` — before quoting any number
3. `runbook.md` — before any device round
4. `index.md` §2 — the full ladder into the archive
5. [quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183) — the lead-dev-facing summary

---

## Maintaining this file

**This is the one file in the cluster that deliberately carries status**, which means it is
the one that can go stale. That is an accepted trade: the index refuses status to avoid rot,
and the cost was that nobody could tell what was open. Keep it cheap to maintain:

- **One line per item.** Detail belongs in the doc the row points at, never here.
- **Move rows between states**; don't delete them. A row that leaves 🔴 is the most
  informative event in this whole cluster.
- **When an item is genuinely finished**, delete its row and let the owner doc's own
  `.done`/`.solved` move be the record.
- **If a row disagrees with the doc it points at, the doc wins.** Fix the row.

---
*Last updated: 2026-08-02*
