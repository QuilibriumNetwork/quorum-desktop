import React from 'react';
import { Button, Flex, Icon } from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';
import { RouteBoundary } from '../../components/Router/RouteBoundary';
import { AppErrorScreen } from '../../components/AppErrorScreen';
import type { RouteErrorScope } from '../../components/RouteErrorFallback';

/**
 * Preview of what a user actually sees when something fails.
 *
 * These are the real components wired the real way: `RouteBoundary` here is the
 * same one the router uses, and the error reaching it is a real thrown error
 * from a child render, not a mocked-up static card. So "Try again" genuinely
 * clears the boundary and re-renders the child, exactly as it does in a channel.
 */

/** Throws until told to stop, standing in for a failed IndexedDB message read. */
const FailingView: React.FC<{ failRef: { current: boolean } }> = ({
  failRef,
}) => {
  if (failRef.current) {
    throw new Error('dev preview: simulated message-read failure');
  }
  return (
    <div className="empty-state empty-state--fill">
      <Icon name="check" size="5xl" className="empty-state__icon" />
      <p className="empty-state__title">Recovered — the view rendered</p>
      <p className="empty-state__description">
        This is what "Try again" reaches when the underlying read succeeds.
      </p>
    </div>
  );
};

const BoundaryDemo: React.FC<{ scope: RouteErrorScope; label: string }> = ({
  scope,
  label,
}) => {
  // A ref, not state: the boundary re-renders its child without re-rendering
  // this component, so the child has to read the current value at render time.
  const failRef = React.useRef(true);
  const [, forceRender] = React.useReducer((n: number) => n + 1, 0);

  return (
    <div
      style={{
        border: '1px solid var(--surface-6)',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        marginBottom: '2rem',
      }}
    >
      <Flex
        direction="row"
        align="center"
        justify="between"
        style={{
          padding: '0.75rem 1rem',
          background: 'var(--surface-2)',
          gap: '0.75rem',
        }}
      >
        <span className="text-strong">{label}</span>
        <Flex direction="row" align="center" style={{ gap: '0.5rem' }}>
          <span className="text-subtle">
            {failRef.current
              ? 'read is failing'
              : 'read will succeed on next retry'}
          </span>
          <Button
            type="subtle-outline"
            size="compact"
            onClick={() => {
              failRef.current = !failRef.current;
              forceRender();
            }}
          >
            {failRef.current ? 'Let it succeed' : 'Break it again'}
          </Button>
        </Flex>
      </Flex>
      <div style={{ minHeight: '20rem', display: 'flex' }}>
        <RouteBoundary scope={scope}>
          <FailingView failRef={failRef} />
        </RouteBoundary>
      </div>
    </div>
  );
};

export const ErrorStates: React.FC = () => {
  const [showAppCrash, setShowAppCrash] = React.useState(false);

  if (showAppCrash) {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1 }}>
          <Button type="subtle-outline" onClick={() => setShowAppCrash(false)}>
            Back to error states
          </Button>
        </div>
        <AppErrorScreen />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '60rem', margin: '0 auto' }}>
      <DevNavMenu currentPath="/dev/error-states" />
      <h1 className="text-strong" style={{ fontSize: '1.5rem', margin: '1rem 0 0.5rem' }}>
        Error states
      </h1>
      <p className="text-subtle" style={{ marginBottom: '2rem' }}>
        What a user sees when a view fails to load. Each panel below contains a
        real error boundary wrapping a child that really throws.
      </p>

      <BoundaryDemo
        scope="channel"
        label="Space channel — /spaces/:spaceId/:channelId"
      />
      <BoundaryDemo
        scope="conversation"
        label="Direct messages — /messages and /messages/:address"
      />
      <BoundaryDemo
        scope="page"
        label="Other routes — bookmarks, wallet, discover, farcaster"
      />

      <div
        style={{
          border: '1px solid var(--surface-6)',
          borderRadius: '0.5rem',
          padding: '1rem',
        }}
      >
        <p className="text-strong" style={{ marginBottom: '0.5rem' }}>
          App-root crash screen
        </p>
        <p className="text-subtle" style={{ marginBottom: '1rem' }}>
          Shown only when an error escapes every route boundary. This replaced
          the maintenance notice, which claimed Quilibrium infrastructure was
          down for faults that were purely local.
        </p>
        <Button type="primary" onClick={() => setShowAppCrash(true)}>
          Show app-root crash screen
        </Button>
      </div>
    </div>
  );
};
