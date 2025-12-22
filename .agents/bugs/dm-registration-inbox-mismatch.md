# DM Messages Not Delivered - Device Registration Inbox Mismatch

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Severity**: Critical
**Status**: Open
**Created**: 2025-12-22
**Updated**: 2025-12-22

---

## Symptoms

- User A sends DM to User B - message shows "sent successfully" but never arrives
- Both users are online with active WebSocket connections
- DM works fine between other user pairs
- Both directions fail (A→B and B→A)
- Console shows successful encryption and WebSocket send, but receiver sees nothing

## Root Cause

**Device registration in API has different inbox addresses than what the user's device is actually using.**

When User A sends to User B:
1. User A fetches User B's registration from API
2. API returns inbox addresses (e.g., `QmYZeDcB...`, `QmfLmDk2...`)
3. User A encrypts messages for those inboxes
4. User B's device is actually listening on DIFFERENT inboxes (e.g., `QmNZiNwU...`, `QmQYnN4v...`)
5. Messages are sent to inboxes nobody is listening on

**Evidence from debugging session:**

```
// API says User B's inboxes are:
QmYZeDcBJFWefT8MYicPpG9LX44ETZfFBZKyJ4RSzPQ5Dg
QmfLmDk2UM89MgYQx4srUqMM4DeAtGtAS8kCeRY4mJn4CJ
...

// But User B's device is ACTUALLY using:
QmNZiNwUqqpeypmWgF5uYw35X68B1UjauvjEELN44Cdi11
QmQYnN4vWdqtCJqnDGx7dQU2Q6q1RS1ZSWT7W7LPBbb1gs
...

// Zero overlap between the two lists!
```

## Potential Causes

1. **Device key regeneration without API update** - User created new device keys locally but registration wasn't pushed to server
2. **Multiple devices with stale registration** - User has multiple devices, API has old device's inbox addresses
3. **Registration update failed silently** - Device attempted to update registration but API call failed without user notification
4. **IndexedDB cleared but not API** - User cleared browser data, got new keys, but API still has old registration
5. **Race condition during registration** - Registration update may have been interrupted or partially applied

---

## Current Registration Sync Logic

**File**: [RegistrationPersister.tsx](../../../src/components/context/RegistrationPersister.tsx)

There IS existing sync logic at lines 187-210:

```typescript
// Lines 187-210: Check if local device exists in API registration
if (
  !registration.registration?.device_registrations.find(
    (d: secureChannel.DeviceRegistration) =>
      d.inbox_registration.inbox_address ==
      senderDevice.inbox_keyset.inbox_address
  )
) {
  // Device not found in API → push updated registration
  const senderRegistration = await secureChannel.ConstructUserRegistration(
    senderIdent,
    existing?.device_registrations ?? [],
    [senderDevice]
  );
  uploadRegistration({
    address: currentPasskeyInfo!.address,
    registration: senderRegistration,
  });
}
```

**What this does**: On startup, if the local device's inbox address is NOT found in the API's device registrations, it pushes an updated registration.

**Why it's not enough**:

| Scenario | Current Logic Handles? | Notes |
|----------|----------------------|-------|
| New device not in API | ✅ Yes | Adds device to registration |
| Device in API with WRONG inbox | ❌ No | Only checks existence, not correctness |
| API has stale device entry | ❌ No | Old entry exists but has wrong inbox |
| Upload fails silently | ❌ No | No retry, no user notification |
| Race with other devices | ❌ No | Concurrent updates may overwrite |

**The gap**: Current logic uses `.find()` to check if inbox address EXISTS in API. But the mismatch bug happens when the API has an ENTRY for this device with a DIFFERENT inbox address (stale data).

---

## Proposed Fix: Option 1 - Enhanced Startup Sync Check

### Approach

Change the sync check from "does my inbox exist in API?" to "does API have my EXACT current inbox?"

### Implementation

