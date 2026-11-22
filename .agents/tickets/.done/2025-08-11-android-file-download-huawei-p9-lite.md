---
type: bug
title: Android 7.0 File Download Fix - Implementation Plan
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-08-11T00:00:00.000Z
---

# Android 7.0 File Download Fix - Implementation Plan

This is only partially solved (giveAndoird 7 users the possibility to manually save the key in a txt file), but it's also a minor issue as those users are an extrenely low minority (well below 1%).

## Problem Analysis

### Issue Description

The key backup feature in the mobile onboarding flow fails to work properly on older Android devices, specifically:

- **Device**: Huawei with Android 7.0
- **Symptom**: Opens phone screen with no clear option to save file
- **Working**: Feature works correctly on newer Motorola Edge 50
- **Impact**: Critical onboarding step fails for users on older Android devices

### Technical Root Cause

Current implementation in `src/hooks/platform/files/useFileDownload.native.ts` relies entirely on:

- `expo-file-system`'s Storage Access Framework (SAF)
- `StorageAccessFramework.requestDirectoryPermissionsAsync()` method
- SAF has inconsistent behavior on older Android versions (API 24/Android 7.0)
- Different Android manufacturers (Huawei, Samsung, etc.) implement SAF differently

### Code Location

- **Primary Issue**: `src/hooks/platform/files/useFileDownload.native.ts:41-86`
- **Business Logic**: `src/hooks/business/files/useKeyBackupLogic.ts:53-84`
- **Component Usage**: `src/components/onboarding/Onboarding.native.tsx:121-128`

## Solution Architecture

### Multi-Tier Fallback System

Implement a robust 3-tier fallback system that works on both iOS and Android:

#### iOS Implementation Tiers

1. **Primary**: react-native-blob-util with iOS native file save
2. **Fallback**: Current expo-sharing implementation (already working)
3. **Ultimate**: Native iOS share sheet with "Save to Files"

#### Android Implementation Tiers

1. **Primary**: Enhanced SAF with better error detection and device compatibility
2. **Fallback**: react-native-blob-util Android Download Manager (works on Android 7.0+)
3. **Ultimate**: expo-sharing dialog as last resort

### Safety Strategy

- **Backup Original**: Create `.original.ts` copy of current implementation
- **Runtime Flag**: Environment/config flag to switch between implementations
- **Gradual Rollout**: Test new implementation with instant rollback capability
- **No Breaking Changes**: Maintain existing API interface

## Implementation Details

### Dependencies

```bash
# Install react-native-blob-util for enhanced file operations
yarn add react-native-blob-util
```

**Note**: `expo-sharing` and `expo-file-system` are already available in package.json

### Files to Modify/Create

#### 1. Backup Current Implementation

- **Create**: `src/hooks/platform/files/useFileDownload.native.original.ts`
- **Content**: Exact copy of current `useFileDownload.native.ts`
- **Purpose**: Safety rollback mechanism

#### 2. Enhanced Implementation

- **Modify**: `src/hooks/platform/files/useFileDownload.native.ts`
- **Changes**:
  - Add react-native-blob-util integration
  - Implement tier-based fallback system
  - Add device/manufacturer detection
  - Enhanced error handling

#### 3. Configuration Updates

- **Modify**: `mobile/app.json`
- **Add**: Android storage permissions if needed
- **Changes**: Ensure compatibility with older Android versions

### Code Architecture Changes

#### New Interface Extensions

```typescript
interface FileDownloadConfig {
  useOriginalImplementation?: boolean;
  enableTierLogging?: boolean;
  maxRetryAttempts?: number;
}
```

#### Enhanced Error Handling

- Device-specific error detection
- Manufacturer compatibility checks
- Graceful degradation between tiers
- User-friendly error messages

## Technical Specifications

### Android Tier Implementation

#### Tier 1: Enhanced SAF

- Current SAF implementation with better error detection
- Device/manufacturer compatibility matrix
- Timeout handling and retry logic

