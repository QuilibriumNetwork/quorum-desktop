import React, { Suspense } from 'react';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import {
  channel_raw,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';

import Connecting from './components/Connecting';
import CustomTitlebar from './components/Titlebar';
import { Login } from './components/onboarding/Login';
import { Onboarding } from './components/onboarding/Onboarding';
import { Maintenance } from './components/Maintenance';
import { RegistrationProvider } from './components/context/RegistrationPersister';
import { ResponsiveLayoutProvider } from './components/context/ResponsiveLayoutProvider';
import { Router } from './components/Router';
import { isElectron, isWeb } from './utils/platform';
import { DefaultImages } from './utils';
import { i18n } from './i18n';
import { I18nProvider } from '@lingui/react';
import { useContextMenuPrevention } from './hooks/useContextMenuPrevention';

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
    console.log(error);
    console.log(info);
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
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              {isWeb() && isElectron() && <CustomTitlebar />}
              <Maintenance />
            </div>
          }
        >
          {isDevRoute ? (
            <div className="bg-app flex flex-col min-h-screen text-main">
              {isWeb() && isElectron() && <CustomTitlebar />}
              <Router user={user} setUser={setUser} />
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
          ) : landing && !currentPasskeyInfo ? (
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              {isWeb() && isElectron() && <CustomTitlebar />}
              <Routes>
                <Route path="/" element={<Login setUser={setUser} />} />
                <Route path="/*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          ) : landing ? (
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              {isWeb() && isElectron() && <CustomTitlebar />}
              <Routes>
                <Route path="/" element={<Onboarding setUser={setUser} />} />
                <Route path="/*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          ) : (
            <Connecting />
          )}
        </ErrorBoundary>
      </I18nProvider>
    </>
  );
};

export default App;
