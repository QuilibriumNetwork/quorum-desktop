import * as React from 'react';
import { Trans } from '@lingui/react/macro';

const Connecting = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-app text-subtle text-center text-2xl" role="status" aria-live="polite" aria-busy="true">
      <div
        className="w-[100px] h-[100px] bg-contain bg-no-repeat bg-center mb-5 animate-[pulse-zoom_2s_ease-in-out_infinite]"
        style={{ backgroundImage: "url('/quorumicon-blue.png')" }}
        role="img"
        aria-label="Quorum"
      ></div>
      <div className="font-medium opacity-90">
        <Trans>Connecting</Trans>
      </div>
    </div>
  );
};

export default Connecting;
