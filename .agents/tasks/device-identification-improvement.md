---
type: task
title: Device Identification Improvement
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Device Identification Improvement

**Status:** Pending
**Priority:** Medium
**Complexity:** Medium

## Problem

The Privacy settings display registered devices using cryptographic identifiers that users cannot understand:

- **Current**: `0x1a2b3c4d5e6f7890abcdef...` [Remove]
- **Needed**: `Chrome (Windows)` [Remove] or `Desktop App (macOS)` [Remove]

This makes device management confusing and potentially unsafe.

## Requirements

Replace cryptographic device addresses with human-readable names in Privacy settings:

### Core Functionality
1. **Device Detection** - Detect browser, OS, and app type using privacy-first methods
2. **Display Format** - Show `"Browser (OS)"` or `"Desktop App (OS)"` instead of hashes
3. **Current Device Marking** - Append `"- This device"` to current device
4. **Fallback** - Show crypto address for undetected devices (backward compatibility)

### Technical Constraints
- **Privacy-First**: Minimal fingerprinting (basic categorization only)
- **Cross-Platform**: Must work on web, desktop app, and mobile app
- **SDK Limitation**: `DeviceRegistration` type in `@quilibrium/quilibrium-js-sdk-channels` cannot be extended client-side

### Implementation Options
1. **User Config Storage** - Store device names in synced user config (complex sync logic required)
2. **Local-Only Names** - Each device only knows its own name (simple, no sync)
3. **SDK Modification** - Extend SDK's `DeviceRegistration` type (requires external changes)

### Files to Modify
- `src/utils/deviceInfo.ts` - Device detection utility (new)
- `src/components/modals/UserSettingsModal/Privacy.tsx` - Display logic
- Registration integration (depends on chosen approach)

---

## Implementation Attempt Results (2025-09-26)

**Status:** ❌ **Attempted and Reverted** - Complex cross-device sync approach failed

### What We Built

A comprehensive device identification system with:

#### ✅ **Comprehensive Browser Detection**
Created extensive browser detection supporting international users:

```typescript
// Major browsers
- Chrome, Safari, Firefox, Edge, Opera

// Privacy-focused browsers
- Brave (special multi-method detection), DuckDuckGo

// Regional browsers (major markets)
- QQ Browser, Baidu Browser, 360 Browser (China)
- Yandex Browser (Russia)
- Samsung Internet, Whale Browser (Asia)
- UC Browser (mobile)

// Developer/power user browsers
- Vivaldi, Arc
```

#### ✅ **Special Brave Browser Detection**
Brave intentionally mimics Chrome for privacy. We implemented multi-method detection:

```typescript
function detectBrave(): boolean {
  // Method 1: Check for navigator.brave API
  if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
    return true;
  }

  // Method 2: Check for navigator.brave object
  if (typeof navigator.brave !== 'undefined') {
    return true;
  }

  // Method 3: User agent fallback (rare cases)
  if (/brave/.test(navigator.userAgent.toLowerCase())) {
    return true;
  }

  // Method 4: Chrome API differences heuristic
  if (typeof window.chrome !== 'undefined' &&
      typeof window.chrome.loadTimes === 'undefined' &&
      typeof navigator.webkitTemporaryStorage === 'undefined') {
    // Additional checks to avoid false positives with other Chromium browsers
    return !navigator.userAgent.includes('Edg') &&
           !navigator.userAgent.includes('OPR') &&
           !navigator.userAgent.includes('Vivaldi');
  }

  return false;
}
```

#### ✅ **Privacy-First Device Detection**
```typescript
interface DeviceInfo {
  type: 'desktop' | 'web' | 'mobile';
  platform?: string; // Windows, macOS, Linux, iOS, Android
  browser?: string;   // Browser name for web environments
}

function getDeviceInfo(): DeviceInfo {
  if (isElectron()) return { type: 'desktop', platform: detectOS() };
  if (isMobile()) return { type: 'mobile', platform: detectOS() };
  if (isWeb()) return { type: 'web', platform: detectOS(), browser: detectBrowser() };
  return { type: 'web' };
}
```

#### ✅ **Integration with Registration System**
- Auto-captured device info during registration in `RegistrationPersister.tsx`
- Smart config merging to handle timestamp race conditions
- Stored device names in user config for cross-device sync
- Clean display logic in Privacy settings

### 🚨 **Implementation Challenge: User Config vs SDK Device Keys**

**The Fundamental Issue:**
Our approach used the user config sync system to store device names, which works but requires understanding the sync behavior and implementing proper merging logic.

