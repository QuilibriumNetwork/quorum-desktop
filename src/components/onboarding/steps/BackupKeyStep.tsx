import React from 'react';
import { Button, Tooltip } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const BackupKeyStep: React.FC<StepProps> = ({ flow }) => {
  // @ts-ignore — window.electron exists in Electron builds
  const isElectron = !!window.electron;

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Back Up Your Account Key`}</h1>
      <p className="text-sm opacity-60 mb-4 max-w-xs">
        {t`You'll need this file to recover your account if you lose access to your device.`}
      </p>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {isElectron
          ? t`If you uninstall the app from your device, you will lose your old messages and keys.`
          : t`If you clear your browser storage or switch browsers, your old messages and keys may disappear.`}
      </p>

      <Button
        type="primary"
        className="w-full max-w-xs mb-3"
        onClick={flow.downloadKey}
      >
        {t`Download Key Backup`}
      </Button>

      <span
        className="text-sm opacity-50 underline cursor-pointer mb-6"
        onClick={flow.skipKeyBackup}
      >
        {t`I've already saved my key`}
      </span>

      <Tooltip
        id="why-backup"
        content={t`Without this backup, losing your device means losing your account - there's no 'forgot password' option. This is the price you pay for privacy :-)`}
        place="bottom"
        maxWidth={300}
      >
        <span className="text-sm opacity-50 underline cursor-pointer">
          {t`Why do I need to do this?`}
        </span>
      </Tooltip>
    </div>
  );
};
