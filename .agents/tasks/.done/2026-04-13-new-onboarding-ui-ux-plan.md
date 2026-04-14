# New Onboarding UI/UX - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SDK-driven `<PasskeyModal>` + split Login/Onboarding components with a unified, step-by-step onboarding flow using the SDK's headless `usePasskeyFlow` hook.

**Architecture:** Orchestrator + individual step components + unified state machine hook. `OnboardingFlow.tsx` renders the current step from a map driven by `useUnifiedOnboardingFlow`, which composes `usePasskeyFlow` (SDK), passkey adapter, key backup, and profile persistence.

**Tech Stack:** React 18, TypeScript, SCSS, Tailwind, Lingui i18n, `@quilibrium/quilibrium-js-sdk-channels` (usePasskeyFlow hook), Tabler Icons

**Design spec:** `.agents/tasks/2026-04-13-new-onboarding-ui-ux-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/onboarding/OnboardingFlow.tsx` | Create | Thin orchestrator: mounts ProgressBar + step component based on hook state |
| `src/components/onboarding/ProgressBar.tsx` | Create | 5-segment pill progress indicator |
| `src/components/onboarding/steps/LoadingStep.tsx` | Create | Spinner while checking returning user |
| `src/components/onboarding/steps/WelcomeStep.tsx` | Create | Step 0: logo, tagline, Create/Import buttons |
| `src/components/onboarding/steps/ImportKeyStep.tsx` | Create | File dropzone for key import |
| `src/components/onboarding/steps/CreatePasskeyStep.tsx` | Create | Step 1a: create passkey, inline error states |
| `src/components/onboarding/steps/SaveKeyToPasskeyStep.tsx` | Create | Step 1b: save key to passkey |
| `src/components/onboarding/steps/BackupKeyStep.tsx` | Create | Step 2a: download key backup |
| `src/components/onboarding/steps/SecurityWarningStep.tsx` | Create | Step 2b: keep your key safe |
| `src/components/onboarding/steps/DisplayNameStep.tsx` | Create | Step 3: name input + account address |
| `src/components/onboarding/steps/ProfilePhotoStep.tsx` | Create | Step 4: photo upload/skip |
| `src/components/onboarding/steps/CompleteStep.tsx` | Create | Step 5: welcome, enter app |
| `src/components/onboarding/steps/index.ts` | Create | Barrel export for all step components |
| `src/hooks/business/user/useUnifiedOnboardingFlow.ts` | Create | Unified state machine hook |
| `src/styles/_onboarding.scss` | Create | Onboarding-specific styles (bg, transitions, progress bar) |
| `src/styles/main.scss` | Modify | Import `_onboarding.scss` |
| `src/App.tsx` | Modify | Replace Login/Onboarding branches with single OnboardingFlow |

---

### Task 1: Create onboarding styles

**Files:**
- Create: `src/styles/_onboarding.scss`
- Modify: `src/styles/main.scss`

- [ ] **Step 1: Create the onboarding stylesheet**

Create `src/styles/_onboarding.scss`:

```scss
// Onboarding flow styles

.bg-onboarding {
  background-color: var(--surface-2);
}

// Step transition animation
@keyframes onboarding-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.onboarding-step {
  animation: onboarding-fade-in 200ms ease-in;
}

// Progress bar
.onboarding-progress-bar {
  display: flex;
  gap: 8px;
  justify-content: center;

  &__segment {
    width: 32px;
    height: 6px;
    border-radius: 3px;
    background-color: var(--surface-5);
    transition: background-color 200ms ease;

    &--filled {
      background-color: var(--accent);
    }
  }
}

// File dropzone for import step
.onboarding-dropzone {
  border: 2px dashed var(--surface-6);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 200ms ease, background-color 200ms ease;

  &:hover,
  &--active {
    border-color: var(--accent);
    background-color: rgba(var(--accent-rgb), 0.05);
  }
}
```

- [ ] **Step 2: Import the stylesheet in main.scss**

Find the imports section in `src/styles/main.scss` and add:

```scss
@import 'onboarding';
```

Add it after the other partial imports (after `@import 'passkey-modal';` or similar).

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles/_onboarding.scss src/styles/main.scss
git commit -m "feat(onboarding): add onboarding-specific styles

