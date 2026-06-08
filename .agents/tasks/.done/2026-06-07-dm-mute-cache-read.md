---
type: task
title: useDMMute and useDMFavorites should read from React Query cache, not messageDB
status: open
severity: medium
scope: desktop
created: 2026-06-07
related:
  - .agents/tasks/2026-06-07-align-notification-settings-with-mobile.md
  - .agents/tasks/2026-06-07-account-tab-defer-save-unification.md
---

# `useDMMute` and `useDMFavorites` read stale config from messageDB

## Problem

Both [`useDMMute.muteConversation` / `unmuteConversation`](../../src/hooks/business/dm/useDMMute.ts) and [`useDMFavorites.addFavorite` / `removeFavorite`](../../src/hooks/business/dm/useDMFavorites.ts) read the current config via `messageDB.getUserConfig({ address })` before computing the next state and writing it via `setQueryData` + action queue enqueue.

This means a rapid sequence of DM mute toggles can lose in-flight optimistic state from previous clicks — exactly the secondary bug pattern `useChannelMute` had before the [first race fix commit](../) in the notification-alignment PR replaced its `messageDB.getUserConfig` read with a React Query cache read.

## Why it's medium severity

- DM mute and favorite are usually one-off actions (right-click context menu) rather than rapid-fire list toggling, so the bug surfaces less often than the channel-mute version did.
- When it does surface, the user sees the same kind of "phantom revert" symptom: rapid toggle of two DM mutes can leave one of them in a stale state until the queue catches up.

## The fix

Mechanical 2-line change per hook — mirror the pattern that already works in `useChannelMute`:

```ts
// Instead of:
const currentConfig = await messageDB.getUserConfig({ address: userAddress });

// Do:
const currentConfig =
  queryClient.getQueryData<UserConfig>(
    buildConfigKey({ userAddress })
  ) ?? (await messageDB.getUserConfig({ address: userAddress }));
```

Then verify with the same instrumentation pattern used during the notification-alignment investigation: temporary `console.log` at every `setQueryData` and at the tail-end `saveConfig` write to confirm rapid DM mute toggles no longer produce out-of-order writes.

## Out of scope for the notification-alignment PR

That PR is already large and the broader architectural fix to `ConfigService.saveConfig` (timestamp-guarded tail-end cache write) handles the *queue-completion clobber* class of bug for these hooks too. What remains is the *read-from-stale-DB* class, which is purely local to each hook and can ship independently. Filed here to avoid scope creep on the notification PR.

## Suggested next step

Pair this with the `useChannelMute` cache-read pattern as a tiny standalone PR. Quick to write, quick to review, gets the DM toggle UX to feel as snappy as the channel toggles.

---
*Last updated: 2026-06-07*
