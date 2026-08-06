import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, Link } from 'react-router';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

import { RouteBoundary } from '@/components/Router/RouteBoundary';
import { AppErrorScreen } from '@/components/AppErrorScreen';
import { ErrorStates } from '@/dev/error-states';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

// React logs every boundary-caught error, and the boundary itself calls
// console.error on purpose. Silence both so the suite output stays readable.
let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

/**
 * Stands in for a message list whose IndexedDB read rejected. `useMessages`
 * uses `useSuspenseInfiniteQuery`, which re-throws a `queryFn` rejection to the
 * nearest error boundary — this is the same shape reaching the boundary.
 */
let shouldThrow = true;
const ChannelView = () => {
  if (shouldThrow) {
    throw new Error('failed to read messages from IndexedDB');
  }
  return <div>channel content</div>;
};

const renderApp = (initialEntry: string) =>
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<div>HOME SCREEN</div>} />
          <Route
            path="/spaces/:spaceId/:channelId"
            element={
              <div>
                <Link to="/spaces/s1/other-channel">go to other channel</Link>
                <RouteBoundary scope="channel">
                  <ChannelView />
                </RouteBoundary>
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );

describe('RouteBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
  });

  it('shows an inline error state instead of redirecting home', async () => {
    renderApp('/spaces/s1/c1');

    expect(
      await screen.findByText("This channel couldn't be loaded")
    ).toBeInTheDocument();

    // The regression this replaced: the fallback was `<Navigate to="/" />`, so
    // the user landed on the home screen with no explanation at all.
    expect(screen.queryByText('HOME SCREEN')).not.toBeInTheDocument();
    // The surrounding route (sidebars in the real app) survives the failure.
    expect(screen.getByText('go to other channel')).toBeInTheDocument();
  });

  it('never blames Quilibrium infrastructure for a local read failure', async () => {
    renderApp('/spaces/s1/c1');
    await screen.findByText("This channel couldn't be loaded");

    expect(screen.queryByText(/Maintenance in Progress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/status\.quilibrium\.com/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/infrastructure is being deployed/i)
    ).not.toBeInTheDocument();
  });

  it('announces the failure to assistive tech', async () => {
    renderApp('/spaces/s1/c1');
    await screen.findByText("This channel couldn't be loaded");

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('recovers the view when "Try again" succeeds', async () => {
    const user = userEvent.setup();
    renderApp('/spaces/s1/c1');
    await screen.findByText("This channel couldn't be loaded");

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('channel content')).toBeInTheDocument();
    expect(
      screen.queryByText("This channel couldn't be loaded")
    ).not.toBeInTheDocument();
  });

  it('keeps showing the error while the underlying failure persists', async () => {
    const user = userEvent.setup();
    renderApp('/spaces/s1/c1');
    await screen.findByText("This channel couldn't be loaded");

    // shouldThrow stays true: retrying a still-broken read must not silently
    // render an empty channel, which is what the earlier bugs looked like.
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByText("This channel couldn't be loaded")
    ).toBeInTheDocument();
    expect(screen.queryByText('channel content')).not.toBeInTheDocument();
  });

  it('clears a stale error when the user navigates to another channel', async () => {
    const user = userEvent.setup();
    renderApp('/spaces/s1/c1');
    await screen.findByText("This channel couldn't be loaded");

    // React Router reuses the element instance across param changes, so without
    // an explicit reset the boundary would stay stuck on the error card for a
    // channel that never failed.
    shouldThrow = false;
    await user.click(screen.getByRole('link', { name: 'go to other channel' }));

    expect(await screen.findByText('channel content')).toBeInTheDocument();
  });

  it('labels a DM failure as a conversation, not a channel', async () => {
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/messages/QmPeerA']}>
          <Routes>
            <Route
              path="/messages/:address"
              element={
                <RouteBoundary scope="conversation">
                  <ChannelView />
                </RouteBoundary>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      await screen.findByText("This conversation couldn't be loaded")
    ).toBeInTheDocument();
  });
});

describe('AppErrorScreen', () => {
  it('reports an unknown crash without claiming a service outage', () => {
    render(
      <I18nProvider i18n={i18n}>
        <AppErrorScreen />
      </I18nProvider>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText(/Maintenance in Progress/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/infrastructure is being deployed/i)
    ).not.toBeInTheDocument();
  });

  it('offers the reload that actually recovers the app', () => {
    render(
      <I18nProvider i18n={i18n}>
        <AppErrorScreen />
      </I18nProvider>
    );

    expect(
      screen.getByRole('button', { name: 'Reload Quorum' })
    ).toBeInTheDocument();
  });
});

// Guards the /dev/error-states preview page against shipping broken, so opening
// it is never a wasted trip to a blank screen.
describe('dev error-states preview page', () => {
  const renderPage = () =>
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/dev/error-states']}>
          <ErrorStates />
        </MemoryRouter>
      </I18nProvider>
    );

  it('renders every route-scope error state', () => {
    renderPage();

    expect(
      screen.getByText("This channel couldn't be loaded")
    ).toBeInTheDocument();
    expect(
      screen.getByText("This conversation couldn't be loaded")
    ).toBeInTheDocument();
    expect(screen.getByText("This page couldn't be loaded")).toBeInTheDocument();
  });

  it('recovers a panel through the real retry path', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: 'Let it succeed' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0]);

    expect(
      await screen.findByText('Recovered — the view rendered')
    ).toBeInTheDocument();
  });

  it('can show the app-root crash screen', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Show app-root crash screen' })
    );

    expect(
      await screen.findByText('Something went wrong')
    ).toBeInTheDocument();
  });
});
