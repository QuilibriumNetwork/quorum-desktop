/**
 * Error States — see what a user actually sees when something fails.
 *
 * These are the real components wired the real way: each panel contains the
 * same `RouteBoundary` the router uses, wrapping a child that genuinely throws.
 * So "Try again" clears a real boundary and re-renders a real child, exactly as
 * it does in a channel. Nothing here is a static mockup of a card.
 */

import React from 'react';
import { Button, Flex, Icon } from '../../components/primitives';
import { DevPage, DevPageHeader } from '../shell';
import { RouteBoundary } from '../../components/Router/RouteBoundary';
import { AppErrorScreen } from '../../components/AppErrorScreen';
import type { RouteErrorScope } from '../../components/RouteErrorFallback';

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
      <p className="empty-state__title">Recovered, the view rendered</p>
    </div>
  );
};

const Panel: React.FC<{
  label: string;
  route: string;
  control?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, route, control, children }) => (
  <div className="mb-8 overflow-hidden rounded-lg border border-subtle">
    <Flex
      direction="row"
      align="center"
      justify="between"
      gap="md"
      wrap
      className="bg-surface-2 px-4 py-3"
    >
      <div className="text-left">
        <p className="text-strong">{label}</p>
        <p className="text-subtle text-sm">{route}</p>
      </div>
      {control}
    </Flex>
    <div className="bg-chat flex min-h-[30rem] flex-col">{children}</div>
  </div>
);

const BoundaryDemo: React.FC<{
  scope: RouteErrorScope;
  label: string;
  route: string;
}> = ({ scope, label, route }) => {
  // A ref, not state: the boundary re-renders its child without re-rendering
  // this component, so the child has to read the current value at render time.
  const failRef = React.useRef(true);
  const [, forceRender] = React.useReducer((n: number) => n + 1, 0);

  return (
    <Panel
      label={label}
      route={route}
      control={
        <Flex direction="row" align="center" gap="sm" wrap>
          <span className="text-subtle text-sm">
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
      }
    >
      <RouteBoundary scope={scope}>
        <FailingView failRef={failRef} />
      </RouteBoundary>
    </Panel>
  );
};

export const ErrorStates: React.FC = () => {
  const [fullScreenCrash, setFullScreenCrash] = React.useState(false);

  // Mirrors the App.tsx fallback wrapper exactly, so this is what really ships.
  if (fullScreenCrash) {
    return (
      <div className="bg-surface-1 flex min-h-screen flex-col text-main">
        <div className="absolute right-4 top-4 z-10">
          <Button type="subtle-outline" onClick={() => setFullScreenCrash(false)}>
            Back to error states
          </Button>
        </div>
        <AppErrorScreen />
      </div>
    );
  }

  return (
    <DevPage width="narrow">
        <DevPageHeader
          icon="skull"
          title="Error States"
          subtitle="What a user sees when a view fails to load. Every panel below holds a real error boundary wrapping a child that really throws, so retry and recovery behave exactly as they do in the app."
        />

        <BoundaryDemo
          scope="channel"
          label="Space channel"
          route="/spaces/:spaceId/:channelId"
        />
        <BoundaryDemo
          scope="conversation"
          label="Direct messages"
          route="/messages and /messages/:address"
        />
        <BoundaryDemo
          scope="page"
          label="Other routes"
          route="/bookmarks, /wallet, /discover/spaces, /farcaster, /spaces"
        />

        <Panel
          label="App-root crash screen"
          route="Any error that escapes every route boundary"
          control={
            <Button
              type="subtle-outline"
              size="compact"
              onClick={() => setFullScreenCrash(true)}
            >
              View full screen
            </Button>
          }
        >
          <AppErrorScreen />
        </Panel>

        <p className="text-subtle text-sm">
          The crash screen replaced a maintenance notice that told users
          Quilibrium infrastructure was being deployed, for faults that were
          usually local. The status link survives as a second guess, not a
          diagnosis.
        </p>
    </DevPage>
  );
};
