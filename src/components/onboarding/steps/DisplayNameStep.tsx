import React from 'react';
import { Button, Input } from '../../primitives';
import { t } from '@lingui/core/macro';
import { formatAddress } from '@quilibrium/quorum-shared';
import { validateDisplayName } from '../../../hooks/business/validation';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';
import { OnboardingInfoLink } from '../OnboardingInfoLink';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const DisplayNameStep: React.FC<StepProps> = ({ flow }) => {
  const nameError = flow.displayName.trim()
    ? validateDisplayName(flow.displayName)
    : undefined;

  return (
    <div className="onboarding-step-body">
      <h1 className="onboarding-title">{t`What should we call you?`}</h1>
      <p className="onboarding-description">
        {t`This is how others will see you in Quorum. You can change this anytime in Settings.`}
      </p>

      <div className="onboarding-input-wrapper">
        <Input
          variant="filled"
          value={flow.displayName}
          onChange={flow.setDisplayName}
          placeholder={t`Enter your name`}
          error={!!nameError}
          errorMessage={nameError ?? undefined}
        />
      </div>

      {flow.address && (
        <div className="onboarding-input-wrapper">
          <span className="text-xs onboarding-label-muted mb-1">{t`Account Address`}</span>
          <Input
            variant="filled"
            value={formatAddress(flow.address, 10, 8)}
            placeholder={t`Account address`}
            disabled
          />
        </div>
      )}

      <Button
        type="primary"
        className="onboarding-action"
        disabled={!flow.canProceedWithName}
        onClick={flow.saveDisplayName}
      >
        {t`Continue`}
      </Button>

      {flow.address && (
        <OnboardingInfoLink
          label={t`What is the account address?`}
          content={t`Your account address is a unique public identifier derived from your account key. Others can use it to find and message you. Think of it like a username that can never change.`}
        />
      )}
    </div>
  );
};
