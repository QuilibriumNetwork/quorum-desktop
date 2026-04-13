import React from 'react';
import { Button, Tooltip, Icon } from '../../primitives';
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
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Create Passkey`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Passkeys use your device's built-in security to protect your account. This requires two quick confirmations via your device.`}
      </p>

      {hasError && (
        <div className="mb-6 max-w-xs">
          <div className="flex items-start gap-2 mb-4">
            <Icon name="alert-circle" className="text-danger mt-0.5 shrink-0" />
            <p className="text-sm text-left">
              {getErrorMessage(flow.passkeyError!.code)}
            </p>
          </div>
          {flow.passkeyError!.rawMessage && (
            <Tooltip
              id="passkey-raw-error"
              content={flow.passkeyError!.rawMessage}
              place="bottom"
              maxWidth={300}
            >
              <span className="text-xs opacity-40 underline cursor-pointer">
                {t`View technical details`}
              </span>
            </Tooltip>
          )}
        </div>
      )}

      {!hasError && (
        <Button
          type="primary"
          className="w-full max-w-xs mb-3"
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
          className="w-full max-w-xs mb-3"
          onClick={flow.retryPasskey}
        >
          {t`Try Again`}
        </Button>
      )}

      {hasError && (
        <Button
          type="secondary"
          className="w-full max-w-xs mb-6"
          onClick={flow.continueWithoutPasskey}
        >
          {t`Continue without passkey`}
        </Button>
      )}

      <Tooltip
        id="what-is-passkey"
        content={t`A passkey uses your device's security features (Face ID, fingerprint, or PIN) to protect your account. It's more secure than a password and you don't have to remember anything.`}
        place="bottom"
        maxWidth={300}
      >
        <span className="text-sm opacity-50 underline cursor-pointer">
          {t`What is a Passkey?`}
        </span>
      </Tooltip>
    </div>
  );
};
