import React, { Suspense } from 'react';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import {
  channel_raw,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';

import Layout from './components/Layout';
import { AppWithSearch } from './components/AppWithSearch';
import Space from './components/space/Space';
import Connecting from './components/Connecting';
import CustomTitlebar from './components/Titlebar';
import { Login } from './components/onboarding/Login';
import { Onboarding } from './components/onboarding/Onboarding';
import DirectMessages from './components/direct/DirectMessages';
import { Maintenance } from './components/Maintenance';
import { RegistrationProvider } from './components/context/RegistrationPersister';
import { ResponsiveLayoutProvider } from './components/context/ResponsiveLayoutProvider';
import { PrimitivesPlayground } from './playground/web/PrimitivesPlayground';
import JoinSpaceModal from './components/modals/JoinSpaceModal';
import Elements from './components/Elements';
import { DefaultImages } from './utils';
import { i18n } from './i18n';
import { I18nProvider } from '@lingui/react';

window.Buffer = Buffer;

class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
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
  const [kickUserAddress, setKickUserAddress] = useState<string>();

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

  // Conditional return must come after all hooks
  const isElementsPage = window.location.pathname === '/elements';
  if (isElementsPage) return <Elements />;

  return (
    <>
      <I18nProvider i18n={i18n}>
        {
          // @ts-ignore
          window.electron && <CustomTitlebar />
        }
        <ErrorBoundary
          fallback={
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              <Maintenance />
            </div>
          }
        >
          {user && currentPasskeyInfo ? (
            <div className="bg-app flex flex-col min-h-screen text-main">
              <Suspense fallback={<Connecting />}>
                <RegistrationProvider>
                  <ResponsiveLayoutProvider>
                    <Suspense>
                      <Routes>
                        <Route
                          path="/"
                          element={
                            <>
                              <Connecting />
                              {user && (
                                <Navigate
                                  to="/messages"
                                  state={{ from: '/' }}
                                  replace
                                />
                              )}
                            </>
                          }
                        />
                        <Route
                          path="/messages"
                          element={
                            <AppWithSearch
                              kickUserAddress={kickUserAddress}
                              setKickUserAddress={setKickUserAddress}
                              user={user}
                              setUser={setUser}
                            >
                              <DirectMessages
                                setUser={setUser}
                                setAuthState={() => {
                                  setUser(undefined);
                                }}
                                user={user}
                              />
                            </AppWithSearch>
                          }
                        />
                        <Route
                          path="/messages/:address"
                          element={
                            <AppWithSearch
                              kickUserAddress={kickUserAddress}
                              setKickUserAddress={setKickUserAddress}
                              user={user}
                              setUser={setUser}
                            >
                              <DirectMessages
                                setUser={setUser}
                                setAuthState={() => {
                                  setUser(undefined);
                                }}
                                user={user}
                              />
                            </AppWithSearch>
                          }
                        />
                        <Route
                          path="/spaces/:spaceId/:channelId"
                          element={
                            <AppWithSearch
                              kickUserAddress={kickUserAddress}
                              setKickUserAddress={setKickUserAddress}
                              user={user}
                              setUser={setUser}
                            >
                              <Space
                                setUser={setUser}
                                setAuthState={() => {
                                  setUser(undefined);
                                }}
                                kickUserAddress={kickUserAddress}
                                setKickUserAddress={setKickUserAddress}
                                user={user}
                              />
                            </AppWithSearch>
                          }
                        />
                        <Route
                          path="/invite/"
                          element={
                            <InviteRoute
                              kickUserAddress={kickUserAddress}
                              setKickUserAddress={setKickUserAddress}
                            />
                          }
                        />
                        <Route
                          path="/playground"
                          element={
                            <AppWithSearch
                              kickUserAddress={kickUserAddress}
                              setKickUserAddress={setKickUserAddress}
                              user={user}
                              setUser={setUser}
                            >
                              <PrimitivesPlayground />
                            </AppWithSearch>
                          }
                        />
                        <Route
                          path="/*"
                          element={
                            <Navigate
                              to="/messages"
                              state={{ from: '/' }}
                              replace
                            />
                          }
                        />
                      </Routes>
                    </Suspense>
                  </ResponsiveLayoutProvider>
                </RegistrationProvider>
              </Suspense>
            </div>
          ) : landing && !currentPasskeyInfo ? (
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              <Routes>
                <Route path="/" element={<Login setUser={setUser} />} />
                <Route path="/*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          ) : landing ? (
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
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

const InviteRoute: React.FC<{
  kickUserAddress: string;
  setKickUserAddress: (addr: string) => void;
}> = ({ kickUserAddress, setKickUserAddress }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    // Check if there's meaningful browser history to go back to
    if (window.history.length > 1 && document.referrer) {
      // There's previous history and a referrer, safe to go back
      window.history.back();
    } else {
      // No meaningful history or came directly to this page, go to messages
      navigate('/messages');
    }
  };

  return (
    <div className="app-with-search">
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur">
        <JoinSpaceModal visible={true} onClose={handleClose} />
        <div className="fixed inset-0 -z-10" onClick={handleClose} />
      </div>

      <AppWithSearch
        kickUserAddress={kickUserAddress}
        setKickUserAddress={setKickUserAddress}
      >
        <div />
      </AppWithSearch>
    </div>
  );
};

export default App;
