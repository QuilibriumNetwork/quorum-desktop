import React from 'react';
import { Button, Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const SecurityWarningStep: React.FC<StepProps> = ({ flow }) => {
  return (
    <div className="onboarding-step-body">
      <div className="onboarding-step-icon">
        <Icon name="lock" size="2xl" />
      </div>
      <h1 className="onboarding-title">{t`Keep your Key Safe!`}</h1>
      <p className="onboarding-description">
        {t`Keep the file you downloaded safe and private! Anyone with this file can access your account.`}
      </p>

      <Button
        type="primary"
        className="onboarding-action"
        onClick={flow.acknowledgeSecurityWarning}
      >
        {t`I understand`}
      </Button>
    </div>
  );
};
