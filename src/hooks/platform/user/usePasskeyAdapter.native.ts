import { OnboardingAdapter, PasskeyInfo } from '../../business/user/useOnboardingFlowLogic';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

/**
 * Native adapter for passkey functionality using the SDK shim
 * This will use the mock data from our SDK shim for React Native
 *
 * Note: Config sync (exportKey, fetchUserConfigWithKey) is not supported on native
 * since it requires IndexedDB and Web Crypto APIs. The adapter omits these methods
 * for graceful degradation - onboarding flow will proceed normally without config sync.
 */
export const usePasskeyAdapter = (): OnboardingAdapter => {
  const { currentPasskeyInfo, updateStoredPasskey } = usePasskeysContext();

  // Convert SDK shim types to our platform-agnostic types
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

  // Wrap the shim's updateStoredPasskey to match our interface
  const adaptedUpdateStoredPasskey = (
    credentialId: string,
    updates: Partial<PasskeyInfo>
  ) => {
    // The native shim will handle this appropriately
    updateStoredPasskey(credentialId, {
      credentialId: updates.credentialId || credentialId,
      address: updates.address || '',
      publicKey: updates.publicKey || '',
      displayName: updates.displayName,
      pfpUrl: updates.pfpUrl,
      completedOnboarding: updates.completedOnboarding ?? false,
    });
  };

  // Native does not support config sync - omit exportKey and fetchUserConfigWithKey
  // The onboarding flow will gracefully skip config fetch when these are undefined
  return {
    currentPasskeyInfo: adaptedPasskeyInfo,
    updateStoredPasskey: adaptedUpdateStoredPasskey,
  };
};
