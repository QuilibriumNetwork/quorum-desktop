import { useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { t } from '@lingui/core/macro';
import type { KeyBackupAdapter } from '../../business/files/useKeyBackupLogic';

/**
 * REACT NATIVE ADAPTER: File Download Operations
 * =============================================
 * 
 * Handles file download operations using React Native/Expo APIs:
 * - File system operations with Expo FileSystem
 * - Native sharing with Expo Sharing
 * - Native alerts for user feedback
 * 
 * This adapter implements the KeyBackupAdapter interface for mobile platforms.
 */
export const useFileDownloadAdapter = (): KeyBackupAdapter => {
  
  // React Native-specific: Save and share file using Expo APIs
  const downloadKeyFile = useCallback(async (keyData: string, filename: string): Promise<void> => {
    try {
      // Create enhanced key data object with metadata
      const enhancedKeyData = {
        keyData,
        filename,
        createdAt: new Date().toISOString(),
        platform: 'mobile',
        version: '1.0',
      };
      
      // Write to app's document directory
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(enhancedKeyData, null, 2));
      
      // Check if sharing is available
      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        // Share the file (user can choose to save to Files, send via email, etc.)
        await Sharing.shareAsync(fileUri, {
          dialogTitle: t`Save your Quorum key backup`,
          mimeType: 'application/json',
        });
      } else {
        // Fallback - show alert with file location
        Alert.alert(
          t`Key Backup Created`,
          t`Your key has been saved to the app's documents folder: ${filename}`,
          [{ text: t`OK` }]
        );
      }
      
    } catch (error: any) {
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

  // React Native-specific: Show success using native Alert
  const showSuccess = useCallback((message: string) => {
    Alert.alert(
      t`Backup Successful`,
      message,
      [{ text: t`OK` }]
    );
  }, []);

  return {
    downloadKeyFile,
    showError,
    showSuccess,
  };
};