Add bg-onboarding background, step fade transition,
progress bar segments, and import dropzone styles."
```

---

### Task 2: Create ProgressBar component

**Files:**
- Create: `src/components/onboarding/ProgressBar.tsx`

- [ ] **Step 1: Create the ProgressBar component**

Create `src/components/onboarding/ProgressBar.tsx`:

```tsx
import React from 'react';

interface ProgressBarProps {
  /** Total number of segments */
  total: number;
  /** 1-based index of the current active segment (all segments up to this index are filled) */
  active: number;
}

/**
 * 5-segment pill progress indicator for onboarding flow.
 * Segments 1..active are filled (accent color), rest are empty (surface-5).
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ total, active }) => {
  return (
    <div className="onboarding-progress-bar" role="progressbar" aria-valuenow={active} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`onboarding-progress-bar__segment${i < active ? ' onboarding-progress-bar__segment--filled' : ''}`}
        />
      ))}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/ProgressBar.tsx
git commit -m "feat(onboarding): add ProgressBar component

5-segment pill progress indicator with filled/empty states,
themed via CSS variables."
```

---

### Task 3: Create the unified onboarding flow hook (types and skeleton)

**Files:**
- Create: `src/hooks/business/user/useUnifiedOnboardingFlow.ts`

This is the largest and most critical piece. We'll build it incrementally across Tasks 3-5.

- [ ] **Step 1: Create the hook file with types and skeleton**

Create `src/hooks/business/user/useUnifiedOnboardingFlow.ts`:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors (types only so far, no runtime usage).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/user/useUnifiedOnboardingFlow.ts
git commit -m "feat(onboarding): add unified flow hook types and skeleton

OnboardingStep type, return interface, dot index mapping.
Hook implementation follows in next commits."
```

---

### Task 4: Implement the unified hook — state machine and passkey integration

**Files:**
- Modify: `src/hooks/business/user/useUnifiedOnboardingFlow.ts`

- [ ] **Step 1: Add the hook function with state management and passkey integration**

Append to `src/hooks/business/user/useUnifiedOnboardingFlow.ts`, after the `getDotIndex` function:

```typescript
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
    onError: (error: PasskeyFlowError) => {
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

  // (Actions are defined in next task)
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: Errors about missing return statement and actions — expected, we'll add those next.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/user/useUnifiedOnboardingFlow.ts
git commit -m "feat(onboarding): add unified hook state machine and passkey integration

Returning user detection, usePasskeyFlow composition with
onStepChange/onError callbacks, dot index computation."
```

---

### Task 5: Implement the unified hook — actions and return

**Files:**
- Modify: `src/hooks/business/user/useUnifiedOnboardingFlow.ts`

- [ ] **Step 1: Add all action functions and the return statement**

Replace the `// (Actions are defined in next task)` comment at the end of the hook function with:

```typescript
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
      // onStepChange will fire with 'ready_with_keypair' → setStep('create-passkey-1a')
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
      pfpUrl: undefined,
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

    adapter.updateStoredPasskey(adapter.currentPasskeyInfo.credentialId, {
      credentialId: adapter.currentPasskeyInfo.credentialId,
      address: adapter.currentPasskeyInfo.address,
      publicKey: adapter.currentPasskeyInfo.publicKey,
      displayName,
      pfpUrl: adapter.currentPasskeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER,
      completedOnboarding: true,
    });

    setUser({
      displayName,
      state: 'online',
      status: '',
      userIcon: adapter.currentPasskeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER,
      address: adapter.currentPasskeyInfo.address,
    });
  }, [adapter, displayName, setUser]);

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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors (the hook is now complete but not yet consumed).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/user/useUnifiedOnboardingFlow.ts
git commit -m "feat(onboarding): add unified hook actions and return

Welcome actions (startNewAccount, startImportAccount), passkey
wrappers, profile persistence, and onboarding completion."
```

---

### Task 6: Create step components — LoadingStep and WelcomeStep

**Files:**
- Create: `src/components/onboarding/steps/LoadingStep.tsx`
- Create: `src/components/onboarding/steps/WelcomeStep.tsx`

- [ ] **Step 1: Create LoadingStep**

Create `src/components/onboarding/steps/LoadingStep.tsx`:

```tsx
import React from 'react';
import { Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const LoadingStep: React.FC<StepProps> = () => {
  return (
    <div className="flex flex-col items-center text-center">
      <Icon name="spinner" size="2xl" className="icon-spin mb-4" />
      <p className="text-lg">{t`Loading your profile...`}</p>
    </div>
  );
};
```

- [ ] **Step 2: Create WelcomeStep**

Create `src/components/onboarding/steps/WelcomeStep.tsx`:

```tsx
import React from 'react';
import { Button, Tooltip, Icon } from '../../primitives';
import Logo from '../../Logo';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const WelcomeStep: React.FC<StepProps> = ({ flow }) => {
  return (
    <div className="flex flex-col items-center text-center">
      <Logo className="h-10 mb-8 opacity-60" />
      <h1 className="text-2xl font-bold mb-2">{t`Sign in into Quorum`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Your communities, your rules - no platform can ban you.`}
      </p>
      <Button
        type="primary"
        className="w-full max-w-xs mb-3"
        onClick={flow.startNewAccount}
      >
        {t`Create New Account`}
      </Button>
      <Button
        type="secondary"
        className="w-full max-w-xs mb-6"
        onClick={flow.startImportAccount}
      >
        {t`I already have an account`}
      </Button>
      <Tooltip
        id="read-more-quorum"
        content={t`Quorum is a decentralized messaging platform where you own your identity. No email, no phone number - just a secure key that only you control.`}
        place="bottom"
        maxWidth={300}
      >
        <span className="text-sm opacity-50 underline cursor-pointer">
          {t`Read more about Quorum`}
        </span>
      </Tooltip>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/steps/LoadingStep.tsx src/components/onboarding/steps/WelcomeStep.tsx
git commit -m "feat(onboarding): add LoadingStep and WelcomeStep components

LoadingStep shows spinner during returning user check.
WelcomeStep shows logo, tagline, Create/Import buttons, and tooltip."
```

---

### Task 7: Create step components — CreatePasskeyStep and SaveKeyToPasskeyStep

**Files:**
- Create: `src/components/onboarding/steps/CreatePasskeyStep.tsx`
- Create: `src/components/onboarding/steps/SaveKeyToPasskeyStep.tsx`

- [ ] **Step 1: Create CreatePasskeyStep**

Create `src/components/onboarding/steps/CreatePasskeyStep.tsx`:

```tsx
import React from 'react';
import { Button, Tooltip, Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'user_cancelled':
      return t`You cancelled the passkey setup. You can try again, or continue without Passkey (still secure, just without device hardware protection).`;
    case 'not_supported':
      return t`Passkeys aren't supported on this browser. You'll need to continue without Passkey (still secure, just without device hardware protection).`;
    case 'timeout':
      return t`The passkey setup timed out. You can try again, or continue without Passkey (still secure, just without device hardware protection).`;
    default:
      return t`Passkey setup failed. You can try again, or continue without Passkey (still secure, just without device hardware protection).`;
  }
}

export const CreatePasskeyStep: React.FC<StepProps> = ({ flow }) => {
  const isRegistering = flow.passkeyStep === 'registering';
  const hasError = flow.passkeyError !== null;

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Create Passkey`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Passkeys use your device's built-in security to protect your account. This requires two quick confirmations via your device.`}
      </p>

      {hasError && (
        <div className="mb-6 max-w-xs">
          <div className="flex items-start gap-2 mb-4">
            <Icon name="alert-circle" className="text-danger mt-0.5 shrink-0" />
            <p className="text-sm text-left">
              {getErrorMessage(flow.passkeyError!.code)}
            </p>
          </div>
          {flow.passkeyError!.rawMessage && (
            <Tooltip
              id="passkey-raw-error"
              content={flow.passkeyError!.rawMessage}
              place="bottom"
              maxWidth={300}
            >
              <span className="text-xs opacity-40 underline cursor-pointer">
                {t`View technical details`}
              </span>
            </Tooltip>
          )}
        </div>
      )}

      {!hasError && (
        <Button
          type="primary"
          className="w-full max-w-xs mb-3"
          onClick={flow.createPasskey}
          disabled={isRegistering}
          iconName={isRegistering ? 'spinner' : undefined}
        >
          {t`Create Passkey`}
        </Button>
      )}

      {hasError && flow.canRetry && (
        <Button
          type="primary"
          className="w-full max-w-xs mb-3"
          onClick={flow.retryPasskey}
        >
          {t`Try Again`}
        </Button>
      )}

      {hasError && (
        <Button
          type="secondary"
          className="w-full max-w-xs mb-6"
          onClick={flow.continueWithoutPasskey}
        >
          {t`Continue without passkey`}
        </Button>
      )}

      <Tooltip
        id="what-is-passkey"
        content={t`A passkey uses your device's security features (Face ID, fingerprint, or PIN) to protect your account. It's more secure than a password and you don't have to remember anything.`}
        place="bottom"
        maxWidth={300}
      >
        <span className="text-sm opacity-50 underline cursor-pointer">
          {t`What is a Passkey?`}
        </span>
      </Tooltip>
    </div>
  );
};
```

- [ ] **Step 2: Create SaveKeyToPasskeyStep**

Create `src/components/onboarding/steps/SaveKeyToPasskeyStep.tsx`:

```tsx
import React from 'react';
import { Button, Tooltip } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const SaveKeyToPasskeyStep: React.FC<StepProps> = ({ flow }) => {
  const isCompleting = flow.passkeyStep === 'completing';

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Save Your Account Key`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Now let's store your account key inside your passkey. One more confirmation needed.`}
      </p>

      <Button
        type="primary"
        className="w-full max-w-xs mb-6"
        onClick={flow.saveToPasskey}
        disabled={isCompleting}
        iconName={isCompleting ? 'spinner' : undefined}
      >
        {t`Save to Passkey`}
      </Button>

      <Tooltip
        id="what-is-account-key"
        content={t`Your account key is your unique identity in Quorum. It's like a master password that proves you are you - but it's generated automatically and stored securely in your passkey.`}
        place="bottom"
        maxWidth={300}
      >
        <span className="text-sm opacity-50 underline cursor-pointer">
          {t`What is the Account Key?`}
        </span>
      </Tooltip>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/steps/CreatePasskeyStep.tsx src/components/onboarding/steps/SaveKeyToPasskeyStep.tsx
git commit -m "feat(onboarding): add CreatePasskeyStep and SaveKeyToPasskeyStep

CreatePasskeyStep handles inline error states with contextual
messages per error code, retry, and fallback options.
SaveKeyToPasskeyStep handles the second WebAuthn prompt."
```

---

### Task 8: Create step components — ImportKeyStep

**Files:**
- Create: `src/components/onboarding/steps/ImportKeyStep.tsx`

- [ ] **Step 1: Create ImportKeyStep**

Create `src/components/onboarding/steps/ImportKeyStep.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { Button, Icon, FileUpload } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const ImportKeyStep: React.FC<StepProps> = ({ flow }) => {
  const [fileSelected, setFileSelected] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFilesSelected = useCallback(
    async (files: any[]) => {
      if (files.length > 0 && files[0].file) {
        setFileSelected(true);
        await flow.importKeyFile(files[0].file);
      }
    },
    [flow.importKeyFile]
  );

  const handleFileError = useCallback(() => {
    setFileSelected(false);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Import your account key`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Select or drag your account key file to restore your account.`}
      </p>

      <div className="w-full max-w-xs mb-6">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          onError={handleFileError}
          accept={{ 'application/octet-stream': ['.key'] }}
          multiple={false}
          {...({ onDragActiveChange: setIsDragActive } as any)}
        >
          <div
            className={`onboarding-dropzone${isDragActive ? ' onboarding-dropzone--active' : ''}`}
          >
            <Icon name="upload" size="xl" className="mb-2 opacity-40" />
            <p className="text-sm">
              {t`Drag and drop or`}{' '}
              <span className="text-accent underline cursor-pointer">
                {t`choose file`}
              </span>
            </p>
          </div>
        </FileUpload>
      </div>

      {flow.importError && (
        <div className="mb-4 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="alert-circle" className="text-danger shrink-0" />
            <p className="text-sm text-danger">{t`Invalid Key File`}</p>
          </div>
          <p className="text-xs opacity-50">{flow.importError}</p>
        </div>
      )}

      <span
        className="text-sm opacity-50 underline cursor-pointer"
        onClick={flow.startNewAccount}
      >
        {t`Create new account instead`}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/steps/ImportKeyStep.tsx
git commit -m "feat(onboarding): add ImportKeyStep component

File dropzone for .key file import with drag-and-drop,
error handling for invalid files, and link back to create flow."
```

---

### Task 9: Create step components — BackupKeyStep and SecurityWarningStep

**Files:**
- Create: `src/components/onboarding/steps/BackupKeyStep.tsx`
- Create: `src/components/onboarding/steps/SecurityWarningStep.tsx`

- [ ] **Step 1: Create BackupKeyStep**

Create `src/components/onboarding/steps/BackupKeyStep.tsx`:

```tsx
import React from 'react';
import { Button, Tooltip } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const BackupKeyStep: React.FC<StepProps> = ({ flow }) => {
  // @ts-ignore — window.electron exists in Electron builds
  const isElectron = !!window.electron;

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Back Up Your Account Key`}</h1>
      <p className="text-sm opacity-60 mb-4 max-w-xs">
        {t`You'll need this file to recover your account if you lose access to your device.`}
      </p>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {isElectron
          ? t`If you uninstall the app from your device, you will lose your old messages and keys.`
          : t`If you clear your browser storage or switch browsers, your old messages and keys may disappear.`}
      </p>

      <Button
        type="primary"
        className="w-full max-w-xs mb-3"
        onClick={flow.downloadKey}
      >
        {t`Download Key Backup`}
      </Button>

      <span
        className="text-sm opacity-50 underline cursor-pointer mb-6"
        onClick={flow.skipKeyBackup}
      >
        {t`I've already saved my key`}
      </span>

      <Tooltip
        id="why-backup"
        content={t`Without this backup, losing your device means losing your account - there's no 'forgot password' option. This is the price you pay for privacy :-)`}
        place="bottom"
        maxWidth={300}
      >
        <span className="text-sm opacity-50 underline cursor-pointer">
          {t`Why do I need to do this?`}
        </span>
      </Tooltip>
    </div>
  );
};
```

- [ ] **Step 2: Create SecurityWarningStep**

Create `src/components/onboarding/steps/SecurityWarningStep.tsx`:

```tsx
import React from 'react';
import { Button, Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const SecurityWarningStep: React.FC<StepProps> = ({ flow }) => {
  return (
    <div className="flex flex-col items-center text-center">
      <Icon name="lock" size="3xl" className="mb-4 opacity-60" />
      <h1 className="text-2xl font-bold mb-2">{t`Keep your Key Safe!`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Keep the file you downloaded safe and private! Anyone with this file can access your account.`}
      </p>

      <Button
        type="primary"
        className="w-full max-w-xs"
        onClick={flow.acknowledgeSecurityWarning}
      >
        {t`I understand`}
      </Button>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/steps/BackupKeyStep.tsx src/components/onboarding/steps/SecurityWarningStep.tsx
git commit -m "feat(onboarding): add BackupKeyStep and SecurityWarningStep

BackupKeyStep with platform-specific copy (web vs Electron),
download button, skip option, and tooltip.
SecurityWarningStep with lock icon and acknowledge button."
```

---

### Task 10: Create step components — DisplayNameStep, ProfilePhotoStep, CompleteStep

**Files:**
- Create: `src/components/onboarding/steps/DisplayNameStep.tsx`
- Create: `src/components/onboarding/steps/ProfilePhotoStep.tsx`
- Create: `src/components/onboarding/steps/CompleteStep.tsx`

- [ ] **Step 1: Create DisplayNameStep**

Create `src/components/onboarding/steps/DisplayNameStep.tsx`:

```tsx
import React from 'react';
import { Button, Input, Tooltip, Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import { validateDisplayName } from '../../../hooks/business/validation';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const DisplayNameStep: React.FC<StepProps> = ({ flow }) => {
  const nameError = flow.displayName.trim()
    ? validateDisplayName(flow.displayName)
    : undefined;

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`What should we call you?`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`This is how others will see you in Quorum. You can change this anytime in Settings.`}
      </p>

      <div className="w-full max-w-xs mb-4">
        <Input
          variant="filled"
          label={t`User Name`}
          labelType="static"
          className="w-full"
          value={flow.displayName}
          onChange={flow.setDisplayName}
          placeholder={t`Enter your name`}
          error={!!nameError}
          errorMessage={nameError ?? undefined}
        />
      </div>

      {flow.address && (
        <div className="w-full max-w-xs mb-6">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs opacity-50">{t`Account Address`}</span>
            <Tooltip
              id="account-address-info"
              content={t`Your account address is a unique public identifier derived from your account key. Others can use it to find and message you. Think of it like a username that can never change.`}
              place="bottom"
              maxWidth={300}
            >
              <Icon
                name="help-circle"
                size="xs"
                className="opacity-40 cursor-pointer"
              />
            </Tooltip>
          </div>
          <Input
            variant="filled"
            className="w-full"
            value={flow.address.length > 20
              ? `${flow.address.slice(0, 10)}...${flow.address.slice(-8)}`
              : flow.address}
            disabled
          />
        </div>
      )}

      <Button
        type="primary"
        className="w-full max-w-xs"
        disabled={!flow.canProceedWithName}
        onClick={flow.saveDisplayName}
      >
        {t`Continue`}
      </Button>
    </div>
  );
};
```

- [ ] **Step 2: Create ProfilePhotoStep**

Create `src/components/onboarding/steps/ProfilePhotoStep.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { Button, Icon, FileUpload } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const ProfilePhotoStep: React.FC<StepProps> = ({ flow }) => {
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const maxImageSize = 25 * 1024 * 1024; // 25MB

  const handleFilesSelected = useCallback(
    (files: any[]) => {
      if (files.length > 0) {
        flow.setProfileImagePreview(files[0].uri);
        setFileError(null);
      }
    },
    [flow.setProfileImagePreview]
  );

  const handleFileError = useCallback((error: Error) => {
    setFileError(error.message);
    flow.setProfileImagePreview(null);
  }, [flow.setProfileImagePreview]);

  const handleContinue = useCallback(() => {
    flow.saveProfilePhoto(flow.profileImagePreview ?? undefined);
  }, [flow.saveProfilePhoto, flow.profileImagePreview]);

  const handleSkip = useCallback(() => {
    flow.saveProfilePhoto(undefined);
  }, [flow.saveProfilePhoto]);

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Add a profile photo`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Help others recognize you with a profile picture.`}
      </p>

      <div className="mb-6">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          onError={handleFileError}
          accept={{
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
          }}
          maxSize={maxImageSize}
          multiple={false}
          {...({ onDragActiveChange: setIsDragActive } as any)}
        >
          <div
            className={`onboarding-dropzone w-32 h-32 rounded-full flex items-center justify-center overflow-hidden${isDragActive ? ' onboarding-dropzone--active' : ''}`}
            style={
              flow.profileImagePreview
                ? {
                    backgroundImage: `url(${flow.profileImagePreview})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {}
            }
          >
            {!flow.profileImagePreview && (
              <Icon name="camera" size="2xl" className="opacity-40" />
            )}
          </div>
        </FileUpload>
      </div>

      {fileError && (
        <p className="text-sm text-danger mb-4">{fileError}</p>
      )}

      <Button
        type="primary"
        className="w-full max-w-xs mb-3"
        onClick={handleContinue}
      >
        {t`Continue`}
      </Button>

      <span
        className="text-sm opacity-50 underline cursor-pointer"
        onClick={handleSkip}
      >
        {t`Skip for now`}
      </span>
    </div>
  );
};
```

- [ ] **Step 3: Create CompleteStep**

Create `src/components/onboarding/steps/CompleteStep.tsx`:

```tsx
import React from 'react';
import { Button } from '../../primitives';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const CompleteStep: React.FC<StepProps> = ({ flow }) => {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`You're all set!`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {i18n._(
          `Welcome to Quorum, {name}! Your account is secured and ready to go.`,
          { name: flow.displayName }
        )}
      </p>

      <Button
        type="primary"
        className="w-full max-w-xs"
        onClick={flow.completeOnboarding}
      >
        {t`Enter Quorum`}
      </Button>
    </div>
  );
};
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/steps/DisplayNameStep.tsx src/components/onboarding/steps/ProfilePhotoStep.tsx src/components/onboarding/steps/CompleteStep.tsx
git commit -m "feat(onboarding): add DisplayNameStep, ProfilePhotoStep, CompleteStep

DisplayNameStep with name input, account address display, and validation.
ProfilePhotoStep with avatar upload, preview, and skip option.
CompleteStep with personalized welcome message."
```

---

### Task 11: Create step barrel export and OnboardingFlow orchestrator

**Files:**
- Create: `src/components/onboarding/steps/index.ts`
- Create: `src/components/onboarding/OnboardingFlow.tsx`

- [ ] **Step 1: Create barrel export**

Create `src/components/onboarding/steps/index.ts`:

```typescript
export { LoadingStep } from './LoadingStep';
export { WelcomeStep } from './WelcomeStep';
export { ImportKeyStep } from './ImportKeyStep';
export { CreatePasskeyStep } from './CreatePasskeyStep';
export { SaveKeyToPasskeyStep } from './SaveKeyToPasskeyStep';
export { BackupKeyStep } from './BackupKeyStep';
export { SecurityWarningStep } from './SecurityWarningStep';
export { DisplayNameStep } from './DisplayNameStep';
export { ProfilePhotoStep } from './ProfilePhotoStep';
export { CompleteStep } from './CompleteStep';
```

- [ ] **Step 2: Create OnboardingFlow orchestrator**

Create `src/components/onboarding/OnboardingFlow.tsx`:

```tsx
import React from 'react';
import { ProgressBar } from './ProgressBar';
import Logo from '../Logo';
import {
  useUnifiedOnboardingFlow,
  type OnboardingStep,
  type UseUnifiedOnboardingFlowReturn,
} from '../../hooks/business/user/useUnifiedOnboardingFlow';
import {
  LoadingStep,
  WelcomeStep,
  ImportKeyStep,
  CreatePasskeyStep,
  SaveKeyToPasskeyStep,
  BackupKeyStep,
  SecurityWarningStep,
  DisplayNameStep,
  ProfilePhotoStep,
  CompleteStep,
} from './steps';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

const STEP_MAP: Record<OnboardingStep, React.ComponentType<StepProps>> = {
  'loading': LoadingStep,
  'welcome': WelcomeStep,
  'import-key': ImportKeyStep,
  'create-passkey-1a': CreatePasskeyStep,
  'save-key-to-passkey': SaveKeyToPasskeyStep,
  'backup-key': BackupKeyStep,
  'security-warning': SecurityWarningStep,
  'display-name': DisplayNameStep,
  'profile-photo': ProfilePhotoStep,
  'complete': CompleteStep,
};

interface OnboardingFlowProps {
  setUser: (user: {
    displayName: string;
    state: string;
    status: string;
    userIcon: string;
    address: string;
  }) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ setUser }) => {
  const flow = useUnifiedOnboardingFlow({ setUser });
  const StepComponent = STEP_MAP[flow.step];
  const showSmallLogo = flow.step !== 'welcome' && flow.step !== 'loading';

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Small top-left logo on all steps except welcome and loading */}
      {showSmallLogo && (
        <div className="absolute top-6 left-6">
          <Logo className="h-6 opacity-40" />
        </div>
      )}

      {/* Centered content area */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[460px]">
          {/* Progress bar */}
          {flow.dotIndex !== null && (
            <div className="mb-8">
              <ProgressBar total={5} active={flow.dotIndex} />
            </div>
          )}

          {/* Step content with fade transition */}
          <div key={flow.step} className="onboarding-step">
            <StepComponent flow={flow} />
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/steps/index.ts src/components/onboarding/OnboardingFlow.tsx
git commit -m "feat(onboarding): add OnboardingFlow orchestrator

Thin orchestrator that renders ProgressBar + current step component
from step map, with fade transition and responsive logo placement."
```

---

### Task 12: Wire up App.tsx — replace Login/Onboarding with OnboardingFlow

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update imports in App.tsx**

In `src/App.tsx`, replace the Login and Onboarding imports:

Replace:
```typescript
import { Login } from './components/onboarding/Login';
import { Onboarding } from './components/onboarding/Onboarding';
```

With:
```typescript
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
```

Also remove the `_passkey-modal.scss` import if present:
```typescript
// Remove this line if it exists:
import './styles/_passkey-modal.scss';
```

- [ ] **Step 2: Replace the mounting logic branches**

In `src/App.tsx`, replace the two onboarding branches (lines ~134-149):

Replace:
```tsx
          ) : landing && !currentPasskeyInfo ? (
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              {isWeb() && isElectron() && <CustomTitlebar />}
              <Routes>
                <Route path="/" element={<Login setUser={setUser} />} />
                <Route path="/*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          ) : landing ? (
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              {isWeb() && isElectron() && <CustomTitlebar />}
              <Routes>
                <Route path="/" element={<Onboarding setUser={setUser} />} />
                <Route path="/*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
```

With:
```tsx
          ) : landing && !user ? (
            <div className="bg-onboarding flex flex-col min-h-screen text-main">
              {isWeb() && isElectron() && <CustomTitlebar />}
              <OnboardingFlow setUser={setUser} />
            </div>
```

Note: We removed the `<Routes>` wrapper since `OnboardingFlow` doesn't need routing — it handles all navigation internally.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(onboarding): wire OnboardingFlow into App.tsx

Replace Login + Onboarding branches with single OnboardingFlow.
Use bg-onboarding instead of bg-radial--accent-noise.
Remove Routes wrapper (flow handles navigation internally)."
```

---

### Task 13: Export the new hook from barrel files

**Files:**
- Modify: `src/hooks/business/user/index.ts` (or wherever user hooks are re-exported)

- [ ] **Step 1: Add the export**

Find `src/hooks/business/user/index.ts` and add:

```typescript
export {
  useUnifiedOnboardingFlow,
  type OnboardingStep,
  type OnboardingUser,
  type UseUnifiedOnboardingFlowReturn,
} from './useUnifiedOnboardingFlow';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/user/index.ts
git commit -m "feat(onboarding): export unified hook from barrel file"
```

---

### Task 14: Integration testing — full flow verification

**Files:**
- No new files — manual testing

- [ ] **Step 1: Start the dev server**

Run: `yarn dev` (or `yarn electron:dev` for Electron testing)

- [ ] **Step 2: Test new account flow (browser)**

1. Clear `localStorage` to ensure a fresh state
2. Verify the welcome screen appears with Quorum logo, correct copy, two buttons, and tooltip
3. Click "Create New Account"
4. Verify progress bar shows (1 of 5 segments filled)
5. Verify "Create Passkey" step with correct copy
6. Click "Create Passkey" — browser should prompt for biometric
7. After first prompt, verify "Save Your Account Key" step appears (progress bar: 1 filled)
8. After second prompt, verify transition to "Back Up Your Account Key" (progress bar: 2 filled)
9. Click "Download Key Backup" — verify `.key` file downloads
10. Verify "Keep your Key Safe!" warning screen appears
11. Click "I understand" — verify name input step (progress bar: 4 filled)
12. Enter a name, verify "Continue" button becomes enabled
13. Click "Continue" — verify photo upload step
14. Skip photo — verify complete step with personalized welcome
15. Click "Enter Quorum" — verify main app loads

- [ ] **Step 3: Test import flow**

1. Clear `localStorage`
2. Click "I already have an account"
3. Verify dropzone appears, drag/drop a `.key` file
4. Verify passkey steps appear after file import
5. Complete the flow through to main app

- [ ] **Step 4: Test error/fallback flow**

1. Clear `localStorage`
2. Click "Create New Account"
3. Cancel the browser passkey prompt
4. Verify inline error message with "Try Again" and "Continue without passkey" buttons
5. Click "Continue without passkey"
6. Verify flow continues to backup step

- [ ] **Step 5: Test returning user**

1. Complete a full registration
2. Refresh the page
3. Verify the app auto-logs in without showing onboarding

- [ ] **Step 6: Test Electron flow (if available)**

1. Run `yarn electron:dev`
2. Clear storage
3. Click "Create New Account"
4. Verify passkey steps are skipped entirely (goes straight to backup)

- [ ] **Step 7: Test light/dark theme**

1. Switch system theme to light mode
2. Verify the onboarding uses the themed surface-2 background
3. Verify all text, buttons, and inputs are readable in light mode
4. Switch back to dark mode and verify

- [ ] **Step 8: Test "skip key backup" path**

1. Clear `localStorage`, create new account, complete passkey
2. On backup step, click "I've already saved my key"
3. Verify flow jumps directly to name step (skips security warning)

- [ ] **Step 9: Commit any fixes**

If any issues were found during testing, fix them and commit:

```bash
git add -A
git commit -m "fix(onboarding): address issues found during integration testing"
```

---

### Task 15: Extract i18n strings

**Files:**
- Lingui catalog files

- [ ] **Step 1: Run Lingui extract**

Run: `yarn extract`

This scans all `t` tagged templates and `<Trans>` components, adding new message IDs to the catalog files.

- [ ] **Step 2: Verify no extraction errors**

Expected: Clean extraction with new messages added for all onboarding strings.

- [ ] **Step 3: Commit updated catalogs**

```bash
git add src/locales/
git commit -m "chore(i18n): extract new onboarding flow strings"
```

---

*Created: 2026-04-13*
