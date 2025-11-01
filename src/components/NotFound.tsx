import * as React from 'react';
import { useNavigate } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { Button } from './primitives';
import { Logo } from './Logo';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5 text-text-main bg-app relative">
      <Logo className="max-w-[150px] xs:max-w-[200px] text-muted mx-auto mb-12 xs:absolute xs:top-4 xs:left-4 xs:mb-0 xs:mx-0" />
      <div className="text-center max-w-96 w-full">
        <div className="text-8xl xs:text-9xl font-bold text-accent leading-none mb-4">
          404
        </div>
        <h1 className="text-2xl xs:text-4xl font-medium text-text-strong mb-4">
          <Trans>Page Not Found</Trans>
        </h1>
        <p className="text-subtle xs:text-lg mb-8 max-w-80 mx-auto">
          <Trans>
            The page you're looking for doesn't exist or has been moved. Let's
            get you back on track.
          </Trans>
        </p>
        <div className="flex justify-center">
          <Button
            type="primary"
            onClick={() => navigate('/messages')}
            className="min-w-40"
          >
            <Trans>Go to Home</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

