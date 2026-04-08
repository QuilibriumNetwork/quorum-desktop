---
type: doc
title: Device Naming
status: done
ai_generated: false
created: 2026-04-08T00:00:00.000Z
updated: 2026-04-08T00:00:00.000Z
---

# Device Naming

## Overview

Users can assign human-readable names to their registered devices in the Privacy/Security section of Settings. Names sync across all devices via the existing `UserConfig` system. On first open of the Settings modal, the current device is auto-named using browser/OS detection (e.g. "Chrome (Windows)" or "Desktop App (macOS)"), and the user can rename it at any time via an inline edit field.

**Branch:** `feat/device-naming`

---

## Feature Details

### What users see

Each device row in the Privacy/Security device list shows:

- The device name (if set), followed by a truncated address (first 4 + last 4 chars) with a copy icon
- An edit icon (pencil) on the current device row only
- "This device" label on the current device; "Remove" button on others

When the user clicks the edit icon, the row switches to an inline input field with confirm (Enter or checkmark) and cancel (Escape or X) controls. The save is immediate on confirm — no separate "Save Changes" button required.

### Auto-naming

When the Settings modal opens and the current device has no saved name, `getDeviceName()` is called automatically and the result is saved to `deviceNames` via `saveDeviceName`. The user can still rename it afterward. Auto-detection covers:

- **Electron**: "Desktop App (OS)"
- **React Native**: "Mobile App (OS)"
- **Web browsers**: "BrowserName (OS)"

Detection is intentionally minimal: basic categorization only, no detailed fingerprinting.

---

## Architecture

### Data layer

Two optional fields were added to `UserConfig` in `src/db/messages.ts`:

```typescript
deviceNames?: { [inboxAddress: string]: string };
deletedDeviceNameAddresses?: string[];
```

- `deviceNames`: maps each device's `inbox_registration.inbox_address` to a user-given label
- `deletedDeviceNameAddresses`: tombstone list for removed devices, preventing name resurrection on next sync

The `inbox_address` is used as the key because it is stable and already used elsewhere to identify "this device."

### Additive merge in ConfigService

`ConfigService.getConfig` (in `src/services/ConfigService.ts`) merges `deviceNames` from local and remote configs after decryption, using a private `mergeDeviceNames` method:

- The result is the union of local and remote maps
- Remote wins when the same key exists in both (handles the case where a user renames a device from another device)
- Any address in either tombstone list is removed from the result
- Both tombstone lists are unioned into a single list

This is race-condition-safe because each device only ever writes its own `inboxAddress` key. Two devices can never conflict on the same key.

### Stale-ref fix in useUserSettings

The root cause of the original September 2025 failure was `existingConfig.current` being captured once at hook startup and never refreshed. `saveChanges` in `src/hooks/business/user/useUserSettings.ts` now fetches a fresh config from the server before building `newConfig`, so names set by other devices since startup are never silently overwritten.

### Auto-naming in useUserSettings init

During `useUserSettings` initialization, if the current device's `inboxAddress` has no entry in `deviceNames`, `getDeviceName()` is called and `saveDeviceName` is invoked to persist the detected name immediately.

### saveDeviceName

A dedicated `saveDeviceName(name: string): Promise<void>` action was added to `useUserSettings`. It:

1. Fetches a fresh config
2. Sets `deviceNames[thisDeviceInboxAddress] = name`
3. Enqueues the save via `actionQueueService`

This action is separate from `saveChanges` so the rename is instant and does not require the user to click the main Save button.

### Tombstoning on device removal

When `removeDevice` is called in `useUserSettings`, the device's `inbox_address` is added to a `pendingTombstones` state array. When the user subsequently clicks "Save Changes", those addresses are appended to `deletedDeviceNameAddresses` in the saved config, preventing the name from reappearing on sync.

---

## Files

| File | Change |
|------|--------|
| `src/db/messages.ts` | Added `deviceNames` and `deletedDeviceNameAddresses` to `UserConfig` type |
| `src/services/ConfigService.ts` | Added private `mergeDeviceNames` method; called it in `getConfig` after remote config decryption |
| `src/hooks/business/user/useUserSettings.ts` | Fixed stale `existingConfig.current` ref in `saveChanges`; added `saveDeviceName` action; added auto-naming in init; added tombstone tracking in `removeDevice` |
| `src/utils/deviceInfo.ts` | New utility: `getDeviceName()` for auto-detection, `truncateAddress()` for display |
| `src/hooks/business/validation/useDeviceNameValidation.ts` | New validation hook: `validateDeviceName()` (non-hook) and `useDeviceNameValidation()` (React hook) |
| `src/hooks/business/validation/index.ts` | Exports the new validation hook |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Device row UI: truncated address, copy button, edit icon, inline rename input, validation display |
| `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` | Passes `deviceNames` and `saveDeviceName` as props to `<Privacy />` |

---

## Privacy

Device names are stored in `UserConfig`, which is AES-256-GCM encrypted before being uploaded to the server. The key is derived from the user's Ed448 private key using SHA-512. Device names are never visible to other users and are never transmitted in plaintext.

See `config-sync-system.md` for full encryption details.

---

## Validation

`useDeviceNameValidation` / `validateDeviceName`:

- Empty or whitespace-only: rejected
- Over 40 characters (`MAX_NAME_LENGTH`): rejected
- HTML tag patterns (XSS check via `validateNameForXSS`): rejected
- Allowed characters: unicode letters, unicode digits, spaces, hyphens, parentheses, apostrophes (regex `/^[\p{L}\p{N} \-()']+$/u`)

Error is shown inline below the input. The confirm action (Enter, checkmark icon) is disabled while the input is invalid.

---

## Detection coverage

`src/utils/deviceInfo.ts` supports:

**App environments:**
- Electron (desktop app): detected via `window.electronAPI`
- React Native (mobile app): detected via `navigator.product === 'ReactNative'`

**Browsers (web):**
- Edge, Opera, Vivaldi, Yandex Browser, Samsung Internet, UC Browser, Firefox, Chrome, Safari
- Brave: detected via async `navigator.brave.isBrave()` API, then `navigator.brave` object presence, then user agent fallback

**Operating systems:**
- Windows, iOS, Android, macOS, Linux (via user agent)

---

## Known edge cases

1. **Duplicate auto-names for same browser/OS**: Two devices running the same browser on the same OS will both auto-detect the same name (e.g. "Chrome (Windows)"). They remain distinguishable by the truncated inbox address shown next to the name. Users can rename either device to something more specific.

2. **Tombstone array growth**: `deletedDeviceNameAddresses` grows monotonically and is never pruned. In practice this is negligible: users register a handful of devices over a lifetime, so the array will never grow large enough to affect payload size.

3. **Auto-naming only on Settings open**: The auto-detected name is saved when the Settings modal first opens, not during device registration. A device that has never opened Settings will show a raw truncated address on other devices until the user opens Settings on that device.

4. **Brave detection is async**: `getDeviceName()` is `async` because the Brave detection API (`navigator.brave.isBrave()`) returns a Promise. All callers await it.

---

## Related documentation

- [Config Sync System](config-sync-system.md) — encryption, signing, merge strategy for UserConfig
- [Task: device-naming-plan](../tasks/.done/2026-04-08-device-naming-plan.md) — implementation plan
- [Design spec](../tasks/.done/2026-04-08-device-naming-design.md) — original design decisions

---

*Updated: 2026-04-08*