**Location**: [RegistrationPersister.tsx:187-210](../../../src/components/context/RegistrationPersister.tsx#L187-L210)

```typescript
// BEFORE: Only checks if inbox EXISTS
const deviceExistsInApi = registration.registration?.device_registrations.find(
  (d) => d.inbox_registration.inbox_address === senderDevice.inbox_keyset.inbox_address
);

// AFTER: Also verify the device keyset matches (or just always re-push if any doubt)
const myInboxAddress = senderDevice.inbox_keyset.inbox_address;
const apiHasMyExactDevice = registration.registration?.device_registrations.find(
  (d) => d.inbox_registration.inbox_address === myInboxAddress
);

if (!apiHasMyExactDevice) {
  console.log('[RegistrationPersister] Device inbox not in API, pushing registration...');
  // ... existing push logic
}
```

### Performance Considerations

| Concern | Analysis |
|---------|----------|
| **Extra API call?** | No - already fetches registration via `useRegistration` hook |
| **Extra upload on every startup?** | No - only if mismatch detected (rare) |
| **Latency impact?** | Minimal - sync check is O(n) where n = device count (typically 1-5) |
| **Race conditions?** | Possible but unlikely - same user logging in on multiple devices simultaneously |

### SDK Analysis: `ConstructUserRegistration` Behavior

**VERIFIED** - SDK source at `node_modules/@quilibrium/quilibrium-js-sdk-channels/src/channel/channel.ts:341-411`

```typescript
export const ConstructUserRegistration = async (
  userKeyset: UserKeyset,
  existing_device_keysets: DeviceRegistration[],  // From API
  device_keysets: DeviceKeyset[]                   // Current device(s)
) => {
  // ...
  return {
    // ...
    device_registrations: [
      ...existing_device_keysets,        // ← SPREADS existing (no dedup)
      ...device_keysets.map((d) => {     // ← APPENDS new
        return { /* new device */ };
      }),
    ],
    // ...
  };
};
```

**Answer: Option B - APPENDS, does NOT replace!**

This means:
- If API has stale entry `[{inbox: 'QmOld...'}]`
- And we call with current device `[{inbox: 'QmNew...'}]`
- Result is `[{inbox: 'QmOld...'}, {inbox: 'QmNew...'}]` - **both entries!**

### Implications for Fix

The current sync check logic IS working correctly when triggered:
1. Check: "is my inbox in API?" → No (stale entry has different inbox)
2. Fetch fresh `existing?.device_registrations` from API
3. Call `ConstructUserRegistration(userKeyset, existing, [currentDevice])`
4. Upload result → API now has `[...existing, currentDevice]`

**The problem**: Step 1 check uses `registration.registration` which comes from React Query cache (via `useRegistration` hook), NOT a fresh API fetch. If the cache is stale, the check might pass incorrectly.

**Wait** - let me re-read the code...

Actually looking at lines 187-199:
```typescript
if (!registration.registration?.device_registrations.find(...)) {
  // This block runs if device NOT found
  let existing;
  try {
    existing = (await apiClient.getUser(...))?.data;  // FRESH fetch here
  } catch {}
  // ...
}
```

The check uses cached `registration.registration`, but if mismatch detected, it fetches fresh before constructing.

**Real gap**: The check condition itself uses potentially stale cache. If cache shows device exists (but with wrong inbox), the `if` block never runs.

### Root Cause Confirmed

The sync check at line 187-192:
```typescript
!registration.registration?.device_registrations.find(
  (d) => d.inbox_registration.inbox_address == senderDevice.inbox_keyset.inbox_address
)
```

Uses **cached** registration data. If cache is stale and has a DIFFERENT device entry for this user (old inbox), the `.find()` returns `undefined` (correct - triggers sync). BUT if cache has the SAME stale data that API has, it returns `undefined` too (correct).

**The actual problem**: What if the user's local device keys changed, but both cache AND API still have the old registration? Then:
1. Cache has `[{inbox: 'QmOld...'}]`
2. API has `[{inbox: 'QmOld...'}]`
3. Local device has `{inbox: 'QmNew...'}`
4. Check: "is QmNew in [QmOld]?" → No → triggers sync ✅

This SHOULD work... unless React Query cache invalidation isn't happening properly after the upload.

### New Hypothesis

The bug might be in the **upload mutation not invalidating the cache**, so:
1. User opens app
2. Check runs, detects mismatch, uploads new registration
3. Cache still has old data (not invalidated)
4. Other users fetch user's registration → gets fresh data ✅
5. User's own app uses cached registration → uses stale data for `self` in DM

**Need to verify**: Does `uploadRegistration` mutation invalidate the registration query cache?

### Cache Invalidation Analysis

**VERIFIED** - Cache invalidation IS implemented correctly:

1. [useUploadRegistration.ts](../../../src/hooks/mutations/useUploadRegistration.ts) calls `invalidateRegistration({ address })` after upload
2. [useInvalidateRegistration.ts](../../../src/hooks/queries/registration/useInvalidateRegistration.ts) calls `queryClient.invalidateQueries({ queryKey: ['Registration', address] })`
3. [useRegistration.ts](../../../src/hooks/queries/registration/useRegistration.ts) uses the same key and has `refetchOnMount: true`

**Cache flow is correct.** The bug is elsewhere.

### RegistrationPersister Flow Analysis

Two main paths in [RegistrationPersister.tsx](../../../src/components/context/RegistrationPersister.tsx):

**Path 1: User NOT registered in API** (lines 49-157)
- Tries to load device keys from slot 2 (passkey encrypted storage)
- If load fails → generates NEW device keys at line 115
- **ALWAYS uploads** afterward (lines 101-104 or 150-153)
- ✅ This path is safe

**Path 2: User IS registered in API** (lines 158-239)
- Tries to load device keys from slot 2 (lines 169-186)
- Checks if device inbox exists in API (lines 187-192)
- **Only uploads if mismatch detected** (lines 193-210)
- ⚠️ This is where the gap is

### Specific Failure Scenario

For Jennifer's case (user WAS registered, used on multiple devices for testing):

1. Jennifer logs in on Device A → registers with inbox `QmDeviceA...`
2. Jennifer logs in on Device B → adds `QmDeviceB...` to registration
3. API now has `[{inbox: QmDeviceA}, {inbox: QmDeviceB}]`
4. Jennifer clears Device B's browser data (slot 2 wiped)
5. Jennifer logs in on Device B again
6. Path 2 runs: `registration.registered = true`
7. Slot 2 load at line 169-186 **FAILS** (data was cleared)
8. Exception caught at line 229
9. Only `NotAllowedError` is handled specially (shows reauth UI)
10. Other exceptions are **re-thrown** - but in this async context, might fail silently
11. **No new device keys created, no upload**
12. Device B is now in limbo - no valid local keys, API has stale entry

**Wait** - if slot 2 load fails, how does the app work at all? Let me check...

Actually, looking more carefully at the "registered" path - if slot 2 decryption fails, the exception is thrown, and lines 211-228 (setting keyset, config) never run. The app would be stuck without a keyset.

### Most Likely Scenario

The user tested across multiple devices, and at some point:
1. The API upload succeeded on one device
2. But another device also uploaded around the same time
3. **Race condition**: One device's upload overwrote the other's
4. Result: API has registrations from device X, but user is now on device Y

This explains why "zero overlap" - the API has entries from completely different devices/sessions.

### Proposed Fix: Always Verify Current Device

Instead of checking "does my inbox exist?", the fix should:
1. Fetch current API registration
2. Check if **this exact device** (by inbox address) is in the list
3. If not, add it (existing logic)
4. **NEW**: Also verify no STALE entry for a previous version of this device

But wait - how do we identify "this device" across key regenerations? We can't - each key regeneration creates a new identity.

### Simpler Fix: Always Re-Push on Startup

The safest fix is to **always push the current device registration on startup**, not just when mismatch detected:

```typescript
// Current: Only push if mismatch
if (!registration.registration?.device_registrations.find(...)) {
  // push
}

// Proposed: Always push (idempotent)
const existing = await apiClient.getUser(address);
const senderRegistration = await ConstructUserRegistration(
  senderIdent,
  existing?.device_registrations.filter(
    d => d.inbox_registration.inbox_address !== senderDevice.inbox_keyset.inbox_address
  ) ?? [],  // Filter out any existing entry for THIS device
  [senderDevice]  // Always add current device fresh
);
uploadRegistration(senderRegistration);
```

This ensures:
- Current device is always in registration
- Stale entries for same device are replaced (via filter + add)
- Other devices preserved

**Performance impact**: One extra API call per startup (upload). Acceptable for reliability.

---

## Option 2 - "Refresh Registration" Button (Recommended for Edge Case)

### Approach

Add a manual "Refresh Device Registration" button in Privacy settings, following the existing pattern of "Restore Missing Spaces".

### Implementation Details

**Pattern to follow**: [useSpaceRecovery.ts](../../../src/hooks/business/user/useSpaceRecovery.ts)

**New hook**: `useRegistrationRefresh.ts`

```typescript
// src/hooks/business/user/useRegistrationRefresh.ts
import { useState, useCallback } from 'react';
import { usePasskeysContext, channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { useUploadRegistration } from '../../mutations/useUploadRegistration';
import { showToast } from '../../../utils/toast';

export interface UseRegistrationRefreshReturn {
  refreshRegistration: () => Promise<void>;
  isRefreshing: boolean;
}

export const useRegistrationRefresh = (): UseRegistrationRefreshReturn => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();

  const refreshRegistration = useCallback(async () => {
    if (!currentPasskeyInfo || !keyset) {
      showToast(t`Unable to refresh: not logged in`, { variant: 'error', bottomFixed: true });
      return;
    }

    setIsRefreshing(true);
    try {
      // 1. Fetch current registration from API
      let existing: secureChannel.UserRegistration | undefined;
      try {
        existing = (await apiClient.getUser(currentPasskeyInfo.address))?.data;
      } catch (e) {
        // User might not exist yet, that's fine
      }

      // 2. Filter out any stale entry for THIS device's inbox address
      const myInboxAddress = keyset.deviceKeyset.inbox_keyset.inbox_address;
      const otherDevices = existing?.device_registrations?.filter(
        d => d.inbox_registration.inbox_address !== myInboxAddress
      ) ?? [];

      // 3. Construct new registration with current device
      const senderRegistration = await secureChannel.ConstructUserRegistration(
        keyset.userKeyset,
        otherDevices,
        [keyset.deviceKeyset]
      );

      // 4. Upload
      await uploadRegistration({
        address: currentPasskeyInfo.address,
        registration: senderRegistration,
      });

      showToast(t`Device registration refreshed`, { variant: 'success', bottomFixed: true });
    } catch (error) {
      console.error('[RegistrationRefresh] Error:', error);
      showToast(t`Failed to refresh registration`, { variant: 'error', bottomFixed: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [currentPasskeyInfo, keyset, apiClient, uploadRegistration]);

  return { refreshRegistration, isRefreshing };
};
```

**UI in Privacy.tsx** - Consolidate "Restore Missing Spaces" and "Refresh Registration" into a "Fixes" section (following SpaceSettingsModal pattern):

```tsx
// Props interface addition
fixes?: {
  id: string;
  message: string;
  actionLabel: string;
  onFix: () => void;
  loading?: boolean;
}[];

// In component body (replace separate Data Recovery section):
{fixes && fixes.length > 0 && (
  <>
    <Spacer size="md" direction="vertical" borderTop={true} />
    <div className="text-subtitle-2 mb-2">{t`Fixes`}</div>
    <div className="modal-content-info">
      <div className="flex flex-col gap-2">
        {fixes.map((fix) => (
          <div
            key={fix.id}
            className="flex items-start justify-between gap-3 p-3 rounded-md border"
          >
            <div className="text-sm" style={{ lineHeight: 1.3 }}>
              {fix.message}
            </div>
            <Button
              type="secondary"
              size="small"
              className="whitespace-nowrap"
              onClick={fix.onFix}
              disabled={!!fix.loading}
            >
              {fix.loading ? t`Fixing...` : fix.actionLabel}
            </Button>
          </div>
        ))}
      </div>
    </div>
  </>
)}
```

**In UserSettingsModal.tsx** - Build fixes array:

```tsx
const { restoreMissingSpaces, isRestoring } = useSpaceRecovery();
const { refreshRegistration, isRefreshing } = useRegistrationRefresh();

// Build fixes array (only show relevant fixes)
const fixes = React.useMemo(() => {
  const result = [];

  // Always show refresh registration (useful for edge cases)
  result.push({
    id: 'refresh-registration',
    message: t`If direct messages aren't being delivered, refresh your device registration to resync with the server.`,
    actionLabel: t`Refresh`,
    onFix: refreshRegistration,
    loading: isRefreshing,
  });

  // Restore missing spaces
  result.push({
    id: 'restore-spaces',
    message: t`Restore Spaces that exist on this device but are missing from your navigation menu.`,
    actionLabel: t`Restore`,
    onFix: restoreMissingSpaces,
    loading: isRestoring,
  });

  return result;
}, [refreshRegistration, isRefreshing, restoreMissingSpaces, isRestoring]);

