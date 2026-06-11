import * as React from 'react';
import { t } from '@lingui/core/macro';
import QuorumLoader from './ui/QuorumLoader';

const Connecting = () => {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-app"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <QuorumLoader text={t`Connecting`} />
    </div>
  );
};

export default Connecting;
