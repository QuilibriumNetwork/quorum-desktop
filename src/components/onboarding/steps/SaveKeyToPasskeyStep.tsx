import React from 'react';
import { Button } from '../../primitives';
import { OnboardingInfoLink } from '../OnboardingInfoLink';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const SaveKeyToPasskeyStep: React.FC<StepProps> = ({ flow }) => {
  const isCompleting = flow.passkeyStep === 'completing';

  return (
    <div className="onboarding-step-body">
      <h1 className="onboarding-title">{t`Save Your Account Key`}</h1>
      <p className="onboarding-description">
        {t`Now let's store your account key inside your passkey. One more confirmation needed.`}
      </p>

      <Button
        type="primary"
        className="onboarding-action mb-6"
        onClick={flow.saveToPasskey}
        disabled={isCompleting}
        iconName={isCompleting ? 'spinner' : undefined}
      >
        {t`Save to Passkey`}
      </Button>

      <OnboardingInfoLink
        label={t`What is the Account Key?`}
        content={t`Your account key is your unique identity in Quorum. It's like a master password that proves you are you - but it's generated automatically and stored securely in your passkey.`}
      />
    </div>
  );
};
