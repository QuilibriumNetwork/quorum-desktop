import * as React from 'react';
import { Trans } from '@lingui/react/macro';

/**
 * ConnectingClassic — the previous loading screen (pulse-zoom Quorum symbol).
 *
 * Kept aside as a fallback while we trial the animated QuorumLoader in
 * Connecting.tsx. Not wired into anything. If we revert, point the Suspense
 * fallbacks (App.tsx, Layout.tsx, Router.web.tsx) back at this, or restore
 * this body into Connecting.tsx.
 */
const ConnectingClassic = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-app text-subtle text-center text-2xl" role="status" aria-live="polite" aria-busy="true">
      <div
        className="w-[100px] h-[100px] bg-contain bg-no-repeat bg-center mb-5 animate-[pulse-zoom_2s_ease-in-out_infinite]"
        style={{ backgroundImage: "url('/quorum-symbol.png')" }}
        role="img"
        aria-label="Quorum"
      ></div>
      <div className="font-medium opacity-90">
        <Trans>Connecting</Trans>
      </div>
    </div>
  );
};

export default ConnectingClassic;
