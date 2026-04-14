import React from 'react';
import { Button, Icon } from './primitives';
import { Trans } from '@lingui/react/macro';

export const Maintenance = () => {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[460px] text-center">
        <div className="flex justify-center mb-6">
          <div className="onboarding-step-icon onboarding-step-icon--large">
            <Icon name="tools" size="2xl" />
          </div>
        </div>
        <h1 className="onboarding-title">
          <Trans>Maintenance in Progress</Trans>
        </h1>
        <p className="onboarding-description">
          <Trans>
            Quorum infrastructure is being deployed at this time. Please try
            refreshing, and check{' '}
            <a
              href="https://status.quilibrium.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="onboarding-link"
            >
              status.quilibrium.com
            </a>{' '}
            for updates.
          </Trans>
        </p>
        <div className="flex justify-center">
          <Button
            type="primary"
            className="onboarding-action"
            onClick={() => window.location.reload()}
          >
            <Trans>Refresh</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
};
