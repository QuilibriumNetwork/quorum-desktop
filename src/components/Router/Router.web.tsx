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
import { DiscoverPage } from '@/components/discover-page';
import { BookmarksPage } from '@/components/bookmarks';
import { FarcasterPage } from '@/components/farcaster';
import { WalletPage } from '@/components/wallet';
import { RouteBoundary } from './RouteBoundary';

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
const DevMainPage = lazyDevImport(
  () => import('@/dev/DevMainPage'),
  'DevMainPage'
);
const Docs = lazyDevImport(() => import('@/dev/docs/Docs'), 'Docs');
const Issues = lazyDevImport(() => import('@/dev/docs/Issues'), 'Issues');
const Reports = lazyDevImport(() => import('@/dev/docs/Reports'), 'Reports');
const DbInspector = lazyDevImport(
  () => import('@/dev/db-inspector'),
  'DbInspector'
);
const DmDoctor = lazyDevImport(
  () => import('@/dev/dm-doctor'),
  'DmDoctor'
);
const IdentityCoverage = lazyDevImport(
  () => import('@/dev/identity-coverage'),
  'IdentityCoverage'
);
const FakeQns = lazyDevImport(() => import('@/dev/fake-qns'), 'FakeQns');
const ErrorStates = lazyDevImport(
  () => import('@/dev/error-states'),
  'ErrorStates'
);
const TypographyCompare = lazyDevImport(
  () => import('@/dev/typography-compare'),
  'TypographyCompare'
);
const DevPageLoading = lazyDevImport(
  () => import('@/dev/shell'),
  'DevPageLoading'
);

/**
 * Suspense fallback for a lazily-loaded dev page.
 *
 * Must go through `lazyDevImport` like everything else in this file: the
 * production build marks `/src/dev/` external (`web/vite.config.ts`), so a
 * static import from there would emit a bare, unresolvable import into the
 * production bundle. Loaded lazily it is simply never requested in production.
 *
 * The inner `Suspense fallback={null}` covers the shell's own chunk. It is tiny
 * and shared by every dev page, so it resolves first on a cold visit and is
 * cached for every navigation after that.
 */
const devFallback = (name: string) =>
  DevPageLoading ? (
    <Suspense fallback={null}>
      <DevPageLoading name={name} />
    </Suspense>
  ) : null;

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
                  <RouteBoundary scope="conversation">
                    <DirectMessages />
                  </RouteBoundary>
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
                  <RouteBoundary scope="conversation">
                    <DirectMessages />
                  </RouteBoundary>
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route
        path="/spaces"
        element={
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <RouteBoundary>
                    <DiscoverPage mode="spaces-empty" />
                  </RouteBoundary>
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      {/* Discover: redirect bare /discover to its default sub-page.
          /discover/people was retired 2026-06-08 (no backend enumeration);
          redirect for stale bookmarks. */}
      <Route path="/discover" element={<Navigate to="/discover/spaces" replace />} />
      <Route path="/discover/people" element={<Navigate to="/discover/spaces" replace />} />
      <Route
        path="/discover/spaces"
        element={
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <RouteBoundary>
                    <DiscoverPage />
                  </RouteBoundary>
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <RouteBoundary>
                    <BookmarksPage />
                  </RouteBoundary>
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route
        path="/farcaster"
        element={
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <RouteBoundary>
                    <FarcasterPage />
                  </RouteBoundary>
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route
        path="/wallet"
        element={
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <RouteBoundary>
                    <WalletPage />
                  </RouteBoundary>
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
                  <RouteBoundary scope="channel">
                    <Space />
                  </RouteBoundary>
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
      <Route path="/invite/" element={<InviteRoute />} />
      {process.env.NODE_ENV === 'development' && PrimitivesPlayground && (
        <Route
          path="/dev/playground"
          element={
            <Suspense fallback={devFallback('Playground')}>
              <PrimitivesPlayground />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && ComponentAuditViewer && (
        <Route
          path="/dev/audit"
          element={
            <Suspense fallback={devFallback('Component Audit')}>
              <ComponentAuditViewer />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && DevMainPage && (
        <Route
          path="/dev"
          element={
            <Suspense fallback={devFallback('Dev Tools')}>
              <DevMainPage />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && Docs && (
        <Route
          path="/dev/docs/:docId?"
          element={
            <Suspense fallback={devFallback('Documentation')}>
              <Docs />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && Issues && (
        <Route
          path="/dev/issues/:issueId?"
          element={
            <Suspense fallback={devFallback('Issues')}>
              <Issues />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && Reports && (
        <Route
          path="/dev/reports/:reportId?"
          element={
            <Suspense fallback={devFallback('Reports')}>
              <Reports />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && DbInspector && (
        <Route
          path="/dev/db-inspector"
          element={
            <Suspense fallback={devFallback('DB Inspector')}>
              <DbInspector />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && DmDoctor && (
        <Route
          path="/dev/dm-doctor"
          element={
            <Suspense fallback={devFallback('DM Doctor')}>
              <DmDoctor />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && IdentityCoverage && (
        <Route
          path="/dev/identity-coverage"
          element={
            <Suspense fallback={devFallback('Identity Coverage')}>
              <IdentityCoverage />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && FakeQns && (
        <Route
          path="/dev/fake-qns"
          element={
            <Suspense fallback={devFallback('Fake QNS')}>
              <FakeQns />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && ErrorStates && (
        <Route
          path="/dev/error-states"
          element={
            <Suspense fallback={devFallback('Error States')}>
              <ErrorStates />
            </Suspense>
          }
        />
      )}
      {process.env.NODE_ENV === 'development' && TypographyCompare && (
        <Route
          path="/dev/typography-compare"
          element={
            <Suspense fallback={devFallback('Typography Compare')}>
              <TypographyCompare />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
