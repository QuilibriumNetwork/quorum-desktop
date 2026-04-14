import React from 'react';
import { Button } from '../../primitives';
import { Logo } from '../../Logo';
import { OnboardingInfoLink } from '../OnboardingInfoLink';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const WelcomeStep: React.FC<StepProps> = ({ flow }) => {
  return (
    <div className="onboarding-step-body">
      <Logo className="onboarding-logo h-8 mb-8" />
      <h1 className="onboarding-title">{t`Sign in into Quorum`}</h1>
      <p className="onboarding-description">
        {t`Your communities, your rules - no platform can ban you.`}
      </p>
      <Button
        type="primary"
        className="onboarding-action"
        onClick={flow.startNewAccount}
      >
        {t`Create New Account`}
      </Button>
      <Button
        type="secondary"
        className="onboarding-action"
        onClick={flow.startImportAccount}
      >
        {t`I already have an account`}
      </Button>
      <OnboardingInfoLink
        label={t`Read more about Quorum`}
        content={t`Quorum is a decentralized messaging platform where you own your identity. No email, no phone number - just a secure key that only you control.`}
      />
    </div>
  );
};
