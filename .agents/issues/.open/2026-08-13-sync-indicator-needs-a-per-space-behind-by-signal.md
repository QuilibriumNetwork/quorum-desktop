---
type: task
title: "Rebuild the sync indicator on a per-space \"behind by N\" signal (measure the signal first)"
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-13
area: sync / UX feedback
---

# Rebuild the sync indicator on a per-space "behind by N" signal

The global "Syncing..." toast was **removed** on 2026-08-13 (see "What was removed").
This task is the rebuild, and it is deliberately **gated on a measurement** rather than
starting with an implementation, because three previous attempts each shipped a trigger
that seemed right by reading and was wrong in practice.

## The UX goal (stated by the user, 2026-08-13)

> "You are in this space, but there are still messages that are arriving, and you don't
> see them yet. Don't worry, they will arrive."

Two properties follow, and both were missing before:

1. It must fire **while the user waits**, not after the data lands.
2. It must be **per-space**. A global indicator covering all spaces is noise, because
   sync for a space you are not looking at tells you nothing.

## Why the old one was wrong

It fired on sync **intent**, not on need. `showSyncToast()` was the first statement of
`SyncService.requestSync()`, before anything was known about whether the client was
behind. `requestSync` runs once per space on every connect, so the toast appeared on
every refresh, including when the channel was already fully rendered.

Second defect: the arrival side could not tell a real sync from a no-op either. The
`sync-delta` handler called `noteSyncActivity()` under `if (envelope.message.messageDelta)`,
which is true for an **empty** delta. The `if (channelIdsToRefetch.size === 0)` fallback
directly above it exists precisely because empty deltas arrive.

Third defect: `SYNC_TOAST_ID` was a single hardcoded `'sync'`, so all spaces shared one
toast. Per-space was not merely unimplemented, it was structurally impossible.

### Why the previous attempts failed

They kept relocating the trigger — `requestSync` → `initiateSync` → chunk arrival — but
**every one of those points fires on a no-op sync**, so none of them could ever
distinguish "you are behind" from "a sync ran". The original implementation did compare
peer count against local count, but behind a `>= 20` per-chunk threshold; when the
protocol moved to byte-sized (5MB) chunking that threshold became non-deterministic and
the 2026-05-18 rework discarded the comparison entirely in favour of firing on intent.
The comparison was the valuable part, and it was the part that got thrown away.

History: `.agents/issues/.done/sync-toast-notifications.md`.

## The lead: `sync-info` already carries a per-space peer message count

`MessageService.ts`, the `sync-info` branch. A peer answering a sync request advertises
`envelope.message.messageCount` (and `memberCount`, and a `summary`) **for one space**,
and it arrives during the handshake, **before** any message data. That is the right shape
and the right moment for "more is coming":

- per-space already (the handler derives `spaceId` from `conversationId`)
- arrives before the payload, so it can fire while the user waits
- no prior attempt used it at this point

Note it already survives an expired session: `noteAdvertisedRoster` is called *outside*
the session gate deliberately (see the long comment in that branch), so what a peer
advertises is learned even when we cannot sync from the offer.

## STEP 1 — Measure before building. Do not skip this.

**The load-bearing assumption:** that `peer messageCount - local count` is a trustworthy
"behind by N" for a space.

**Why it is genuinely in doubt:** it is unclear whether the two numbers are even
comparable. Candidate skews, each of which would make the difference meaningless or
negative: messages across channels the client does not subscribe to; deleted messages and
tombstones counted on one side but not the other; the peer being behind *us*; several
peers advertising different counts in the same window.

This is the same class of assumption that killed the `>= 20` threshold. Prove it before
writing UI.

**How to measure.** The repo already has the instrument — the scenario harness under
`src/dev/tests/harness/` (`*.scenario.test.ts`, plus captured `space-backlog` logs).
Add a scenario, or extend a backlog one, that records at each `sync-info`:

| Field | Why |
|---|---|
| advertised `messageCount` | the peer's claim |
| local count for the same space | our side of the subtraction |
| the delta actually delivered afterwards | ground truth |

Then answer:

- [ ] Does `advertised - local` **predict** the number of messages actually delivered?
- [ ] Is it ever negative or wildly wrong (peer behind us, different channel scope)?
- [ ] With several peers answering, does taking the max behave sensibly?
- [ ] On a **clean refresh with nothing to sync**, is the difference reliably ~0?
      This is the case that must produce no indicator, and it is the one the old
      implementation got wrong every single time.

**Include a control arm:** a space that should show nothing. If both the backlog space
and the control space light up, the signal is broken rather than the code.

## STEP 2 — Only if the measurement holds

- [ ] Key the indicator by `spaceId`; drop the single global `'sync'` id.
- [ ] Show it only for the space the user is **currently viewing**.
- [ ] Raise it when `behind > 0` for that space; clear it when the local count catches up,
      with a hard timeout as a backstop (peers can vanish mid-sync — that failure mode is
      what forced the old two-timer dismiss system).
- [ ] Reuse `showPersistentToast` / `dismissToast` in `src/utils/toast.ts`; they were kept
      when the sync layer was deleted and are not sync-specific.
- [ ] Consider an inline indicator in the message list rather than a toast. It is closer
      to "these messages are still arriving" than a corner notification is.

**If the measurement does not hold:** say so and stop. Leaving no indicator is the correct
outcome — a wrong one is worse than none, which is why the old one was removed.

## What was removed (2026-08-13)

| File | Change |
|---|---|
| `src/utils/toast.ts` | deleted `showSyncToast`, `noteSyncActivity`, both timers, `SYNC_TOAST_*` constants. `showPersistentToast` / `dismissToast` kept. |
| `src/services/SyncService.ts` | deleted the `showSyncToast(t\`Syncing...\`)` call in `requestSync()` and the now-unused `toast` + `@lingui` imports |
| `src/services/MessageService.ts` | deleted both `noteSyncActivity()` calls; trimmed the toast import |
| `src/components/ui/OfflineBanner.tsx` | doc comment no longer references the toast |

Verified at removal: `tsc --noEmit` exit 0; full suite 1440 passed / 155 files.

The `Syncing...` string was left in the `.po` catalogues rather than re-extracted across
30 locales; a future `yarn i18n:extract` will drop it, and it is inert until then.

---

*Last updated: 2026-08-13*
