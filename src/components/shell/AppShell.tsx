import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { ShellStateProvider, useShellState } from './useShellState';
import { useSidebarMode } from './useSidebarMode';
import { NavRail } from './NavRail';
import { Sidebar } from './Sidebar';
import './AppShell.scss';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Focus trap for the phone drawer. Autofocuses the first focusable element on
// mount, cycles Tab/Shift+Tab within the dialog, and calls onEscape on Esc.
const useDrawerFocusTrap = (
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void
) => {
  React.useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('inert') && el.offsetParent !== null
      );

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === firstEl || !node.contains(activeEl)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (activeEl === lastEl || !node.contains(activeEl)) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [ref, active, onEscape]);
};

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
  const drawerRef = React.useRef<HTMLDivElement>(null);
  useDrawerFocusTrap(drawerRef, isPhone && drawerOpen, closeDrawer);

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
          <div
            ref={drawerRef}
            className="app-shell__drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t`Navigation`}
          >
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
