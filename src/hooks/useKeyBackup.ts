import { useKeyBackupLogic } from './business/files/useKeyBackupLogic';
import { useFileDownloadAdapter } from './platform/files/useFileDownload';

/**
 * COMPOSED HOOK: Key Backup Functionality
 * =======================================
 * 
 * Combines shared business logic with platform-specific adapters.
 * This is the single hook that components should import.
 * 
 * Architecture:
 * - Business logic: useKeyBackupLogic (100% shared)
 * - Platform adapter: useFileDownloadAdapter (platform-specific)
 * - Result: Clean API that works identically on both platforms
 * 
 * Replaces:
 * - useWebKeyBackup (web-only)
 * - useKeyBackup.native.ts (mobile-only)
 */
export const useKeyBackup = () => {
  // Get platform-specific adapter (Metro will choose .web.ts or .native.ts)
  const adapter = useFileDownloadAdapter();
  
  // Combine with shared business logic
  const businessLogic = useKeyBackupLogic(adapter);
  
  // Return combined functionality
  return businessLogic;
};