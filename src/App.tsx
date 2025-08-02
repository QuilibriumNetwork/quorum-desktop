import React, { Suspense } from 'react';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import {
  channel_raw,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';

import Layout from './components/Layout';
import { ModalProvider } from './components/context/ModalProvider';
import { MobileProvider } from './components/context/MobileProvider';
import { SidebarProvider } from './components/context/SidebarProvider';
import Space from './components/space/Space';
import Connecting from './components/Connecting';
import CustomTitlebar from './components/Titlebar';
import { Login } from './components/onboarding/Login';
import { Onboarding } from './components/onboarding/Onboarding';
import DirectMessages from './components/direct/DirectMessages';
import { Maintenance } from './components/Maintenance';
import { RegistrationProvider } from './components/context/RegistrationPersister';
import { ResponsiveLayoutProvider } from './components/context/ResponsiveLayoutProvider';
// Conditionally import playground in development mode
const PrimitivesPlayground = process.env.NODE_ENV === 'development'
  ? React.lazy(() => import('./dev/playground/web/PrimitivesPlayground').then(m => ({ default: m.PrimitivesPlayground })))
  : null;

// Conditionally import dev tools in development mode
const ComponentAuditViewer = process.env.NODE_ENV === 'development'
  ? React.lazy(() => import('./dev/components-audit').then(m => ({ default: m.ComponentAuditViewer })))
  : null;
const Elements = process.env.NODE_ENV === 'development'
  ? React.lazy(() => import('./dev/Elements'))
  : null;
import JoinSpaceModal from './components/modals/JoinSpaceModal';
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


  return (
    <>
      <I18nProvider i18n={i18n}>
        <ErrorBoundary
          fallback={
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              {
                // @ts-ignore
                window.electron && <CustomTitlebar />
              }
              <Maintenance />
            </div>
          }
        >
          {user && currentPasskeyInfo ? (
            <div className="bg-app flex flex-col min-h-screen text-main">
              {
                // @ts-ignore
                window.electron && <CustomTitlebar />
              }
              <Suspense fallback={<Connecting />}>
                <RegistrationProvider>
                  <ResponsiveLayoutProvider>
                    <ModalProvider user={user} setUser={setUser}>
                      <MobileProvider>
                        <SidebarProvider>
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
                            <Layout
                              kickUserAddress={kickUserAddress}
                              setKickUserAddress={setKickUserAddress}
                            >
                              <DirectMessages
                                setUser={setUser}
                                setAuthState={() => {
                                  setUser(undefined);
                                }}
                                user={user}
                              />
                            </Layout>
                          }
                        />
                        <Route
                          path="/messages/:address"
                          element={
                            <Layout
                              kickUserAddress={kickUserAddress}
                              setKickUserAddress={setKickUserAddress}
                            >
                              <DirectMessages
                                setUser={setUser}
                                setAuthState={() => {
                                  setUser(undefined);
                                }}
                                user={user}
                              />
                            </Layout>
                          }
                        />
                        <Route
                          path="/spaces/:spaceId/:channelId"
                          element={
                            <Layout
                              kickUserAddress={kickUserAddress}
                              setKickUserAddress={setKickUserAddress}
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
                            </Layout>
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
                        {process.env.NODE_ENV === 'development' && PrimitivesPlayground && (
                          <Route
                            path="/playground"
                            element={
                              <ModalProvider user={user} setUser={setUser}>
                              <MobileProvider>
                                <SidebarProvider>
                                  <Layout
                                    kickUserAddress={kickUserAddress}
                                    setKickUserAddress={setKickUserAddress}
                                  >
                                    <Suspense fallback={<div>Loading playground...</div>}>
                                      <PrimitivesPlayground />
                                    </Suspense>
                                  </Layout>
                                </SidebarProvider>
                              </MobileProvider>
                            </ModalProvider>
                            }
                          />
                        )}
                        {process.env.NODE_ENV === 'development' && ComponentAuditViewer && (
                          <Route
                            path="/dev/audit"
                            element={
                              <Suspense fallback={<div>Loading audit viewer...</div>}>
                                <ComponentAuditViewer />
                              </Suspense>
                            }
                          />
                        )}
                        {process.env.NODE_ENV === 'development' && Elements && (
                          <Route
                            path="/elements"
                            element={
                              <Suspense fallback={<div>Loading Elements...</div>}>
                                <Elements />
                              </Suspense>
                            }
                          />
                        )}
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
                        </SidebarProvider>
                      </MobileProvider>
                    </ModalProvider>
                  </ResponsiveLayoutProvider>
                </RegistrationProvider>
              </Suspense>
            </div>
          ) : landing && !currentPasskeyInfo ? (
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              {
                // @ts-ignore
                window.electron && <CustomTitlebar />
              }
              <Routes>
                <Route path="/" element={<Login setUser={setUser} />} />
                <Route path="/*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          ) : landing ? (
            <div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
              {
                // @ts-ignore
                window.electron && <CustomTitlebar />
              }
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
  kickUserAddress: string | undefined;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
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
    <div className="min-h-screen w-full">
      <JoinSpaceModal visible={true} onClose={handleClose} />
      <ModalProvider>
        <MobileProvider>
          <SidebarProvider>
            <Layout
              kickUserAddress={kickUserAddress}
              setKickUserAddress={setKickUserAddress}
            >
              <div />
            </Layout>
          </SidebarProvider>
        </MobileProvider>
      </ModalProvider>
    </div>
  );
};

export default App;
