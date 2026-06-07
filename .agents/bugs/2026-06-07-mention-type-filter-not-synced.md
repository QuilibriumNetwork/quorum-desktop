---
type: bug
title: Per-space mention-type filter (enabledNotificationTypes) does not sync across devices
status: open
created: 2026-06-07
severity: medium
scope: desktop
related:
  - .agents/reports/2026-05-28-notification-architecture-divergence.md
  - .agents/tasks/2026-06-07-align-notification-settings-with-mobile.md
---

# Per-space mention-type filter doesn't sync across devices

## Symptom

When a user changes the per-space notification type filter in **Space Settings → Account tab → Notifications** (the multi-select dropdown of `@you` / `@everyone` / `@roles` / `Replies`) and clicks the Save button, the change is written to the **local IndexedDB only** and never propagates to:
- The user's other devices (other browsers, other Electron installs)
- The server-side encrypted `UserConfig` blob

All other per-space and per-channel notification preferences (the `isMuted` flag, `mutedChannels`, `showMutedChannels`, `mutedConversations`, `favoriteDMs`) DO sync cross-device. This one field is the outlier.

## Root cause

[`src/hooks/business/mentions/useMentionNotificationSettings.ts`](../../src/hooks/business/mentions/useMentionNotificationSettings.ts) — its `saveSettings()` function calls `messageDB.saveUserConfig()` **directly**, bypassing the action queue.

For comparison, [`src/hooks/business/channels/useChannelMute.ts:270-355`](../../src/hooks/business/channels/useChannelMute.ts#L270-L355) (the path for `isMuted`, `mutedChannels`, etc.) goes through the action queue, which:
1. Encrypts the config with AES-GCM (key from user's Ed448 key)
2. Signs it with Ed448
3. Posts to `apiClient.postUserSettings()` (server-side sync)
4. Writes to local IndexedDB
5. Updates React Query caches

Step 3 is what's missing for the mention-type filter — it only ever runs the local-IndexedDB equivalent of step 4.

## Why it's medium severity (not low, not high)

- **Not high:** the feature degrades gracefully. Each device just keeps its own filter. No data corruption, no broken UI.
- **Not low:** users who use the app on multiple devices (a real Quorum demographic — desktop at work, laptop at home) will silently get inconsistent notification behavior. Hard to diagnose ("why does my work computer ping me for `@everyone` but my home one doesn't?").

## Suggested fix

Route `useMentionNotificationSettings.saveSettings()` through the same action-queue path that `useChannelMute` uses. Concretely:
1. Replace the direct `messageDB.saveUserConfig()` call with the appropriate action-queue enqueue (look at how `muteSpace` in `useChannelMute.ts` does it for the pattern).
2. Verify the action queue's config-merge logic handles `notificationSettings[spaceId].enabledNotificationTypes` — it should already, since the field is part of the same `UserConfig.notificationSettings[spaceId]` object that `isMuted` lives in.
3. Verify on two browser profiles: change the filter on profile A, observe profile B receives the update via the config sync path within a few seconds.

## Scope note

This is **not** bundled into the [notification settings UX alignment PR](../tasks/2026-06-07-align-notification-settings-with-mobile.md) because it's a data-sync bug, not a UX rename. They could ship together if convenient, but there's no dependency between them.

---
*Last updated: 2026-06-07*
