import React from 'react';
import { Button, Tooltip } from '../../primitives';
import { Logo } from '../../Logo';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const WelcomeStep: React.FC<StepProps> = ({ flow }) => {
  return (
    <div className="flex flex-col items-center text-center">
      <Logo className="h-10 mb-8 opacity-60" />
      <h1 className="text-2xl font-bold mb-2">{t`Sign in into Quorum`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Your communities, your rules - no platform can ban you.`}
      </p>
      <Button
        type="primary"
        className="w-full max-w-xs mb-3"
        onClick={flow.startNewAccount}
      >
        {t`Create New Account`}
      </Button>
      <Button
        type="secondary"
        className="w-full max-w-xs mb-6"
        onClick={flow.startImportAccount}
      >
        {t`I already have an account`}
      </Button>
      <Tooltip
        id="read-more-quorum"
        content={t`Quorum is a decentralized messaging platform where you own your identity. No email, no phone number - just a secure key that only you control.`}
        place="bottom"
        maxWidth={300}
      >
        <span className="text-sm opacity-50 underline cursor-pointer">
          {t`Read more about Quorum`}
        </span>
      </Tooltip>
    </div>
  );
};
