import { useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import { t } from '@lingui/core/macro';
import type { KeyBackupAdapter } from '../../business/files/useKeyBackupLogic';

/**
 * REACT NATIVE ADAPTER: File Download Operations
 * =============================================
 *
 * USER-FRIENDLY & SECURE: Handles private key backup operations:
 * - Let user choose save location using native file picker
 * - Saves to user-accessible folders (Downloads, Documents, etc.)
 * - Same location where "upload" functionality can find the file
 * - NO SHARING - uses save dialog, not share dialog
 *
 * This adapter implements the KeyBackupAdapter interface for mobile platforms.
 */
export const useFileDownloadAdapter = (): KeyBackupAdapter => {
  // Check if device should use clipboard fallback (Android < 8.0)
  const shouldUseClipboardFallback = useCallback((): boolean => {
    try {
      // Only Android devices need clipboard fallback
      // Device.osName can be "Android" or full build string on some devices
      const isAndroid =
        Device.osName?.toLowerCase().includes('android') ||
        Device.osName?.includes('/') || // Build string format
        (Device.platformApiLevel && Device.platformApiLevel > 0); // Android has API level

      if (!isAndroid) {
        return false;
      }

      // For Android, check system version
      const systemVersion = Device.osVersion;
      if (systemVersion) {
        // Parse major version (e.g., "7.1.2" -> 7, "8.0.0" -> 8)
        const majorVersion = parseInt(systemVersion.split('.')[0], 10);

        // Use clipboard fallback for Android < 8.0
        return majorVersion < 8;
      }

      // Fallback: try platformApiLevel if osVersion is not available
      if (Device.platformApiLevel) {
        return Device.platformApiLevel < 26; // API 26 = Android 8.0
      }

      // If we can't determine the version, assume clipboard fallback is needed for safety
      return true;
    } catch (error) {
      return true;
    }
  }, []);

  // React Native-specific: Platform-aware file save (2024 best practice)
  const downloadKeyFile = useCallback(
    async (keyData: string, filename: string): Promise<void> => {
      try {
        // Check if we should use clipboard fallback (Android < 8.0 only)
        if (shouldUseClipboardFallback()) {
          // Extract the actual private key from JSON if needed
          let privateKeyToShow = keyData;
          try {
            const parsed = JSON.parse(keyData);
            if (parsed.privateKey) {
              privateKeyToShow = parsed.privateKey;
            }
          } catch (e) {
            // If it's not JSON, use as-is
          }

          // Show native Alert with copy functionality
          Alert.alert(
            t`Manual Backup Required`,
            t`Your device doesn't support automatic file downloads. Your private key will be copied to clipboard so you can save it manually.`,
            [
              {
                text: t`Cancel`,
                style: 'cancel',
                onPress: () => {
                  // Don't resolve - this will keep the user on the current step
                },
              },
              {
                text: t`Copy Key & Continue`,
                onPress: async () => {
                  try {
                    await Clipboard.setStringAsync(privateKeyToShow);

                    // Show success message
                    Alert.alert(
                      t`Key Copied!`,
                      t`Your private key has been copied to clipboard. Save it as "AccountID.key" (you can find your Account ID in Settings later). NEVER share this key!`,
                      [
                        {
                          text: t`I've Saved It`,
                          onPress: () => {
                            // Continue with onboarding - this will be handled by the business logic
                          },
                        },
                      ]
                    );
                  } catch (error) {
                    Alert.alert(
                      t`Copy Failed`,
                      t`Failed to copy to clipboard. Please try again.`,
                      [{ text: t`OK` }]
                    );
                  }
                },
              },
            ]
          );

          // Return immediately - the Alert handles the user interaction
          return;
        }

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

        // Create temporary file first with raw key data (not JSON wrapped)
        const tempFileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(tempFileUri, privateKeyToSave);

        // Check if Android device (handles both "Android" and build strings)
        const isAndroid =
          Device.osName?.toLowerCase().includes('android') ||
          Device.osName?.includes('/') || // Build string format
          (Device.platformApiLevel && Device.platformApiLevel > 0); // Android has API level

        if (isAndroid) {
          // Android: Use Storage Access Framework (best practice 2024)
          const { StorageAccessFramework } = FileSystem;

          if (!StorageAccessFramework) {
            await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
            throw new Error(
              'Storage Access Framework not available on this Android device'
            );
          }

          // Request directory permissions - opens folder picker (user can choose Downloads)
          const permissions =
            await StorageAccessFramework.requestDirectoryPermissionsAsync();

          if (!permissions.granted) {
            // Clean up temp file
            await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
            throw new Error('canceled');
          }

          // Create file in selected directory
          const fileUri = await StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/octet-stream'
          );

          if (!fileUri) {
            await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
            throw new Error('Failed to create file');
          }

          // Write raw key data directly to the created file
          await FileSystem.writeAsStringAsync(fileUri, privateKeyToSave);

          // Clean up temp file
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });

          // Show success message
          Alert.alert(t`Key Saved`, t`Private key saved to selected folder`, [
            { text: t`OK` },
          ]);

          return; // Important: exit here to prevent falling through to iOS code
        } else {
          // iOS or other platforms - use sharing
          // iOS: Use expo-sharing (best practice 2024)
          // User can choose "Save to Files" from the share sheet
          await Sharing.shareAsync(tempFileUri, {
            mimeType: 'application/octet-stream',
            dialogTitle: t`Save Private Key`,
          });

          // Note: On iOS, we don't clean up temp file immediately as sharing is async
          // The file will be cleaned up when cache is cleared

          // Show success message (iOS sharing doesn't provide completion callback)
          Alert.alert(
            t`Key Ready`,
            t`Use "Save to Files" to save your private key`,
            [{ text: t`OK` }]
          );
        }
      } catch (error: any) {
        // Don't throw "canceled" errors as failures
        if (
          error.message?.includes('canceled') ||
          error.message?.includes('cancelled')
        ) {
          throw new Error('canceled'); // Special error type for business logic
        }
        throw new Error(`Failed to save key file: ${error.message}`);
      }
    },
    [shouldUseClipboardFallback]
  );

  // React Native-specific: Show error using native Alert
  const showError = useCallback((message: string) => {
    Alert.alert(t`Backup Failed`, message, [{ text: t`OK` }]);
  }, []);

  return {
    downloadKeyFile,
    showError,
  };
};
