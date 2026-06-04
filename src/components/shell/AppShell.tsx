import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import {
  ShellStateProvider,
  useShellState,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_SNAP_THRESHOLD,
} from './useShellState';
import { useSidebarMode } from './useSidebarMode';
import { NavRail } from './NavRail';
import { Sidebar } from './Sidebar';
import './AppShell.scss';

const HOVER_ARM_DELAY_MS = 500;
const KEYBOARD_RESIZE_STEP = 16;

// Channels mode pins the sidebar at a fixed width regardless of the user's
// persisted collapse/resize preference for the other modes. Channel names
// need a predictable amount of horizontal space to stay readable, and the
// sidebar isn't user-resizable here (drag handle is suppressed below).
// Mirrors $sidebar-width in _variables.scss.
const CHANNELS_SIDEBAR_WIDTH = 300;

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

// Hover-arm: after the cursor stays over the drag handle for HOVER_ARM_DELAY_MS,
// set data-hover-armed="true" so CSS can reveal the tinted ribbon. Movement
// resets the timer; leaving clears it. The "armed" state is exposed as a DOM
// attribute (not React state) so it doesn't trigger re-renders.
const useHoverArm = (ref: React.RefObject<HTMLElement | null>, suppress: boolean) => {
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (suppress) {
      node.setAttribute('data-hover-armed', 'true');
      // Clear on cleanup so the ribbon disappears when suppress flips off,
      // even if the cursor never leaves the handle (e.g. drag-end at max width).
      return () => {
        node.removeAttribute('data-hover-armed');
      };
    }
    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        node.setAttribute('data-hover-armed', 'true');
      }, HOVER_ARM_DELAY_MS);
    };
    const disarm = () => {
      window.clearTimeout(timer);
      node.removeAttribute('data-hover-armed');
    };
    node.addEventListener('mousemove', arm);
    node.addEventListener('mouseleave', disarm);
    return () => {
      window.clearTimeout(timer);
      node.removeAttribute('data-hover-armed');
      node.removeEventListener('mousemove', arm);
      node.removeEventListener('mouseleave', disarm);
    };
  }, [ref, suppress]);
};

const clampWidth = (px: number, minOverride?: number): number =>
  Math.max(minOverride ?? SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, px));

interface AppShellProps {
  children: React.ReactNode;
  onAddSpace: () => void;
  onCreateSpace: () => void;
}

