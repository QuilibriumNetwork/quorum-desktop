---
type: task
title: "ROUND Q — join each lost message to a specific socket CLOSE (the round that can falsify the relay-pong diagnosis)"
status: READY TO RUN — every tool is built and armed. One burst round, ~15 minutes of device time
created: 2026-07-31
area: WebSocket transport / DM loss / socket lifecycle
repos: quorum-mobile (rig + burst), quorum-desktop (DM doctor)
related:
  - "bugs/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md (the diagnosis under test)"
  - "docs/transport-measurements.md § ROUND P (the round this completes) and § THE RELAY PROBE"
  - "docs/transport-manual-round-runbook.md (THE protocol — follow it, this file only adds the round plan)"
---

# Round Q — tie individual lost messages to individual CLOSE events

## §1. The round plan (runbook rule 1: write this before sending anything)

**The single variable vs Round P:** the socket **lifecycle** probe is armed
(`[WS-life] OPEN / CLOSE / ERROR`). P had only the mid-batch probe, which sees a
dead socket *only* when it is about to write — so drops between batches were
invisible, and P's messages 9 and 10 could not be explained.

**The competing hypotheses, and what each outcome means:**

| outcome | reading |
|---|---|
| **every lost message sits shortly before a `CLOSE`** | the relay-pong diagnosis is confirmed end to end: connections die, and frames written into the blind window are the losses. The chain is closed |
| **some losses occur with no `CLOSE` anywhere near** | ⛔ **the diagnosis is WRONG or incomplete.** A second loss mechanism exists that the socket model does not cover. This is the outcome that matters most |
| **no messages are lost at all** | the round is inconclusive, not a pass. Re-run; 15-25% over four rounds says one clean round is noise |

**This round is worth running precisely because it can fail.** Two published
leads (Y's slow-send, Z's chain-position) were killed by the next measurement
rather than accumulating; this continues that discipline against our own current
favourite.

## §2. The second question it answers for free

The load-bearing inference in the whole diagnosis is that **React Native misses
pongs**, which has never been observed — RN's JS `WebSocket` does not expose
ping/pong. This round gives an indirect but real test.

The idle baseline is **one drop every 19.0 s** (81 drops / 25.6 min, phone idle).
If radio sleep is what delays the pongs, then during an **active burst** — screen
on, radio hot, a send every 2 s — the radio never sleeps, pongs should land inside
the 1.0 s budget, and **connections should live markedly longer**.

| observed during the burst | reading |
|---|---|
| lifetimes ≫ 19 s (few or no CLOSEs) | supports radio sleep as the pong-delay mechanism |
| lifetimes ≈ 19 s, same as idle | ⛔ radio state is **not** the differentiator; the RN-misses-pongs story needs another explanation |

Record every `[WS-life] OPEN`/`CLOSE` pair regardless of outcome. This costs
nothing extra — the probe is already logging it.

## §3. Setup (the parts that have bitten us before)

1. `git debug` in **quorum-mobile**. It now **exits 1** if any probe is missing,
   so a green run is a real assertion, not a printed `(want 1)`.
2. ⭐ **Start Metro with `-ResetCache`.** Round Z lost its entire `[WS-frame]`
   dataset to a warm Metro cache serving the old `node_modules` bundle while
   `git debug` correctly reported all three bundles patched.
3. Start the capture (`capture-xptrace.bat`), reload the app, then **validate
   before sending anything**:

   ```bash
   node .agents/scripts/validate-capture.mjs <capture.log>
   ```

   Exit 1 ⇒ re-arm and start over. Do not spend the round on a rejected capture.
4. Runbook rules apply in full — in particular **rule 6** (both receiving desktops
   must have the real app open, not just `/dev/dm-doctor`, which renders outside
   the app shell and has no WebSocket) and **rule 4** (read BOTH desktops).

## §4. The round

- Sender: mobile A, dev build, rig branch, burst button.
- **Letter: `Q`** (X, Y, Z, P burned; the burst button also auto-suggests).
- 20 messages, 2000 ms interval.
- Receivers: desktop B (peer) and desktop A (self-sync fan-out) — **both live and
  connected throughout**, as in Round Y.
- Read both doctors immediately, then again ~10 minutes later (rule 5).

## §5. The join — this is the actual deliverable

For each of the 20 messages, produce one row:

| message | `[DM-send row]` t | `[WS-frame] sent` t | nearest `[WS-life] CLOSE` | Δ to that CLOSE | landed? |
|---|---|---|---|---|---|

Then answer, explicitly:

1. **Does every lost message sit within a few seconds BEFORE a `CLOSE`?**
   Round P's landed/lost boundary was ~5 s; check whether that holds.
2. **Is any message lost with no nearby `CLOSE`?** Name it. This is the finding
   that would break the diagnosis, so do not round it away.
3. **Did any message land despite sitting inside a blind window?** That bounds
   how wide the window really is.
4. **Connection lifetimes during the burst vs the 19.0 s idle baseline** (§2).

## §6. Recording the result

Append a `## ROUND Q` section to `docs/transport-measurements.md` the same day —
append-only, never rewrite a past row. Include the join table, the lifetime
comparison, and an explicit statement of which of §1's three outcomes occurred.

If the diagnosis is refuted, say so in the heading. The measurements file's own
rule is that a confident wrong version is worth less than a corrected one, and
this investigation has retracted more claims than it has kept.

---
*Last updated: 2026-07-31*
