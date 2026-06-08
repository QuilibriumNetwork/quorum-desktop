---
type: bug
title: UserSettingsModal fields flash empty for 1-2 seconds on open
status: open
severity: low
created: 2026-06-08
surfaced-by: 2026-06-08 per-space bio port session — user noticed when opening UserSettingsModal to verify global bio persisted
scope: desktop
---

# UserSettingsModal fields flash empty on open

## Symptom

When the user opens UserSettingsModal (top-right avatar → User Settings), every form field renders with its default empty/false value for ~1-2 seconds before populating with the actual stored values. Most visible on the Bio textarea (empty → previously-saved bio) and the various toggles in Privacy (off → on).

## Reproduction

1. Set a non-empty bio in User Settings → General. Save.
2. Close the modal.
3. Reopen User Settings → General.
4. **Observe**: Bio textarea is empty for ~1-2 seconds, then populates with the saved value.

Same pattern applies to:
- `allowSync`, `nonRepudiable`, `deliveryReceipts`, `readReceipts` toggles
- `typingIndicatorsDM`, `typingIndicatorsSpaces` toggles
- `generateYouTubePreviews` toggle
- `isProfilePublic` toggle in Privacy
- `spaceTagId` Select
- `deviceNames` map (Devices section)

All flash to their default value, then update once the async config load resolves.

## Root cause

`src/hooks/business/user/useUserSettings.ts` initializes every field to a hardcoded default via `useState` (e.g. `setBio('')` initial), then runs an async `useEffect` (~L107-127) that:

1. Calls `getConfig({ address, userKey })` — an IndexedDB read followed by decryption with the user's key.
2. Once resolved, calls all the `setXxx(config?.xxx ?? default)` calls.

The render between mount and effect-resolution shows the default values. With encrypted IndexedDB reads on a busy main thread, this takes ~1-2 seconds in practice.

Affects every consumer of `useUserSettings` — currently just `UserSettingsModal.tsx` — but the pattern is shared across other modals in the app (e.g. Account-tab `useSpaceProfile` has the same shape but the perceived flash is shorter because it reads from a smaller IndexedDB store).

## Why it's worth fixing

- Modal is one of the most-used surfaces. Every open shows the user a brief "your settings are empty/off" state, which is confusing for toggles (it suggests something just got disabled).
- Particularly bad for the Bio textarea — the user briefly thinks their bio was lost.
- Same pattern likely appears in other modals and is the same root cause; fixing the pattern is reusable.

## Why it's not urgent

- Existing users don't lose data — the correct values arrive within a few seconds.
- A loading spinner or skeleton would mask the flash, but adds its own UX cost (the modal shows a loading state instead of the form).
- Pre-existing issue; not regression from any recent PR.

## Suggested fix directions (pick one when picking this up)

### Option A: Snapshot config to React Query / a sync cache; read synchronously from cache on mount

The config is already loaded for many other code paths via `buildConfigKey({ userAddress })` React Query keys. If we ensure the config is in-cache before the modal can be opened (e.g. prefetch on app start, or invalidate on save), the modal hook can read synchronously from `queryClient.getQueryData(buildConfigKey(...))` and seed `useState` from that snapshot — eliminating the empty-default render entirely.

Risk: if the cache miss path happens (config not yet loaded), we still need the fallback. So the initial state becomes "from cache if present, else empty" — flash gone for the common case, preserved for cold starts.

### Option B: Suspense-style loading boundary inside the modal

Render a skeleton or spinner inside the modal body until `isConfigLoaded` is true. Cleaner but adds a visible loading state where there was none.

### Option C: Open the modal as part of the load completion

Defer opening UserSettingsModal until the config has been read at least once. Trade-off: the user clicks the avatar and the modal doesn't open for 1-2s. Probably worse UX than the current flash because the user gets no feedback.

**Recommend Option A** — it eliminates the flash for the realistic case (returning user with warm cache) and degrades gracefully to current behavior on cold open.

## Related files

- `src/hooks/business/user/useUserSettings.ts` — root location, the async init effect at L107-127
- `src/hooks/business/spaces/useSpaceProfile.ts` — has the same pattern at L61-90 (but smaller IndexedDB read, less perceptible)
- `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` — consumer
- `src/components/context/MessageDB.tsx` — `getConfig` lives here / nearby
- `src/hooks/queries/config/buildConfigKey.ts` (if exists) — the React Query key, would be the seed source for Option A

## Out of scope

- Other modals using the same async-init pattern. Fix this one first; if Option A pans out, generalize.

---

*Surfaced 2026-06-08 during the per-space bio port. User noticed when verifying global bio persistence — "If I reopen the model though, it takes one or two seconds to show the text area is empty at first when you open the model."*
