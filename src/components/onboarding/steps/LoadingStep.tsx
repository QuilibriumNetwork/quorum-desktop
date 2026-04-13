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
