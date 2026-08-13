import { useCallback } from 'react';
import { usePasskeysContext, passkey } from '@quilibrium/quilibrium-js-sdk-channels';
import {
  OnboardingAdapter,
  PasskeyInfo,
} from '../../business/user/useOnboardingFlowLogic';

/**
 * Web adapter for passkey functionality using the Quilibrium SDK
 */
export const usePasskeyAdapter = (): OnboardingAdapter => {
  const { currentPasskeyInfo, updateStoredPasskey, exportKey } = usePasskeysContext();

  // Convert SDK types to our platform-agnostic types
  const adaptedPasskeyInfo: PasskeyInfo | null = currentPasskeyInfo
    ? {
        credentialId: currentPasskeyInfo.credentialId,
        address: currentPasskeyInfo.address,
        publicKey: currentPasskeyInfo.publicKey,
        displayName: currentPasskeyInfo.displayName,
        pfpUrl: currentPasskeyInfo.pfpUrl,
        completedOnboarding: currentPasskeyInfo.completedOnboarding,
      }
    : null;

  // Wrap the SDK's updateStoredPasskey to match our interface
  const adaptedUpdateStoredPasskey = (
    credentialId: string,
    updates: Partial<PasskeyInfo>
  ) => {
    const sdkUpdates: passkey.StoredPasskey = {
      credentialId: updates.credentialId || credentialId,
      address: updates.address || '',
      publicKey: updates.publicKey || '',
      displayName: updates.displayName,
      pfpUrl: updates.pfpUrl,
      completedOnboarding: updates.completedOnboarding ?? false,
    };
    updateStoredPasskey(credentialId, sdkUpdates);
  };

  /**
   * Export the user's private key (hex string)
   * Wraps the SDK's exportKey function
   */
  const adaptedExportKey = useCallback(
    async (address: string): Promise<string> => {
      return exportKey(address);
    },
    [exportKey]
  );

  return {
    currentPasskeyInfo: adaptedPasskeyInfo,
    updateStoredPasskey: adaptedUpdateStoredPasskey,
    exportKey: adaptedExportKey,
  };
};
