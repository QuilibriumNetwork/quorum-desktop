import { useState, useCallback } from 'react';
import { DefaultImages } from '../../../utils'
import { passkey } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/MessageDB';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext'

export type OnboardingStep = 'loading' | 'key-backup' | 'display-name' | 'profile-photo' | 'complete';

export interface PasskeyInfo {
  credentialId: string;
  address: string;
  publicKey: string;
  displayName?: string;
  pfpUrl?: string;
  completedOnboarding?: boolean;
}

export interface OnboardingAdapter {
  currentPasskeyInfo: PasskeyInfo | null;
  updateStoredPasskey: (credentialId: string, updates: Partial<PasskeyInfo>) => void;
  exportKey: (address: string) => Promise<string>;
}

/**
 * Business logic for managing the onboarding flow state machine and user profile data
 * Platform-agnostic implementation that works with adapters
 */
export const useOnboardingFlowLogic = (adapter: OnboardingAdapter) => {
  const { currentPasskeyInfo, updateStoredPasskey, exportKey } = adapter;
  const [exported, setExported] = useState(false);
  const [displayName, setDisplayName] = useState(
    currentPasskeyInfo?.displayName ?? ''
  );
  const [isFetchingUser, setIsFetchingUser] = useState(false);
  const { getConfig } = useMessageDB();
  const { apiClient } = useQuorumApiClient();

  // State machine - determine current step based on completion state
  const getCurrentStep = useCallback((): OnboardingStep => {
    if (isFetchingUser) return 'loading';
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
    updates: Partial<PasskeyInfo> = {}
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

  const fetchUser = useCallback(async (
    address: string,
    setUser?: (user: {
      displayName: string;
      state: string;
      status: string;
      userIcon: string;
      address: string;
    }) => void
  ) => {

    if (!address) return;

    setIsFetchingUser(true);
    try {

      await apiClient.getUser(address);
      // user is already registered
      const user_key = new Uint8Array(
        Buffer.from(
          await exportKey(address),
          'hex'
        )
      );

      const passkeyData = await passkey.loadKeyDecryptData(2);
      const envelope = JSON.parse(
        Buffer.from(passkeyData).toString('utf-8')
      );
      const key = await passkey.createKeyFromBuffer(
        user_key as unknown as ArrayBuffer
      );
      const inner = JSON.parse(
        Buffer.from(
          await passkey.decrypt(
            new Uint8Array(envelope.ciphertext),
            new Uint8Array(envelope.iv),
            key
          )
        ).toString('utf-8')
      );

      const config = await getConfig({
        address: address,
        userKey: inner.identity,
      });

      setIsFetchingUser(false);
      // If the remote config contains saved user info, update local
      const hasSavedProfile = Boolean(config && config.name && config.name.trim().length > 0);
      if (hasSavedProfile) {
        setDisplayName(config!.name!);
        updateUserProfile({
          displayName: config!.name!,
          pfpUrl: config!.profile_image ?? DefaultImages.UNKNOWN_USER,
        });
        if (setUser) {
          setUser({
            displayName: config!.name!,
            state: 'online',
            status: '',
            userIcon: config!.profile_image ?? DefaultImages.UNKNOWN_USER,
            address: address,
          });
        }
      } else {
        // Do not set user when config fetch fails or returns no profile
      }
      return config;
    } catch (error) {

    } finally {
      setIsFetchingUser(false);
    }
    return null;
  }, [currentPasskeyInfo?.address]);

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
    isFetchingUser,

    // Validation
    canProceedWithName,
    isOnboardingComplete,

    // Actions
    fetchUser,
    setDisplayName,
    markKeyAsExported,
    saveDisplayName,
    saveProfilePhoto,
    completeOnboarding,
    updateUserProfile,
  };
};