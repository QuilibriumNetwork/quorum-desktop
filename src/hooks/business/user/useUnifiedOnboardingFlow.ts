import { useState, useCallback, useEffect, useRef } from 'react';
import {
  usePasskeyFlow,
  passkey,
} from '@quilibrium/quilibrium-js-sdk-channels';
import type {
  PasskeyFlowStep,
  PasskeyFlowError,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { usePasskeyAdapter } from '../../platform/user/usePasskeyAdapter';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { useUploadRegistration } from '../../mutations/useUploadRegistration';
import { useKeyBackup } from '../../useKeyBackup';
import { validateDisplayName } from '../validation';
import { DefaultImages } from '../../../utils';
import { t } from '@lingui/core/macro';
import { showWarning } from '../../../utils/toast';

// --- Types ---

export type OnboardingStep =
  | 'loading'
  | 'welcome'
  | 'import-key'
  | 'create-passkey-1a'
  | 'save-key-to-passkey'
  | 'backup-key'
  | 'security-warning'
  | 'display-name'
  | 'profile-photo'
  | 'complete';

export interface OnboardingUser {
  displayName: string;
  state: string;
  status: string;
  userIcon: string;
  address: string;
}

export interface UseUnifiedOnboardingFlowOptions {
  setUser: (user: OnboardingUser) => void;
}

export interface UseUnifiedOnboardingFlowReturn {
  // Step state
  step: OnboardingStep;
  dotIndex: number | null;

  // Passkey state (proxied from usePasskeyFlow)
  passkeyStep: PasskeyFlowStep;
  passkeyError: PasskeyFlowError | null;
  isImportMode: boolean;
  isPasskeySupported: boolean;
  canRetry: boolean;

  // Import error
  importError: string | null;

  // Profile state
  address: string | null;
  displayName: string;
  profileImagePreview: string | null;

  // Actions — welcome
  startNewAccount: () => Promise<void>;
  startImportAccount: () => void;

  // Actions — passkey
  createPasskey: () => Promise<void>;
  saveToPasskey: () => Promise<void>;
  continueWithoutPasskey: () => Promise<void>;
  retryPasskey: () => void;
  importKeyFile: (file: File) => Promise<void>;

  // Actions — onboarding
  downloadKey: () => Promise<void>;
  skipKeyBackup: () => void;
  acknowledgeSecurityWarning: () => void;
  setDisplayName: (name: string) => void;
  saveDisplayName: () => void;
  saveProfilePhoto: (url?: string) => void;
  setProfileImagePreview: (url: string | null) => void;
  completeOnboarding: () => void;

  // Validation
  canProceedWithName: boolean;
}

// --- Dot index mapping ---

function getDotIndex(step: OnboardingStep): number | null {
  switch (step) {
    case 'loading':
    case 'welcome':
    case 'import-key':
      return null;
    case 'create-passkey-1a':
    case 'save-key-to-passkey':
      return 1;
    case 'backup-key':
    case 'security-warning':
      return 2;
    case 'display-name':
      return 3;
    case 'profile-photo':
      return 4;
    case 'complete':
      return null;
  }
}

export function useUnifiedOnboardingFlow(
  options: UseUnifiedOnboardingFlowOptions
): UseUnifiedOnboardingFlowReturn {
  const { setUser } = options;

  // --- Composed hooks ---
  const adapter = usePasskeyAdapter();
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();
  const keyBackup = useKeyBackup();

  // --- Internal state ---
  const [step, setStep] = useState<OnboardingStep>('loading');
  const [importMode, setImportMode] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState(false);

  // Ref to track current step inside callbacks (avoids stale closures)
  const stepRef = useRef<OnboardingStep>(step);
  stepRef.current = step;

  // --- API callbacks for usePasskeyFlow ---
  const getUserRegistration = useCallback(
    async (address: string) => {
      const response = await apiClient.getUser(address);
      return response.data;
    },
    [apiClient]
  );

  // --- usePasskeyFlow from SDK ---
  const passkeyFlow = usePasskeyFlow({
    fqAppPrefix: 'Quorum',
    getUserRegistration,
    uploadRegistration,
    onStepChange: (sdkStep: PasskeyFlowStep) => {
      if (sdkStep === 'awaiting_completion') {
        setStep('save-key-to-passkey');
      }
      if (sdkStep === 'success') {
        setStep('backup-key');
      }
      if (sdkStep === 'ready_with_keypair') {
        setStep('create-passkey-1a');
      }
    },
    onError: (_error: PasskeyFlowError) => {
      // If we were completing (step 1b), auto-fallback to backup
      if (stepRef.current === 'save-key-to-passkey') {
        setStep('backup-key');
      }
      // If registering (step 1a), stay on same step — inline error shows
    },
    onComplete: () => {
      // Handled by onStepChange 'success' → setStep('backup-key')
    },
  });

  // --- Returning user detection ---
  useEffect(() => {
    if (step !== 'loading') return;

    const checkReturningUser = async () => {
      const info = adapter.currentPasskeyInfo;

      // No stored credentials — new user
      if (!info || !info.address) {
        setStep('welcome');
        return;
      }

      // Has credentials with completedOnboarding — App.tsx useEffect handles this case
      // before the orchestrator mounts. But as a safety net:
      if (info.completedOnboarding) {
        setUser({
          displayName: info.displayName ?? info.address,
          state: 'online',
          status: '',
          userIcon: info.pfpUrl ?? DefaultImages.UNKNOWN_USER,
          address: info.address,
        });
        return;
      }

      // Has credentials but onboarding not complete — try to fetch remote profile
      if (!adapter.exportKey) {
        setStep('welcome');
        return;
      }

      setIsFetchingUser(true);
      try {
        const userKeyHex = await adapter.exportKey(info.address);
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

        // Fetch encrypted config
        let savedConfig;
        try {
          savedConfig = (await apiClient.getUserSettings(info.address)).data;
        } catch {
          setStep('welcome');
          return;
        }

        if (!savedConfig?.user_config) {
          setStep('welcome');
          return;
        }

        // Derive decryption key
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

        // Decrypt config
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

        // Validate remote profile
        const rawName = decryptedConfig?.name;
        const nameError = rawName ? validateDisplayName(rawName) : 'empty';
        const validatedName = nameError ? undefined : rawName;

        if (validatedName) {
          const finalProfileImage = decryptedConfig?.profile_image ?? DefaultImages.UNKNOWN_USER;

          adapter.updateStoredPasskey(info.credentialId, {
            credentialId: info.credentialId,
            address: info.address,
            publicKey: info.publicKey,
            displayName: validatedName,
            pfpUrl: finalProfileImage,
            completedOnboarding: true,
          });

          setUser({
            displayName: validatedName,
            state: 'online',
            status: '',
            userIcon: finalProfileImage,
            address: info.address,
          });
          return;
        }

        // Has credentials but no valid remote profile — continue onboarding
        setStep('welcome');
      } catch {
        showWarning(
          t`Couldn't load your saved profile. Please re-enter your name and profile image.`
        );
        setStep('welcome');
      } finally {
        setIsFetchingUser(false);
      }
    };

    checkReturningUser();
  }, [step, adapter.currentPasskeyInfo?.address]);

  // Computed values
  const dotIndex = getDotIndex(step);
  const canProceedWithName = !validateDisplayName(displayName);

  // --- Actions: Welcome ---

  const startNewAccount = useCallback(async () => {
    setImportMode(false);
    setImportError(null);

    if (!passkeyFlow.isPasskeySupported) {
      // Electron / unsupported browser: skip passkey steps entirely
      await passkeyFlow.proceedWithoutPasskey();
      setStep('backup-key');
    } else {
      setStep('create-passkey-1a');
    }
  }, [passkeyFlow.isPasskeySupported, passkeyFlow.proceedWithoutPasskey]);

  const startImportAccount = useCallback(() => {
    setImportMode(true);
    setImportError(null);
    setStep('import-key');
  }, []);

  // --- Actions: Passkey ---

  const createPasskey = useCallback(async () => {
    await passkeyFlow.startRegistration();
  }, [passkeyFlow.startRegistration]);

  const saveToPasskey = useCallback(async () => {
    await passkeyFlow.completeRegistration();
  }, [passkeyFlow.completeRegistration]);

  const continueWithoutPasskey = useCallback(async () => {
    await passkeyFlow.proceedWithoutPasskey();
    setStep('backup-key');
  }, [passkeyFlow.proceedWithoutPasskey]);

  const retryPasskey = useCallback(() => {
    passkeyFlow.retry();
  }, [passkeyFlow.retry]);

  const handleImportKeyFile = useCallback(async (file: File) => {
    setImportError(null);
    try {
      await passkeyFlow.importKeyFile(file);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }, [passkeyFlow.importKeyFile]);

  // --- Actions: Onboarding ---

  const handleDownloadKey = useCallback(async () => {
    try {
      await keyBackup.downloadKey();
      setStep('security-warning');
    } catch (error) {
      // downloadKey handles its own error display; stay on backup-key step
      console.error('Key download failed:', error);
    }
  }, [keyBackup.downloadKey]);

  const skipKeyBackup = useCallback(() => {
    setStep('display-name');
  }, []);

  const acknowledgeSecurityWarning = useCallback(() => {
    setStep('display-name');
  }, []);

  const saveDisplayNameAction = useCallback(() => {
    if (!adapter.currentPasskeyInfo || !canProceedWithName) return;

    adapter.updateStoredPasskey(adapter.currentPasskeyInfo.credentialId, {
      credentialId: adapter.currentPasskeyInfo.credentialId,
      address: adapter.currentPasskeyInfo.address,
      publicKey: adapter.currentPasskeyInfo.publicKey,
      displayName,
      completedOnboarding: false,
      pfpUrl: adapter.currentPasskeyInfo.pfpUrl,
    });
    setStep('profile-photo');
  }, [adapter, displayName, canProceedWithName]);

  const saveProfilePhoto = useCallback(
    (url?: string) => {
      if (!adapter.currentPasskeyInfo) return;

      const finalPfpUrl = url ?? DefaultImages.UNKNOWN_USER;
      adapter.updateStoredPasskey(adapter.currentPasskeyInfo.credentialId, {
        credentialId: adapter.currentPasskeyInfo.credentialId,
        address: adapter.currentPasskeyInfo.address,
        publicKey: adapter.currentPasskeyInfo.publicKey,
        displayName,
        pfpUrl: finalPfpUrl,
        completedOnboarding: false,
      });
      setStep('complete');
    },
    [adapter, displayName]
  );

  const handleCompleteOnboarding = useCallback(() => {
    if (!adapter.currentPasskeyInfo) return;

    const finalPfpUrl = profileImagePreview ?? adapter.currentPasskeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER;

    adapter.updateStoredPasskey(adapter.currentPasskeyInfo.credentialId, {
      credentialId: adapter.currentPasskeyInfo.credentialId,
      address: adapter.currentPasskeyInfo.address,
      publicKey: adapter.currentPasskeyInfo.publicKey,
      displayName,
      pfpUrl: finalPfpUrl,
      completedOnboarding: true,
    });

    setUser({
      displayName,
      state: 'online',
      status: '',
      userIcon: finalPfpUrl,
      address: adapter.currentPasskeyInfo.address,
    });
  }, [adapter, displayName, profileImagePreview, setUser]);

  // --- Return ---

  return {
    step,
    dotIndex,

    passkeyStep: passkeyFlow.step,
    passkeyError: passkeyFlow.error,
    isImportMode: importMode,
    isPasskeySupported: passkeyFlow.isPasskeySupported,
    canRetry: passkeyFlow.canRetry,

    importError,

    address: passkeyFlow.address,
    displayName,
    profileImagePreview,

    startNewAccount,
    startImportAccount,

    createPasskey,
    saveToPasskey,
    continueWithoutPasskey,
    retryPasskey,
    importKeyFile: handleImportKeyFile,

    downloadKey: handleDownloadKey,
    skipKeyBackup,
    acknowledgeSecurityWarning,
    setDisplayName,
    saveDisplayName: saveDisplayNameAction,
    saveProfilePhoto,
    setProfileImagePreview,
    completeOnboarding: handleCompleteOnboarding,

    canProceedWithName,
  };
}
