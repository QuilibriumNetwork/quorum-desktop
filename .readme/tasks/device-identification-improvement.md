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

### Phase 1: Privacy-First Device Information Display
Create simplified device detection utility using existing platform APIs with minimal fingerprinting:

```typescript
// New utility: src/utils/deviceInfo.ts
interface DeviceInfo {
  type: 'desktop' | 'web' | 'mobile';
  platform?: string; // Basic OS: Windows, macOS, Linux, iOS, Android
  browser?: string;   // Only for web: Chrome, Safari, Firefox, Edge
}

function getDeviceInfo(): DeviceInfo {
  // Uses existing platform utilities (src/utils/platform.ts)
  // Minimal detection focusing on broad categories
  // No detailed device model extraction for privacy
  // Modern API usage (Client Hints where available)
}
```

**Example Output Formats (Simplified):**
```
Desktop App (Windows) - This device
Chrome (macOS) [Remove]
Safari (iOS) [Remove]
Firefox (Linux) [Remove]
Mobile App (Android) [Remove]
Mobile App (iOS) [Remove]
```

**Key Detection Capabilities (Privacy-Focused):**

1. **Desktop App** (Electron): `Desktop App (OS)`
2. **Web Browsers**: `{Browser} (OS)`
   - Basic browser identification without mobile/desktop distinction
   - Uses existing platform detection utilities
   - No device model extraction to protect privacy
3. **Mobile App**: `Mobile App (iOS)` or `Mobile App (Android)`
   - Basic OS detection is privacy-safe and security-relevant
   - Uses native device info APIs where available
   - Handled by dedicated native components during registration

**Privacy and Security Considerations:**
- **Minimal Fingerprinting**: Only collects necessary categorization data
- **Modern APIs**: Uses User Agent Client Hints where available (Chrome)
- **Graceful Degradation**: Falls back to basic detection for older browsers
- **No Device Models**: Avoids extracting specific device models (Samsung Galaxy S23, etc.)
- **Feature Detection**: Prefers capability detection over user agent parsing

**Technical Implementation:**
- Uses existing `isElectron()`, `isMobile()`, `getPlatform()` utilities
- Implements Client Hints API for Chromium browsers
- Simple browser detection without complex user agent parsing
- Clean integration with registration flow in `RegistrationPersister.tsx`
- Fallback to crypto address for backward compatibility

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

- **Web/Desktop**: Browser-based device detection focuses on web and Electron platforms
- **Mobile App**: Native device identification handled separately by platform-specific components
- **Unified Device List**: All devices (web, desktop app, mobile app) appear together in Privacy settings
- **UI Design**: Device list must be mobile-responsive for cross-platform settings access
- **Future Sync**: Custom device names should sync across platforms in later phases

## Device Registration Flow Analysis

**Current Registration Process:**
1. **PasskeyModal** (Onboarding.tsx) - User authentication via passkey
2. **RegistrationPersister.tsx** - Automatic device registration after authentication
   - Line 117: `secureChannel.NewDeviceKeyset()` - Creates device keys
   - Line 126: `secureChannel.ConstructUserRegistration()` - Registers device
   - **Problem**: Only stores cryptographic identifiers, no human-readable info

**Where Device Info Should Be Injected:**
- Modify `RegistrationPersister.tsx` device creation process
- Add device metadata during `NewDeviceKeyset()` or `ConstructUserRegistration()`
- Device info captured automatically when user first accesses app (not during onboarding flow)

## Implementation Scope for Phase 1 (Revised)

**In Scope (Privacy-First Approach):**
- Create simplified `src/utils/deviceInfo.ts` utility using existing platform detection
- Basic device categorization: Desktop App, Web Browser, Mobile App
- Simple OS detection: Windows, macOS, Linux, iOS, Android (no versions)
- Basic browser identification: Chrome, Safari, Firefox, Edge (web only)
- Modify device registration in `RegistrationPersister.tsx` to include minimal device metadata
- Update Privacy component to display human-readable device names
- Current device marking ("This device")
- Fallback to crypto address for backward compatibility

**Out of Scope (Deferred for Privacy/Simplicity):**
- Mobile vs Desktop browser distinction (adds complexity for minimal benefit)
- Detailed device model extraction (privacy concern)
- Complex duplicate numbering system (simple list until custom naming)
- Detailed OS version detection (Windows 11, macOS Sonoma, etc.)
- Cross-device synchronization of device names
- Custom device naming functionality

**Removed from Original Scope (Privacy Concerns):**
- ❌ Android device model extraction from User Agent
- ❌ Detailed device fingerprinting
- ❌ Complex user agent parsing
- ❌ Mobile/Desktop browser distinction

**Key Integration Points (Simplified):**
- Minimal device metadata captured during automatic registration (RegistrationPersister.tsx)
- Device names generated at display time (Privacy.tsx) using basic stored metadata
- Clean data flow: Registration → Storage → Display
- Modern API usage (Client Hints) with graceful degradation

---

## Analysis Summary

**Feature Analysis:** Analyzed by feature-analyzer agent on 2025-09-26

**Key Findings:**
- ✅ **Good Scope**: Well-planned phased approach with proper cross-platform awareness
- ⚠️ **Privacy Concerns**: Original approach created detailed fingerprints - revised to minimal detection
- ⚠️ **Over-Engineering**: Simplified from complex device model extraction to basic categorization
- ✅ **Integration**: Proper use of existing platform utilities and SDK registration flow

**Recommendations Implemented:**
- Simplified device detection to basic categories (Desktop App, Browser, Mobile App)
- Removed detailed device model extraction for privacy
- Uses modern APIs (Client Hints) with graceful degradation
- Clean data flow from registration to display
- Maintains backward compatibility with crypto address fallback

---

*Created: 2025-09-25*
*Updated: 2025-09-26 (Feature analysis and privacy-first revision)*