---
type: bug
title: UserSettingsModal shows stale display name after remote UserConfig sync
status: open
created: 2026-05-30
severity: low
discovered-during: AES-GCM config-decrypt dedup session (unrelated to that refactor)
---

# UserSettingsModal shows stale display name after remote UserConfig sync

## Repro

1. Log into the desktop app on **browser profile A** with an existing identity.
2. Log into the same identity on **browser profile B** (fresh login flow, decrypts remote `UserConfig`).
3. In **profile B**, open the User Settings modal and change the display name. Save.
4. In **profile B**, send a message → confirm the new display name appears on your own messages in the channel.
5. Switch back to **profile A** (already running).

## Expected

User Settings modal in profile A reflects the new display name (since the synced `UserConfig` carries it).

## Actual

- **Channel views** in profile A show the **NEW** display name on the user's own messages → the synced `UserConfig` reached profile A correctly and is being rendered downstream.
- **User Settings modal** in profile A still shows the **OLD** display name in the input field.

## Likely cause (hypothesis — not verified)

The UserSettingsModal is probably reading the display name from a different source than the channel-message renderer. Candidates:

1. **Local-only initial value cached at modal mount time**, not subscribed to UserConfig changes (the modal initializes its form state once and doesn't re-sync when UserConfig updates arrive over the wire).
2. **A local override** (e.g. `localStorage` / IndexedDB stored copy) that's read before the synced `UserConfig` is consulted.
3. **A stale React Query cache key** — modal queries a different key than channel rendering uses, and that key wasn't invalidated by the incoming sync.

The channel-rendering path correctly reflects the synced value, so the sync layer itself is healthy.

## NOT caused by

The 2026-05-30 AES-GCM config-decrypt dedup refactor (commit on `session/2026-05-30` branch). If decryption were broken, channel messages wouldn't show the new name either — but they do.

## Investigation starting points

- `UserSettingsModal.tsx` (or equivalent) — where does `displayName` initial value come from?
- The channel-message renderer — what hook/source gives it `displayName`? Compare paths.
- React Query keys around `UserConfig` — is there a missing invalidation when the synced UserConfig updates?

## Priority

Low — cosmetic on the modal, doesn't block messaging or sync. But it's confusing UX (user thinks their change didn't propagate).
