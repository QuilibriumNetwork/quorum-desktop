import React, { Suspense, createContext, useContext } from 'react';
import { Buffer } from 'buffer';
import { Navigate, Route, Routes } from 'react-router';

import Layout from './components/Layout';
import Space from './components/space/Space';
import Connecting from './components/Connecting';
import CustomTitlebar from './components/Titlebar';
import { Login } from './components/onboarding/Login';
import { Onboarding } from './components/onboarding/Onboarding';
import DirectMessages from './components/direct/DirectMessages';
import JoinSpaceModal from './components/modals/JoinSpaceModal';

window.Buffer = Buffer;

// ---- FAKE CONTEXT OVERRIDE ----
const FakePasskeysContext = createContext<any>({
  currentPasskeyInfo: {
    completedOnboarding: true,
    address: '0x123',
    displayName: 'Test User',
    pfpUrl: '/unknown.png',
    deviceKeyset: {
      publicKey: '0xdeadbeef',
      keyId: 'mock-key',
      algorithm: 'ECDSA',
    },
  },
  passkeyRegistrationComplete: true,
});

const FakePasskeysProvider = ({ children }: { children: React.ReactNode }) => (
  <FakePasskeysContext.Provider value={FakePasskeysContext._currentValue}>
    {children}
  </FakePasskeysContext.Provider>
);

// Override usePasskeysContext globally
export const usePasskeysContext = () => useContext(FakePasskeysContext);

// Stub registration provider to skip API calls
const FakeRegistrationProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

// --------------------------------

const App = () => {
  const user = {
    displayName: 'Test User',
    state: 'online',
    status: 'Styling Mode',
    userIcon: '/unknown.png',
    address: '0x123',
  };

  const kickUserAddress = undefined;
  const setKickUserAddress = () => {};

  return (
    <div className="flex flex-col h-[100vh]">
      {
        // @ts-ignore
        window.electron && <CustomTitlebar />
      }
      <Suspense fallback={<Connecting />}>
        <FakePasskeysProvider>
          <FakeRegistrationProvider>
            <Suspense>
              <Routes>
                <Route
                  path="/"
                  element={
                    <>
                      <Connecting />
                      <Navigate to="/messages" state={{ from: '/' }} replace />
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
                        setUser={() => {}}
                        setAuthState={() => {}}
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
                        setUser={() => {}}
                        setAuthState={() => {}}
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
                        setUser={() => {}}
                        setAuthState={() => {}}
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
                        setUser={() => {}}
                        setAuthState={() => {}}
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
                    <Navigate to="/messages" state={{ from: '/' }} replace />
                  }
                />
              </Routes>
            </Suspense>
          </FakeRegistrationProvider>
        </FakePasskeysProvider>
      </Suspense>
    </div>
  );
};

export default App;
