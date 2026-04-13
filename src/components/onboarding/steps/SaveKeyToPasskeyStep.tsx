import React from 'react';
import { Button, Tooltip } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const SaveKeyToPasskeyStep: React.FC<StepProps> = ({ flow }) => {
  const isCompleting = flow.passkeyStep === 'completing';

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Save Your Account Key`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Now let's store your account key inside your passkey. One more confirmation needed.`}
      </p>

      <Button
        type="primary"
        className="w-full max-w-xs mb-6"
        onClick={flow.saveToPasskey}
        disabled={isCompleting}
        iconName={isCompleting ? 'spinner' : undefined}
      >
        {t`Save to Passkey`}
      </Button>

      <Tooltip
        id="what-is-account-key"
        content={t`Your account key is your unique identity in Quorum. It's like a master password that proves you are you - but it's generated automatically and stored securely in your passkey.`}
        place="bottom"
        maxWidth={300}
      >
        <span className="text-sm opacity-50 underline cursor-pointer">
          {t`What is the Account Key?`}
        </span>
      </Tooltip>
    </div>
  );
};
