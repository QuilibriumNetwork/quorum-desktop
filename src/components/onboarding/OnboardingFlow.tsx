import React from 'react';
import { ProgressBar } from './ProgressBar';
import { Logo } from '../Logo';
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
