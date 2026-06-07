---
type: task
title: Unify Account tab's defer-until-Save vs. instant-toggle semantics
status: design-questions-open
created: 2026-06-07
scope: desktop
related:
  - .agents/tasks/2026-06-07-align-notification-settings-with-mobile.md
  - .agents/tasks/2026-06-07-align-notification-settings-with-mobile-plan.md
---

# Unify Account tab's defer-vs-instant control semantics

## Problem

The Account tab of `SpaceSettingsModal` currently mixes two patterns:

| Control | Pattern |
|---|---|
| Display name | **Deferred** — needs Save Changes |
| Avatar | **Deferred** — needs Save Changes |
| Mention-type filter (`@you` / `@everyone` / `@roles` / `Replies` Select) | **Deferred** — needs Save Changes |
| Space notifications master toggle | **Instant** — writes on click |
| Per-channel notification switches | **Instant** — writes on click |
| Hide muted channels from sidebar | **Instant** — writes on click |

The `Save Changes` button at the bottom of the modal only persists the first three. The others have already self-saved by the time the user clicks Save. A user looking at the panel cannot tell which controls are deferred and which are instant by sight — same widget, same context, different semantics.

This was tolerable when only the Select was deferred (one outlier). With the new per-channel switches added by [`feat/align-notification-settings-with-mobile`](2026-06-07-align-notification-settings-with-mobile.md), the inconsistency becomes more visible.

## Why this is a separate task (not in the notification-alignment PR)

The notification-alignment PR is already large and visually verified. Making the whole Account tab deferred-on-Save is:
- A real refactor (local state for every control, controlled inputs, careful reset on close)
- Risks regressing controls outside the Notifications section
- Requires deciding what happens with the right-click context menu (which is intentionally instant) and how its labels stay in sync with deferred panel state

That belongs to its own focused PR.

## Design questions to resolve before implementation

1. **Direction: defer everything or instant everything?**
   - **Defer everything**: every Account-tab control becomes local state; Save Changes persists the whole set; closing the modal without saving discards. Consistent with Display name + Avatar (which can't be instant). Better for users to preview a set of changes before committing.
   - **Instant everything**: drop the Save Changes button entirely; every control self-saves on change. Consistent with the right-click context menu and with how every other settings panel in the app behaves. Simpler to implement.
   - **Recommend: defer everything.** Display name and avatar can't reasonably be instant (typing 'J' shouldn't save your name as 'J'), so the modal already needs a Save button. Better to align the smaller controls to the unavoidable pattern than to invent a special case.

2. **Right-click context menu behavior.**
   - It MUST stay instant — that's its whole purpose ("quick action" surface).
   - This means context-menu writes and panel writes go to the same underlying state but via different paths. Acceptable but needs care: if the panel has pending unsaved changes and the user uses the context menu, what happens?
   - **Recommend:** context menu writes are independent of panel state. If the panel has pending changes when a context-menu action lands, the panel's local state for that field gets *overwritten* by the context-menu action (the latest action wins). Show a non-blocking toast: "Channel muted from menu — your unsaved panel changes are still pending." Better than silently losing context-menu actions.

3. **Discard confirmation on close.**
   - If the user has pending changes and clicks X / hits Esc / clicks outside the modal, do we confirm?
   - **Recommend:** yes, with a "Discard changes?" confirmation. Trivially small but prevents accidental data loss.

4. **What about the existing race condition fix (cache-read pattern)?**
   - The notification-alignment PR includes a fix to read from React Query cache instead of IndexedDB to prevent stale-read races in rapid toggling. That fix becomes **mostly redundant** if controls are deferred — there's no rapid concurrent persistence anymore, just one Save call at the end.
   - **Recommend:** leave the cache-read fix in place anyway. The right-click context menu still uses the optimistic-cache + action-queue pattern (instant), and other code paths that read user config benefit from it. Defense in depth.

5. **Save button enable/disable logic.**
   - Should Save be disabled when there are no pending changes? Currently it's always enabled.
   - **Recommend:** disable when no pending changes (compare local state to canonical config). Standard UX.

6. **What happens to controls that write to other slices of `UserConfig` (not the Account tab specifically)?**
   - E.g. DM mute (`mutedConversations`), favorite DMs (`favoriteDMs`), other panels.
   - **Recommend:** out of scope for this task. This task is about the Account tab specifically. The instant pattern there can persist unchanged.

## Implementation sketch (once design is settled)

Assuming "defer everything in the Account tab" + "context menu remains instant":

1. **`Account.tsx`**: extract every control into local state. Today it already partly does this for `selectedMentionTypes` (which is lifted to `SpaceSettingsModal.tsx`); extend the same pattern to `isSpaceMuted`, `mutedChannels`, `showMutedChannels`. Local state is seeded from the React Query config on mount and reset on close.
2. **A single `handleSave` function** at the modal level that diffs local state against config, builds one `updatedConfig`, calls the existing config-persistence path once. Replaces the multiple per-toggle action-queue enqueues.
3. **`SpaceSettingsModal.tsx`**: wire a "dirty" flag (any local state ≠ canonical config). Disable Save when not dirty. Show a discard confirmation on close-while-dirty.
4. **Context menu** (`useSpaceContextMenu.tsx`, `ChannelItem.tsx`): leave the instant `useChannelMute` writes unchanged. Add a small subscription in `Account.tsx` so that if the canonical config changes mid-edit (e.g. context menu fired), local state for unmodified fields refreshes — but local state for fields the user has touched does NOT (last-edit wins on Save).
5. **Toast**: optional non-blocking toast when context menu and panel disagree.
6. **Reset on close**: when modal closes (saved or discarded), clear local state so reopening starts fresh from canonical config.

## Out of scope for this task

- DM mute, favorite DMs, other UserConfig slices.
- Right-click context menu UX.
- The notification-alignment work (separate, already shipped).
- The `useChannelMute` API itself — the underlying mute/unmute functions stay as-is, they just stop being called per-toggle in Account.tsx.

## Next step

Get user input on the design questions above (especially Q1 direction and Q2 context-menu interaction), then write an implementation plan.

---
*Last updated: 2026-06-07*
