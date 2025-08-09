import { useState, useCallback } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

/**
 * SHARED BUSINESS LOGIC: Key Backup Functionality
 * ===============================================
 * 
 * Contains all business logic for key backup operations:
 * - Key export state management
 * - Validation logic
 * - Error handling
 * - Confirmation flow logic
 * 
 * Platform-specific file operations are handled by adapters.
 * This hook is 100% shared between web and mobile.
 */

export interface KeyBackupAdapter {
  // Platform-specific file operations
  downloadKeyFile: (keyData: string, filename: string) => Promise<void>;
  
  // Platform-specific UI helpers
  showError?: (message: string) => void;
  showSuccess?: (message: string) => void;
}

export const useKeyBackupLogic = (adapter: KeyBackupAdapter) => {
  const { currentPasskeyInfo, exportKey } = usePasskeysContext();
  
  // Shared state management
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [alreadySavedConfirmationStep, setAlreadySavedConfirmationStep] = useState(0);

  // Business logic: Generate key data for export
  const generateKeyData = useCallback(async (): Promise<{ content: string; filename: string }> => {
    if (!currentPasskeyInfo) {
      throw new Error('No passkey information available');
    }

    try {
      // Export key using SDK
      const content = await exportKey(currentPasskeyInfo.address);
      const filename = `${currentPasskeyInfo.address}.key`;
      
      return { content, filename };
    } catch (error: any) {
      throw new Error(`Failed to export key: ${error.message}`);
    }
  }, [currentPasskeyInfo, exportKey]);

  // Business logic: Download key file
  const downloadKey = useCallback(async (): Promise<void> => {
    setIsExporting(true);
    setExportError(null);

    try {
      // Generate key data (business logic)
      const { content, filename } = await generateKeyData();
      
      // Use platform adapter for file operations
      await adapter.downloadKeyFile(content, filename);
      
      // Success - adapter handles its own success message
      
    } catch (error: any) {
      // Handle user cancellation gracefully - don't show as error
      if (error.message === 'canceled') {
        // User canceled the save dialog - this is not an error
        return;
      }
      
      const errorMessage = error.message || 'Failed to backup key';
      setExportError(errorMessage);
      
      // Show platform-specific error if available
      adapter.showError?.(errorMessage);
      
      console.error('Error downloading key:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [generateKeyData, adapter]);

  // Business logic: Handle "I already saved mine" confirmation flow
  const handleAlreadySaved = useCallback((): boolean => {
    if (alreadySavedConfirmationStep === 0) {
      // First click - show confirmation
      setAlreadySavedConfirmationStep(1);
      // Reset confirmation after 5 seconds
      setTimeout(() => setAlreadySavedConfirmationStep(0), 5000);
      return false; // Don't proceed yet
    } else {
      // Second click - user confirmed
      setAlreadySavedConfirmationStep(0);
      return true; // Proceed with onboarding
    }
  }, [alreadySavedConfirmationStep]);

  // Business logic: Get appropriate button text for confirmation flow
  const getConfirmationButtonText = useCallback((): string => {
    return alreadySavedConfirmationStep === 0
      ? 'I already saved mine'
      : 'Click again to confirm';
  }, [alreadySavedConfirmationStep]);

  // Business logic: Clear error state
  const clearError = useCallback(() => {
    setExportError(null);
  }, []);

  // Business logic: Check if key can be exported
  const canExportKey = useCallback((): boolean => {
    return !!currentPasskeyInfo && !isExporting;
  }, [currentPasskeyInfo, isExporting]);

  return {
    // State (business logic)
    isExporting,
    exportError,
    alreadySavedConfirmationStep,
    
    // Actions (business logic)
    downloadKey,
    handleAlreadySaved,
    clearError,
    
    // Helpers (business logic)
    getConfirmationButtonText,
    canExportKey,
    
    // Data (from SDK context)
    currentPasskeyInfo,
  };
};