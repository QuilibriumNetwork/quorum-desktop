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
 * Route-scoped error state. Renders inside `Layout`, so the sidebars and the
 * space list stay usable and the failure stays visibly attached to the view
 * that actually failed.
 *
 * This replaced a bare `<Navigate to="/" replace />` fallback, which ejected
 * the user to the root with no explanation — indistinguishable from the app
 * randomly kicking them out.
 */
export const RouteErrorFallback: React.FunctionComponent<
  RouteErrorFallbackProps
> = ({ scope = 'page', onRetry }) => (
  <div className="empty-state empty-state--fill" role="alert">
    <Icon name="alert-triangle" size="5xl" className="empty-state__icon" />
    <p className="empty-state__title">{titleFor(scope)}</p>
    <p className="empty-state__description">
      {t`Something went wrong while loading it. Trying again usually works; if it doesn't, reload the app.`}
    </p>
    <div className="empty-state__actions">
      <Button type="primary" onClick={onRetry}>
        {t`Try again`}
      </Button>
      <Button type="subtle-outline" onClick={() => window.location.reload()}>
        {t`Reload app`}
      </Button>
    </div>
  </div>
);
