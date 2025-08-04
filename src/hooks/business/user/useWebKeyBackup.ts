import { useState, useCallback } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

/**
 * Hook for web-specific key backup functionality
 * Handles key export and download with confirmation flow
 * Web-only implementation using DOM APIs
 */
export const useWebKeyBackup = () => {
  const { currentPasskeyInfo, exportKey } = usePasskeysContext();
  const [alreadySavedConfirmationStep, setAlreadySavedConfirmationStep] = useState(0);

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

  // Handle "I already saved mine" confirmation flow
  const handleAlreadySaved = useCallback(() => {
    if (alreadySavedConfirmationStep === 0) {
      setAlreadySavedConfirmationStep(1);
      // Reset confirmation after 5 seconds
      setTimeout(() => setAlreadySavedConfirmationStep(0), 5000);
    } else {
      // User confirmed, return true to indicate they can proceed
      return true;
    }
    return false;
  }, [alreadySavedConfirmationStep]);

  // Get appropriate button text for confirmation flow
  const getConfirmationButtonText = useCallback(() => {
    return alreadySavedConfirmationStep === 0
      ? 'I already saved mine'
      : 'Click again to confirm';
  }, [alreadySavedConfirmationStep]);

  return {
    // State
    alreadySavedConfirmationStep,
    
    // Actions
    downloadKey,
    handleAlreadySaved,
    
    // UI helpers  
    getConfirmationButtonText,
  };
};