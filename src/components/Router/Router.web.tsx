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
import NotFound from '@/components/NotFound';

class RouteErrorBoundary extends React.Component<
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
    console.error('Route error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Helper function for conditional dev imports
const lazyDevImport = (importFn: () => Promise<any>, exportName?: string) =>
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
            ),
          };
        }
      })
    : null;

// Dev components - only loaded in development
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
const Docs = lazyDevImport(() => import('@/dev/docs/Docs'), 'Docs');
const Tasks = lazyDevImport(() => import('@/dev/docs/Tasks'), 'Tasks');
const Bugs = lazyDevImport(() => import('@/dev/docs/Bugs'), 'Bugs');
const Reports = lazyDevImport(() => import('@/dev/docs/Reports'), 'Reports');
const DbInspector = lazyDevImport(
  () => import('@/dev/db-inspector'),
  'DbInspector'
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
            {user && <Navigate to="/messages" state={{ from: '/' }} replace />}
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
                  <DirectMessages />
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
                  <DirectMessages />
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
                  <RouteErrorBoundary fallback={<Navigate to="/" replace />}>
                    <Space />
                  </RouteErrorBoundary>
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route path="/invite/" element={<InviteRoute />} />
      {process.env.NODE_ENV === 'development' && PrimitivesPlayground && (
        <Route
          path="/playground"
          element={
            <Suspense fallback={<div>Loading playground...</div>}>
              <PrimitivesPlayground />
            </Suspense>
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
      {process.env.NODE_ENV === 'development' && DependencyAuditViewer && (
        <Route
          path="/dev/dependencies"
          element={
            <Suspense fallback={<div>Loading dependency analysis...</div>}>
              <DependencyAuditViewer />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && DevMainPage && (
        <Route
          path="/dev"
          element={
            <Suspense fallback={<div>Loading dev tools...</div>}>
              <DevMainPage />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && Docs && (
        <Route
          path="/dev/docs/:docId?"
          element={
            <Suspense fallback={<div>Loading documentation...</div>}>
              <Docs />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && Tasks && (
        <Route
          path="/dev/tasks/:taskId?"
          element={
            <Suspense fallback={<div>Loading tasks...</div>}>
              <Tasks />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && Bugs && (
        <Route
          path="/dev/bugs/:bugId?"
          element={
            <Suspense fallback={<div>Loading bug reports...</div>}>
              <Bugs />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && Reports && (
        <Route
          path="/dev/reports/:reportId?"
          element={
            <Suspense fallback={<div>Loading reports...</div>}>
              <Reports />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && DbInspector && (
        <Route
          path="/dev/db-inspector"
          element={
            <Suspense fallback={<div>Loading DB inspector...</div>}>
              <DbInspector />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
