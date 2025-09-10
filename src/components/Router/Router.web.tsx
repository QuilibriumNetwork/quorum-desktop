import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ModalProvider } from '@/components/context/ModalProvider';
import { MobileProvider } from '@/components/context/MobileProvider';
import { SidebarProvider } from '@/components/context/SidebarProvider';
import Layout from '@/components/Layout';
import Space from '@/components/space/Space';
import DirectMessages from '@/components/direct/DirectMessages';
import Connecting from '@/components/Connecting';
import InviteRoute from '@/components/InviteRoute';

// Helper function for conditional dev imports
const lazyDevImport = (
  importFn: () => Promise<any>,
  exportName?: string
) =>
  process.env.NODE_ENV === 'development'
    ? React.lazy(async () => {
        try {
          const module = await importFn();
          if (exportName && module[exportName]) {
            return { default: module[exportName] };
          }
          return module;
        } catch (error) {
          console.error(`Failed to import dev component:`, error);
          // Return a fallback component instead of failing
          return { 
            default: () => (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                Dev component failed to load: {String(error)}
              </div>
            )
          };
        }
      })
    : null;

// Dev components - web playground still available alongside mobile playground
const PrimitivesPlayground = lazyDevImport(
  () => import('@/dev/primitives-playground/PrimitivesPlayground'),
  'PrimitivesPlayground'
);
const ComponentAuditViewer = lazyDevImport(
  () => import('@/dev/components-audit'),
  'ComponentAuditViewer'
);
const DependencyAuditViewer = lazyDevImport(
  () => import('@/dev/components-audit'),
  'ComponentAuditViewer'
);
const DevMainPage = lazyDevImport(
  () => import('@/dev/DevMainPage'),
  'DevMainPage'
);
const Docs = lazyDevImport(
  () => import('@/dev/docs/Docs'),
  'Docs'
);
const Tasks = lazyDevImport(
  () => import('@/dev/docs/Tasks'),
  'Tasks'
);
const Bugs = lazyDevImport(
  () => import('@/dev/docs/Bugs'),
  'Bugs'
);

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
        DependencyAuditViewer && (
          <Route
            path="/dev/dependencies"
            element={
              <Suspense
                fallback={<div>Loading dependency analysis...</div>}
              >
                <DependencyAuditViewer />
              </Suspense>
            }
          />
        )}
      {process.env.NODE_ENV === 'development' &&
        DevMainPage && (
          <Route
            path="/dev"
            element={
              <Suspense
                fallback={<div>Loading dev tools...</div>}
              >
                <DevMainPage />
              </Suspense>
            }
          />
        )}
      {process.env.NODE_ENV === 'development' &&
        Docs && (
          <Route
            path="/dev/docs"
            element={
              <Suspense
                fallback={<div>Loading documentation...</div>}
              >
                <Docs />
              </Suspense>
            }
          />
        )}
      {process.env.NODE_ENV === 'development' &&
        Tasks && (
          <Route
            path="/dev/tasks"
            element={
              <Suspense
                fallback={<div>Loading tasks...</div>}
              >
                <Tasks />
              </Suspense>
            }
          />
        )}
      {process.env.NODE_ENV === 'development' &&
        Bugs && (
          <Route
            path="/dev/bugs"
            element={
              <Suspense
                fallback={<div>Loading bug reports...</div>}
              >
                <Bugs />
              </Suspense>
            }
          />
        )}
    </Routes>
  );
}