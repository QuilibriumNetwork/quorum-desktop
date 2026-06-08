---
type: bug
title: Per-space mention-type filter (enabledNotificationTypes) does not sync across devices
status: solved
created: 2026-06-07
solved: 2026-06-08
severity: medium
scope: desktop
related:
  - .agents/reports/2026-05-28-notification-architecture-divergence.md
  - .agents/tasks/2026-06-07-align-notification-settings-with-mobile.md
---

# Per-space mention-type filter doesn't sync across devices

## Symptom

When a user changed the per-space notification type filter in **Space Settings → Account tab → Notifications** (the multi-select dropdown of `@you` / `@everyone` / `@roles` / `Replies`) and clicked Save, the change was written to the **local IndexedDB only** and never propagated to:
- The user's other devices (other browsers, other Electron installs)
- The server-side encrypted `UserConfig` blob

All other per-space and per-channel notification preferences (`isMuted`, `mutedChannels`, `showMutedChannels`, `mutedConversations`, `favoriteDMs`) did sync cross-device. This one field was the outlier.

## Root cause

[`useMentionNotificationSettings.ts`](../../src/hooks/business/mentions/useMentionNotificationSettings.ts) — `saveSettings()` called `messageDB.saveUserConfig()` **directly**, bypassing the action queue. Direct calls skip the encrypt-sign-post pipeline that pushes the blob to the server. The field was therefore device-local.

## Bonus bug found while fixing this one

The same `saveSettings()` wrote the new `notificationSettings[spaceId]` object as a bare `{ spaceId, enabledNotificationTypes }`, silently overwriting any other fields already in that slot — including `isMuted`. That meant: if a user muted a space and later changed its mention-type filter, the save would silently un-mute the space.

## Fix

Routed `saveSettings()` through the same action-queue path that [`useChannelMute.muteSpace`](../../src/hooks/business/channels/useChannelMute.ts#L288) uses:

- `actionQueueService.enqueue('save-user-config', { config }, 'config:${userAddress}')` instead of `messageDB.saveUserConfig` direct.
- Cache-first read of `currentConfig` from React Query (sees in-flight optimistic updates from sibling hooks writing the same blob).
- Spread `...currentSettings` before overriding `enabledNotificationTypes`, so `isMuted` and any future fields survive — closes the bonus bug.
- Optimistic `queryClient.setQueryData` for instant UI feedback.
- Dedup key `config:${userAddress}` collapses near-simultaneous writes (same family used by all other config-writing hooks).

No changes were required in `@quilibrium/quorum-shared`: the `SpaceNotificationSettings` type already includes `enabledNotificationTypes`, and the action-queue handler treats the config blob as opaque — no field-level merge logic to update.

## Verification

Tested with two browser profiles on the same account.

- Profile A changes the multi-select → clicks Save. Modal closes cleanly.
- Profile B picks up the change on the next config-sync poll. Observed latency: from a few seconds up to several minutes depending on network/poll cadence, consistent with how `isMuted` and `mutedChannels` already behave.

## Sync model (for future reference)

The `UserConfig` blob uses **last-write-wins**, not field-level merge. The action-queue handler posts the entire blob; the server stores the most recent version; other devices pick it up on their next pull (periodic sync, focus event, reconnect, or manual reload). There is no push notification — the lag is real and is the same lag that `isMuted` and `mutedChannels` exhibit. This is the architecture, not a regression of this fix.

Implication: if two devices edit the same field within the same sync window, one device's edit silently wins. The cache-first read added here is purely a single-device safeguard (it sees in-flight optimistic writes from sibling hooks on the same device, so the dedup key collapses them into a single server post). It does not arbitrate across devices.

---
*Last updated: 2026-06-08*
