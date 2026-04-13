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
          'Welcome to Quorum, {name}! Your account is secured and ready to go.',
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
