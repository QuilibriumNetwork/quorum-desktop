import React from 'react';
import { Button, Icon } from '../../primitives';
import { OnboardingInfoLink } from '../OnboardingInfoLink';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const BackupKeyStep: React.FC<StepProps> = ({ flow }) => {
  return (
    <div className="onboarding-step-body">
      <div className="onboarding-step-icon">
        <Icon name="download" size="2xl" />
      </div>
      <h1 className="onboarding-title">{t`Back Up Your Account Key`}</h1>
      <p className="onboarding-description">
        {t`You'll need this file to recover your account if you lose access to your device.`}
      </p>

      <Button
        type="primary"
        className="onboarding-action"
        onClick={flow.downloadKey}
      >
        {t`Download Key Backup`}
      </Button>

      <Button
        type="secondary"
        className="onboarding-action"
        onClick={flow.skipKeyBackup}
      >
        {t`I've already saved my key`}
      </Button>

      <OnboardingInfoLink
        label={t`Why do I need to do this?`}
        content={t`Without this backup, losing your device means losing your account - there's no 'forgot password' option. This is the price you pay for privacy :-)`}
      />
    </div>
  );
};
