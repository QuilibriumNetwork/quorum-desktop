import React, { Suspense } from 'react';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import {
  channel_raw,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';

import Layout from './components/Layout';
import Space from './components/space/Space';
import Connecting from './components/Connecting';
import CustomTitlebar from './components/Titlebar';
import { Login } from './components/onboarding/Login';
import { Onboarding } from './components/onboarding/Onboarding';
import DirectMessages from './components/direct/DirectMessages';
import { Maintenance } from './components/Maintenance';
import { RegistrationProvider } from './components/context/RegistrationPersister';
import JoinSpaceModal from './components/modals/JoinSpaceModal';
import Elements from './components/Elements';


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

  const isElementsPage = window.location.pathname === '/elements';
  if (isElementsPage) return <Elements />;

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
        userIcon: currentPasskeyInfo.pfpUrl ?? '/unknown.png',
        address: currentPasskeyInfo.address,
      });
    }
  }, [currentPasskeyInfo, passkeyRegistrationComplete, setUser, user]);

  return (
    <>
      {
        // @ts-ignore
        window.electron && <CustomTitlebar />
      }
      <ErrorBoundary
        fallback={
          <div className="bg-primary--accent--noise flex flex-col min-h-screen text-text-base">
            <Maintenance />
          </div>
        }
      >
        {user && currentPasskeyInfo ? (
          <div className="bg-[var(--surface-00)] flex flex-col min-h-screen text-text-base">
            <Suspense fallback={<Connecting />}>
              <RegistrationProvider>
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
                      path="/messages/new"
                      element={
                        <Layout
                          newDirectMessage
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
                        <Layout
                          kickUserAddress={kickUserAddress}
                          setKickUserAddress={setKickUserAddress}
                        >
                          <JoinSpaceModal visible={true} onClose={() => {}} />
                        </Layout>
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
              </RegistrationProvider>
            </Suspense>
          </div>
        ) : landing && !currentPasskeyInfo ? (
          <div className="bg-primary--accent--noise flex flex-col min-h-screen text-text-base">
            <Routes>
              <Route path="/" element={<Login setUser={setUser} />} />
              <Route path="/*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        ) : landing ? (
          <div className="bg-primary--accent--noise flex flex-col min-h-screen text-text-base">
            <Routes>
              <Route path="/" element={<Onboarding setUser={setUser} />} />
              <Route path="/*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        ) : (
          <Connecting />
        )}
      </ErrorBoundary>
    </>
  );
};

export default App;