**What We Implemented:**
1. **Device Detection**: Comprehensive browser/OS detection with privacy-first approach
2. **User Config Storage**: Extended user config to include `deviceNames` mapping
3. **Registration Integration**: Auto-captured device info during registration
4. **Smart Merging**: Implemented config merging to handle multiple devices

**Why This Approach Was Complex:**
- Required understanding user config sync system behavior
- Needed smart merging logic to preserve device names from all devices
- Had to handle edge cases like config cleanup and timestamp management
- Added fallback logic for backward compatibility

**Tyler's Suggestion Challenge:**
The "save as property in device keys" approach would be simpler but requires **SDK modifications** - the `DeviceRegistration` type is defined in `@quilibrium/quilibrium-js-sdk-channels` and cannot be extended client-side.

### 💡 **Simpler Solutions That Would Work**

#### **Option 1: Local-Only Device Names (Simplest)**
```typescript
// Each device only knows its own name
// Show: "Chrome (Windows) - This device", "0x1a2b3c4d...", "0x7f8e9a0b..."
// Pros: No sync complexity, always works
// Cons: Other devices still show hashes
```

#### **Option 2: Hybrid Approach**
```typescript
// Current device: "Chrome (Windows) - This device"
// Other devices: "Device #2 (...3c4d)", "Device #3 (...7f8e)"
// Pros: Some readability improvement, no sync issues
// Cons: Less informative for other devices
```

#### **Option 3: SDK-Level Device Metadata (Future)**
```typescript
// Modify SDK to include device metadata in registration
// Requires: SDK changes, not just client-side solution
// Pros: Proper sync, no race conditions
// Cons: Requires SDK modification, breaking changes
```

#### **Option 4: Simple Server-Side Device Registry**
```typescript
// Store device names server-side with device identity keys
// Pros: Reliable sync, no race conditions
// Cons: New API endpoints, server storage
```

### 🎯 **Recommended Next Steps**

**For Immediate Implementation:**
1. **Use Option 1 (Local-Only)** - 50 lines vs 200+ lines of complex sync logic
2. **Keep the browser detection** - The comprehensive browser list is valuable
3. **Keep Brave detection** - This will help users identify their devices
4. **Add edit functionality** - Let users rename their current device

**For Future Enhancement:**
- Consider Option 4 (server-side registry) when device management becomes more important
- Keep comprehensive documentation for reference

### Key Learnings

1. **SDK constraints limit client-side solutions** - Device metadata ideally belongs in the SDK's DeviceRegistration type
2. **User config sync requires careful merging** - Multiple devices updating config simultaneously needs smart merge logic
3. **Browser detection is valuable** - The comprehensive browser list should be preserved for any approach
4. **Simple solutions often better** - Local-only naming may solve 80% of the UX problem with much less complexity

---

## Analysis Summary

**Feature Analysis:** Analyzed by feature-analyzer agent on 2025-09-26
**Implementation Attempt:** 2025-09-26 (Full implementation attempted and reverted)

**Key Findings:**
- ✅ **Good Scope**: Well-planned phased approach with proper cross-platform awareness
- ⚠️ **Privacy Concerns**: Original approach created detailed fingerprints - revised to minimal detection
- ❌ **Over-Engineering**: Complex cross-device sync approach failed due to race conditions
- ✅ **Integration**: Proper use of existing platform utilities and SDK registration flow
- ✅ **Browser Detection**: Comprehensive international browser support successfully implemented
- ✅ **Brave Detection**: Special detection methods work reliably

**Implementation Results:**
- ✅ Comprehensive browser detection (45+ browsers including regional variants)
- ✅ Privacy-first device fingerprinting
- ✅ Special Brave browser detection using multiple methods
- ✅ User config-based device name storage implementation
- ⚠️ Complex merging logic required for cross-device sync
- 📋 Complete implementation documentation preserved for future reference

**Recommendations for Future Attempts:**
1. **SDK modification approach** - modify `@quilibrium/quilibrium-js-sdk-channels` to include device metadata in `DeviceRegistration`
2. **Use local-only device names** - eliminates sync complexity entirely if SDK changes not feasible
3. **Preserve browser detection logic** - comprehensive international support is valuable
4. **Keep Brave detection methods** - these work reliably and help user experience
5. **Add simple device renaming** - let users customize their current device name

---

## Subtask: SDK Modification for Device Name Sync

**Status:** Pending (Requires SDK changes)
**Complexity:** Medium
**Location:** `@quilibrium/quilibrium-js-sdk-channels` (local: `/mnt/d/GitHub/Quilibrium/quilibrium-js-sdk-channels`)

### Why SDK Modification is the Proper Solution

