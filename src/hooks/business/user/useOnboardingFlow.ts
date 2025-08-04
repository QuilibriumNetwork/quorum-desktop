import { useState, useCallback } from 'react';
import { 
  usePasskeysContext, 
  passkey 
} from '@quilibrium/quilibrium-js-sdk-channels';
import { DefaultImages } from '../../../utils';

export type OnboardingStep = 'key-backup' | 'display-name' | 'profile-photo' | 'complete';

/**
 * Hook for managing the onboarding flow state machine and user profile data
 * Handles step progression, validation, and profile updates
 * Cross-platform compatible business logic
 */
export const useOnboardingFlow = () => {
  const { currentPasskeyInfo, updateStoredPasskey } = usePasskeysContext();
  const [exported, setExported] = useState(false);
  const [displayName, setDisplayName] = useState(
    currentPasskeyInfo?.displayName ?? ''
  );

  // State machine - determine current step based on completion state
  const getCurrentStep = useCallback((): OnboardingStep => {
    if (!exported) return 'key-backup';
    if (exported && !currentPasskeyInfo?.displayName) return 'display-name';
    if (exported && currentPasskeyInfo?.displayName && !currentPasskeyInfo?.pfpUrl) {
      return 'profile-photo';
    }
    if (exported && currentPasskeyInfo?.pfpUrl && currentPasskeyInfo.displayName) {
      return 'complete';
    }
    return 'key-backup';
  }, [exported, currentPasskeyInfo?.displayName, currentPasskeyInfo?.pfpUrl]);

  // Update user stored information in passkey context
  const updateUserProfile = useCallback((
    updates: Partial<passkey.StoredPasskey> = {}
  ) => {
    if (!currentPasskeyInfo) return;

    updateStoredPasskey(currentPasskeyInfo.credentialId, {
      credentialId: currentPasskeyInfo.credentialId,
      address: currentPasskeyInfo.address,
      publicKey: currentPasskeyInfo.publicKey,
      displayName: displayName,
      completedOnboarding: false,
      pfpUrl: currentPasskeyInfo?.pfpUrl ?? DefaultImages.UNKNOWN_USER,
      ...updates,
    });
  }, [currentPasskeyInfo, displayName, updateStoredPasskey]);

  // Complete the onboarding process and set user as active
  const completeOnboarding = useCallback((setUser: (user: any) => void) => {
    if (!currentPasskeyInfo) return;

    updateUserProfile({ completedOnboarding: true });
    setUser({
      displayName: displayName,
      state: 'online',
      status: '',
      userIcon: currentPasskeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER,
      address: currentPasskeyInfo.address,
    });
  }, [currentPasskeyInfo, displayName, updateUserProfile]);

  // Mark key as exported (called by platform-specific backup implementations)
  const markKeyAsExported = useCallback(() => {
    setExported(true);
  }, []);

  // Save display name
  const saveDisplayName = useCallback(() => {
    updateUserProfile({ displayName, pfpUrl: undefined });
  }, [displayName, updateUserProfile]);

  // Save profile photo with provided URL
  const saveProfilePhoto = useCallback((pfpUrl?: string) => {
    const finalPfpUrl = pfpUrl ?? DefaultImages.UNKNOWN_USER;
    updateUserProfile({ pfpUrl: finalPfpUrl });
  }, [updateUserProfile]);

  // Validation helpers
  const canProceedWithName = displayName.length > 0;
  const isOnboardingComplete = exported && 
    currentPasskeyInfo?.displayName && 
    currentPasskeyInfo?.pfpUrl;

  return {
    // State
    currentStep: getCurrentStep(),
    exported,
    displayName,
    currentPasskeyInfo,
    
    // Validation
    canProceedWithName,
    isOnboardingComplete,
    
    // Actions
    setDisplayName,
    markKeyAsExported,
    saveDisplayName,
    saveProfilePhoto,
    completeOnboarding,
    updateUserProfile,
  };
};