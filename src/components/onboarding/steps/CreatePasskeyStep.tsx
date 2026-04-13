import React from 'react';
import { Button, Icon } from '../../primitives';
import { OnboardingInfoLink } from '../OnboardingInfoLink';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'user_cancelled':
      return t`You cancelled the passkey setup. You can try again, or continue without Passkey (still secure, just without device hardware protection).`;
    case 'not_supported':
      return t`Passkeys aren't supported on this browser. You'll need to continue without Passkey (still secure, just without device hardware protection).`;
    case 'timeout':
      return t`The passkey setup timed out. You can try again, or continue without Passkey (still secure, just without device hardware protection).`;
    default:
      return t`Passkey setup failed. You can try again, or continue without Passkey (still secure, just without device hardware protection).`;
  }
}

export const CreatePasskeyStep: React.FC<StepProps> = ({ flow }) => {
  const isRegistering = flow.passkeyStep === 'registering';
  const hasError = flow.passkeyError !== null;

  return (
    <div className="onboarding-step-body">
      <div className={`onboarding-step-icon${hasError ? ' onboarding-step-icon--error' : ''}`}>
        <Icon name={hasError ? 'warning' : 'key'} size="2xl" />
      </div>
      <h1 className="onboarding-title">{t`Create Passkey`}</h1>
      <p className="onboarding-description">
        {hasError
          ? getErrorMessage(flow.passkeyError!.code)
          : t`Passkeys use your device's built-in security to protect your account. This requires two quick confirmations via your device.`}
      </p>

      {!hasError && (
        <Button
          type="primary"
          className="onboarding-action"
          onClick={flow.createPasskey}
          disabled={isRegistering}
          iconName={isRegistering ? 'spinner' : undefined}
        >
          {t`Create Passkey`}
        </Button>
      )}

      {hasError && flow.canRetry && (
        <Button
          type="primary"
          className="onboarding-action"
          onClick={flow.retryPasskey}
        >
          {t`Try Again`}
        </Button>
      )}

      {hasError && (
        <Button
          type="secondary"
          className="onboarding-action"
          onClick={flow.continueWithoutPasskey}
        >
          {t`Continue without passkey`}
        </Button>
      )}

      {hasError && flow.passkeyError!.rawMessage ? (
        <OnboardingInfoLink
          label={t`View technical details`}
          content={flow.passkeyError!.rawMessage}
        />
      ) : (
        <OnboardingInfoLink
          label={t`What is a Passkey?`}
          content={t`A passkey uses your device's security features (Face ID, fingerprint, or PIN) to protect your account. It's more secure than a password and you don't have to remember anything.`}
        />
      )}
    </div>
  );
};