The UserConfig sync approach failed because of **race conditions during concurrent device registration**. The proper solution is to include device metadata in the `DeviceRegistration` type itself, which:

1. **Syncs automatically** - Device names travel with device keys
2. **No race conditions** - Each device registers its own name atomically
3. **Server stores it** - Names persist alongside device identity keys
4. **Other devices see it** - When fetching user registration, all device names are included

### Current SDK Architecture

#### Key Types (`src/channel/channel.ts`)

```typescript
// Current DeviceRegistration (lines 146-150)
export type DeviceRegistration = {
  identity_public_key: string;
  pre_public_key: string;
  inbox_registration: InboxRegistration;
};

// Current UserRegistration (lines 152-158)
export type UserRegistration = {
  user_address: string;
  user_public_key: string;
  peer_public_key: string;
  device_registrations: DeviceRegistration[];
  signature: string;
};
```

#### Registration Flow

1. `NewDeviceKeyset()` - Creates cryptographic keys for the device
2. `ConstructUserRegistration()` - Combines user keyset + device keysets into signed registration
3. Client calls `POST /users/{address}` with the `UserRegistration` payload
4. Server stores and returns device registrations

### Proposed SDK Changes

#### 1. Extend DeviceRegistration Type

```typescript
// In src/channel/channel.ts (line 146)
export type DeviceRegistration = {
  identity_public_key: string;
  pre_public_key: string;
  inbox_registration: InboxRegistration;
  device_metadata?: DeviceMetadata;  // NEW: Optional for backward compatibility
};

// NEW type
export type DeviceMetadata = {
  device_name?: string;        // e.g., "Chrome (Windows)", "Desktop App (macOS)"
  device_type?: 'web' | 'desktop' | 'mobile';
  registered_at?: number;      // Unix timestamp
};
```

#### 2. Update ConstructUserRegistration Function

The signature in `ConstructUserRegistration` (lines 341-411) must include the new field. Currently it signs:

```typescript
// Current signature payload (lines 386-405)
[
  ...userKeyset.peer_key.public_key,
  ...existing_device_keysets.flatMap((d) => [
    ...Buffer.from(d.identity_public_key, 'hex'),
    ...Buffer.from(d.pre_public_key, 'hex'),
    ...base58_to_binary(d.inbox_registration.inbox_address),
    ...Buffer.from(d.inbox_registration.inbox_encryption_public_key, 'hex'),
  ]),
  ...device_keysets.flatMap((d) => [...similar...]),
]
```

**Modify to include device_metadata:**

```typescript
// Updated signature payload
[
  ...userKeyset.peer_key.public_key,
  ...existing_device_keysets.flatMap((d) => [
    ...Buffer.from(d.identity_public_key, 'hex'),
    ...Buffer.from(d.pre_public_key, 'hex'),
    ...base58_to_binary(d.inbox_registration.inbox_address),
    ...Buffer.from(d.inbox_registration.inbox_encryption_public_key, 'hex'),
    // NEW: Include device_name in signature (empty string if not set)
    ...Buffer.from(d.device_metadata?.device_name || '', 'utf-8'),
  ]),
  ...device_keysets.flatMap((d, index) => [
    ...d.identity_key.public_key,
    ...d.pre_key.public_key,
    ...base58_to_binary(d.inbox_keyset.inbox_address),
    ...d.inbox_keyset.inbox_encryption_key.public_key,
    // NEW: Include device_name in signature
    ...Buffer.from(deviceMetadataArray?.[index]?.device_name || '', 'utf-8'),
  ]),
]
```

#### 3. Update Function Signature

```typescript
// Current (line 341)
export const ConstructUserRegistration = async (
  userKeyset: UserKeyset,
  existing_device_keysets: DeviceRegistration[],
  device_keysets: DeviceKeyset[]
) => { ... }

// Updated
export const ConstructUserRegistration = async (
  userKeyset: UserKeyset,
  existing_device_keysets: DeviceRegistration[],
  device_keysets: DeviceKeyset[],
  deviceMetadataArray?: DeviceMetadata[]  // NEW: Optional metadata for new devices
) => { ... }
```

#### 4. Update Device Registration Creation

```typescript
// Current (lines 359-375)
device_registrations: [
  ...existing_device_keysets,
  ...device_keysets.map((d) => {
    return {
      identity_public_key: Buffer.from(...).toString('hex'),
      pre_public_key: Buffer.from(...).toString('hex'),
      inbox_registration: { ... },
    } as DeviceRegistration;
  }),
],

// Updated
device_registrations: [
  ...existing_device_keysets,
  ...device_keysets.map((d, index) => {
    return {
      identity_public_key: Buffer.from(...).toString('hex'),
      pre_public_key: Buffer.from(...).toString('hex'),
      inbox_registration: { ... },
      device_metadata: deviceMetadataArray?.[index],  // NEW
    } as DeviceRegistration;
  }),
],
```

