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
*Last updated: 2026-06-10*
