import React from 'react';
import { Button } from '../../primitives';
import { OnboardingInfoLink } from '../OnboardingInfoLink';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const BackupKeyStep: React.FC<StepProps> = ({ flow }) => {
  // @ts-ignore — window.electron exists in Electron builds
  const isElectron = !!window.electron;

  return (
    <div className="onboarding-step-body">
      <h1 className="onboarding-title">{t`Back Up Your Account Key`}</h1>
      <p className="onboarding-description mb-4">
        {t`You'll need this file to recover your account if you lose access to your device.`}
      </p>
      <p className="onboarding-description">
        {isElectron
          ? t`If you uninstall the app from your device, you will lose your old messages and keys.`
          : t`If you clear your browser storage or switch browsers, your old messages and keys may disappear.`}
      </p>

      <Button
        type="primary"
        className="onboarding-action mb-3"
        onClick={flow.downloadKey}
      >
        {t`Download Key Backup`}
      </Button>

      <span
        className="onboarding-link mb-6"
        onClick={flow.skipKeyBackup}
      >
        {t`I've already saved my key`}
      </span>

      <OnboardingInfoLink
        label={t`Why do I need to do this?`}
        content={t`Without this backup, losing your device means losing your account - there's no 'forgot password' option. This is the price you pay for privacy :-)`}
      />
    </div>
  );
};
