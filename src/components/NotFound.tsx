import * as React from 'react';
import { useNavigate } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { Button } from './primitives';
import './NotFound.scss';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="not-found-page bg-app">
      <div className="not-found-container">
        <div className="not-found-code">404</div>
        <h1 className="not-found-title">
          <Trans>Page Not Found</Trans>
        </h1>
        <p className="not-found-message">
          <Trans>
            The page you're looking for doesn't exist or has been moved. Let's
            get you back on track.
          </Trans>
        </p>
        <Button type="primary" onClick={() => navigate('/messages')}>
          <Trans>Go to Home</Trans>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;

