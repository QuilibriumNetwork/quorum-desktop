import { 
  usePasskeysContext
} from '@quilibrium/quilibrium-js-sdk-channels';
import { OnboardingAdapter, PasskeyInfo } from '../../business/user/useOnboardingFlowLogic';

/**
 * Native adapter for passkey functionality using the SDK shim
 * This will use the mock data from our SDK shim for React Native
 */
export const usePasskeyAdapter = (): OnboardingAdapter => {
  const { currentPasskeyInfo, updateStoredPasskey } = usePasskeysContext();

  // Convert SDK shim types to our platform-agnostic types
  const adaptedPasskeyInfo: PasskeyInfo | null = currentPasskeyInfo ? {
    credentialId: currentPasskeyInfo.credentialId,
    address: currentPasskeyInfo.address,
    publicKey: currentPasskeyInfo.publicKey,
    displayName: currentPasskeyInfo.displayName,
    pfpUrl: currentPasskeyInfo.pfpUrl,
    completedOnboarding: currentPasskeyInfo.completedOnboarding,
  } : null;

  // Wrap the shim's updateStoredPasskey to match our interface
  const adaptedUpdateStoredPasskey = (credentialId: string, updates: Partial<PasskeyInfo>) => {
    // The native shim will handle this appropriately
    updateStoredPasskey(credentialId, {
      credentialId: updates.credentialId || credentialId,
      address: updates.address || '',
      publicKey: updates.publicKey || '',
      displayName: updates.displayName,
      pfpUrl: updates.pfpUrl,
      completedOnboarding: updates.completedOnboarding,
    });
  };

  return {
    currentPasskeyInfo: adaptedPasskeyInfo,
    updateStoredPasskey: adaptedUpdateStoredPasskey,
  };
};