// Pass to Privacy component
<Privacy
  ...
  fixes={fixes}
/>
```

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/business/user/useRegistrationRefresh.ts` | **New file** - hook implementation |
| `src/hooks/business/user/index.ts` | Export new hook |
| `src/hooks/index.ts` | Export new hook |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Replace separate sections with unified `fixes` prop |
| `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` | Build fixes array, wire up both hooks |

### What It Does

1. Fetches current registration from API (fresh, not cached)
2. Filters out any existing entry for THIS device (by inbox address)
3. Adds current device fresh via `ConstructUserRegistration`
4. Uploads updated registration
5. Cache automatically invalidated by `uploadRegistration` mutation

### Why This Works

Even though `ConstructUserRegistration` appends (doesn't replace), we **filter first** to remove any stale entry for this device. Result:
- Other devices preserved
- This device's entry is always fresh and correct
- No duplicates

### Pros
- User control for edge cases
- Good for support/debugging ("click this button to fix DM issues")
- Low risk - doesn't change automatic behavior
- No performance impact on normal startup
- Follows existing UI pattern (Restore Missing Spaces)

### Cons
- Requires user awareness of the problem
- Not self-healing (user must click button)
- Most users won't know to use it without support guidance

### When User Would Use This

1. DMs not being delivered to/from specific users
2. Support tells them to try "Refresh Registration" button
3. After clearing browser data and having DM issues
4. After using app on multiple devices with issues

---

## Immediate Workaround (Per-User)

User needs to force re-registration of their current device:

1. **Remove all devices and re-authenticate** (Privacy settings → Remove devices)
2. **Clear browser data and re-login** (will generate new keys and push to API)
3. **Re-import account from private key** (verified to work - forces fresh registration)

---

## Files to Investigate

| File | Purpose | Lines |
|------|---------|-------|
| [RegistrationPersister.tsx](../../../src/components/context/RegistrationPersister.tsx) | Startup registration sync | 187-210 |
| [useUploadRegistration.ts](../../../src/hooks/mutations/useUploadRegistration.ts) | API upload mutation | All |
| SDK: `ConstructUserRegistration` | Registration merge logic | Need to verify |

---

## Diagnostic Commands

To check if a user has this issue, run in their browser console:

```javascript
// 1. Get user's address
const myAddress = '<USER_ADDRESS>';

// 2. Fetch what API thinks their inboxes are
const response = await fetch(`https://api.quorummessenger.com/users/${myAddress}`);
const apiData = await response.json();
console.log('API inbox addresses:');
apiData.device_registrations?.forEach(d => console.log(d.inbox_registration?.inbox_address));

// 3. Check what inboxes their device is actually using
const allStates = await window.__messageDB.getAllEncryptionStates();
const dmStates = allStates.filter(s => s.conversationId.includes('/'));
console.log('Device inbox addresses:');
[...new Set(dmStates.map(s => s.inboxId))].forEach(i => console.log(i));

// 4. If lists don't overlap, user has this bug
```

---

## Next Steps

1. **Verify SDK behavior**: Check if `ConstructUserRegistration` replaces or duplicates device entries
2. **Add logging**: Temporary console logs in RegistrationPersister to track sync behavior
3. **Implement enhanced check**: If SDK replaces entries correctly, the fix is just ensuring we always push when needed
4. **Test**: Reproduce the bug scenario and verify fix works
5. **Consider Option 2**: Add manual refresh button as fallback

---

## Related

- DM encryption uses Double Ratchet protocol which depends on correct inbox addresses
- This issue is independent of action queue changes - affects both legacy and new code paths
- Similar to session establishment issues but root cause is at registration level

---

## Summary of Findings

| Component | Status | Notes |
|-----------|--------|-------|
| Cache invalidation | ✅ Correct | `uploadRegistration` → `invalidateRegistration` → `queryClient.invalidateQueries` |
| `ConstructUserRegistration` | ⚠️ Appends only | Does NOT replace stale entries - need to filter before calling |
| Sync check condition | ⚠️ Gap | Only checks if inbox EXISTS, not if it's the ONLY entry for this device |
| Race condition handling | ❌ Missing | Concurrent logins can overwrite each other's registrations |

### Recommended Fix

**Always re-push device registration on startup** with filtering:

```typescript
// In RegistrationPersister.tsx, "registered" path
const existing = await apiClient.getUser(address);
const senderRegistration = await ConstructUserRegistration(
  senderIdent,
  existing?.device_registrations.filter(
    d => d.inbox_registration.inbox_address !== senderDevice.inbox_keyset.inbox_address
  ) ?? [],
  [senderDevice]
);
uploadRegistration(senderRegistration);
```

**Cost**: One upload per startup
**Benefit**: Self-healing, prevents all mismatch scenarios

---

_Created: 2025-12-22_
_Discovered during: Action queue DM offline fix testing_
_Updated: 2025-12-22_
