---
type: bug
title: Action queue errors silently swallowed across all config-writing hooks
status: solved
severity: medium-high
scope: desktop
created: 2026-06-07
solved: 2026-06-08
solved_by: PR #180
related:
  - .agents/tasks/2026-06-07-account-tab-defer-save-unification.md
  - .agents/tasks/2026-06-07-align-notification-settings-with-mobile.md
---

## Resolution (2026-06-08, PR #180)

Interim minimal fix per the "Suggested fix" section below: a `.catch`
shim added to all 14 enqueue sites across the 8 affected hook files
(useChannelMute ×5, useUserSettings ×2, useDMMute ×2, useDMFavorites
×2, useFolderManagement ×1, useFolderDragAndDrop ×1, useDeleteFolder
×1, useMentionNotificationSettings ×1). Each shim logs via
`logger.error`, rolls the React Query cache back to the pre-update
snapshot, and surfaces a `showError` toast.

Notable per-site decisions:
- The 3 sites that previously `await`ed enqueue (useUserSettings
  saveChanges, useFolderManagement saveChanges, useDeleteFolder)
  were converted to fire-and-forget. The hook handles all user
  feedback (toast + rollback); modals close as if the save
  succeeded. Caller-side `onSaveError` paths became defensive nets
  for non-enqueue errors only.
- The auto-device-name useEffect at lines 128-136 of useUserSettings
  got a log-only shim — no toast, no rollback. The write is a
  one-shot first-run autoname with no user action behind it; next
  session start re-attempts since `loadedNames` still won't have the
  entry.
- The useMentionNotificationSettings shim rolls back both the React
  Query cache and a local React state (`settings`).

Manual verification: temporarily threw from
`actionQueueService.enqueue` for type `'save-user-config'`, then
exercised two representative sites (toggle "Show muted channels" in
channel-mute settings; User Settings modal Save). Toast appeared on
both; the channel-mute toggle visually never committed (optimistic
update + rollback batched into a single render); the User Settings
modal closed normally per the agreed swallow contract. Throw was
reverted before commit.

The shared `useUserConfigMutation` refactor mentioned below remains
the long-term clean home for this pattern and will replace the
duplicated catch-shims in one pass when the defer-vs-instant
unification task is tackled.

# Action queue errors silently swallowed across all config-writing hooks

## Symptom

When `actionQueueService.enqueue(...)` throws (queue full, IndexedDB write failure, etc.), every hook that uses the optimistic-update-then-enqueue pattern silently swallows the error:

- The UI shows the toggle/state as flipped because the optimistic `setQueryData` already ran
- No persistence happens
- No error toast or console.error is shown
- No rollback of the optimistic update
- On reload the setting silently reverts

User-facing result: "I muted this channel and the next time I opened the app it was unmuted again." Indistinguishable from a sync glitch.

## Where it fires

Five sites in [`useChannelMute.ts`](../../src/hooks/business/channels/useChannelMute.ts) (the new ones written for this PR's notification list amplify exposure):

- `muteChannel` — fire-and-forget `void enqueue(...)`
- `unmuteChannel` — same
- `toggleShowMutedChannels` — same
- `muteSpace` — same
- `unmuteSpace` — same

The pattern is also present (with `await` rather than `void`, but still inside a `try/catch` that re-throws without rollback) in:

- [`useUserSettings.saveChanges`](../../src/hooks/business/user/useUserSettings.ts) — the new optimistic write added in this PR
- [`useUserSettings`](../../src/hooks/business/user/useUserSettings.ts) effect at lines 128-133 (pre-existing) — completely unawaited, completely unobserved
- [`useDMMute`](../../src/hooks/business/dm/useDMMute.ts), [`useDMFavorites`](../../src/hooks/business/dm/useDMFavorites.ts)
- [`useFolderManagement`](../../src/hooks/business/folders/useFolderManagement.ts), [`useFolderDragAndDrop`](../../src/hooks/business/folders/useFolderDragAndDrop.ts), [`useDeleteFolder`](../../src/hooks/business/folders/useDeleteFolder.ts)

This is a codebase-wide pattern, not specific to the PR. The PR's per-channel notifications list increases the visibility because users now interact with up to dozens of channel switches in rapid succession.

## Why it wasn't fixed in the notification-alignment PR

1. **It's pre-existing.** Every site listed above had the same swallowed-error behavior before this PR. The change from `await` to `void` in `useChannelMute` (commit `1467b522`) doesn't make error handling worse — the existing `try/catch` was already catching nothing actionable.
2. **The right architectural fix touches the whole hook family** and overlaps with the [defer-vs-instant unification task](../tasks/2026-06-07-account-tab-defer-save-unification.md), which is the natural home for a systematic rewrite. Patching 5-10 individual sites here would be band-aid work that gets thrown away by the unification refactor.
3. **The notification PR was already large** — adding error-handling refactor to it would have ballooned scope.

## Suggested fix (when a maintainer tackles this)

The clean approach is a shared `useUserConfigMutation` hook (see the defer-unification task) that wraps the optimistic-update + enqueue + rollback-on-failure pattern in one place. Every hook would funnel through it.

The interim minimal fix is to add a `.catch` shim with error logging and optimistic rollback to each of the 5+ call sites:

```ts
actionQueueService
  .enqueue('save-user-config', { config: updatedConfig }, `config:${userAddress}`)
  .catch((err) => {
    logger.error('[ChannelMute] enqueue failed, rolling back', err);
    queryClient.setQueryData(buildConfigKey({ userAddress }), currentConfig);
    showToast({ kind: 'error', message: t`Failed to save notification setting` });
  });
```

This duplicates the catch-shim 10+ times but is mechanical and ships independently of the unification refactor.

## Severity rationale

**Medium-high**, not critical. In practice the action queue rarely throws — the queue-full case requires hundreds of pending tasks (`MAX_QUEUE_SIZE`), and IndexedDB write failures are rare enough that most users never hit either. But when it does happen, the user has no way to diagnose: their state appears saved, then silently disappears. That's a trust-eroding bug class even if individual occurrences are rare.

---
*Last updated: 2026-06-07*
