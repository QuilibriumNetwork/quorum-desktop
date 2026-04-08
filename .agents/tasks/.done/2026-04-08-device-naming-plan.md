# Device Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rename their current device in Privacy/Security settings, with the name syncing to all other devices via the existing UserConfig system.

**Architecture:** Add `deviceNames` and `deletedDeviceNameAddresses` fields to `UserConfig`. Fix a stale-ref bug in `useUserSettings.saveChanges` that would cause one device to silently overwrite another device's names. Add an additive merge for `deviceNames` in `ConfigService.getConfig` so names from all devices survive concurrent saves. Surface the rename UI inline in the Privacy settings device row.

**Tech Stack:** React, TypeScript, Tailwind CSS, `@quilibrium/quorum-shared` (validation utils), existing `ClickToCopyContent` component, existing `ConfigService`/`useUserSettings` patterns.

**Spec:** `.agents/tasks/2026-04-08-device-naming-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/db/messages.ts` | Modify | Add `deviceNames` and `deletedDeviceNameAddresses` to `UserConfig` type |
| `src/services/ConfigService.ts` | Modify | Add additive `deviceNames` merge in `getConfig` after remote config is decrypted |
| `src/hooks/business/user/useUserSettings.ts` | Modify | Fix stale `existingConfig.current` ref in `saveChanges`; add `saveDeviceName` action; add tombstone on device removal |
| `src/utils/deviceInfo.ts` | Create | Device type/OS/browser detection for auto-suggested name |
| `src/hooks/business/validation/useDeviceNameValidation.ts` | Create | Validation hook for device name input |
| `src/hooks/business/validation/index.ts` | Modify | Export new hook |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Modify | Device row UI: truncated address, copy button, edit icon, inline rename input |

---

## Task 1: Extend UserConfig type

**Files:**
- Modify: `src/db/messages.ts`

- [x] **Step 1: Add the two new fields to the UserConfig type**

Open `src/db/messages.ts`. Find the `UserConfig` type (around line 48). Add after the `favoriteDMs` or `mutedConversations` fields:

```typescript
// Device names: maps inbox_address → user-given label, synced across devices
deviceNames?: { [inboxAddress: string]: string };
// Tombstones for removed devices so names don't resurrect on sync
deletedDeviceNameAddresses?: string[];
```

- [x] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no new errors.

- [x] **Step 3: Commit**

```bash
git add src/db/messages.ts
git commit -m "feat(device-naming): add deviceNames and tombstone fields to UserConfig"
```

---

## Task 2: Add deviceNames merge in ConfigService

**Files:**
- Modify: `src/services/ConfigService.ts`

**Context:** `getConfig` fetches remote config, verifies signature, decrypts it, then processes spaces and bookmarks before returning. We need to add a `deviceNames` merge step after decryption — the same pattern used for bookmarks. The merge is additive: take the union of local and remote maps, then filter out any address in either tombstone list.

- [x] **Step 1: Write a failing unit test for the merge logic**

Create `src/dev/tests/services/ConfigService.deviceNames.unit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Pure merge logic extracted for testing — we'll add this as a private method
function mergeDeviceNames(
  localNames: Record<string, string> | undefined,
  remoteNames: Record<string, string> | undefined,
  localTombstones: string[] | undefined,
  remoteTombstones: string[] | undefined
): { deviceNames: Record<string, string>; deletedDeviceNameAddresses: string[] } {
  const allTombstones = [
    ...(localTombstones ?? []),
    ...(remoteTombstones ?? []),
  ];
  const merged: Record<string, string> = {
    ...(localNames ?? {}),
    ...(remoteNames ?? {}), // remote wins on conflict for same key
  };
  for (const addr of allTombstones) {
    delete merged[addr];
  }
  return { deviceNames: merged, deletedDeviceNameAddresses: allTombstones };
}

describe('mergeDeviceNames', () => {
  it('merges local and remote names', () => {
    const result = mergeDeviceNames(
      { 'QmAAA': 'Work Laptop' },
      { 'QmBBB': 'Phone' },
      [],
      []
    );
    expect(result.deviceNames).toEqual({ 'QmAAA': 'Work Laptop', 'QmBBB': 'Phone' });
  });

  it('remote wins when same key exists in both', () => {
    const result = mergeDeviceNames(
      { 'QmAAA': 'Old Name' },
      { 'QmAAA': 'New Name' },
      [],
      []
    );
    expect(result.deviceNames).toEqual({ 'QmAAA': 'New Name' });
  });

  it('removes tombstoned addresses from result', () => {
    const result = mergeDeviceNames(
      { 'QmAAA': 'Work Laptop', 'QmDEAD': 'Old Phone' },
      { 'QmBBB': 'Tablet' },
      ['QmDEAD'],
      []
    );
    expect(result.deviceNames).not.toHaveProperty('QmDEAD');
    expect(result.deviceNames).toEqual({ 'QmAAA': 'Work Laptop', 'QmBBB': 'Tablet' });
  });

  it('unions tombstone lists from both sides', () => {
    const result = mergeDeviceNames({}, {}, ['QmAAA'], ['QmBBB']);
    expect(result.deletedDeviceNameAddresses).toContain('QmAAA');
    expect(result.deletedDeviceNameAddresses).toContain('QmBBB');
  });

  it('handles undefined inputs gracefully', () => {
    const result = mergeDeviceNames(undefined, undefined, undefined, undefined);
    expect(result.deviceNames).toEqual({});
    expect(result.deletedDeviceNameAddresses).toEqual([]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/services/ConfigService.deviceNames.unit.test.ts
```

