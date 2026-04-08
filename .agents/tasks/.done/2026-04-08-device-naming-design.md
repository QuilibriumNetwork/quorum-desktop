# Device Naming Feature — Design Spec

**Date:** 2026-04-08
**Status:** Implemented — see `feat/device-naming` branch (completed 2026-04-08)

---

## Problem

The Privacy/Security settings screen lists all registered devices by their raw cryptographic inbox address (e.g. `QmSXkX2d1q8PASMPaMjieh6yyricTG89NY8QzEvj7273Jz`). Users cannot tell which device is which, making device management confusing and potentially unsafe.

---

## Goal

Let users rename their current device. That name syncs to all other devices so every device can display human-readable names for the full device list.

---

## Constraints

- Each device can only rename **itself** (not other devices)
- Must work within the existing `UserConfig` sync system — no SDK or server changes
- The previous implementation attempt failed because `existingConfig.current` in `useUserSettings` is captured once at startup and never refreshed, so a name set on Device A was silently overwritten when Device B next saved its stale config snapshot. This must be fixed.

---

## Data Layer

### 1. Extend `UserConfig` (`src/db/messages.ts`)

Add two optional fields:

```typescript
deviceNames?: { [inboxAddress: string]: string };
deletedDeviceNameAddresses?: string[];
```

- Key: the device's `inbox_registration.inbox_address` (stable identifier, already used to identify "this device")
- Value: the user-given name string
- `deletedDeviceNameAddresses`: tombstone list for device removals, so other devices don't resurrect names of removed devices

### 2. Additive merge in `ConfigService.getConfig()` (`src/services/ConfigService.ts`)

After decrypting the remote config, before returning, merge `deviceNames` from both local and remote:

```typescript
// Merge deviceNames: union of local + remote, filtered by tombstones
const allTombstones = [
  ...(config.deletedDeviceNameAddresses ?? []),
  ...(storedConfig?.deletedDeviceNameAddresses ?? []),
];
config.deviceNames = {
  ...(storedConfig?.deviceNames ?? {}),
  ...(config.deviceNames ?? {}),   // remote wins on conflict for same key
};
// Remove any tombstoned entries
for (const addr of allTombstones) {
  delete config.deviceNames[addr];
}
config.deletedDeviceNameAddresses = allTombstones;
```

This is race-condition-safe because each device only ever writes its own `inboxAddress` key. Two devices can never conflict on the same key.

Tombstone accumulation is negligible in practice: users register a handful of devices over a lifetime. The list will never grow large.

### 3. Fix stale config ref in `useUserSettings` (`src/hooks/business/user/useUserSettings.ts`)

This is the root cause of the original failure. In `saveChanges`, replace the spread from the stale `existingConfig.current` ref with a fresh fetch:

```typescript
// Before (broken):
const newConfig = {
  ...existingConfig.current!,
  allowSync,
  ...
};

// After (fixed):
const freshConfig = await getConfig({
  address: currentPasskeyInfo.address,
  userKey: keyset.userKeyset,
});
const newConfig = {
  ...freshConfig,
  allowSync,
  ...
};
```

This ensures every settings save starts from the latest server state, so names set by other devices are never silently overwritten. The cost is one extra server round-trip on settings save — acceptable since this is a deliberate user action, not a background operation.

---

## Validation

New hook `useDeviceNameValidation` in `src/hooks/business/validation/`:

- Reuses `validateNameForXSS()` from `src/utils/validation.ts`
- Max 40 chars (reuse existing `MAX_NAME_LENGTH` constant)
- Allowed characters: letters (including unicode/international), numbers, spaces, hyphens, parentheses — regex `/^[\p{L}\p{N} \-()']+$/u`
- Error shown inline below input; confirm action disabled while invalid

---

## Auto-detection

A new utility `src/utils/deviceInfo.ts` provides a suggested name when the user opens the rename field for the first time on an unnamed device. It pre-fills the input with e.g. "Chrome (Windows)" or "Desktop App (macOS)" as a starting point. The user can accept or overwrite it.

The detection logic (browser, OS, app type) already exists in the task file at `.agents/tasks/device-identification-improvement.md` and should be ported as-is.

---

## UI Layer — Privacy.tsx Device Row

### Row states

**1. Unnamed, other device:**
```
QmXJ...2XB5  ⧉                    [Remove]
```

**2. Unnamed, this device:**
```
QmSX...73Jz  ⧉  ✏                 [This device]
```

**3. Named, other device:**
```
Phone (iOS)   QmXJ...2XB5  ⧉      [Remove]
```

**4. Named, this device:**
```
Work Laptop   QmSX...73Jz  ⧉  ✏   [This device]
```

**5. Edit mode (this device only):**
```
[ Work Laptop ________________________  ✓  ✗ ]   [This device]
```

### Layout rules

- Left section (`flex-1`): name (if set) + `ClickToCopyContent` wrapping truncated address, copy icon on right, edit icon immediately after copy icon (this device only)
- Right section (`flex-shrink-0`): "This device" / "Remove" button, unchanged
- Truncation: first 4 chars + `...` + last 4 chars of `inbox_address`
- Edit mode: entire left section becomes a text input. Name and key disappear while editing. Confirm on Enter or ✓ icon, cancel on Escape or ✗ icon.
- Save is immediate on confirm — calls `saveConfig` directly, no "Save Changes" button needed

### Mobile layout

- On narrow screens the left section wraps: name on top line, key + icons on second line (`flex-wrap`)
- Edit mode: input takes full width of the left section

### Components used

- `ClickToCopyContent` (`src/components/ui/ClickToCopyContent.tsx`) — `text={fullAddress}`, `iconPosition="right"`, children = truncated address string
- `Icon` — pencil icon for edit trigger, check/x icons for confirm/cancel
- `useDeviceNameValidation` — new hook (see Validation section)

---

## Deletion tombstoning

When a device is removed via the existing "Remove" flow in `useUserSettings.removeDevice`, add its `inbox_address` to `deletedDeviceNameAddresses` before saving. This prevents the name from being resurrected on next sync by a device that still has the old name in its local state.

---

## What this does NOT change

- The existing device removal flow (staged removal + Save Changes button) is untouched
- No SDK changes
- No server changes
- No changes to registration flow

---

## Files to create or modify

| File | Change |
|------|--------|
| `src/db/messages.ts` | Add `deviceNames` and `deletedDeviceNameAddresses` to `UserConfig` type |
| `src/services/ConfigService.ts` | Add `deviceNames` merge step in `getConfig` |
| `src/hooks/business/user/useUserSettings.ts` | Fix stale `existingConfig.current` ref in `saveChanges`; add `saveDeviceName(name: string): Promise<void>` — fetches fresh config, sets `deviceNames[thisDeviceInboxAddress] = name`, calls `saveConfig` immediately |
| `src/hooks/business/validation/useDeviceNameValidation.ts` | New validation hook |
| `src/hooks/business/validation/index.ts` | Export new hook |
| `src/utils/deviceInfo.ts` | New device detection utility (ported from task file) |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Device row UI with rename interaction |

---

*Created: 2026-04-08*
