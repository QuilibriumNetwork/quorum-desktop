import * as React from 'react';
import { useNavigate } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { Button } from './primitives';
import { Logo } from './Logo';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 relative bg-surface-1">
      <Logo className="max-w-[160px] text-muted absolute top-4 left-4" />
      <div className="w-full max-w-[460px] text-center">
        <div className="text-8xl xs:text-9xl font-bold text-accent leading-none mb-6">
          404
        </div>
        <h1 className="onboarding-title">
          <Trans>Page Not Found</Trans>
        </h1>
        <p className="onboarding-description mx-auto">
          <Trans>
            The page you're looking for doesn't exist or has been moved. Let's
            get you back on track.
          </Trans>
        </p>
        <div className="flex justify-center">
          <Button
            type="primary"
            onClick={() => navigate('/messages')}
            className="onboarding-action"
          >
            <Trans>Go to Home</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