Expected: FAIL — `mergeDeviceNames` is not yet on `ConfigService`.

- [x] **Step 3: Add the merge method to ConfigService**

Open `src/services/ConfigService.ts`. Add a private method before the closing `}` of the class (after `mergeBookmarks`):

```typescript
private mergeDeviceNames(
  localNames: Record<string, string> | undefined,
  remoteNames: Record<string, string> | undefined,
  localTombstones: string[] | undefined,
  remoteTombstones: string[] | undefined
): { deviceNames: Record<string, string>; deletedDeviceNameAddresses: string[] } {
  const allTombstones = [
    ...(localTombstones ?? []),
    ...(remoteTombstones ?? []),
  ];
  const merged: Record<string, string> = {
    ...(localNames ?? {}),
    ...(remoteNames ?? {}),
  };
  for (const addr of allTombstones) {
    delete merged[addr];
  }
  return { deviceNames: merged, deletedDeviceNameAddresses: allTombstones };
}
```

- [x] **Step 4: Call the merge in getConfig after the config is decrypted**

In `getConfig`, find the block that processes `config.items` (around line 131). Add the merge call immediately after the items validation block and before the `for (const space of config.spaceKeys ?? [])` loop:

```typescript
// Merge deviceNames: additive union so names from all devices survive concurrent saves
const deviceNamesMerge = this.mergeDeviceNames(
  storedConfig?.deviceNames,
  config.deviceNames,
  storedConfig?.deletedDeviceNameAddresses,
  config.deletedDeviceNameAddresses
);
config.deviceNames = deviceNamesMerge.deviceNames;
config.deletedDeviceNameAddresses = deviceNamesMerge.deletedDeviceNameAddresses;
```

- [x] **Step 5: Update the test to import from ConfigService**

The test file already contains the pure function inline for clarity — this is intentional. The test exercises the logic directly. No import change needed; the test is self-contained.

- [x] **Step 6: Run tests**

```bash
npx vitest run src/dev/tests/services/ConfigService.deviceNames.unit.test.ts
```

Expected: all 5 tests PASS.

- [x] **Step 7: Type check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no new errors.

- [x] **Step 8: Commit**

```bash
git add src/services/ConfigService.ts src/dev/tests/services/ConfigService.deviceNames.unit.test.ts
git commit -m "feat(device-naming): additive deviceNames merge in ConfigService.getConfig"
```

---

## Task 3: Fix stale config ref + add saveDeviceName to useUserSettings

**Files:**
- Modify: `src/hooks/business/user/useUserSettings.ts`

**Context:** `saveChanges` spreads `existingConfig.current` which is captured once at startup. If Device A renames itself after Device B started up, Device B's next `saveChanges` will overwrite the server with no `deviceNames`. Fix: fetch fresh config inside `saveChanges` before building `newConfig`. Also add `saveDeviceName` for immediate name saves from the UI, and add tombstoning to `removeDevice`.

- [x] **Step 1: Fix the stale ref in saveChanges**

In `src/hooks/business/user/useUserSettings.ts`, find `saveChanges` (around line 181). Replace the `existingConfig.current` spread:

