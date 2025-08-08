import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';

/**
 * Native implementation of key backup functionality
 * Compatible API with useWebKeyBackup but uses mobile file system
 * Business logic remains the same, only file operations differ
 */
export const useWebKeyBackup = () => {
  const { currentPasskeyInfo, getPrivateKeyForExport } = usePasskeysContext();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadKey = useCallback(async () => {
    if (!currentPasskeyInfo) {
      setDownloadError(t`No passkey information available`);
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      // Get the private key data from passkey context
      const privateKeyData = await getPrivateKeyForExport();
      
      if (!privateKeyData) {
        throw new Error(t`Failed to get private key data`);
      }

      // Create filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `quorum-key-${timestamp}.json`;
      
      // Create the key data object (same format as web)
      const keyData = {
        address: currentPasskeyInfo.address,
        privateKey: privateKeyData,
        displayName: currentPasskeyInfo.displayName,
        createdAt: new Date().toISOString(),
        version: '1.0',
      };

      // Write to app's document directory
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(keyData, null, 2));

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
      console.error('Error downloading key:', error);
      setDownloadError(error.message || t`Failed to backup key`);
      
      Alert.alert(
        t`Backup Failed`,
        t`There was an error creating your key backup. Please try again.`,
        [{ text: t`OK` }]
      );
    } finally {
      setIsDownloading(false);
    }
  }, [currentPasskeyInfo, getPrivateKeyForExport]);

  const clearError = useCallback(() => {
    setDownloadError(null);
  }, []);

  return {
    // Same API as useWebKeyBackup for compatibility
    isDownloading,
    downloadError,
    downloadKey,
    clearError,
  };
};