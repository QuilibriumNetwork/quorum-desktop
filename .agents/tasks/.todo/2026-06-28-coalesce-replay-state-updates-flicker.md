---
type: task
title: "Coalesce replayed update-profile during history replay to stop display-name flicker"
status: blocked
priority: medium
created: 2026-06-28
blocked-by: hub-log transport not yet ported to desktop (desktop still on P2P sync-delta)
scope: quorum-desktop (app-side effect-batching; NOT quorum-shared)
mobile-counterpart: ../../../quorum-mobile/.agents/tasks/2026-06-28-coalesce-replay-state-updates-stop-flicker.md
sibling: 2026-06-28-coalesce-replay-space-manifest-flicker.md (the harder half — space/channel flicker)
---

# Coalesce replayed update-profile during history replay (stop flicker) — DEFERRED

> **This is the easy half.** The harder `space-manifest` (space/channel) flicker
> is its own deferred task:
> [2026-06-28-coalesce-replay-space-manifest-flicker.md](2026-06-28-coalesce-replay-space-manifest-flicker.md).
>
> **Why deferred:** the clean fix lives in the history-replay apply path.
> Desktop's current replay path is the **P2P sync-delta** protocol, expected to
> be **replaced by the hub-log transport** (converging with mobile). Fixing the
> soon-to-be-removed P2P path is wasted work. This unblocks once the hub-log port
> lands; the fix then goes into desktop's hub-log apply path (mirroring the mobile
> fix through desktop's IndexedDB/MessageDB + React Query).

## Symptom

On a new device, history replay makes a contact's **display name** "scrub"
through 3-4 old names before converging. Final state correct — only the
intermediate re-renders are the issue. (Space/channel flicker → sibling task.)

## Root cause (desktop, current P2P path — verified 2026-06-28)

`src/services/MessageService.ts` applies replayed `update-profile` events
one-by-one with a cache update after each:
[MessageService.ts:1312-1363](../../../src/services/MessageService.ts)
(`saveMessage`) and `addMessage` (~L1862-1932): per-event `saveSpaceMember` +
`setQueryData(buildSpaceMembersKey)`. **No timestamp guard at all** — strictly
worse than mobile, which at least guards backward rewinds.

## Two wins, only one is the flicker

1. **Timestamp/version guards** — the hub-log port brings these for free
   (mobile already has a `profileTimestamp` guard). This fixes a **silent
   stale-overwrite correctness bug** (an older profile event overwriting a newer
   one). Comes with the port.
2. **Flicker** — caused by the per-event apply+render loop, NOT the transport.
   The hub-log port alone does **NOT** fix it (mobile runs the hub-log and still
   scrubs on a fresh device). The flicker fix is end-of-batch coalescing
   (keep latest per sender, apply once), written into desktop's hub-log apply path.

## When unblocked

1. Confirm the hub-log transport has landed on desktop.
2. Port mobile's `update-profile` coalescing into desktop's hub-log batch apply,
   against IndexedDB/MessageDB + `buildSpaceMembersKey`.
3. Move this file out of `.todo/` into active `.agents/tasks/` when work starts.
   (The `space-manifest` half is the sibling task above.)

## Why app-side, NOT quorum-shared

Effect-batching (storage + cache writes) is app-owned per the architecture's
consistent rule; quorum-shared holds pure decisions/shapes only (verified
2026-06-28 — `utils/` is free of queryClient/storage). See the mobile counterpart
task's "Why app-side" section for the full reasoning.

*Last updated: 2026-06-28*
