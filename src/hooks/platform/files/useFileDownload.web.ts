import { useCallback } from 'react';
import type { KeyBackupAdapter } from '../../business/files/useKeyBackupLogic';

/**
 * WEB ADAPTER: File Download Operations
 * ====================================
 * 
 * Handles file download operations using web APIs:
 * - Blob creation and URL generation
 * - DOM manipulation for download links
 * - Browser-specific file saving
 * 
 * This adapter implements the KeyBackupAdapter interface for web platforms.
 */
export const useFileDownloadAdapter = (): KeyBackupAdapter => {
  
  // Web-specific: Download file using DOM manipulation
  const downloadKeyFile = useCallback(async (keyData: string, filename: string): Promise<void> => {
    try {
      // Create blob from key data
      const blob = new Blob([keyData], { type: 'text/plain' });
      
      // Create object URL
      const url = window.URL.createObjectURL(blob);
      
      // Create temporary download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error: any) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }, []);

  // Web-specific: Show error using browser alert (could be replaced with toast)
  const showError = useCallback((message: string) => {
    // TODO: Replace with proper toast notification
    console.error('Key backup error:', message);
    // For now, let the component handle error display
  }, []);

  // Web-specific: Show success using browser console (could be replaced with toast)
  const showSuccess = useCallback((message: string) => {
    // TODO: Replace with proper toast notification
    console.log('Key backup success:', message);
    // For now, let the component handle success display
  }, []);

  return {
    downloadKeyFile,
    showError,
    showSuccess,
  };
};