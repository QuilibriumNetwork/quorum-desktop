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
