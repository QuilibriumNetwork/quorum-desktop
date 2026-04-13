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
    <div className="onboarding-step-body">
      <h1 className="onboarding-title">{t`You're all set!`}</h1>
      <p className="onboarding-description">
        {i18n._(
          'Welcome to Quorum, {name}! Your account is secured and ready to go.',
          { name: flow.displayName }
        )}
      </p>

      <Button
        type="primary"
        className="onboarding-action"
        onClick={flow.completeOnboarding}
      >
        {t`Enter Quorum`}
      </Button>
    </div>
  );
};
