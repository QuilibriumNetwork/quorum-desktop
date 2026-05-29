import { useCallback } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

/**
 * Hook for web-specific key backup functionality
 * Handles key export and download via DOM APIs
 */
export const useWebKeyBackup = () => {
  const { currentPasskeyInfo, exportKey } = usePasskeysContext();

  // Download key file using web APIs
  const downloadKey = useCallback(async (): Promise<void> => {
    if (!currentPasskeyInfo) {
      throw new Error('No passkey info available');
    }

    try {
      const content = await exportKey(currentPasskeyInfo.address);
      const fileName = currentPasskeyInfo.address + '.key';
      const blob = new Blob([content], { type: 'text/plain' });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting key:', error);
      throw error;
    }
  }, [currentPasskeyInfo, exportKey]);

  return {
    downloadKey,
  };
};