#### Tier 2: react-native-blob-util Download Manager

```typescript
// Android Download Manager approach
await RNBlobUtil.config({
  addAndroidDownloads: {
    useDownloadManager: true,
    notification: false,
    mediaScannable: true,
    path: `${RNBlobUtil.fs.dirs.DownloadDir}/${filename}`,
  },
}).fetch('GET', dataUri);
```

#### Tier 3: expo-sharing Fallback

- Current expo-sharing implementation
- Always available as ultimate fallback

### iOS Tier Implementation

#### Tier 1: react-native-blob-util iOS

```typescript
// iOS native file operations
await RNBlobUtil.ios.openDocument(filePath);
```

#### Tier 2: expo-sharing (Current)

- Existing working implementation
- Native iOS share sheet

### Cross-Platform Detection

```typescript
const getOptimalDownloadStrategy = () => {
  if (Platform.OS === 'ios') {
    return 'react-native-blob-util-ios';
  }

  // Android device detection
  const androidVersion = Platform.Version;
  const manufacturer = DeviceInfo.getManufacturer();

  if (androidVersion >= 24 && !isProblematicDevice(manufacturer)) {
    return 'enhanced-saf';
  }

  return 'react-native-blob-util-android';
};
```

## Testing Strategy

### Device Compatibility Matrix

| Platform | Version | Manufacturer     | Test Status | Expected Tier |
| -------- | ------- | ---------------- | ----------- | ------------- |
| Android  | 7.0     | Huawei           | 🔴 Failing  | Tier 2        |
| Android  | Latest  | Motorola Edge 50 | ✅ Working  | Tier 1        |
| Android  | 8.0+    | Samsung          | 📋 To Test  | Tier 1        |
| Android  | 7.0+    | Generic          | 📋 To Test  | Tier 2        |
| iOS      | 13+     | All              | 📋 To Test  | Tier 1        |

### Test Scenarios

#### Scenario 1: Primary Method Success

- **Expected**: File saves successfully using Tier 1
- **Verify**: File appears in expected location
- **Platforms**: Both iOS and Android

#### Scenario 2: Primary Method Failure → Fallback

- **Expected**: Graceful fallback to Tier 2
- **Verify**: User receives clear feedback about fallback
- **Platforms**: Primarily older Android devices

#### Scenario 3: All Methods Fail → Ultimate Fallback

- **Expected**: expo-sharing dialog appears
- **Verify**: User can still save file manually
- **Platforms**: Edge cases and very old devices

#### Scenario 4: Rollback Testing

- **Expected**: Original implementation works when flag is set
- **Verify**: Can instantly revert to current behavior
- **Platforms**: All platforms

### Testing Checklist

- [ ] Test on Huawei Android 7.0 device (primary issue)
- [ ] Test on Motorola Edge 50 (currently working)
- [ ] Test on Samsung Android devices
- [ ] Test on iOS devices (iPhone/iPad)
- [ ] Test rollback flag functionality
- [ ] Test each tier individually
- [ ] Test error scenarios and fallback paths
- [ ] Verify file integrity after save
- [ ] Test user experience and feedback messages

## Deployment Plan

### Phase 1: Development & Backup (Week 1)

- [ ] Create backup of current implementation
- [ ] Install react-native-blob-util dependency
- [ ] Implement enhanced multi-tier system
- [ ] Add configuration flags for rollback
- [ ] Initial testing on available devices

### Phase 2: Testing & Validation (Week 2)

- [ ] Comprehensive device testing
- [ ] User experience validation
- [ ] Performance impact assessment
- [ ] Error handling verification
- [ ] Rollback mechanism testing

### Phase 3: Gradual Rollout (Week 3)

- [ ] Deploy with original implementation as default
- [ ] Enable new implementation for beta users
- [ ] Monitor error rates and user feedback
- [ ] A/B test between implementations

