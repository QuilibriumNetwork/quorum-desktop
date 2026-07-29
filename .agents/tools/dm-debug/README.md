---
type: tool
title: DM debug snippets
status: living
created: 2026-06-09
updated: 2026-06-09
---

# DM debug snippets

Browser-console snippets for diagnosing DM identity / sync issues. Each `.js` file in this folder is self-contained — paste into the DevTools console (or save as a DevTools Snippet) and run.

For background on the architecture and the debug ladder, read [`../../docs/debugging/dm-architecture-and-debug-playbook.md`](../../docs/debugging/dm-architecture-and-debug-playbook.md) first.

## Snippets

| File | Purpose |
|---|---|
| `01-snapshot.js` | Full snapshot of one client's `conversations`, `space_members`, `messages`, and `user_config`. Auto-copies JSON to clipboard. Run on both clients and diff. |
| `02-dm-pairs.js` | Lists each client's DM partners. Quick check for asymmetric conversation rows. |
| `03-encryption-states.js` | Shows the Double Ratchet state per conversation. Tells you whether a DM session actually exists. |
| `04-stores.js` | Lists all IndexedDB object store names. Use when a snippet errors with "object store not found" — store names have drifted between builds. |
| `05-profile-sources.js` | Per-DM, compares the stored conversation row's name/icon against the live public-profile API. Use to diagnose why an avatar/name shows in the open conversation (public-profile fallback, in-memory) but not in the sidebar (reads the stored row). A `data:image/...` stored icon means the avatar has been persisted to the row. |
| `06-space-member-sources.js` | Space-member equivalent of 05. |
| `07-receiver-probe.js` | **DM-loss receiver probe** (handoff §4, sender-isolation runs). Install BEFORE the sender starts; counts receive-path warnings from install and reads `messages` from IndexedDB directly. `await window.__probe.report('V')` → landed / missing numbers / warning counters. Take a second reading ~10 min later — that is what separates loss from a latency tail. |

## Offline analysis (node CLI, NOT console snippets)

These are a different kind of tool: they run in a terminal against a **saved
console log** and re-execute the real crypto against the SDK wasm. No devices, no
live session, no capture round. They resolve the SDK as a sibling checkout of this
repo; set `SDK_DIR=` if yours is elsewhere.

| File | Purpose |
|---|---|
| `dr-replay.mjs` | Reassembles `[XPDUMP]` chunks from a log and re-runs the real failing decrypt. Reports whether the seal opened, whether the frame was init-wrapped, and whether the ratchet failed. Use to confirm a failure is genuine and reproducible rather than an app-level race. |
| `dr-ablate.mjs` | **Finds what CAUSES a failure.** Re-runs the same decrypt while changing ONE property of the ratchet state at a time, so a load-bearing property announces itself by making the frame decrypt. |
| `dr-advanced-start-fork.mjs` | Needs no log at all. Builds pristine sessions from one X3DH pair and drives a case matrix to reproduce the upstream crate's advanced-start fork in seconds. This is the runnable evidence behind item 1 of [quorum-mobile#183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183). |
| `dr-position-table.mjs` | Needs no log. Builds **fresh** sessions and scores first-attempt failure by chain position across six delivery regimes. Result: 1920 frames, zero failures — which corroborates finding AC rather than contradicting anything, because a fresh session has no poisoning skipped-keys bucket. ⛔ Not evidence the crate is clean. |
| `dr-prune-safety.mjs` | **Explains the mechanism and validates the mitigation.** Per captured failure it reports what the frame *is* — its index in its own sending chain, whether it drove a DH step, whether that index collides with the stale bucket — and whether recovery is genuine or a re-accepted duplicate. Its synthetic half needs **no log** (`--synthetic-only`): it builds the poisoning condition from a pristine X3DH pair, so one state holds both the frame a retry would recover and the frames a prune would destroy. That is how the "does pruning break a success?" question got answered — the captured corpus cannot answer it, because `[XPDUMP]` only ever fires on failure. |
| `dr-self-echo.mjs` | Does a client receive its OWN outbound frames? Joins `[DM-send wire]` against `[DM-recv wire]` within one client's log. **0 of 2709 distinct captured browser arrivals** — the control that proved the headless harness's 41-48% self-echo was a bench artifact (all bots shared one IndexedDB) and not the cause of the measured ~40% failure rate. |

```
node .agents/tools/dm-debug/dr-replay.mjs       <saved-console.log>
node .agents/tools/dm-debug/dr-ablate.mjs       <saved-console.log> [...more logs]
node .agents/tools/dm-debug/dr-prune-safety.mjs <saved-console.log> [...more logs]
node .agents/tools/dm-debug/dr-prune-safety.mjs --synthetic-only    # no log needed
node .agents/tools/dm-debug/dr-self-echo.mjs    <saved-console.log> [...more logs]
```

**`dr-ablate` is the cheapest tool in this folder and it arrived last.** It found
the root cause of the 2026-07 DM delivery bug in one run over logs already on
disk, after ten hypotheses had been killed the slow way by booking capture rounds.
**Add a case to its `VARIANTS` array to test a new hypothesis against every
captured failure in seconds.** Reach for it before booking device time.

> ⚠️ Logs containing `[XPDUMP]` hold **real ratchet key material**. Throwaway test
> accounts only, keep them local, never paste raw regions into an issue.

## Workflow

1. **Reload both clients hard** (Ctrl+Shift+R) so they're running current code.
2. **Disable console filters** (set log level to "All levels"). Filtered consoles silently hide `console.log`.
3. **Run `01-snapshot.js` on both** clients. Paste both JSON outputs into a shared place (or a bug report).
4. **Diff the two snapshots.** Specifically look at: `conversations` symmetry, `space_members` presence for the addresses involved, `encryption_states` presence for the DM partner.
5. **If you need to trace a specific code path**, see the log-point list in [`log-points.md`](./log-points.md).
6. **Strip any log statements you added before committing.** The playbook has a checklist.

## Common gotchas

- **DevTools shows a `Promise{pending}` and you think the snippet failed.** Right-click the Promise → "Store object as global variable" → it appears as `temp1` in console. Or expand `[[PromiseResult]]`. Most snippets here use plain `console.log` inside event handlers to avoid this.
- **`Failed to execute 'transaction': object store not found`.** Run `04-stores.js` first and substitute the right store name. The most common drift: `passkey_info` (old) vs `user_info` (current).
- **Snippet returns `undefined`.** The IIFE ran but printed nothing — usually because `console.table` swallows empty input. Fall back to `console.log`.
- **No output at all.** Console filter is hiding info-level. Set log level to "All levels" or "Verbose".

---
*Last updated: 2026-07-27*
