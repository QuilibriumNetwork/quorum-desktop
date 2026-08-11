import React, { Suspense } from 'react';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import {
  channel_raw,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';

import Connecting from './components/Connecting';
import CustomTitlebar from './components/Titlebar';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { AppErrorScreen } from './components/AppErrorScreen';
import { RegistrationProvider } from './components/context/RegistrationPersister';
import { ResponsiveLayoutProvider } from './components/context/ResponsiveLayoutProvider';
import { Router } from './components/Router';
import { isElectron, isWeb } from './utils/platform';
import { DefaultImages } from './utils';
import { i18n } from './i18n';
import { I18nProvider } from '@lingui/react';
import { useContextMenuPrevention } from './hooks/useContextMenuPrevention';
import { IdentityScopeProvider, type RosterNameRow } from './identity';

// Stable reference so the root provider's memo (see identityProvider.tsx's
// own EMPTY_LOCAL_NAMES) isn't invalidated by a fresh `{}` literal on every
// App render. No spaceId, no roster — the global ladder applies by default;
// every nested <IdentityScopeProvider> (Channel, DirectMessage, Bookmarks...)
// still overrides this with richer, scoped data when it mounts.
const EMPTY_ROSTERS: Record<string, Record<string, RosterNameRow>> = {};

window.Buffer = Buffer;

class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    // console, not logger: `logger.log` is a no-op in production builds, so a
    // crash that reached the app root left no trace anywhere at all.
    console.error('App error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

const App = () => {
  // Prevent native browser context menu (except on input fields)
  useContextMenuPrevention();

  const { currentPasskeyInfo, passkeyRegistrationComplete } =
    usePasskeysContext();
  const [user, setUser] = useState<
    | {
        displayName: string;
        state: string;
        status: string;
        userIcon: string;
        address: string;
      }
    | undefined
  >(undefined);
  const [init, setInit] = useState(false);
  const [landing, setLanding] = useState(false);

  // All hooks must be called before any conditional returns
  useEffect(() => {
    if (!init) {
      setInit(true);
      setTimeout(() => setLanding(true), 500);
      fetch('/channelwasm_bg.wasm').then(async (r) => {
        channel_raw.initSync(await r.arrayBuffer());
      });
    }
  }, [init]);

  useEffect(() => {
    if (currentPasskeyInfo && currentPasskeyInfo.completedOnboarding && !user) {
      setUser({
        displayName:
          currentPasskeyInfo.displayName ?? currentPasskeyInfo.address,
        state: 'online',
        status: '',
        userIcon: currentPasskeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER,
        address: currentPasskeyInfo.address,
      });
    }
  }, [currentPasskeyInfo, passkeyRegistrationComplete, setUser, user]);

  // Check if we're on a dev route that doesn't need authentication
  const isDevRoute = process.env.NODE_ENV === 'development' &&
    (window.location.pathname.startsWith('/playground') ||
     window.location.pathname.startsWith('/dev'));

  return (
    <>
      <I18nProvider i18n={i18n}>
        <ErrorBoundary
          fallback={
            <div className="bg-surface-1 flex flex-col min-h-screen text-main">
              {isWeb() && isElectron() && <CustomTitlebar />}
              <AppErrorScreen />
            </div>
          }
        >
          {/* Root-level identity scope: mounted ABOVE the Router (so every
              route's ModalProvider/AppShell/NavRail is inside it) and above
              every dev-route render too, so no rendered component can ever
              be outside an <IdentityScopeProvider> and hit the "Wrap the
              route" throw in identityProvider.tsx. No spaceId, empty
              rostersBySpace — the global ladder applies by default. Nested
              providers (Channel, DirectMessage, Bookmarks, notifications...)
              still mount below and override with scoped roster/local-name
              data; this one exists purely as the backstop for surfaces
              nobody has migrated yet (e.g. a confirmation modal or toast
              rendered from Layout's app-level modal host, outside any
              Space/DM provider). selfAddress comes from currentPasskeyInfo,
              the ONLY place the address is known before a user record even
              exists — the self tier itself resolves from the public
              profile fetched here, never from currentPasskeyInfo's fields. */}
          <IdentityScopeProvider
            rostersBySpace={EMPTY_ROSTERS}
            selfAddress={currentPasskeyInfo?.address ?? null}
          >
            {isDevRoute ? (
              <div className="bg-app flex flex-col min-h-screen text-main">
                {isWeb() && isElectron() && <CustomTitlebar />}
                <Router user={user!} setUser={setUser} />
              </div>
            ) : user && currentPasskeyInfo ? (
              <div className="bg-app flex flex-col min-h-screen text-main">
                {isWeb() && isElectron() && <CustomTitlebar />}
                <Suspense fallback={<Connecting />}>
                  <RegistrationProvider>
                    <ResponsiveLayoutProvider>
                      <Suspense>
                        <Router user={user} setUser={setUser} />
                      </Suspense>
                    </ResponsiveLayoutProvider>
                  </RegistrationProvider>
                </Suspense>
              </div>
            ) : landing && !user ? (
              <div className="bg-onboarding flex flex-col min-h-screen text-main">
                {isWeb() && isElectron() && <CustomTitlebar />}
                <OnboardingFlow setUser={setUser} />
              </div>
            ) : (
              <Connecting />
            )}
          </IdentityScopeProvider>
        </ErrorBoundary>
      </I18nProvider>
    </>
  );
};

export default App;
