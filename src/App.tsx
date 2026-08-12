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
import { IdentityScopeProvider } from './identity';
import { useRootIdentityScope } from './hooks/business/identity';

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
  // Real data for the root <IdentityScopeProvider> below — see
  // useRootIdentityScope's own docstring for why this is a non-suspense
  // read (this component wraps every branch, including the ones rendered
  // before login) and .agents/docs/features/identity-resolution-and-profile-sync.md
  // for the bug this closes: Kick/Mute/Block confirmations (ModalProvider,
  // above every Space/DM provider) used to see a permanently empty roster
  // here regardless of which space they were acting in.
  const { rostersBySpace: rootRostersBySpace, locallyKnownNames: rootLocalNames } =
    useRootIdentityScope(currentPasskeyInfo?.address, currentPasskeyInfo?.displayName);
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
    window.location.pathname.startsWith('/dev');

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
              route" throw in identityProvider.tsx. No spaceId — the global
              ladder applies by default. Nested providers (Channel,
              DirectMessage, Bookmarks, notifications...) still mount below
              and override with more tightly scoped roster/local-name data;
              this one is the backstop for surfaces that render from an
              app-level host with NO provider of their own (Kick/Mute/Block
              confirmations — ModalProvider sits above every Space/DM
              provider, see Router.web.tsx) — which is why it can no longer
              ship with a permanently empty roster (see
              useRootIdentityScope's docstring and
              .agents/docs/features/identity-resolution-and-profile-sync.md).
              selfAddress comes from currentPasskeyInfo, the ONLY place the
              address is known before a user record even exists — the self
              tier itself resolves from the public profile fetched here
              first, the device displayName only as the LAST resort
              (`rootLocalNames`, via `selfLocalNameEntry`) — never from
              currentPasskeyInfo's fields directly, and never a source of a
              `.q`. */}
          <IdentityScopeProvider
            rostersBySpace={rootRostersBySpace}
            selfAddress={currentPasskeyInfo?.address ?? null}
            locallyKnownNames={rootLocalNames}
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
