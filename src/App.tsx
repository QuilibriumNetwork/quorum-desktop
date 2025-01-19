import React, { Suspense } from 'react';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { channel_raw, usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

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
    <div className="flex flex-col h-[100vh]">
      {
        // @ts-ignore
        window.electron && <CustomTitlebar />
      }
      <ErrorBoundary fallback={<Maintenance />}>
        {user && currentPasskeyInfo ? (
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
                      <Layout>
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
                      <Layout newDirectMessage>
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
                      <Layout>
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
                      <Layout>
                        <Space
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
                    path="/invite/"
                    element={
                      <Layout>
                        <JoinSpaceModal visible={true} onClose={() => {}} />
                      </Layout>
                    }
                  />
                  <Route
                    path="/*"
                    element={
                      <Navigate to="/messages" state={{ from: '/' }} replace />
                    }
                  />
                </Routes>
              </Suspense>
            </RegistrationProvider>
          </Suspense>
        ) : landing && !currentPasskeyInfo ? (
          <Routes>
            <Route path="/" element={<Login setUser={setUser} />} />
            <Route path="/*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : landing ? (
          <Routes>
            <Route path="/" element={<Onboarding setUser={setUser} />} />
            <Route path="/*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Connecting />
        )}
      </ErrorBoundary>
    </div>
  );
};

export default App;
