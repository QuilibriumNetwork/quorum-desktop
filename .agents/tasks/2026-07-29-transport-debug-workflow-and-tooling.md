---
type: task
title: "Transport debugging: the workflow and tool suite that takes the operator out of the copy-paste loop"
status: OPEN — plan agreed with the operator 2026-07-29. Build order in §6.
created: 2026-07-29
area: debugging infrastructure / DM + space transport
related:
  - "tasks/2026-07-29-dm-loss-next-session-handoff.md (how the need became undeniable)"
  - "docs/transport-measurements.md (where every result must land)"
  - "quorum-mobile#183 (the field bug all of this serves)"
---

# Transport debugging: workflow + tools

## §0. Why this exists

The remaining DM-loss bug lives outside every automated instrument: the harness
cannot drive a real phone's native socket, the diag rig sees down to JS
`ws.send` and no further, and the node side needs logs only upstream can pull.
So every discriminating datapoint costs a manual round — and on 2026-07-29 one
manual round took the operator ~2 hours of console pasting across two phones
and two browsers, tangled three separate bugs, and still needed a redo. The
work is progressing; the **cost per datapoint** is the problem. This file fixes
the cost.

## §1. The three rules (workflow)

1. **No round without a one-page plan.** Before any manual test: which SINGLE
   variable changes, and what each outcome would mean. A round that does not
   discriminate between two named hypotheses does not happen. (The V-run of
   07-29 changed two variables at once — build AND sender state — and was
   invalidated.)
2. **Separate the estates.** Canonical accounts are for the operator's manual
   tests ONLY. The harness gets its own dedicated pair (it ages them by use).
   The instrument contaminating the experiment has now cost two captures.
3. **The operator never pastes console code again.** Everything done by hand on
   07-29 becomes one-click tools (§2). The operator's role in a round shrinks
   to: press a button on the phone, read one table on the desktop.

## §2. The tool suite

> **Status update 2026-07-29 (same day):** T1 SHIPPED — quorum-desktop PR #275,
> merged (`/dev/dm-doctor`; prod-bundle exclusion proven by build + grep). T2
> SHIPPED — quorum-mobile PR #200, merged (flask icon in the DM header, dev
> builds; one `.preview` sanity check owed). Day-to-day usage now lives in
> `tasks/2026-07-29-manual-round-runbook.md`. T3 (native probe) and T4 (round
> runner) remain unbuilt.

### T1 — Resident "DM doctor" (desktop, dev build only)

The checked-in console probe (`tools/dm-debug/07-receiver-probe.js`) becomes a
resident dev-mode module + dev-panel page:

- auto-installs at startup (dev builds only, alongside the existing `src/dev/`
  dashboard infrastructure): hooks the logger for the tell-tale warnings
  (SESSION REPLACED / unknown inbox / decrypt failures) from t=0, not from
  whenever a snippet gets pasted;
- panel shows: per-conversation sequence check (prefix + expected → landed /
  missing / duplicates, reading the store like the probe does), live warning
  counters, and a copy-report button producing the measurement-log row;
- bonus: surfaces ghost conversations (a DM conversation keyed by the
  account's own address, or with a failing profile backfill) — today's bug
  would have announced itself.

### T2 — Test-burst button (mobile, dev/diag builds only)

A dev-only control that sends `<letter> 1`…`<letter> N` automatically
(auto-increments the letter per run), records each message's send-side record
(fingerprint, target inboxes, timestamps) to a file adb can pull, and shows a
one-line summary. Removes: typing 20 messages, remembering which letter is
next, and the send-side blindness of operator-driven runs.

### T3 — Native-layer socket probe (mobile debug build) ⭐ the new instrument

The 07-29 U-run cross-check proved messages die WHOLE at the source — all
fan-out copies at once. The last unobserved client layer is below JS:
RN bridge → native WebSocketModule → okhttp → wire. Since `android/` is
committed source (prebuild is fenced off), we can add native code directly:

- subclass/shadow RN's `WebSocketModule` (or register a wrapping module) to log
  every actual `send()` call **and its okhttp boolean result — which RN
  silently ignores**, plus queue size and socket lifecycle transitions with
  precise timestamps;
- debug/diag builds only; joins against T2's per-message records by timestamp
  + length;
- outcome space: frames reaching native with `send()=false` or during a socket
  transition ⇒ client-side drop found; all frames written cleanly ⇒ the loss is
  on the wire or at the node, and quorum-mobile#183 item 2 gets its strongest
  evidence yet.
- Spike first: confirm the override/registration approach compiles in the
  committed `android/` tree before promising the round.

### T4 — One-command round runner

Wires the existing pieces (`git debug`, `capture-xptrace.bat`, the dr-join
tools, T1's export) into one script: arm → capture both sides → prompt "send
now" → pull logs → join send-records vs receiver store → print the verdict
table and the ready-to-paste measurement row.

## §3. The discriminating-experiment queue (DMs, in order)

| # | experiment | needs | answers |
|---|---|---|---|
| 1 | **W-run**: preview build, AFTER sign-out/in (fresh sessions), `W 1`…`W 20`, receiver probe | operator, ~15 min | dev-vs-prod for the field symptom (handoff §3.1 — still unanswered; the V-run was invalidated) |
| 2 | **Native-probe round**: dev build + T3, numbered burst, join all layers | T3 built | dies-in-RN-native vs dies-at-node — the fork #183 has been stuck on |
| 3 | **Node-side logs window** | lead dev | the other half of #183 item 2. The message-level finding makes their search EASIER: a whole fan-out batch vanishing at once is a far more findable server event than lone writes |

## §4. Spaces — engineering, not mystery

Spaces' known loss (~1/5, **proven in a release build**, master report Run 3)
is root-caused: the hub `log-append` ack is received and discarded, so a lost
write is invisible and never resent. The fix is designed and waiting:
`quorum-mobile/.agents/tasks/2026-07-21-fix-space-append-send-loss-ack-resend.md`.
Implement it; verify with the (spec'd, unbuilt) headless space harness
(`tasks/2026-07-27-headless-space-harness.md`). Do not spend mystery budget
here — spend it on §3.

## §5. Also in the pipeline (ordinary bug work, no devices needed)

- `bugs/2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md` —
  both faces (send-side autoheal = existing task; receive-side mapping fix =
  failing unit test first).
- Ghost-conversation cleanup + detection (fits T1).

## §6. Build order and constraints

1. T1 (desktop) — self-contained, dev-only, branch + PR. ⚠️ Coordinate with the
   operator before touching the desktop working tree: a live `yarn dev` session
   hot-reloads on branch switches. Use a worktree (see the private vault's
   worktree-setup note: 3 junctions after `yarn install`) or a parked window.
2. T2 (mobile) — ⚠️ the mobile checkout currently sits on a UI feature branch;
   do not switch it under the operator. Worktree or a coordinated window.
3. T3 spike (mobile `android/`) — compile-feasibility first, then the probe.
4. T4 last — it only glues the others together.

---
*Last updated: 2026-07-29*
