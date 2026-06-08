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
  CHANNELS_SIDEBAR_FLOOR,
} from './useShellState';
import { useSidebarMode } from './useSidebarMode';
import { NavRail } from './NavRail';
import { Sidebar } from './Sidebar';
import './AppShell.scss';

const HOVER_ARM_DELAY_MS = 500;
const KEYBOARD_RESIZE_STEP = 16;

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
    channelsFloored,
    dragWidth,
    setSidebarWidth,
    setChannelsFloored,
    setSidebarCollapsed,
    setDragWidth,
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
  const isDragging = dragWidth !== null;
  useDrawerFocusTrap(drawerRef, isPhone && drawerOpen, closeDrawer);
  useHoverArm(dragHandleRef, isDragging);

  const isChannels = sidebarMode === 'channels';
  const railToggleHandler = viewport === 'desktop' ? toggleRailCollapsed : null;
  const showDragHandle = viewport === 'desktop' && !sidebarHidden;

  // Resting (non-drag) effective width: channels uses CHANNELS_SIDEBAR_FLOOR
  // when floored and sidebarWidth (lifted to the channels floor) otherwise.
  // DM/Spaces uses SIDEBAR_COLLAPSED_WIDTH when collapsed and sidebarWidth otherwise.
  const restingSidebarWidth = isChannels
    ? channelsFloored
      ? CHANNELS_SIDEBAR_FLOOR
      : Math.max(sidebarWidth, CHANNELS_SIDEBAR_FLOOR)
    : sidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : sidebarWidth;
  // While dragging, the on-screen width follows the cursor (via dragWidth);
  // otherwise it's the resting width from the model.
  const effectiveSidebarWidth = dragWidth ?? restingSidebarWidth;
  // Floor for the drag handle ARIA attributes (the lowest width this mode can render).
  const minSidebarWidth = isChannels ? CHANNELS_SIDEBAR_FLOOR : SIDEBAR_COLLAPSED_WIDTH;

  const onDragHandleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = restingSidebarWidth;
      setDragWidth(startWidth);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      // During drag we maintain dragWidth (local state) so the sidebar tracks
      // the cursor in real time. We don't touch sidebarWidth / flags during
      // drag — those get committed on release based on where the user lands.
      const onMove = (ev: MouseEvent) => {
        const candidate = startWidth + (ev.clientX - startX);
        if (isChannels) {
          // Channels: clamp at the channels floor for visual feedback.
          setDragWidth(clampWidth(candidate, CHANNELS_SIDEBAR_FLOOR));
        } else {
          // DM/Spaces: below the snap threshold, visual width follows down to
          // the collapsed strip (clamped to >= SIDEBAR_COLLAPSED_WIDTH).
          // Above the threshold, clamp to [SIDEBAR_MIN_WIDTH, MAX].
          if (candidate <= SIDEBAR_SNAP_THRESHOLD) {
            setDragWidth(Math.max(SIDEBAR_COLLAPSED_WIDTH, candidate));
          } else {
            setDragWidth(clampWidth(candidate));
          }
        }
      };
      const onUp = (ev: MouseEvent) => {
        const finalCandidate = startWidth + (ev.clientX - startX);
        if (isChannels) {
          const clamped = clampWidth(finalCandidate, CHANNELS_SIDEBAR_FLOOR);
          if (clamped <= CHANNELS_SIDEBAR_FLOOR) {
            // Landed at the floor — flip the floor flag (which also collapses DM/Spaces).
            setChannelsFloored(true);
          } else {
            // Landed above the floor — clear floor flag and persist as free width.
            setChannelsFloored(false);
            setSidebarWidth(clamped);
          }
        } else {
          if (finalCandidate <= SIDEBAR_SNAP_THRESHOLD) {
            // Snap to collapsed; preserve the persisted "free width" untouched.
            setSidebarCollapsed(true);
          } else {
            setSidebarCollapsed(false);
            setSidebarWidth(clampWidth(finalCandidate));
          }
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDragWidth(null);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [restingSidebarWidth, isChannels, setSidebarWidth, setChannelsFloored, setSidebarCollapsed, setDragWidth]
  );

  const onDragHandleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const floor = isChannels ? CHANNELS_SIDEBAR_FLOOR : SIDEBAR_MIN_WIDTH;
      const baseWidth = effectiveSidebarWidth;
      let next: number;
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
      if (isChannels) {
        if (next <= CHANNELS_SIDEBAR_FLOOR) {
          setChannelsFloored(true);
        } else {
          setChannelsFloored(false);
          setSidebarWidth(next);
        }
      } else {
        // Keyboard never snap-to-collapses (no SIDEBAR_SNAP_THRESHOLD logic);
        // SIDEBAR_MIN_WIDTH is the keyboard floor for DM/Spaces.
        setSidebarCollapsed(false);
        setSidebarWidth(next);
      }
    },
    [effectiveSidebarWidth, isChannels, setSidebarWidth, setChannelsFloored, setSidebarCollapsed]
  );

  // Phone: rail + sidebar are hidden inline; their content lives in the drawer.
  const railSlotClass = isPhone
    ? 'app-shell__rail--hidden'
    : railCollapsed
      ? 'app-shell__rail--collapsed'
      : 'app-shell__rail--expanded';

  // --collapsed class is only used by DM/Spaces (it locks width to 72px in CSS).
  // Channels mode renders via --expanded with --shell-sidebar-width = CHANNELS_SIDEBAR_FLOOR
  // when floored, so the slot picks up the floor width from the CSS variable.
  // During drag we always use --expanded so the live dragWidth drives the slot.
  const sidebarSlotClass = (isPhone || sidebarHidden)
    ? 'app-shell__sidebar--hidden'
    : (!isChannels && sidebarCollapsed && !isDragging)
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
