import React from 'react';
import { Button, Icon } from './primitives';
import { Trans } from '@lingui/react/macro';
import { Logo } from './Logo';

/**
 * App-root crash screen: what the user sees when an error escapes every route
 * boundary and reaches the top-level `ErrorBoundary` in `App.tsx`.
 *
 * Deliberately does NOT claim a server outage. This boundary catches any render
 * error in the tree, and the common causes are local (a failed IndexedDB read,
 * a component throwing), so `Maintenance` was telling users Quilibrium
 * infrastructure was down for faults that had nothing to do with it. The status
 * page is still linked, but as a second guess rather than a diagnosis.
 */
export const AppErrorScreen = () => {
  return (
    // flex-1, not min-h-screen: the App.tsx fallback wrapper already supplies
    // `flex flex-col min-h-screen`, so this fills the viewport there while
    // staying containable in the /dev/error-states preview.
    <div
      className="flex flex-1 flex-col items-center justify-center px-4 py-12 relative"
      role="alert"
    >
      <Logo className="max-w-[160px] text-muted absolute top-4 left-4" />
      <div className="w-full max-w-[460px] text-center">
        <div className="flex justify-center mb-6">
          <div className="onboarding-step-icon onboarding-step-icon--large">
            <Icon name="skull" size="3xl" />
          </div>
        </div>
        <h1 className="onboarding-title">
          <Trans>Something went wrong</Trans>
        </h1>
        <p className="onboarding-description mx-auto">
          <Trans>
            Reloading usually fixes it. If it keeps happening, check{' '}
            <a
              href="https://status.quilibrium.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="onboarding-link !text-base"
            >
              status.quilibrium.com
            </a>{' '}
            for service updates.
          </Trans>
        </p>
        <div className="flex justify-center">
          <Button
            type="primary"
            className="onboarding-action"
            onClick={() => window.location.reload()}
          >
            <Trans>Reload Quorum</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
};