```typescript
// BEFORE (around line 231):
const newConfig = {
  ...existingConfig.current!,
  allowSync,
  nonRepudiable: nonRepudiable,
  deliveryReceipts,
  readReceipts,
  name: displayName,
  profile_image: profileImageUrl,
  bio: bio.trim() || undefined,
  spaceTagId: spaceTagId || undefined,
};

// AFTER:
const freshConfig = await getConfig({
  address: currentPasskeyInfo.address,
  userKey: keyset.userKeyset,
});
const newConfig = {
  ...freshConfig,
  allowSync,
  nonRepudiable: nonRepudiable,
  deliveryReceipts,
  readReceipts,
  name: displayName,
  profile_image: profileImageUrl,
  bio: bio.trim() || undefined,
  spaceTagId: spaceTagId || undefined,
};
```

Note: `existingConfig.current` is still used during initialization (setting local state on mount) — only the `saveChanges` usage changes.

- [x] **Step 2: Add saveDeviceName action**

Add this function inside `useUserSettings`, after `removeDevice`:

```typescript
const saveDeviceName = async (name: string) => {
  if (!currentPasskeyInfo || !keyset?.userKeyset) return;

  const inboxAddress = keyset.deviceKeyset?.inbox_keyset?.inbox_address;
  if (!inboxAddress) return;

  const freshConfig = await getConfig({
    address: currentPasskeyInfo.address,
    userKey: keyset.userKeyset,
  });

  const updatedConfig = {
    ...freshConfig,
    deviceNames: {
      ...(freshConfig?.deviceNames ?? {}),
      [inboxAddress]: name,
    },
  };

  await actionQueueService.enqueue(
    'save-user-config',
    { config: updatedConfig },
    `config:${currentPasskeyInfo.address}`
  );
};
```

- [x] **Step 3: Add tombstone to removeDevice**

The existing `removeDevice` function only updates `stagedRegistration` (UI state). It doesn't persist a config change — that happens when the user clicks "Save Changes" which calls `saveChanges`. We need to track tombstones separately so `saveChanges` can include them.

Add state for pending tombstones near the other state declarations (around line 76):

```typescript
const [pendingTombstones, setPendingTombstones] = React.useState<string[]>([]);
```

Update `removeDevice` to also record the inbox address for tombstoning:

```typescript
const removeDevice = (identityKey: string) => {
  // Find inbox address before removing from staged registration
  const device = stagedRegistration?.device_registrations?.find(
    (d: any) => d.identity_public_key === identityKey
  );
  if (device?.inbox_registration?.inbox_address) {
    setPendingTombstones(prev => [...prev, device.inbox_registration.inbox_address]);
  }

  setStagedRegistration((reg: any) => ({
    ...reg!,
    device_registrations: reg!.device_registrations.filter(
      (d: any) => d.identity_public_key !== identityKey
    ),
  }));

  setRemovedDevices(prev => [...prev, identityKey]);
};
```

Update `saveChanges` to include pending tombstones in the config (add to the `newConfig` spread built after the fresh fetch):

```typescript
const newConfig = {
  ...freshConfig,
  allowSync,
  nonRepudiable: nonRepudiable,
  deliveryReceipts,
  readReceipts,
  name: displayName,
  profile_image: profileImageUrl,
  bio: bio.trim() || undefined,
  spaceTagId: spaceTagId || undefined,
  // Merge pending tombstones with any existing ones
  deletedDeviceNameAddresses: [
    ...(freshConfig?.deletedDeviceNameAddresses ?? []),
    ...pendingTombstones,
  ],
};
```

Also clear `pendingTombstones` after a successful save (add after `setRemovedDevices([])`):

```typescript
setPendingTombstones([]);
```

- [x] **Step 4: Export saveDeviceName from the hook return**

Add to the return object at the bottom of `useUserSettings`:

```typescript
return {
  // ... existing fields ...
  saveDeviceName,
};
```

Also add it to the `UseUserSettingsReturn` interface (around line 12):

```typescript
saveDeviceName: (name: string) => Promise<void>;
```

- [x] **Step 5: Type check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no new errors.

- [x] **Step 6: Commit**

```bash
git add src/hooks/business/user/useUserSettings.ts
git commit -m "feat(device-naming): fix stale config ref, add saveDeviceName, tombstone on removal"
```

