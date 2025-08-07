import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ModalProvider } from '../context/ModalProvider';
import { MobileProvider } from '../context/MobileProvider';
import { SidebarProvider } from '../context/SidebarProvider';
import Layout from '../Layout';
import Space from '../space/Space';
import DirectMessages from '../direct/DirectMessages';
import Connecting from '../Connecting';
import InviteRoute from '../InviteRoute';

// Helper function for conditional dev imports
const lazyDevImport = (
  importFn: () => Promise<any>,
  exportName?: string
) =>
  process.env.NODE_ENV === 'development'
    ? React.lazy(() =>
        exportName
          ? importFn().then((m) => ({ default: m[exportName] }))
          : importFn()
      )
    : null;

// Conditionally import dev components
const PrimitivesPlayground = lazyDevImport(
  () => import('../../dev/playground/web/PrimitivesPlayground'),
  'PrimitivesPlayground'
);
const ComponentAuditViewer = lazyDevImport(
  () => import('../../dev/components-audit'),
  'ComponentAuditViewer'
);
const Elements = lazyDevImport(() => import('../../dev/Elements'));

interface RouterProps {
  user: {
    displayName: string;
    state: string;
    status: string;
    userIcon: string;
    address: string;
  };
  setUser: (user: any) => void;
}

export function Router({ user, setUser }: RouterProps) {
  return (
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
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <DirectMessages
                    setUser={setUser}
                    setAuthState={() => {
                      setUser(undefined);
                    }}
                    user={user}
                  />
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route
        path="/messages/:address"
        element={
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <DirectMessages
                    setUser={setUser}
                    setAuthState={() => {
                      setUser(undefined);
                    }}
                    user={user}
                  />
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route
        path="/spaces/:spaceId/:channelId"
        element={
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <Space
                    setUser={setUser}
                    setAuthState={() => {
                      setUser(undefined);
                    }}
                    user={user}
                  />
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route path="/invite/" element={<InviteRoute />} />
      {process.env.NODE_ENV === 'development' &&
        PrimitivesPlayground && (
          <Route
            path="/playground"
            element={
              <ModalProvider user={user} setUser={setUser}>
                <MobileProvider>
                  <Suspense
                    fallback={<div>Loading playground...</div>}
                  >
                    <PrimitivesPlayground />
                  </Suspense>
                </MobileProvider>
              </ModalProvider>
            }
          />
        )}
      {process.env.NODE_ENV === 'development' &&
        ComponentAuditViewer && (
          <Route
            path="/dev/audit"
            element={
              <Suspense
                fallback={<div>Loading audit viewer...</div>}
              >
                <ComponentAuditViewer />
              </Suspense>
            }
          />
        )}
      {process.env.NODE_ENV === 'development' &&
        Elements && (
          <Route
            path="/dev/elements"
            element={
              <Suspense fallback={<div>Loading elements...</div>}>
                <Elements />
              </Suspense>
            }
          />
        )}
    </Routes>
  );
}