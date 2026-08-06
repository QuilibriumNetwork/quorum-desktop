import React from 'react';
import { useLocation } from 'react-router';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import {
  RouteErrorFallback,
  type RouteErrorScope,
} from '@/components/RouteErrorFallback';

interface RouteErrorBoundaryProps {
  /** Rendered in place of the children, given a callback that clears the error. */
  fallback: (retry: () => void) => React.ReactNode;
  /** Changing this clears a stale error — see `getDerivedStateFromProps`. */
  resetKey?: string;
  /** Runs before the boundary clears, so query state resets with it. */
  onReset?: () => void;
  children: React.ReactNode;
}

class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  { hasError: boolean; resetKey?: string }
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(_error: any) {
    return { hasError: true };
  }

  static getDerivedStateFromProps(
    props: RouteErrorBoundaryProps,
    state: { hasError: boolean; resetKey?: string }
  ) {
    if (props.resetKey === state.resetKey) {
      return null;
    }
    // React Router reuses the element instance across param changes, so without
    // this the boundary would keep showing the fallback after the user picks a
    // different channel — a view that never failed, permanently stuck.
    return { hasError: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: any, info: any) {
    console.error('Route error boundary caught:', error, info);
  }

  retry = () => {
    this.props.onReset?.();
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.retry);
    }
    return this.props.children;
  }
}

/**
 * Route-level error containment. Shows an inline, retryable error state instead
 * of silently navigating home, and keeps a local failure (a failed IndexedDB
 * read, say) from reaching the app-root boundary, which replaces the whole app
 * with a maintenance notice.
 *
 * `QueryErrorResetBoundary` matters because message lists use
 * `useSuspenseInfiniteQuery`: TanStack Query v5 always re-throws a `queryFn`
 * rejection to the nearest boundary, and the query stays errored until it is
 * reset, so clearing the boundary alone would not make "Try again" retry
 * anything.
 */
export const RouteBoundary: React.FunctionComponent<{
  scope?: RouteErrorScope;
  children: React.ReactNode;
}> = ({ scope, children }) => {
  const location = useLocation();

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <RouteErrorBoundary
          resetKey={location.pathname}
          onReset={reset}
          fallback={(retry) => (
            <RouteErrorFallback scope={scope} onRetry={retry} />
          )}
        >
          {children}
        </RouteErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};
