---
type: task
title: "Notification-type settings: settings modal reads stale config (shows all-4) + can clobber synced value on Save"
status: done
created: 2026-06-23
completed: 2026-06-24
urgency: medium (silent data-loss hazard on Save)
found_via: mobile↔desktop sync testing 2026-06-23
related_files:
  - src/hooks/business/mentions/useMentionNotificationSettings.ts
  - src/components/modals/SpaceSettingsModal/Account.tsx
  - src/services/ConfigService.ts
---

# Notification-type settings: stale read in the settings modal (+ clobber-on-save)

## Symptom (observed cross-device)

A user set per-space notification types on MOBILE to only `['mention-roles']`
(disabled @you / @everyone / reply). On DESKTOP:
- The **settings modal** (SpaceSettings → Account → "Notify me for") shows **all 4
  still selected** — looks like the setting didn't sync.
- BUT the **notification panel** correctly does NOT show the disabled types.

Contradiction → the value DID sync (panel honors it); only the settings UI
displays it stale.

## Root cause

The value syncs fine in the `UserConfig` config blob
(`notificationSettings[spaceId].enabledNotificationTypes`). Two desktop read
paths with different freshness:

- **Panel** (`useChannelMentionCounts`, `useAllMentions`): React Query queryFn,
  `staleTime: 90s` + `refetchOnWindowFocus` → re-reads after the config sync lands
  → sees `['mention-roles']`. Correct.
- **Settings modal** (`useMentionNotificationSettings.ts`, `loadSettings` in a
  one-shot `useEffect` on mount, ~L79-112): cold-reads IndexedDB ONCE via
  `messageDB.getUserConfig()` and sets local `useState`. If the modal mounts
  before `ConfigService.getConfig` has finished writing the synced blob to
  IndexedDB, it shows desktop's stale local default (all-4) and never re-reads.

So: panel = fresh, settings UI = stale one-shot read. Same synced data.

## Hazard (the reason this is medium, not low)

If the user opens the settings modal (stale all-4) and clicks **Save** without
changing anything, `handleAccountSave → mentionSettings.saveSettings()` POSTs
`enabledNotificationTypes: [all 4]` and **silently clobbers** the mobile-set
`['mention-roles']`. Display bug → data-loss bug on save.

## Fix

In `useMentionNotificationSettings.ts`, make `loadSettings` **cache-first** and
reactive, matching how `saveSettings` already reads (L124-127):
1. Read the React Query config cache first
   (`queryClient.getQueryData(buildConfigKey(userAddress))`), fall back to
   `messageDB.getUserConfig()` only if the cache is empty.
2. Re-initialise when the config sync lands — convert the one-shot `useEffect`
   into a `useQuery`/`useSuspenseQuery` on the config key, OR subscribe to the
   config cache so `selectedTypes` updates when `ConfigService.getConfig`
   populates it. (The panel hooks already do this implicitly via React Query.)
3. Guard against clobber: don't POST on Save if the loaded value was a default/
   stale fallback and the user didn't actually change the selection (or simply
   ensure the load is fresh before Save is possible).

## Out of scope (note, not fix)
- Shared `UserConfig.notificationSettings` is still typed as the LEGACY
  `NotificationSettings` (no `enabledNotificationTypes`) in
  `quorum-shared/src/types/user.ts`; desktop's local `UserConfig` (messages.ts)
  uses the richer `SpaceNotificationSettings`. Both cast `as any`; the JSON
  round-trips fine, so this is NOT the runtime cause — but the shared type should
  be upgraded additively eventually. (Mobile has the same `as any` gap.)

## Verify
- Set types on mobile → on desktop, open the space settings: the multiselect
  reflects the mobile choice (not all-4), even right after launch.
- Saving on desktop without changes does not overwrite the mobile value.
- Panel filtering stays consistent with the displayed setting.

## Resolution (2026-06-24)

Fixed in `useMentionNotificationSettings.ts` by replacing the one-shot mount
read with the reactive `useConfig` query (the same IndexedDB-backed React Query
source the panel hooks use). Concretely:

1. **Cache-first + reactive read.** Removed the `loadSettings` `useEffect` and
   its cold `messageDB.getUserConfig()`. `settings` is now derived from
   `useConfig({ userAddress }).data.notificationSettings[spaceId]`, falling back
   to `getDefaultNotificationSettings`. When a cross-device config sync lands,
   the query cache updates and the modal re-renders with the fresh value — no
   stale all-4 display.
2. **Re-sync without stomping edits.** Local multiselect state (`selectedTypes`)
   is seeded from the persisted value and re-synced via a small effect whenever
   the persisted value changes AND the user has no pending edit (tracked by
   `isDirtyRef`). `setSelectedTypes` is wrapped to set the dirty flag.
3. **Clobber guard on Save.** `saveSettings` now early-returns (no POST) when the
   selection is order-insensitively equal to the persisted value (`sameTypes`).
   A no-op Save can no longer overwrite another device's value. The dirty flag
   resets on save (success or no-op).

Because `useConfig` is a suspense query and the modal tree already sits under
`App.tsx`'s `<Suspense>` boundary, config is guaranteed resolved before the
consumer renders, so `isLoading` is now constant `false` (kept in the return for
API compatibility).

**Out-of-scope note still stands:** shared `UserConfig.notificationSettings` is
still typed as the legacy `NotificationSettings`; the `as any` round-trip is
unchanged and not the runtime cause. Left for a later additive shared-type bump.

Tests: added `src/dev/tests/hooks/notificationTypesEquality.unit.test.ts`
(pure-logic coverage of the `sameTypes` equality the guard + re-sync rely on).
tsc + eslint clean; full suite green in isolation (full-run timeouts were
pre-existing import-contention flakiness, unrelated).

Changed files (in worktree `secondary`, branch `session-secondary-2026-06-24`):
- `src/hooks/business/mentions/useMentionNotificationSettings.ts`
- `src/dev/tests/hooks/notificationTypesEquality.unit.test.ts` (new)

*Last updated: 2026-06-24*
