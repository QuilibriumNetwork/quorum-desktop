import * as React from 'react';
import { t } from '@lingui/core/macro';
import { Button, Icon } from './primitives';

/**
 * Which view failed. Only changes the headline — the recovery advice and the
 * actions are the same everywhere.
 */
export type RouteErrorScope = 'channel' | 'conversation' | 'page';

interface RouteErrorFallbackProps {
  scope?: RouteErrorScope;
  /** Clears the boundary and re-runs the queries that threw. */
  onRetry: () => void;
}

const titleFor = (scope: RouteErrorScope) => {
  switch (scope) {
    case 'channel':
      return t`This channel couldn't be loaded`;
    case 'conversation':
      return t`This conversation couldn't be loaded`;
    default:
      return t`This page couldn't be loaded`;
  }
};

/**
 * Route-scoped error state, on the same template as the 404 and maintenance
 * screens: circular icon badge, title, description, stacked actions.
 *
 * Fills its container rather than the viewport. It renders inside `Layout`, so
 * the sidebars and the space list stay usable and the failure stays visibly
 * attached to the view that actually failed. No Logo either, for the same
 * reason: the app chrome around it is still on screen.
 *
 * This replaced a bare `<Navigate to="/" replace />` fallback, which ejected
 * the user to the root with no explanation — indistinguishable from the app
 * randomly kicking them out.
 */
export const RouteErrorFallback: React.FunctionComponent<
  RouteErrorFallbackProps
> = ({ scope = 'page', onRetry }) => (
  <div className="error-panel" role="alert">
    <div className="error-panel__content">
      <div className="flex justify-center mb-6">
        <div className="onboarding-step-icon onboarding-step-icon--large">
          <Icon name="skull" size="3xl" />
        </div>
      </div>
      <h1 className="onboarding-title">{titleFor(scope)}</h1>
      <p className="onboarding-description mx-auto">
        {t`Trying again usually works. If it doesn't, reload the app.`}
      </p>
      <div className="error-panel__actions">
        <Button type="primary" className="onboarding-action" onClick={onRetry}>
          {t`Try again`}
        </Button>
        <Button
          type="subtle-outline"
          className="onboarding-action"
          onClick={() => window.location.reload()}
        >
          {t`Reload app`}
        </Button>
      </div>
    </div>
  </div>
);
