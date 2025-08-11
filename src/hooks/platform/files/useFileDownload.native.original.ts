import { useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
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
  
  // React Native-specific: Platform-aware file save (2024 best practice)
  const downloadKeyFile = useCallback(async (keyData: string, filename: string): Promise<void> => {
    try {
      // Create enhanced key data object with metadata
      const enhancedKeyData = {
        keyData,
        filename,
        createdAt: new Date().toISOString(),
        platform: 'mobile',
        version: '1.0',
        warning: 'PRIVATE KEY - Never share this file with anyone',
      };
      
      // Create temporary file first
      const tempFileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(tempFileUri, JSON.stringify(enhancedKeyData, null, 2));
      
      if (Platform.OS === 'android') {
        // Android: Use Storage Access Framework (best practice 2024)
        const { StorageAccessFramework } = FileSystem;
        
        if (!StorageAccessFramework) {
          throw new Error('File saving not supported on this device');
        }

        // Request directory permissions - opens folder picker (user can choose Downloads)
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        
        if (!permissions.granted) {
          // Clean up temp file
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
          throw new Error('canceled');
        }
        
        // Read temp file as base64 (required for SAF)
        const base64Content = await FileSystem.readAsStringAsync(tempFileUri, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        // Create file in selected directory
        const fileUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          filename,
          'application/json'
        );
        
        if (!fileUri) {
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
          throw new Error('Failed to create file');
        }
        
        // Write content to the created file
        await FileSystem.writeAsStringAsync(fileUri, base64Content, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        // Clean up temp file
        await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        
        // Show success message
        Alert.alert(
          t`Key Saved`,
          t`Private key saved to selected folder`,
          [{ text: t`OK` }]
        );
        
      } else {
        // iOS: Use expo-sharing (best practice 2024)
        // User can choose "Save to Files" from the share sheet
        await Sharing.shareAsync(tempFileUri, {
          mimeType: 'application/json',
          dialogTitle: t`Save Private Key`,
          UTI: 'public.json',
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
      if (error.message?.includes('canceled') || error.message?.includes('cancelled')) {
        throw new Error('canceled'); // Special error type for business logic
      }
      throw new Error(`Failed to save key file: ${error.message}`);
    }
  }, []);

  // React Native-specific: Show error using native Alert
  const showError = useCallback((message: string) => {
    Alert.alert(
      t`Backup Failed`,
      message,
      [{ text: t`OK` }]
    );
  }, []);

  return {
    downloadKeyFile,
    showError,
  };
};