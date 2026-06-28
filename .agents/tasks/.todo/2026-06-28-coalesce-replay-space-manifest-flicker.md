---
type: task
title: "Coalesce replayed space-manifest during history replay to stop space/channel flicker"
status: blocked
priority: medium
created: 2026-06-28
blocked-by: hub-log transport not yet ported to desktop (desktop still on P2P sync-delta)
scope: quorum-desktop (app-side effect-batching; NOT quorum-shared)
mobile-counterpart: ../../../quorum-mobile/.agents/tasks/2026-06-28-coalesce-replay-space-manifest-flicker.md
sibling: 2026-06-28-coalesce-replay-state-updates-flicker.md (the easy half — update-profile)
---

# Coalesce replayed space-manifest during history replay (stop flicker) — DEFERRED

> **Harder half**, split out of
> [2026-06-28-coalesce-replay-state-updates-flicker.md](2026-06-28-coalesce-replay-state-updates-flicker.md)
> so the risky space-manifest work has its own visible record. Same deferral
> reason: desktop's replay path is P2P sync-delta, expected to be replaced by the
> hub-log transport. Fix goes into desktop's hub-log apply path at port time.

## Symptom

On a new device, a **space name / channel list / channel names** flicker through
their entire edit history during replay before settling. Final state correct;
intermediate re-renders are the issue.

## Root cause (desktop, current P2P path — verified 2026-06-28)

[MessageService.ts:3562-3664](../../../src/services/MessageService.ts) processes
each `space-manifest` immediately: `saveSpace` + `setQueryData(buildSpaceKey)` +
spaces-list update, per manifest. **No version guard** — so beyond flicker, an
older manifest arriving after a newer one silently clobbers state (a correctness
bug). The hub-log port brings the staleness guard for free (fixes the clobber);
the flicker still needs explicit per-space coalescing (see mobile counterpart).

## Why harder than the profile half

`space-manifest` is a control message with real side effects (signature verify,
decrypt, channel/thread reconcile, multiple invalidations) — not a pure state
merge. Can't be folded into a simple cache-transform flush. The approach (per the
mobile task) is to pre-scan the batch and process only the **latest manifest per
space**, skipping superseded older ones.

## When unblocked

1. Confirm the hub-log transport has landed on desktop.
2. Implement "latest manifest per space" pre-scan in desktop's hub-log batch apply
   (against IndexedDB/MessageDB + `buildSpaceKey`), mirroring the mobile fix.
3. Reconcile with the concurrent-edit conflict-resolution model
   (mobile `2026-06-13-space-manifest-sync-architecture-improvement.md`, A/B/C).
4. Move out of `.todo/` into active `.agents/tasks/` when work starts.

## Why app-side, NOT quorum-shared

Effect-batching is app-owned per the architecture's consistent rule; quorum-shared
is pure decisions/shapes only (verified 2026-06-28). See the profile task's
"Why app-side" for the full reasoning.

*Last updated: 2026-06-28*