### Phase 4: Full Deployment (Week 4)

- [ ] Enable new implementation by default
- [ ] Monitor production metrics
- [ ] Address any edge cases discovered
- [ ] Document final implementation

### Phase 5: Cleanup (Week 5)

- [ ] Remove rollback flags if stable
- [ ] Clean up original implementation backup
- [ ] Update documentation
- [ ] Archive this implementation plan

## Risk Mitigation

### High-Priority Risks

1. **New implementation breaks working devices**
   - **Mitigation**: Backup + runtime flag for instant rollback
2. **react-native-blob-util compatibility issues**
   - **Mitigation**: Keep expo-sharing as ultimate fallback
3. **iOS functionality regression**
   - **Mitigation**: Maintain current expo-sharing as iOS fallback

### Medium-Priority Risks

1. **Performance impact of tier detection**
   - **Mitigation**: Cache device detection results
2. **User confusion during fallbacks**
   - **Mitigation**: Clear, consistent messaging across tiers

### Low-Priority Risks

1. **Increased bundle size**
   - **Mitigation**: Monitor bundle impact, tree-shake unused features

## Success Criteria

### Primary Success Metrics

- [ ] ✅ File download works on Huawei Android 7.0 device
- [ ] ✅ Existing functionality maintained on all working devices
- [ ] ✅ iOS compatibility preserved
- [ ] ✅ Zero regression on currently working devices

### Secondary Success Metrics

- [ ] ✅ Improved error handling and user feedback
- [ ] ✅ Better device compatibility across Android manufacturers
- [ ] ✅ Graceful degradation on unsupported devices
- [ ] ✅ Maintainable code with clear fallback paths

### Quality Metrics

- [ ] ✅ All tests pass on target devices
- [ ] ✅ Code review approval
- [ ] ✅ Performance impact within acceptable bounds
- [ ] ✅ Documentation updated and complete

## Implementation Checklist

### Pre-Implementation

- [ ] Review and approve this plan
- [ ] Identify test devices for validation
- [ ] Set up development environment
- [ ] Create feature branch

### Development Phase

- [ ] Create backup file (`useFileDownload.native.original.ts`)
- [ ] Install react-native-blob-util dependency
- [ ] Implement multi-tier fallback system
- [ ] Add configuration flags
- [ ] Update mobile app permissions if needed
- [ ] Add comprehensive error handling
- [ ] Implement device detection logic

### Testing Phase

- [ ] Unit tests for tier selection logic
- [ ] Integration tests for each tier
- [ ] Manual testing on target devices
- [ ] Rollback mechanism validation
- [ ] Performance impact assessment

### Deployment Phase

- [ ] Code review and approval
- [ ] Merge to feature branch
- [ ] Deploy to staging environment
- [ ] Beta user testing
- [ ] Production deployment with feature flag
- [ ] Monitor metrics and user feedback

### Post-Deployment

- [ ] Enable new implementation by default
- [ ] Monitor for issues and user feedback
- [ ] Address any edge cases discovered
- [ ] Clean up temporary code and flags
- [ ] Update project documentation

---

## Notes

### Development Guidelines

- Follow existing code patterns and architecture
- Maintain backwards compatibility
- Use TypeScript for type safety
- Follow React Native best practices
- Ensure cross-platform compatibility

### Security Considerations

- Validate file permissions on all platforms
- Sanitize file names and paths
- Ensure user data privacy
- Follow platform security guidelines

### Performance Considerations

- Minimize bundle size impact
- Cache device detection results
- Avoid blocking UI during file operations
- Implement proper loading states

## Solution to test

Given the number of failed attempts, I think the most realistic path forward is to stop fighting SAF on Android 7 entirely and instead create a non-SAF backup flow specifically for old devices — but not using cache or sharing, since both had UX or security pitfalls.

**We can make this hook robust and future-proof by adding:**