const AppShellInner: React.FunctionComponent<AppShellProps> = ({ children, onAddSpace, onCreateSpace }) => {
  const {
    railCollapsed,
    sidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
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
  const dragHandleRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  useDrawerFocusTrap(drawerRef, isPhone && drawerOpen, closeDrawer);
  useHoverArm(dragHandleRef, isDragging);

  // Channels mode never collapses — channel names need a readable floor width.
  // The collapse preference still persists in the background for DM/Spaces modes.
  const effectiveCollapsed = sidebarMode === 'channels' ? false : sidebarCollapsed;
  // Effective floor for the sidebar in the current mode. Channels mode raises
  // the floor to CHANNELS_SIDEBAR_WIDTH; everything else uses SIDEBAR_MIN_WIDTH.
  // Used for drag clamping AND for the rendered width (via effectiveSidebarWidth
  // below) so a previously-shrunk sidebar grows up to the floor on entry.
  const minSidebarWidth =
    sidebarMode === 'channels' ? CHANNELS_SIDEBAR_WIDTH : SIDEBAR_MIN_WIDTH;
  const railToggleHandler = viewport === 'desktop' ? toggleRailCollapsed : null;
  // Drag handle is rendered on desktop whenever the sidebar is visible. In
  // channels mode the drag is clamped to the channels floor so the user can
  // expand the channels sidebar but never shrink it below the floor; the
  // snap-to-collapsed behaviour is also disabled in channels mode.
  const showDragHandle =
    viewport === 'desktop' && !sidebarHidden;

  const onDragHandleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const isChannels = sidebarMode === 'channels';
      const startX = e.clientX;
      // In channels mode the drag starts from the visible (floor-clamped)
      // width, not from the persisted sidebarWidth. Otherwise a user landing
      // in channels at the 300 floor with a saved 72 would have their first
      // drag pixel jump straight back to 72.
      const startWidth = isChannels
        ? Math.max(sidebarWidth, CHANNELS_SIDEBAR_WIDTH)
        : sidebarWidth;
      const minFloor = isChannels ? CHANNELS_SIDEBAR_WIDTH : SIDEBAR_MIN_WIDTH;
      setIsDragging(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent) => {
        const candidate = startWidth + (ev.clientX - startX);
        let next: number;
        if (isChannels) {
          // Channels: no snap-to-collapsed; clamp at the channels floor.
          next = clampWidth(candidate, CHANNELS_SIDEBAR_WIDTH);
        } else {
          // Non-channels: existing snap-zone feedback below SIDEBAR_MIN_WIDTH.
          next =
            candidate <= SIDEBAR_SNAP_THRESHOLD
              ? Math.max(SIDEBAR_COLLAPSED_WIDTH, candidate)
              : clampWidth(candidate);
        }
        setSidebarWidth(next);
      };
      const onUp = (ev: MouseEvent) => {
        const finalCandidate = startWidth + (ev.clientX - startX);
        let final: number;
        if (isChannels) {
          final = clampWidth(finalCandidate, CHANNELS_SIDEBAR_WIDTH);
        } else {
          final =
            finalCandidate <= SIDEBAR_SNAP_THRESHOLD
              ? SIDEBAR_COLLAPSED_WIDTH
              : clampWidth(finalCandidate);
        }
        setSidebarWidth(final);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setIsDragging(false);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [sidebarWidth, setSidebarWidth, sidebarMode]
  );

  const onDragHandleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isChannels = sidebarMode === 'channels';
      const floor = isChannels ? CHANNELS_SIDEBAR_WIDTH : SIDEBAR_MIN_WIDTH;
      // Operate on the visible width so the first keypress matches what the
      // user sees, even when the persisted sidebarWidth sits below the floor.
      const baseWidth = isChannels
        ? Math.max(sidebarWidth, CHANNELS_SIDEBAR_WIDTH)
        : sidebarWidth;
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowLeft':
          next = clampWidth(baseWidth - KEYBOARD_RESIZE_STEP, floor);
          break;
        case 'ArrowRight':
          next = clampWidth(baseWidth + KEYBOARD_RESIZE_STEP, floor);
          break;
        case 'Home':
          next = floor;
          break;
        case 'End':
          next = SIDEBAR_MAX_WIDTH;
          break;
        default:
          return;
      }
      e.preventDefault();
      setSidebarWidth(next);
    },
    [sidebarWidth, setSidebarWidth, sidebarMode]
  );

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
  // space channel, or one of the Discover tabs. Section-level navigation
  // (DM list, Spaces list) keeps the drawer open so the user can keep picking.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const isDmLeaf = /^\/messages\/[^/]+/.test(location.pathname);
    const isSpaceLeaf = /^\/spaces\/[^/]+\/[^/]+/.test(location.pathname);
    const isDiscoverLeaf = /^\/discover\/(spaces|people)/.test(location.pathname);
    const isHiddenSidebar = sidebarMode === 'hidden';
    if (isDmLeaf || isSpaceLeaf || isDiscoverLeaf || isHiddenSidebar) closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // Channels sidebar has a hard *floor* but no hard ceiling vs other modes:
  // if the user already has the sidebar dragged wider than the channels floor,
  // we keep that width when they enter a channel (no jump). If it's narrower
  // or collapsed, we float it up to the floor so channel names stay readable.
  // Drag below the floor is blocked while in channels (see onDragHandleMouseDown).
  const effectiveSidebarWidth =
    sidebarMode === 'channels'
      ? Math.max(sidebarWidth, CHANNELS_SIDEBAR_WIDTH)
      : sidebarWidth;

  const shellStyle = React.useMemo(
    () => ({ ['--shell-sidebar-width' as string]: `${effectiveSidebarWidth}px` }),
    [effectiveSidebarWidth]
  );
  const shellClass = `app-shell${isDragging ? ' app-shell--dragging' : ''}`;

  return (
    <div className={shellClass} style={shellStyle}>
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
        {!isPhone && !sidebarHidden && <Sidebar onAddSpace={onAddSpace} onCreateSpace={onCreateSpace} />}
        {showDragHandle && (
          <div
            ref={dragHandleRef}
            className="app-shell__drag-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label={t`Resize sidebar`}
            aria-valuenow={effectiveSidebarWidth}
            aria-valuemin={minSidebarWidth}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            tabIndex={0}
            onMouseDown={onDragHandleMouseDown}
            onKeyDown={onDragHandleKeyDown}
          />
        )}
      </aside>
      <div className="app-shell__main">{children}</div>

      {/* Phone-only: off-canvas drawer that hosts the rail + sidebar.
          The drawer trigger lives inside each view's chat header on phone
          (see DirectMessage, Channel, EmptyDirectMessage, DiscoverPage). */}
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
              {!sidebarHidden && <Sidebar onAddSpace={onAddSpace} onCreateSpace={onCreateSpace} forceExpanded />}
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
