import React, { useState } from 'react';
import { Button, Input, Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import { validateDisplayName } from '../../../hooks/business/validation';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const DisplayNameStep: React.FC<StepProps> = ({ flow }) => {
  const [addressInfoExpanded, setAddressInfoExpanded] = useState(false);
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
          <div className="flex items-center gap-1 mb-1">
            <Icon
              name="question-circle"
              size="xs"
              className="onboarding-label-muted cursor-pointer"
              onClick={() => setAddressInfoExpanded(v => !v)}
            />
            <span className="text-xs onboarding-label-muted">{t`Account Address`}</span>
          </div>
          {addressInfoExpanded && (
            <p className="onboarding-read-more mb-2">
              {t`Your account address is a unique public identifier derived from your account key. Others can use it to find and message you. Think of it like a username that can never change.`}
            </p>
          )}
          <Input
            variant="filled"
            value={
              flow.address.length > 20
                ? `${flow.address.slice(0, 10)}...${flow.address.slice(-8)}`
                : flow.address
            }
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
    </div>
  );
};