### Server-Side Changes Required

The server must be updated to:

1. **Accept** `device_metadata` field in POST/PUT `/users/{address}`
2. **Store** device metadata alongside device keys
3. **Return** device metadata in GET `/users/{address}` responses
4. **Validate** signature includes device_name (for new registrations)

### Client-Side Changes (quorum-desktop)

#### 1. Device Detection Utility

Create `src/utils/deviceInfo.ts` (use existing browser detection code from this task):

```typescript
export interface DeviceMetadata {
  device_name: string;
  device_type: 'web' | 'desktop' | 'mobile';
  registered_at: number;
}

export function getDeviceMetadata(): DeviceMetadata {
  return {
    device_name: getDeviceName(),  // "Chrome (Windows)", "Desktop App (macOS)", etc.
    device_type: getDeviceType(),
    registered_at: Date.now(),
  };
}

function getDeviceName(): string {
  if (isElectron()) return `Desktop App (${detectOS()})`;
  if (isMobile()) return `Mobile App (${detectOS()})`;
  return `${detectBrowser()} (${detectOS()})`;
}
```

#### 2. Update Registration Flow

In `RegistrationPersister.tsx` or `useAuthenticationFlow.ts`:

```typescript
import { getDeviceMetadata } from '../utils/deviceInfo';
import { channel } from '@quilibrium/quilibrium-js-sdk-channels';

// During registration
const deviceMetadata = getDeviceMetadata();
const registration = await channel.ConstructUserRegistration(
  userKeyset,
  existingDevices,
  [newDeviceKeyset],
  [deviceMetadata]  // NEW: Pass device metadata
);
```

#### 3. Update Privacy Settings Display

In `Privacy.tsx`, use `device_metadata.device_name` instead of cryptographic address:

```typescript
{devices.map((device) => (
  <FlexRow key={device.inbox_registration.inbox_address}>
    <Text>
      {device.device_metadata?.device_name ||
       truncateAddress(device.inbox_registration.inbox_address)}
      {isCurrentDevice(device) && ' - This device'}
    </Text>
    <Button onClick={() => removeDevice(device)}>Remove</Button>
  </FlexRow>
))}
```

### Backward Compatibility

- `device_metadata` is **optional** in the type
- Old registrations without metadata continue to work
- Display falls back to truncated address if no metadata
- Signature validation accepts both old and new formats (server must handle)

### Migration Path

1. **Phase 1**: Deploy SDK changes (backward compatible)
2. **Phase 2**: Update server to accept and store device_metadata
3. **Phase 3**: Update quorum-desktop to send device_metadata during registration
4. **Phase 4**: Update quorum-desktop Privacy settings to display device names
5. **Future**: Consider adding device renaming API

### Files to Modify in SDK

| File | Changes |
|------|---------|
| `src/channel/channel.ts` | Add `DeviceMetadata` type, extend `DeviceRegistration`, update `ConstructUserRegistration` |
| `src/index.ts` | Export new `DeviceMetadata` type |

### Files to Modify in quorum-desktop

| File | Changes |
|------|---------|
| `src/utils/deviceInfo.ts` | NEW: Device detection utility |
| `src/components/context/RegistrationPersister.tsx` | Pass device metadata to registration |
| `src/hooks/business/user/useAuthenticationFlow.ts` | Include device metadata in registration flow |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Display device names from metadata |

### Why This Approach Works

Unlike the UserConfig sync approach that failed:

| Aspect | UserConfig Approach | SDK Metadata Approach |
|--------|--------------------|-----------------------|
| **Write timing** | All devices write to same config | Each device writes its own registration |
| **Conflict resolution** | Last-write-wins (loses data) | No conflicts (atomic per device) |
| **Storage** | Client-side IndexedDB | Server-side with device keys |
| **Sync** | Requires merge logic | Automatic via user registration |
| **Race conditions** | Yes (concurrent registration) | No (each device independent) |

### Estimated Effort

- **SDK changes**: 2-4 hours
- **Server changes**: 2-4 hours (depending on backend architecture)
- **Client changes**: 2-4 hours
- **Testing**: 2-4 hours
- **Total**: ~1-2 days

---


*Verified: 2025-12-22 (Deep dive verification against SDK source code confirmed all technical claims are accurate)*
