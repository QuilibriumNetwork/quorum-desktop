import { useState, useCallback, useEffect, useRef } from 'react';
import {
  usePasskeyFlow,
  usePasskeysContext,
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
      return 5;
  }
}
