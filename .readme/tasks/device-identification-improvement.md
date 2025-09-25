# Device Identification Improvement

**Status:** Pending
**Priority:** Medium
**Complexity:** Medium

## Problem

The UserSettingsModal's Privacy section displays registered devices using cryptographic identifiers (inbox addresses) that are incomprehensible to users:

- Users see: `0x1a2b3c4d5e6f7890abcdef...`
- Users need: `John's MacBook Pro (Chrome)` or `Desktop App (Windows)`

This creates a poor UX where users cannot identify which device is which, making device management confusing and potentially unsafe.

## Current Implementation

**Privacy.tsx:119** displays `d.inbox_registration.inbox_address` directly in the device list, showing cryptographic addresses instead of human-readable device names.

**Available Device Data:**
- `inbox_address`: Unique cryptographic identifier for device's inbox
- `identity_public_key`: Device authentication key
- No metadata about device type, OS, browser, or user-friendly names

## Proposed Solution

### Phase 1: Basic Device Information Display
Create device fingerprinting utility using existing browser APIs to show readable device info:

```typescript
// New utility: src/utils/deviceInfo.ts
function getDeviceInfo(): string {
  // Platform detection (Desktop App, Browser, Mobile)
  // OS detection (Windows, macOS, Linux, iOS, Android)
  // Browser detection (Chrome, Safari, Firefox)
  // Return formatted string like "Desktop App (Windows)"
}
```

**Example Output:**
```
Desktop App (Windows) - This device
Browser (macOS) [Remove]
Mobile (iOS) [Remove]
```

Notes: 

we need to handle the case where the user is syncing on mutlipel devices that would end up having the same name, and use an incremental number,e.g.:

Desktop App (Windows) - This device
Desktop App (Windows) 2 - [Remove]
Desktop App (Windows) 3 - [Remove]
Browser (macOS) [Remove]
Mobile (iOS) [Remove]
Mobile (Android) [Remove]

Let's think about what we can easily grab form the user device (e.g. can we also grab the browser type? Safari, Chrome, Firefox etc...?) and what is the best info to show automatically for UX.

### Phase 2: Enhanced Device Management (we'll do this at a later time)
1. **Custom Device Naming**
   - Allow users to assign custom names like "John's MacBook Pro"
   - Store names in localStorage initially, sync later

2. **Device Metadata Enhancement**
   - Add registration timestamps
   - Track last active times
   - Store device type and platform info

3. **Improved UI Design**
   - Primary: Human-readable name
   - Secondary: Last active time
   - Technical: Truncated address (first 8 chars)

### Phase 3: Full Device Registration Enhancement
Modify the device registration process to store device metadata:

```typescript
interface EnhancedDeviceRegistration extends DeviceRegistration {
  device_metadata?: {
    device_name: string;
    device_type: string;
    platform: string;
    browser?: string;
    registered_at: number;
    last_active?: number;
    user_agent?: string;
  };
}
```

## Implementation Plan

1. **Device Info Utility** - Create browser API-based device detection
2. **Privacy Component Update** - Display readable device names
3. **Custom Naming** - Add device renaming functionality
4. **Metadata Storage** - Implement device metadata persistence
5. **Registration Enhancement** - Modify device registration to include metadata
6. **Cross-Device Sync** - Sync device names across user's devices

## Files to Modify

- `src/components/modals/UserSettingsModal/Privacy.tsx` - Device list UI
- `src/utils/deviceInfo.ts` - New device detection utility
- `src/hooks/business/user/useUserSettings.ts` - Device management logic
- Device registration types and SDK integration

## Benefits

- **Improved Security**: Users can identify unfamiliar devices more easily
- **Better UX**: Clear, understandable device management
- **Reduced Confusion**: No more cryptographic addresses in UI
- **Enhanced Trust**: Users feel more confident managing their account security

## Cross-Platform Considerations

- Solution must work on both web and mobile platforms
- Device detection should use platform-appropriate APIs
- UI design must be mobile-responsive
- Custom device names should sync across platforms

---

*Created: 2025-09-25*