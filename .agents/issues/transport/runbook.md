---
type: task
title: "RUNBOOK — running a manual DM transport round with the shipped tools (fresh-session protocol)"
status: in-progress
priority: medium
created: 2026-07-29
moved: "2026-08-01 — from tasks/ to docs/. It is a living protocol, not a work item; sitting in tasks/ made it read as permanently unfinished."
area: DM transport debugging / manual rounds
related:
  - "issues/transport/index.md (THE MAP — read its §1 and §2 ladder before anything)"
  - "issues/transport/measurements.md (every result lands there, same day)"
  - "issues/transport/2026-07-29-transport-debug-workflow-and-tooling.md (why these tools exist; T3/T4 still unbuilt)"
---

# RUNBOOK — manual DM transport round

## §0. Who this is for, and what to read first

You are a fresh session asked to run (or support) a manual DM-loss test round
with the operator. **Do not improvise a protocol — this file is the protocol.**

Read first, in this order (15 minutes, non-negotiable):

1. `index.md` §1 (the whole situation in seven
   sentences) and §2 (the read ladder). The index is the map to everything.
2. `measurements.md` — at least the 2026-07-29 rows at the end.
   The result classes (arrival / decrypt / persistence) are defined at the top;
   use them.
3. `2026-07-29-transport-debug-workflow-and-tooling.md` §1 (the three
   rules) and §3 (the experiment queue).

The one-paragraph big picture: after ~30 client fixes across both apps, one
field bug remains — DMs sent from the real mobile app sometimes never arrive
(15–20% in recent runs), scattered, no error anywhere. The 2026-07-29 finding:
lost messages die WHOLE (every fan-out copy at once), at or before the source.
No bench reproduces it; only operator-assisted rounds on real devices can move
it. Two other bug classes were split off the same day and must not be conflated
with it: the stale-returning-device total loss, and receive-side misfiling into
ghost conversations (`2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md`).

## §1. The instruments (shipped 2026-07-29)