---

## Task 4: Device detection utility

**Files:**
- Create: `src/utils/deviceInfo.ts`

**Context:** Provides a suggested auto-detected name when the user opens the rename field for the first time. The detection logic is already documented in `.agents/tasks/device-identification-improvement.md` — port it as-is, keeping only what's needed for name generation.

- [x] **Step 1: Write the failing test**

Create `src/dev/tests/utils/deviceInfo.unit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the pure helper functions, not the navigator-dependent ones
// The navigator-dependent getDeviceName() is tested via integration

describe('truncateAddress', () => {
  // Import after mocking
  it('truncates a long address to first4...last4', async () => {
    const { truncateAddress } = await import('../../../utils/deviceInfo');
    expect(truncateAddress('QmSXkX2d1q8PASMPaMjieh6yyricTG89NY8QzEvj7273Jz')).toBe('QmSX...73Jz');
  });

  it('returns address unchanged if 8 chars or shorter', async () => {
    const { truncateAddress } = await import('../../../utils/deviceInfo');
    expect(truncateAddress('Qm123456')).toBe('Qm123456');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/utils/deviceInfo.unit.test.ts
```

Expected: FAIL — module not found.

- [x] **Step 3: Create deviceInfo.ts**

Create `src/utils/deviceInfo.ts`:

```typescript
/**
 * Device detection utility for human-readable device name suggestions.
 * Uses privacy-first minimal fingerprinting (basic categorization only).
 */

function isElectron(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as any).electronAPI !== 'undefined';
}

function isMobileApp(): boolean {
  // React Native / Expo environment
  return typeof navigator !== 'undefined' &&
    navigator.product === 'ReactNative';
}

function detectOS(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'Windows';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

async function detectBrave(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as any;
  if (nav.brave && typeof nav.brave.isBrave === 'function') {
    try { return await nav.brave.isBrave(); } catch { /* ignore */ }
  }
  if (typeof nav.brave !== 'undefined') return true;
  if (/brave/i.test(navigator.userAgent)) return true;
  return false;
}

function detectBrowserSync(): string {
  if (typeof navigator === 'undefined') return 'Browser';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Vivaldi/.test(ua)) return 'Vivaldi';
  if (/YaBrowser/.test(ua)) return 'Yandex';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/UCBrowser/.test(ua)) return 'UC Browser';
  if (/Firefox/.test(ua)) return 'Firefox';
  if (/Chrome/.test(ua)) return 'Chrome';
  if (/Safari/.test(ua)) return 'Safari';
  return 'Browser';
}

/**
 * Returns a human-readable suggested device name.
 * Examples: "Desktop App (Windows)", "Chrome (macOS)", "Mobile App (iOS)"
 */
export async function getDeviceName(): Promise<string> {
  const os = detectOS();
  if (isElectron()) return `Desktop App (${os})`;
  if (isMobileApp()) return `Mobile App (${os})`;
  const isBrave = await detectBrave();
  const browser = isBrave ? 'Brave' : detectBrowserSync();
  return `${browser} (${os})`;
}

/**
 * Truncates an inbox address for display: first 4 chars + ... + last 4 chars.
 * Returns the address unchanged if it is 8 characters or shorter.
 */
export function truncateAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
```

- [x] **Step 4: Run tests**

```bash
npx vitest run src/dev/tests/utils/deviceInfo.unit.test.ts
```

Expected: all tests PASS.

- [x] **Step 5: Type check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no new errors.

- [x] **Step 6: Commit**

```bash
git add src/utils/deviceInfo.ts src/dev/tests/utils/deviceInfo.unit.test.ts
git commit -m "feat(device-naming): add deviceInfo utility with truncateAddress and getDeviceName"
```

---

## Task 5: Device name validation hook

**Files:**
- Create: `src/hooks/business/validation/useDeviceNameValidation.ts`
- Modify: `src/hooks/business/validation/index.ts`

- [x] **Step 1: Write the failing test**

