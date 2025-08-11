# Android File Download Issue - Huawei P9 Lite (Android 7.0)

**Date:** August 11, 2025  
**Severity:** High - Blocks key backup functionality on older Android devices  
**Status:** Unresolved  
**Affected Component:** `src/hooks/platform/files/useFileDownload.native.ts`

## Problem Description

The private key backup feature in `src/components/onboarding/Onboarding.native.tsx` fails to work properly on older Android devices, specifically tested on a Huawei P9 Lite running Android 7.0 (API 24).

### Original Issue
- User clicks "Download Key" button
- On Huawei P9 Lite: Opens useless file picker showing only "Recenti" (Recent files) with no save option
- On newer devices (Motorola Edge 50): Works correctly with proper folder picker

## Root Cause Analysis

The issue stems from inconsistent Storage Access Framework (SAF) implementation across Android manufacturers and versions:

1. **SAF Inconsistency**: Android 7.0 and below have unreliable SAF implementations
2. **Manufacturer Variations**: Huawei's file picker implementation differs from stock Android
3. **API Version Compatibility**: SAF behavior changed significantly in Android 8.0 (API 26)

## Attempted Solutions & Results

### 1. Universal Android Version Detection ❌
**Approach**: Skip SAF for Android < 26, use direct file operations
**Implementation**: 
```typescript
const isOlderAndroid = androidVersion < 26;
if (isOlderAndroid) {
  // Direct file operations
}
```
**Result**: Failed - Android storage permissions complex and unreliable

### 2. react-native-blob-util Integration ❌
**Approach**: Use react-native-blob-util for better Android compatibility
**Implementation**: Added dependency and fallback system
**Result**: Failed - Native module initialization errors:
```
TypeError: Cannot read property 'getConstants' of null
ERROR Error: Requiring unknown module '1248'
```

### 3. Cache Directory with User Instructions ❌
**Approach**: Save to app cache directory, provide manual access instructions  
**Implementation**: 
```typescript
const cachePath = FileSystem.cacheDirectory + filename;
await FileSystem.writeAsStringAsync(cachePath, jsonContent);
```
**Result**: Failed - File shows as saved in logs (430 bytes) but not accessible to user

### 4. Simple expo-sharing Fallback ❌
**Approach**: Use expo-sharing for older Android versions
**Implementation**:
```typescript
await Sharing.shareAsync(tempFileUri, {
  mimeType: 'application/json',
  dialogTitle: 'Save Private Key File',
});
```
**Result**: Failed - No file attached when sharing via email, confusing UX

### 5. Multi-tier Fallback System ❌
**Approach**: Comprehensive fallback chain (SAF → blob-util → sharing → manual)
**Result**: Failed - Each fallback had its own issues, created complex unreliable system

## Technical Details

### File Structure
- **File Type**: JSON containing private key data
- **File Size**: ~430 bytes
- **Filename Pattern**: `[public-key-hash].key`
- **Content**: Enhanced metadata wrapper around raw key data

### Android Permissions Added
```json
{
  "android": {
    "permissions": [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE"
    ]
  }
}
```

### Debugging Output
```
LOG [FileDownload] Android-Universal: Detected Android 24
LOG [FileDownload] Android-Universal: SUCCESS - File saved to cache: 
    file:///data/user/0/host.exp.exponent/cache/0x1234...key, size: 430 bytes
```

## Current Workaround

**Status**: Reverted to original SAF-only implementation  
**Impact**: Feature remains broken on older Android devices  
**User Experience**: Unusable file picker on affected devices  

## Recommended Solution Path

### Short-term Options
1. **Accept Limitation**: Document that feature requires Android 8.0+
2. **Manual Instructions**: Provide clear manual backup process for older devices
3. **Alternative Backup**: Implement QR code or text-based backup for older devices

### Long-term Solutions
1. **Native Module**: Custom file picker native module with manufacturer-specific handling
2. **Web Fallback**: Open web interface for file download on problematic devices
3. **Cloud Integration**: Direct integration with Google Drive/Dropbox for reliable saving

## Security Considerations

- **No Sharing**: Private keys should never use sharing APIs (security risk)
- **Local Storage**: Files must be saved to user-accessible local storage
- **File Permissions**: Saved files should be readable by other apps for login functionality

## Testing Devices

### ✅ Working
- Motorola Edge 50 (Android 11+)
- Most Android 8.0+ devices with standard SAF

### ❌ Broken  
- Huawei P9 Lite (Android 7.0 / API 24)
- Likely other Android 7.0 and below devices
- Devices with non-standard SAF implementations

## Related Files

- `src/hooks/platform/files/useFileDownload.native.ts` - Main implementation
- `src/components/onboarding/Onboarding.native.tsx:121-128` - User interface
- `mobile/app.json` - Android permissions configuration
- `.readme/tasks/todo/mobile-dev/android-file-download-fix.md` - Implementation plan

## Impact Assessment

- **User Base**: Affects users with older Android devices (Android 7.0 and below)
- **Market Share**: ~15-20% of Android users as of 2025
- **Business Impact**: Users cannot backup private keys, potential account lockout
- **Support Load**: Increased support requests for manual key backup

---

*Last updated: August 11, 2025*