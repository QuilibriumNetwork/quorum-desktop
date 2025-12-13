import { useState, useCallback } from 'react';
import { passkey } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import { showWarning } from '../../../utils/toast';
import { validateDisplayName, validateProfileImage } from '../validation';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';

export type OnboardingStep =
  | 'loading'        // Fetching user config (transitional state)
  | 'key-backup'
  | 'display-name'
  | 'profile-photo'
  | 'complete';

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
  updateStoredPasskey: (
    credentialId: string,
    updates: Partial<PasskeyInfo>
  ) => void;
  // Export the user's private key (hex string) - required for config decryption
  exportKey?: (address: string) => Promise<string>;
}

/**
 * Business logic for managing the onboarding flow state machine and user profile data
 * Platform-agnostic implementation that works with adapters
 */
export const useOnboardingFlowLogic = (adapter: OnboardingAdapter) => {
  const { currentPasskeyInfo, updateStoredPasskey } = adapter;
  const [exported, setExported] = useState(false);
  const [displayName, setDisplayName] = useState(
    currentPasskeyInfo?.displayName ?? ''
  );
  const [isFetchingUser, setIsFetchingUser] = useState(false);

  // Direct context access for API calls
  const { apiClient } = useQuorumApiClient();

  // State machine - determine current step based on completion state
  const getCurrentStep = useCallback((): OnboardingStep => {
    // Show loading state while fetching user
    if (isFetchingUser) return 'loading';

    if (!exported) return 'key-backup';
    if (exported && !currentPasskeyInfo?.displayName) return 'display-name';
    if (
      exported &&
      currentPasskeyInfo?.displayName &&
      !currentPasskeyInfo?.pfpUrl
    ) {
      return 'profile-photo';
    }
    if (
      exported &&
      currentPasskeyInfo?.pfpUrl &&
      currentPasskeyInfo.displayName
    ) {
      return 'complete';
    }
    return 'key-backup';
  }, [isFetchingUser, exported, currentPasskeyInfo?.displayName, currentPasskeyInfo?.pfpUrl]);

  // Update user stored information in passkey context
  const updateUserProfile = useCallback(
    (updates: Partial<PasskeyInfo> = {}) => {
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
    },
    [currentPasskeyInfo, displayName, updateStoredPasskey]
  );

  // Complete the onboarding process and set user as active
  const completeOnboarding = useCallback(
    (setUser: (user: any) => void) => {
      if (!currentPasskeyInfo) return;

      updateUserProfile({ completedOnboarding: true });
      setUser({
        displayName: displayName,
        state: 'online',
        status: '',
        userIcon: currentPasskeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER,
        address: currentPasskeyInfo.address,
      });
    },
    [currentPasskeyInfo, displayName, updateUserProfile]
  );

  // Mark key as exported (called by platform-specific backup implementations)
  const markKeyAsExported = useCallback(() => {
    setExported(true);
  }, []);

  // Save display name
  const saveDisplayName = useCallback(() => {
    updateUserProfile({ displayName, pfpUrl: undefined });
  }, [displayName, updateUserProfile]);

  // Save profile photo with provided URL
  const saveProfilePhoto = useCallback(
    (pfpUrl?: string) => {
      const finalPfpUrl = pfpUrl ?? DefaultImages.UNKNOWN_USER;
      updateUserProfile({ pfpUrl: finalPfpUrl });
    },
    [updateUserProfile]
  );

  /**
   * Fetch user profile from remote storage for returning users.
   * This is a LIGHTWEIGHT fetch that only decrypts profile data (name, profile_image)
   * WITHOUT triggering space/bookmark sync operations.
   *
   * Uses exportKey from adapter + passkey SDK to decrypt keyset,
   * then directly decrypts the user config from API.
   *
   * @param address - User's address
   * @param setUser - Optional callback to set user directly and skip onboarding
   */
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
    // Guard: only fetch if adapter supports exportKey (native doesn't)
    if (!address || !adapter.exportKey) return;

    setIsFetchingUser(true);
    let isRegisteredUser = false;
    let hasRemoteConfig = false;
    try {
      // Check if user is already registered
      try {
        await apiClient.getUser(address);
        isRegisteredUser = true;
      } catch {
        // User not registered - new user, proceed with onboarding silently
        return null;
      }

      // User is registered - decrypt keyset to get the identity key
      const userKeyHex = await adapter.exportKey(address);
      const userKey = new Uint8Array(Buffer.from(userKeyHex, 'hex'));

      const passkeyData = await passkey.loadKeyDecryptData(2);
      const envelope = JSON.parse(Buffer.from(passkeyData).toString('utf-8'));
      const key = await passkey.createKeyFromBuffer(userKey as unknown as ArrayBuffer);
      const decryptedKeyset = await passkey.decrypt(
        new Uint8Array(envelope.ciphertext),
        new Uint8Array(envelope.iv),
        key
      );
      const inner = JSON.parse(Buffer.from(decryptedKeyset).toString('utf-8'));

      // Fetch encrypted config directly from API (bypasses ConfigService sync)
      let savedConfig;
      try {
        savedConfig = (await apiClient.getUserSettings(address)).data;
      } catch {
        // No remote config available - proceed with onboarding
        return null;
      }

      if (!savedConfig?.user_config) {
        return null;
      }
      hasRemoteConfig = true;

      // Derive decryption key from user's private key (same as ConfigService)
      const derived = await crypto.subtle.digest(
        'SHA-512',
        Buffer.from(new Uint8Array(inner.identity.user_key.private_key))
      );

      const subtleKey = await window.crypto.subtle.importKey(
        'raw',
        derived.slice(0, 32),
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decrypt the config (same format as ConfigService)
      const iv = savedConfig.user_config.substring(
        savedConfig.user_config.length - 24
      );
      const ciphertext = savedConfig.user_config.substring(
        0,
        savedConfig.user_config.length - 24
      );

      const decryptedConfig = JSON.parse(
        Buffer.from(
          await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: Buffer.from(iv, 'hex') },
            subtleKey,
            Buffer.from(ciphertext, 'hex')
          )
        ).toString('utf-8')
      );

      // SECURITY: Zero-trust validation of remote config data
      // Re-validate all fields after decryption to prevent XSS/injection attacks
      const rawName = decryptedConfig?.name;
      const rawProfileImage = decryptedConfig?.profile_image;

      // Validate display name - reject if it fails validation rules
      const nameError = rawName ? validateDisplayName(rawName) : 'empty';
      const validatedName = nameError ? undefined : rawName;

      // Validate profile image - reject oversized or invalid MIME types
      const validatedProfileImage = validateProfileImage(rawProfileImage)
        ? rawProfileImage
        : undefined;

      // Check if user has a valid saved profile (validated name required)
      const hasSavedProfile = Boolean(validatedName);

      if (hasSavedProfile) {
        const finalProfileImage = validatedProfileImage ?? DefaultImages.UNKNOWN_USER;

        setDisplayName(validatedName);
        updateStoredPasskey(currentPasskeyInfo!.credentialId, {
          credentialId: currentPasskeyInfo!.credentialId,
          address: currentPasskeyInfo!.address,
          publicKey: currentPasskeyInfo!.publicKey,
          displayName: validatedName,
          pfpUrl: finalProfileImage,
          completedOnboarding: true,
        });

        // Call setUser directly to skip onboarding entirely
        if (setUser) {
          setUser({
            displayName: validatedName,
            state: 'online',
            status: '',
            userIcon: finalProfileImage,
            address: address,
          });
        }
      }
      return decryptedConfig;
    } catch {
      // Show appropriate warning based on where the failure occurred
      if (isRegisteredUser && hasRemoteConfig) {
        // User has saved config but decryption failed
        showWarning(
          t`Couldn't decrypt your saved profile. Please re-enter your name and profile image.`
        );
      } else if (isRegisteredUser) {
        // User is registered but we couldn't load their keyset/config
        showWarning(
          t`Couldn't load your saved profile. Please re-enter your name and profile image.`
        );
      }
      // New users (not registered) proceed silently
    } finally {
      setIsFetchingUser(false);
    }
    return null;
  }, [adapter, apiClient, currentPasskeyInfo, updateStoredPasskey]);

  // Validation helpers
  const canProceedWithName = !validateDisplayName(displayName);
  const isOnboardingComplete =
    exported && currentPasskeyInfo?.displayName && currentPasskeyInfo?.pfpUrl;

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