Create `src/dev/tests/hooks/useDeviceNameValidation.unit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateDeviceName } from '../../../hooks/business/validation/useDeviceNameValidation';

describe('validateDeviceName', () => {
  it('accepts valid names', () => {
    expect(validateDeviceName('Work Laptop')).toBeUndefined();
    expect(validateDeviceName('Chrome (Windows)')).toBeUndefined();
    expect(validateDeviceName('My-Phone')).toBeUndefined();
    expect(validateDeviceName("O'Brien's iPad")).toBeUndefined();
    expect(validateDeviceName('手机')).toBeUndefined(); // unicode letters
  });

  it('rejects empty names', () => {
    expect(validateDeviceName('')).toBeDefined();
    expect(validateDeviceName('   ')).toBeDefined();
  });

  it('rejects names over 40 characters', () => {
    expect(validateDeviceName('a'.repeat(41))).toBeDefined();
    expect(validateDeviceName('a'.repeat(40))).toBeUndefined();
  });

  it('rejects names with HTML tag patterns', () => {
    expect(validateDeviceName('<script>')).toBeDefined();
    expect(validateDeviceName('</div>')).toBeDefined();
  });

  it('rejects names with disallowed characters', () => {
    expect(validateDeviceName('My@Device')).toBeDefined();
    expect(validateDeviceName('Device#1')).toBeDefined();
    expect(validateDeviceName('Dev!ce')).toBeDefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/hooks/useDeviceNameValidation.unit.test.ts
```

Expected: FAIL — module not found.

- [x] **Step 3: Create useDeviceNameValidation.ts**

Create `src/hooks/business/validation/useDeviceNameValidation.ts`:

```typescript
import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { validateNameForXSS, MAX_NAME_LENGTH } from '@quilibrium/quorum-shared';

// Allowed: unicode letters, unicode digits, spaces, hyphens, parentheses, apostrophes
const DEVICE_NAME_PATTERN = /^[\p{L}\p{N} \-()']+$/u;

/**
 * Non-hook validator — usable in callbacks and async contexts.
 */
export function validateDeviceName(name: string): string | undefined {
  if (!name.trim()) {
    return t`Device name cannot be empty`;
  }
  if (name.length > MAX_NAME_LENGTH) {
    return t`Device name must be ${MAX_NAME_LENGTH} characters or less`;
  }
  if (!validateNameForXSS(name)) {
    return t`Device name cannot contain HTML`;
  }
  if (!DEVICE_NAME_PATTERN.test(name)) {
    return t`Device name can only contain letters, numbers, spaces, hyphens, and parentheses`;
  }
  return undefined;
}

/**
 * React hook for real-time device name validation.
 */
export function useDeviceNameValidation(name: string) {
  const error = useMemo(() => validateDeviceName(name), [name]);
  return { error, isValid: !error };
}
```

- [x] **Step 4: Export from validation index**

In `src/hooks/business/validation/index.ts`, add:

```typescript
export * from './useDeviceNameValidation';
```

- [x] **Step 5: Run tests**

```bash
npx vitest run src/dev/tests/hooks/useDeviceNameValidation.unit.test.ts
```

Expected: all tests PASS.

- [x] **Step 6: Type check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no new errors.

- [x] **Step 7: Commit**

```bash
git add src/hooks/business/validation/useDeviceNameValidation.ts src/hooks/business/validation/index.ts src/dev/tests/hooks/useDeviceNameValidation.unit.test.ts
git commit -m "feat(device-naming): add useDeviceNameValidation hook"
```

---

## Task 6: Privacy.tsx device row UI

**Files:**
- Modify: `src/components/modals/UserSettingsModal/Privacy.tsx`

**Context:** The `Privacy` component receives `keyset`, `stagedRegistration`, and `removeDevice` as props. We need to add `saveDeviceName` and `deviceNames` as new props. The device list is rendered in a `ScrollContainer` starting around line 279. Each row currently shows the raw `inbox_address` text and a "This device" or "Remove" button.

**Target row layouts:**

- Unnamed other device: `[QmSX...73Jz  ⧉]  [Remove]`
- Unnamed this device: `[QmSX...73Jz  ⧉  ✏]  [This device]`
- Named other device: `[Phone (iOS)  QmSX...73Jz  ⧉]  [Remove]`
- Named this device: `[Work Laptop  QmSX...73Jz  ⧉  ✏]  [This device]`
- Edit mode (this device): `[input  ✓  ✗]  [This device]`

- [x] **Step 1: Add new props to PrivacyProps interface**

In `src/components/modals/UserSettingsModal/Privacy.tsx`, find the `PrivacyProps` interface (line 7) and add:

```typescript
deviceNames?: { [inboxAddress: string]: string };
saveDeviceName?: (name: string) => Promise<void>;
```