- Android API detection to decide whether to use SAF or fallback.
- Copy-to-clipboard fallback for Android < 26 (broken SAF).
- iOS version detection to decide between UIDocumentPicker (iOS 11+) and fallback for older iOS.

The below code may ned to be reworked according to our specifci situation, it's untested.

IMPORTANT:
We dont' want to show a QR code to users, but simply their key to copy to the clipboard manually. We can use the ClickToCopyContent.native.tsx components for this.

```typescript

import { useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform, Clipboard } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { t } from '@lingui/core/macro';
import QRCode from 'react-native-qrcode-svg';
import React from 'react';

// Helper component for fallback display
const KeyBackupFallback = ({ keyData }: { keyData: string }) => {
  return (
    <>
      <Alert
        title={t`Manual Backup Required`}
        message={t`Your device cannot save this file directly. Please scan the QR code or copy the text below.`}
      />
      <QRCode value={keyData} size={250} />
      <Text selectable>{keyData}</Text>
      <Button title={t`Copy to Clipboard`} onPress={() => Clipboard.setString(keyData)} />
    </>
  );
};

export const useFileDownloadAdapter = () => {
  const androidVersion = Platform.OS === 'android'
    ? parseInt(DeviceInfo.getSystemVersion().split('.')[0], 10)
    : null;

  const iosVersion = Platform.OS === 'ios'
    ? parseInt(DeviceInfo.getSystemVersion().split('.')[0], 10)
    : null;

  const downloadKeyFile = useCallback(async (keyData: string, filename: string): Promise<void> => {
    try {
      const tempFileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(tempFileUri, keyData);

      if (Platform.OS === 'android') {
        if (androidVersion && androidVersion < 8) {
          // Fallback for Android < API 26
          Alert.alert(
            t`Manual Backup Required`,
            t`Saving files is not supported on this Android version. We’ll show you a QR code and direct copy option.`
          );
          // Render fallback UI (QR + Copy)
          // This can be a modal/screen you navigate to
          return;
        }

        const { StorageAccessFramework } = FileSystem;
        if (!StorageAccessFramework) {
          throw new Error('File saving not supported on this device');
        }

        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
          throw new Error('canceled');
        }

        const base64Content = await FileSystem.readAsStringAsync(tempFileUri, {
          encoding: FileSystem.EncodingType.Base64
        });

        const fileUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          filename,
          'application/octet-stream'
        );

        if (!fileUri) {
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
          throw new Error('Failed to create file');
        }

        await FileSystem.writeAsStringAsync(fileUri, base64Content, {
          encoding: FileSystem.EncodingType.Base64
        });

        await FileSystem.deleteAsync(tempFileUri, { idempotent: true });

        Alert.alert(t`Key Saved`, t`Private key saved to selected folder`, [{ text: t`OK` }]);

      } else if (Platform.OS === 'ios') {
        if (iosVersion && iosVersion < 11) {
          // Fallback for iOS < 11
          Alert.alert(
            t`Manual Backup Required`,
            t`Your iOS version does not support saving to Files. We’ll show you a QR code and direct copy option.`
          );
          // Render fallback UI
          return;
        }

        await Sharing.shareAsync(tempFileUri, {
          mimeType: 'application/octet-stream',
          dialogTitle: t`Save Private Key`,
        });

        Alert.alert(
          t`Key Ready`,
          t`Use "Save to Files" to store your private key`,
          [{ text: t`OK` }]
        );
      }

    } catch (error: any) {
      if (error.message?.includes('canceled') || error.message?.includes('cancelled')) {
        throw new Error('canceled');
      }
      throw new Error(`Failed to save key file: ${error.message}`);
    }
  }, [androidVersion, iosVersion]);

  const showError = useCallback((message: string) => {
    Alert.alert(t`Backup Failed`, message, [{ text: t`OK` }]);
  }, []);

  return { downloadKeyFile, showError };
};

```

---

_Last Updated: 2025-08-11_
_Created by: Claude Code Assistant_
