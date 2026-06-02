import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { ShellStateProvider, useShellState } from './useShellState';
import { useSidebarMode } from './useSidebarMode';
import { NavRail } from './NavRail';
import { Sidebar } from './Sidebar';
import './AppShell.scss';

interface AppShellProps {
  children: React.ReactNode;
  onAddSpace: () => void;
}

const AppShellInner: React.FunctionComponent<AppShellProps> = ({ children, onAddSpace }) => {
  const {
    railCollapsed,
    sidebarCollapsed,
    toggleRailCollapsed,
    viewport,
    drawerOpen,
    closeDrawer,
  } = useShellState();
  const sidebarMode = useSidebarMode();
  const sidebarHidden = sidebarMode === 'hidden';
  const isPhone = viewport === 'phone';
  const location = useLocation();

  // Channels mode never collapses — channel names need full width to be readable.
  // The collapse preference still persists in the background for DM/Spaces modes.
  const effectiveCollapsed = sidebarMode === 'channels' ? false : sidebarCollapsed;
  const railToggleHandler = viewport === 'desktop' ? toggleRailCollapsed : null;

  // Phone: rail + sidebar are hidden inline; their content lives in the drawer.
  const railSlotClass = isPhone
    ? 'app-shell__rail--hidden'
    : railCollapsed
      ? 'app-shell__rail--collapsed'
      : 'app-shell__rail--expanded';

  const sidebarSlotClass = (isPhone || sidebarHidden)
    ? 'app-shell__sidebar--hidden'
    : effectiveCollapsed
      ? 'app-shell__sidebar--collapsed'
      : 'app-shell__sidebar--expanded';

  // Auto-close the drawer when the user lands on a destination that doesn't
  // need further browsing inside the drawer: a specific DM conversation, a
  // space channel, or Public spaces (which renders its own full-page content).
  // Section-level navigation (DM list, Spaces list) keeps the drawer open.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const isDmLeaf = /^\/messages\/[^/]+/.test(location.pathname);
    const isSpaceLeaf = /^\/spaces\/[^/]+\/[^/]+/.test(location.pathname);
    const isPublicSpaces = sidebarMode === 'hidden';
    if (isDmLeaf || isSpaceLeaf || isPublicSpaces) closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return (
    <div className="app-shell">
      <aside
        className={`app-shell__rail ${railSlotClass}`}
        aria-hidden={isPhone}
      >
        {!isPhone && <NavRail collapsed={railCollapsed} onToggleCollapse={railToggleHandler} />}
      </aside>
      <aside
        className={`app-shell__sidebar ${sidebarSlotClass}`}
        aria-label="Section sidebar"
        aria-hidden={isPhone || sidebarHidden}
      >
        {!isPhone && !sidebarHidden && <Sidebar onAddSpace={onAddSpace} />}
      </aside>
      <div className="app-shell__main">{children}</div>

      {/* Phone-only: off-canvas drawer that hosts the rail + sidebar.
          The drawer trigger lives inside each view's chat header on phone
          (see DirectMessage, Channel, EmptyDirectMessage, SpacesPage). */}
      {isPhone && drawerOpen && (
        <>
          <div
            className="app-shell__drawer-scrim"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div className="app-shell__drawer" role="dialog" aria-label={t`Navigation`}>
            <div className="app-shell__drawer-rail">
              <NavRail collapsed={true} onToggleCollapse={null} />
            </div>
            <div className="app-shell__drawer-sidebar">
              {!sidebarHidden && <Sidebar onAddSpace={onAddSpace} forceExpanded />}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * 3-column UI shell: NavRail + contextual Sidebar + main content area.
 * The ShellStateProvider wraps the tree so rail/sidebar collapse state is
 * shared between every consumer (AppShell itself, NavRail, SpacesSidebar, etc.).
 */
export const AppShell: React.FunctionComponent<AppShellProps> = (props) => {
  return (
    <ShellStateProvider>
      <AppShellInner {...props} />
    </ShellStateProvider>
  );
};

export default AppShell;