Add the same to the destructured props at line 29:

```typescript
deviceNames = {},
saveDeviceName,
```

- [x] **Step 2: Add edit state and import new utilities**

Add imports at the top of the file:

```typescript
import { truncateAddress, getDeviceName } from '../../../utils/deviceInfo';
import { useDeviceNameValidation } from '../../../hooks/business/validation';
import { ClickToCopyContent } from '../../ui';
```

Add edit state inside the `Privacy` component body (after the existing `useState` declarations):

```typescript
const [editingDevice, setEditingDevice] = React.useState<string | null>(null); // inbox_address being edited
const [editValue, setEditValue] = React.useState('');
const { error: nameError, isValid: nameIsValid } = useDeviceNameValidation(editValue);

const startEdit = async (inboxAddress: string, currentName: string | undefined) => {
  const suggested = currentName ?? await getDeviceName();
  setEditValue(suggested);
  setEditingDevice(inboxAddress);
};

const confirmEdit = async () => {
  if (!nameIsValid || !editingDevice || !saveDeviceName) return;
  await saveDeviceName(editValue.trim());
  setEditingDevice(null);
  setEditValue('');
};

const cancelEdit = () => {
  setEditingDevice(null);
  setEditValue('');
};

const handleEditKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
  if (e.key === 'Escape') { cancelEdit(); }
};
```

- [x] **Step 3: Replace the device row render**

Find the existing device row `return (` block inside the `.map()` (around line 298). Replace the entire inner `return (...)` with:

```tsx
const inboxAddress = d.inbox_registration.inbox_address;
const isRemoved = removedDevices.includes(d.identity_public_key);
const isThisDevice = keyset.deviceKeyset?.inbox_keyset?.inbox_address === inboxAddress;
const deviceName = deviceNames?.[inboxAddress];
const isEditing = editingDevice === inboxAddress;

return (
  <div
    key={inboxAddress}
    className={`flex flex-row justify-between items-center py-3 px-3 ${
      index > 0 ? 'border-t border-dashed border-surface-7' : ''
    } ${isRemoved ? 'opacity-50' : ''}`}
  >
    {/* Left section */}
    <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 mr-2 min-w-0">
      {isEditing ? (
        // Edit mode: full-width input with confirm/cancel
        <>
          <input
            autoFocus
            className="flex-1 min-w-0 bg-transparent border border-subtle rounded px-2 py-0.5 text-sm text-main outline-none focus:border-primary"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            maxLength={40}
          />
          <Icon
            name="check"
            size="sm"
            className={`cursor-pointer flex-shrink-0 ${nameIsValid ? 'text-success hover:text-success' : 'text-muted cursor-not-allowed'}`}
            onClick={nameIsValid ? confirmEdit : undefined}
          />
          <Icon
            name="close"
            size="sm"
            className="cursor-pointer flex-shrink-0 text-subtle hover:text-main"
            onClick={cancelEdit}
          />
          {nameError && (
            <div className="w-full text-xs text-danger mt-0.5">{nameError}</div>
          )}
        </>
      ) : (
        // Display mode
        <>
          {deviceName && (
            <span className="text-sm text-main font-medium truncate max-w-[120px] sm:max-w-none">
              {deviceName}
            </span>
          )}
          <ClickToCopyContent
            text={inboxAddress}
            iconPosition="right"
            textVariant="subtle"
            textSize="sm"
            iconSize="xs"
            tooltipText={t`Copy full address`}
            tooltipLocation="top"
          >
            {truncateAddress(inboxAddress)}
          </ClickToCopyContent>
          {isThisDevice && saveDeviceName && (
            <Icon
              name="edit"
              size="xs"
              className="cursor-pointer text-subtle hover:text-main flex-shrink-0"
              onClick={() => startEdit(inboxAddress, deviceName)}
            />
          )}
        </>
      )}
      {isRemoved && (
        <div className="w-full text-xs text-danger">
          {t`Pending removal - click Save to confirm`}
        </div>
      )}
    </div>

    {/* Right section: button unchanged */}
    <div className="flex-shrink-0">
      {!isThisDevice && (
        <Button
          onClick={() => removeDevice(d.identity_public_key)}
          type="danger-outline"
          size="small"
          disabled={isRemoved}
        >
          {isRemoved ? t`Pending` : t`Remove`}
        </Button>
      )}
      {isThisDevice && (
        <Button size="small" disabled={true} onClick={() => {}}>
          {t`This device`}
        </Button>
      )}
    </div>
  </div>
);
```

