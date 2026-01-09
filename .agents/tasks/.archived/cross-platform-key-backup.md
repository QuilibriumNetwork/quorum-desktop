---
type: task
title: Cross-Platform Key Backup Implementation
status: archived
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Cross-Platform Key Backup Implementation

> **ARCHIVED**: 2025-12-27
>
> **Reason**: Removed clipboard fallback for Android 7.0 and below. The fallback introduced security risks (private key exposed to clipboard history) and only affected <1.2% of Android users. The feature now requires Android 8.0+ (API 26+) which provides hardware-backed keystore support.

## Overview

This document describes the implementation of the cross-platform private key backup feature for the Quorum onboarding flow. The feature uses platform-native file saving mechanisms to ensure secure and user-friendly key backup.

## Supported Platforms

| Platform | Minimum Version | Method                   |
| -------- | --------------- | ------------------------ |
| Android  | 8.0 (API 26)    | Storage Access Framework |
| iOS      | 13+             | Native Sharing           |

**Note**: Android 7.0 and below is not supported. These devices represent <1.2% of the Android market (as of December 2025) and lack hardware-backed keystore support required for secure key operations.

## Architecture

The solution uses a layered architecture with platform-specific adapters:

```
Onboarding.native.tsx / Onboarding.web.tsx
    ↓ imports
useKeyBackup.ts (native) / useWebKeyBackup.ts (web)
    ↓ uses
useFileDownload.native.ts / useFileDownload.web.ts
```

### Key Components

1. **`useKeyBackup.ts`** - Native (React Native) implementation with platform-specific file operations
2. **`useWebKeyBackup.ts`** - Web implementation with browser download functionality
3. **`useFileDownload.native.ts`** - Platform adapter for Android/iOS file saving

## Implementation Logic Flow

### Platform-Specific Solutions

#### Android (Storage Access Framework)

- **Requirement**: Android 8.0+ (API 26+)
- **Method**: Storage Access Framework folder picker
- **User Flow**:
  1. User clicks "Save User Key"
  2. System opens native folder picker
  3. User selects save location (Downloads, Documents, etc.)
  4. File saved directly with correct filename and extension
  5. Success confirmation

#### iOS (Native Sharing)

- **Requirement**: iOS 13+
- **Method**: `expo-sharing` with native share sheet
- **User Flow**:
  1. User clicks "Save User Key"
  2. iOS share sheet appears
  3. User selects "Save to Files"
  4. File saved to chosen location in Files app

## Code Structure

### File Operations Handler

```typescript
const downloadKeyFile = useCallback(
  async (keyData: string, filename: string): Promise<void> => {
    // Extract raw private key from JSON if needed
    let privateKeyToSave = keyData;
    try {
      const parsed = JSON.parse(keyData);
      if (parsed.privateKey) {
        privateKeyToSave = parsed.privateKey;
      }
    } catch (e) {
      // If it's not JSON, use as-is
    }

    // Create temporary file
    const tempFileUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(tempFileUri, privateKeyToSave);

    if (Platform.OS === 'android') {
      // Use Storage Access Framework
      const { StorageAccessFramework } = FileSystem;
      // ... SAF implementation
    } else {
      // iOS: Use native sharing
      await Sharing.shareAsync(tempFileUri, { /* config */ });
    }
  },
  []
);
```

## Technical Decisions

### Why Platform.OS for Platform Detection?

- **Reliable**: `Platform.OS` provides consistent "android" | "ios" detection
- **Simple**: No need to parse device info strings or API levels
- **React Native standard**: Official recommended approach

### Key Data Format

- **Storage**: Raw hex string (not JSON-wrapped)
- **Filename**: `AccountID.key` format
- **MIME Type**: `application/octet-stream` for correct extension

## User Experience

### Success Messages

- **Android**: "Private key saved to selected folder"
- **iOS**: "Use 'Save to Files' to save your private key"

### Error Handling

- **User cancellation**: Gracefully handled, user remains on current onboarding step
- **Permission denied**: Clear error message with retry option
- **Storage unavailable**: Error displayed with retry option

## Security Considerations

- Private key is written to a temporary file that is cleaned up after saving
- Uses hardware-backed storage when available (Android 8.0+)
- No clipboard involvement - keys are never exposed to clipboard history

---

_Last Updated: 2025-12-27_
