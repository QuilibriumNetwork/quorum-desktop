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

      <div className="w-full max-w-xs mb-4">
        <Input
          variant="filled"
          label={t`User Name`}
          labelType="static"
          className="w-full"
          value={flow.displayName}
          onChange={flow.setDisplayName}
          placeholder={t`Enter your name`}
          error={!!nameError}
          errorMessage={nameError ?? undefined}
        />
      </div>

      {flow.address && (
        <div className="w-full max-w-xs mb-6">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs onboarding-label-muted">{t`Account Address`}</span>
            <Icon
              name="help-circle"
              size="xs"
              className="onboarding-label-muted cursor-pointer"
              onClick={() => setAddressInfoExpanded(v => !v)}
            />
          </div>
          {addressInfoExpanded && (
            <p className="onboarding-read-more mb-2">
              {t`Your account address is a unique public identifier derived from your account key. Others can use it to find and message you. Think of it like a username that can never change.`}
            </p>
          )}
          <Input
            variant="filled"
            className="w-full"
            value={
              flow.address.length > 20
                ? `${flow.address.slice(0, 10)}...${flow.address.slice(-8)}`
                : flow.address
            }
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