| tool | where | what it does |
|---|---|---|
| **Mobile test burst** (quorum-mobile PR #200) | dev builds only: flask icon in the DM conversation header | sends `<letter> 1`…`<letter> N` through the REAL send path at a chosen interval, auto-suggests the next unused letter, and appends a per-message JSONL send record to `<documentDirectory>/dm-burst/run-<timestamp>.jsonl` |
| **Desktop DM doctor** (quorum-desktop PR #275) | dev builds only: `/dev/dm-doctor` | sequence scan over the WHOLE IndexedDB messages store (landed / missing / duplicates / **misfiled** flags), ghost-conversation card, receive-warning counters running since app start, copy-measurement-row button |
| fallback console probe | `.agents/tools/dm-debug/07-receiver-probe.js` | same scan for receivers where `/dev` does not exist (production desktop builds). Paste before the run starts |

Pull a burst record from the phone:

```
adb exec-out run-as com.quilibrium.quorummobile.debug cat files/dm-burst/<name>.jsonl
```

(two devices attached ⇒ add `-s <serial>`; list files first with
`... run-as ... ls files/dm-burst`)

⚠️ The burst button exists ONLY in dev builds. A production/`.preview` build
round (like the W-run) means hand-typing the numbered messages — the receiving
side still uses the doctor (receiving desktops are dev builds).

## §2. The rules (violating any of these voids the round)

1. **One variable per round.** Write down, before sending anything: what single
   thing differs from the last comparable round, the competing hypotheses, and
   what each outcome would mean. No discriminating power ⇒ don't run it.
2. **No harness runs against the canonical accounts during a round window.**
   The harness churns sessions on those accounts and has already contaminated
   two captures. Check nothing is running before starting.
3. **The operator never pastes console code** on dev builds — the tools exist.
   The console probe is only for production-build receivers.
4. **Read BOTH desktops, not just the addressed peer.** The 07-29 lesson: the
   sender's own other device (fan-out channel) missing the SAME numbers as the
   peer = common-mode loss at the source. One store tells you half the story.
5. **Second reading ~10 minutes after the first.** It is what separates loss
   from a long latency tail. Identical missing-list twice = loss.
6. ⭐ **Every receiving desktop must have the ACTUAL APP open during the round.**
   `/dev/*` routes render **outside** the app shell (`Router.web.tsx` — they are
   siblings of `<Layout>`, not children), so a tab parked on `/dev/dm-doctor`
   has no WebSocket provider and **receives nothing**. Keep the app on the
   conversation in one tab and the doctor in another. On 2026-07-29 this
   produced a confident, wrong "three-hour receive stall" finding, retracted the
   same hour.
7. ⭐ **Read BEFORE reloading, then reload and read again.** The first reading
   captures what the running client actually held; the second captures what a
   fresh inbox drain can still recover. **The difference between them is the
   measurement** — it separates "stuck in the client" from "not on the relay at
   all". A cold drain that still comes up short is the strongest available proof
   of real loss (Round X used exactly this).
8. **If loss appears, preserve before touching:** the JSONL file, the doctor's
   copy-rows from both desktops, a console log export. Never reset sessions,
   re-login, or clean up state before everything is captured — on 07-29 a
   "quick fix first" instinct would have destroyed the stale-device evidence.
9. ⭐ **Validate the capture BEFORE running the round, and again before quoting
   any number from it. This is a command, not an eyeball.**

   ```bash
   node .agents/scripts/validate-capture.mjs <capture.log>   # 0 usable, 1 REJECTED, 2 degraded
   ```

   A capture is only evidence if it contains **both** armed markers:
   `[DM-diag] armed` (the build is the diag branch) and `[WS-diag] transport
   patch armed` (the `node_modules` transport patch survived). The failure is
   time-of-check/time-of-use: `git debug` arms the rig, then **any `yarn
   install` or `quorum-shared` rebuild silently disarms it**, and the capture
   that follows looks normal — just quieter. **Absence of evidence reads exactly
   like a quiet network**, which is why round 25 was captured, analysed and
   thrown away. `git debug` now *fails* rather than printing `(want 1)`, and
   this validator refuses the file outright, so neither check depends on
   somebody remembering to look.

   ⚠️ After changing `quorum-shared`, the rebuilt dist wipes the patch. Re-run
   `git debug`, then **restart Metro with `-ResetCache`** — a warm cache serves
   the old bundle, which is its own silent invalidator (round P).

## §3. The test estate (as of 2026-07-29)

- **Account A** — address `QmTestTestEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imz`.
  Primary phone (dev build) + desktop A (dev build, browser profile).
- **Account B** — address `QmYVtoS6E7T4TL4p7Ve1KCVoMoBpz4QEajmJLCoiLjLjDd`.
  Preview phone (`….preview` app id, release build) + desktop B (dev build).
- **Letters burned:** T, U, V, **X** (plus "A→B #n"/"B→A #n" numeric series).
  **W** is reserved for the prod-build run; next free after that: **Y**. The
  burst button tracks its own counter — trust its suggestion on dev builds. The
  doctor's scan window (default 6h) makes letter re-use safe over time, but keep
  advancing letters within a session.
- **Known artifacts deliberately left in place (evidence — do not clean up):**
  ghost self-conversation rows on both desktops; the V-series (20 messages)
  misfiled under B's own address on desktop B; U-series missing 2/5/10 on both
  stores. The doctor will show all of these; that is correct behaviour.

## §4. The standard round, step by step

0. **First use only — acceptance checks** (the tools shipped runtime-untested):
   desktop A doctor, prefix `U`, expected 20 ⇒ **17/20 missing 2, 5, 10**;
   desktop B doctor, prefix `V` ⇒ **20/20 all misfiled** + ghost rows listed;
   phone dev build ⇒ flask icon visible, 5-message burst at 1s lands normally
   in the conversation and produces a JSONL file. Any deviation: stop, fix the
   tool first, file what you find.
1. **Write the round plan** (rule 1) — one paragraph, into the day's notes.
2. **Preconditions:** no harness running; relay healthy (known-user profile
   endpoint returns 200); both desktops open with the doctor reachable; phone
   started via `.agents/scripts/dev-start-mobile.ps1` (mobile repo).
3. **Send:** operator taps the flask → letter (auto), N=20, interval 2000 ms.
4. **Read:** doctor scan on BOTH desktops (rule 4), right after the burst and
   again ~10 minutes later (rule 5). Note misfiled flags and warning counters,
   not just the landed count.
5. **Sender record:** pull the JSONL; confirm all N have records; note per-send
   errors and timing outliers.
6. **Record the result** the same day: append rows to
   `measurements.md` (state the result CLASS per its own rules;
   the doctor's copy-row button gives the template), and add the run to §3 of
   this file's letter ledger... no — letters live in §3 above; update it.
7. **If loss occurred:** rule 6, then update the relevant bug/issue docs with
   pointers (never duplicate numbers outside the measurement log).

## §5. The queued experiments (pick from the top; details in the workflow doc §3)

1. **W-run** — preview build as sender, AFTER sign-out/sign-in (fresh sessions;
   the 07-29 V-run was invalidated by June-era state — do not repeat that
   mistake). Hand-typed `W 1`…`W 20`, doctor on both desktops. Answers
   dev-vs-prod for the field symptom. Bonus check: the flask icon must NOT
   appear in this build (release-exclusion proof owed to mobile PR #200).
2. ✅ **DONE — Round X (2026-07-29):** the field symptom captured end-to-end,
   3/20 lost, absent from both receivers including a cold drain. See the
   measurement log § ROUND X. **Now repeat it** to test the new lead: tag each
   message fast/slow from the burst record and check whether losses keep falling
   in the slow-send group (617-762 ms) rather than the fast one (35-94 ms).
   Two or three more bursts settle it, and they cost minutes each now.
3. **T3 native-probe round** — blocked on building T3 (workflow doc §2); the
   instrument below JS `ws.send`, where the message-level finding points.

## §6. Do NOT

- run the harness "to compare" during a round window (rule 2)
- re-run green benches — they add nothing (index §8)
- clean up ghost rows / misfiled messages / stale sessions before capture
- conflate the three bug classes (field scattered loss ≠ stale-device total
  loss ≠ misfiling) — each has its own doc
- quote a number without its result class and without appending it to the
  measurement log

---
*Last updated: 2026-07-29*
