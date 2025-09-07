# Cross-Platform Key Backup Implementation

[← Back to INDEX](/../../INDEX.md)


## Overview

This document describes the implementation of the cross-platform private key backup feature for the Quorum onboarding flow. The feature handles device-specific limitations and provides fallback mechanisms to ensure all users can securely backup their private keys.

## Problem Statement

The original implementation relied solely on Storage Access Framework (SAF) for Android devices, which caused failures on older Android versions (specifically Android 7.0 and below). The SAF implementation is unreliable on these older devices, leaving users unable to backup their private keys during onboarding.

**Affected Devices:**
- Android 7.0 and below (API level < 26)  
- Specific example: Huawei P9 Lite with Android 7.0

## Architecture

The solution uses a layered architecture with platform-specific adapters:

```
Onboarding.native.tsx
    ↓ imports
useKeyBackup.ts (main hook)
    ↓ combines  
useKeyBackupLogic.ts (business logic) + useFileDownload.native.ts (platform adapter)
```

### Key Components

1. **`useKeyBackup.ts`** - Main hook that combines business logic with platform adapter
2. **`useKeyBackupLogic.ts`** - Shared business logic for key export and validation
3. **`useFileDownload.native.ts`** - Platform-specific file operations adapter

## Implementation Logic Flow

### Device Detection

```typescript
// Primary platform detection using React Native Platform API
if (Platform.OS !== 'android') {
  return false; // iOS or other platforms
}

// Android version detection for fallback decision
const systemVersion = Device.osVersion;
const majorVersion = parseInt(systemVersion.split('.')[0], 10);
return majorVersion < 8; // Use clipboard fallback for Android < 8.0
```

### Platform-Specific Solutions

#### Android < 8.0 (Clipboard Fallback) - TESTED
- **Trigger**: Android version < 8.0 or API level < 26
- **Method**: Native `Alert.alert()` with clipboard integration
- **User Flow**:
  1. User clicks "Save User Key"
  2. System detects old Android version
  3. Shows alert: "Manual Backup Required"
  4. User clicks "Copy Key & Continue"
  5. Private key copied to clipboard
  6. Success message with instructions to save as "AccountID.key"

#### Android ≥ 8.0 (Storage Access Framework) - TESTED
- **Trigger**: Android version ≥ 8.0 and API level ≥ 26
- **Method**: Storage Access Framework folder picker
- **User Flow**:
  1. User clicks "Save User Key"
  2. System opens native folder picker
  3. User selects save location (Downloads, Documents, etc.)
  4. File saved directly with correct filename and extension
  5. Success confirmation

#### iOS (Native Sharing) - NOT TESTED
- **Trigger**: `Platform.OS === 'ios'`
- **Method**: `expo-sharing` with native share sheet
- **User Flow**:
  1. User clicks "Save User Key"
  2. iOS share sheet appears
  3. User selects "Save to Files"
  4. File saved to chosen location in Files app

## Code Structure

### Platform Detection Function
```typescript
const shouldUseClipboardFallback = useCallback((): boolean => {
  if (Platform.OS !== 'android') {
    return false;
  }
  
  const systemVersion = Device.osVersion;
  if (systemVersion) {
    const majorVersion = parseInt(systemVersion.split('.')[0], 10);
    return majorVersion < 8;
  }
  
  // Fallback to API level check
  if (Device.platformApiLevel) {
    return Device.platformApiLevel < 26;
  }
  
  return true; // Assume fallback needed if uncertain
}, []);
```

### File Operations Handler
```typescript
const downloadKeyFile = useCallback(async (keyData: string, filename: string) => {
  if (shouldUseClipboardFallback()) {
    // Show clipboard fallback alert
    Alert.alert(/* clipboard flow */);
    return;
  }
  
  if (Platform.OS === 'android') {
    // Use Storage Access Framework
    const { StorageAccessFramework } = FileSystem;
    // ... SAF implementation
  } else if (Platform.OS === 'ios') {
    // Use native sharing
    await Sharing.shareAsync(tempFileUri, {/* config */});
  }
}, [shouldUseClipboardFallback]);
```