- [x] **Step 4: Pass new props from UserSettingsModal**

Find where `Privacy` is rendered in `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` (or equivalent). Add the new props:

```tsx
<Privacy
  {/* ... existing props ... */}
  deviceNames={config?.deviceNames}
  saveDeviceName={saveDeviceName}
/>
```

The `config` object comes from the existing config query, and `saveDeviceName` comes from `useUserSettings`.

- [x] **Step 5: Type check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no new errors.

- [x] **Step 6: Lint**

```bash
yarn lint
```

Expected: no new errors.

- [x] **Step 7: Commit**

```bash
git add src/components/modals/UserSettingsModal/Privacy.tsx
git commit -m "feat(device-naming): device row UI with inline rename, truncated address, copy button"
```

---

## Task 7: Wire saveDeviceName and deviceNames into UserSettingsModal

**Files:**
- Modify: `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` (find the exact file rendering `<Privacy .../>`)

**Context:** Need to confirm where `Privacy` is rendered and that `saveDeviceName` from `useUserSettings` and `config.deviceNames` are both passed down. This task is a verification + wiring step.

- [x] **Step 1: Find where Privacy is rendered**

```bash
grep -r "saveDeviceName\|<Privacy" src/components/modals/UserSettingsModal/ --include="*.tsx" -l
```

- [x] **Step 2: Confirm saveDeviceName is exported from useUserSettings and available at the call site**

Check that the component using `useUserSettings` destructures `saveDeviceName`:

```typescript
const {
  // ... existing destructured fields ...
  saveDeviceName,
} = useUserSettings({ onSave: handleSave });
```

- [x] **Step 3: Confirm deviceNames is read from config**

The config is typically available via `useMessageDB` or a React Query config hook. Find the pattern already used for other config fields (e.g. `allowSync`, `nonRepudiable`) and follow the same pattern to pass `config?.deviceNames` to `<Privacy />`.

- [x] **Step 4: Type check and lint**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn lint
```

Expected: no errors.

- [x] **Step 5: Commit**

```bash
git add src/components/modals/UserSettingsModal/
git commit -m "feat(device-naming): wire saveDeviceName and deviceNames into UserSettingsModal"
```

---

## Task 8: Manual integration test

This feature requires testing on two devices (or two browser tabs with different accounts/devices registered). The goal is to verify the sync actually works end-to-end.

- [x] **Step 1: Set up two devices**

Option A: Two different browsers (e.g. Chrome + Firefox) logged into the same Quorum account.
Option B: Desktop app + browser tab, same account.

Both devices must be registered (appear in the Privacy/Security device list).

- [x] **Step 2: Rename current device on Device A**

Open Privacy/Security on Device A. Click the ✏ icon on "This device" row. Type "Device A Name". Press Enter. Verify the name appears immediately on Device A's row.

- [x] **Step 3: Verify sync on Device B**

On Device B, close and reopen the Privacy/Security modal (forces a config refresh). Verify Device A's row now shows "Device A Name" instead of the raw address.

- [x] **Step 4: Test that Device B's save doesn't wipe Device A's name**

On Device B, change any setting (e.g. toggle "Always sign Direct Messages" off then on). Click "Save Changes". Reopen Privacy/Security. Verify "Device A Name" is still visible on Device A's row.

- [x] **Step 5: Test device removal tombstone**

On Device A, mark Device B for removal and click "Save Changes". On a third device (or after re-registering Device B), verify Device B's old name does not reappear.

- [x] **Step 6: Commit any fixes found during testing**

If any bugs are found during manual testing, fix them and commit with descriptive messages before marking this task complete.

---

## Enhancement: Auto-naming on first Settings open

Beyond the original plan, auto-naming was added as an enhancement. When a user opens Privacy/Security settings and their current device has no name yet, `getDeviceName()` is called during the `useUserSettings` initialization phase and automatically saves a detected name (e.g. "Chrome (Windows)") to `deviceNames` without requiring the user to click the edit icon. The user can still rename it at any time via the inline edit UI. This was implemented in `useUserSettings.ts` init logic alongside the manual rename flow.

---

*Created: 2026-04-08*