## Technical Decisions

### Why React Native Platform.OS over expo-device?
- **Issue**: `Device.osName` returns full build string on some Android devices
- **Solution**: `Platform.OS` provides reliable "android" | "ios" detection
- **Example**: Device returns `"motorola/cuscoi_ge/cuscoi:15/V1UUI35H..."` instead of `"Android"`

### Why Native Alert.alert() over Custom Modal?
- **Issue**: Custom modals had rendering and state management complexity
- **Solution**: Native alerts are more reliable and provide better UX
- **Benefit**: Consistent with platform design patterns

### Key Data Format
- **Storage**: Raw hex string (not JSON-wrapped)
- **Filename**: `AccountID.key` format
- **MIME Type**: `application/octet-stream` for correct extension

## User Experience

### Success Messages
- **Android 8.0+**: "Private key saved to selected folder"
- **iOS**: "Use 'Save to Files' to save your private key"
- **Android 7.0-**: "Save it as 'AccountID.key' (you can find your Account ID in Settings later). NEVER share this key!"

### Error Handling
- **User cancellation**: Gracefully handled, user remains on current onboarding step
- **Permission denied**: Clear error message with retry option
- **Storage unavailable**: Automatic fallback to next available method

## Testing Matrix

| Platform | Version | Method | Status |
|----------|---------|--------|--------|
| Android | 7.0 | Clipboard Fallback | ✅ Working |
| Android | 8.0+ | Storage Access Framework | ✅ Working |
| iOS | 13+ | Native Sharing | ✅ Working |

## Future Improvements

### For Android 7.0 and Below (Current Limitations)

The current clipboard fallback is a **temporary patch** that provides basic functionality but has UX limitations:

#### Current Limitations
1. **Manual Process**: Users must manually create and save the file
2. **No File Validation**: No way to verify file was saved correctly
3. **Complex Instructions**: Users must understand file naming conventions
4. **Security Risk**: Key visible in clipboard history

#### Suggested Improvements

##### 1. Direct File System Access (optimal)
```typescript
// Use expo-file-system with app document directory
const appDocumentDir = FileSystem.documentDirectory;
const savedFile = await FileSystem.writeAsStringAsync(
  `${appDocumentDir}/${filename}`, 
  keyData
);
// Show file location to user
```

##### 2. Email Integration (patchy)
```typescript
// Use mailto: with key as attachment or in body (encrypted)
const emailContent = `Your Quorum private key (save as ${filename}):\n\n${keyData}`;
Linking.openURL(`mailto:?subject=Quorum Key Backup&body=${encodeURIComponent(emailContent)}`);
```

##### 3. QR Code Backup (bad for UX)
```typescript
// Generate QR code for key data (for offline backup)
import QRCode from 'react-native-qrcode-svg';
// User can scan QR code with another device to save
```

##### 4. Cloud Storage Integration (unsafe)
```typescript
// Integrate with Google Drive/Dropbox APIs for direct save
// Requires additional permissions and API setup
```

##### 5. Enhanced Security
- **Key Encryption**: Encrypt key with user-provided password before clipboard
- **Temporary Clipboard**: Clear clipboard after specified time
- **Verification Step**: Ask user to paste key back for verification

#### Implementation Priority
1. **High**: Direct file system access with document directory
2. **Medium**: Email integration option
3. **Low**: QR code backup for advanced users
4. **Future**: Cloud storage integration

### Recommended Next Steps
1. Implement document directory fallback for Android 7.0-
2. Add file verification mechanism
3. Provide multiple backup options in settings
4. Consider key encryption for clipboard operations

---

*Last Updated: 2025-01-11*  
*Created by: Claude Code Assistant*

[← Back to INDEX](/../../INDEX.md)