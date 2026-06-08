import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { logger } from '@quilibrium/quorum-shared';

const STORAGE_KEY_RAIL = 'shell.railCollapsed';
const STORAGE_KEY_SIDEBAR = 'shell.sidebarCollapsed';
const STORAGE_KEY_SIDEBAR_WIDTH = 'shell.sidebarWidth';
const STORAGE_KEY_LAST_FREE_WIDTH = 'shell.lastFreeWidth';
const STORAGE_KEY_CHANNELS_FLOORED = 'shell.channelsFloored';

const DEFAULT_RAIL_COLLAPSED = true;
const DEFAULT_SIDEBAR_COLLAPSED = false;

// Sidebar width bounds. SIDEBAR_COLLAPSED_WIDTH must match $sidebar-width-collapsed
// in _variables.scss; DEFAULT_SIDEBAR_WIDTH should match $sidebar-width.
export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_SNAP_THRESHOLD = 200;
const DEFAULT_SIDEBAR_WIDTH = 280;

// Channels mode has a narrower minimum than DM/Spaces — at this width channel
// names truncate heavily but the list is still navigable. Channels cannot
// fully collapse (would defeat the purpose of being in a channel).
export const CHANNELS_SIDEBAR_FLOOR = 144;

// Viewport breakpoints — mirror $screen-md / $screen-lg in _variables.scss.
const PHONE_MAX = 767;
const TABLET_MAX = 1023;

export type ShellViewport = 'phone' | 'tablet' | 'desktop';

export interface ShellState {
  railCollapsed: boolean;
  /** Persisted: true when DM/Spaces sidebar is in its collapsed (72px) state. */
  sidebarCollapsed: boolean;
  /** Persisted "free width" — what the sidebar shows when not minimized.
   *  Range: [SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH]. Same value used by all modes. */
  sidebarWidth: number;
  /** Persisted: true when the user has dragged the channels sidebar down to the
   *  floor (CHANNELS_SIDEBAR_FLOOR). Setting true also collapses DM/Spaces. */
  channelsFloored: boolean;
  /** Live drag width (null when not dragging). Sidebar consumers should derive
   *  their layout from `sidebarLiveCollapsed` instead of `sidebarCollapsed` so
   *  they re-render the expanded layout as the user drags past the threshold. */
  dragWidth: number | null;
  /** Live "should I render the collapsed (icons-only) layout?" — during drag,
   *  this follows the on-screen width; at rest, it equals `sidebarCollapsed`. */
  sidebarLiveCollapsed: boolean;
  setRailCollapsed: (v: boolean) => void;
  toggleRailCollapsed: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebarCollapsed: () => void;
  /** Set the shared "free width". Caller clamps. Persists across all modes. */
  setSidebarWidth: (px: number) => void;
  /** Set the channels-floored flag. true also collapses DM/Spaces; false does
   *  NOT auto-expand DM/Spaces (asymmetric — see docs/responsive-layout.md). */
  setChannelsFloored: (v: boolean) => void;
  /** Set the live drag width. AppShell calls this from its drag handlers. */
  setDragWidth: (px: number | null) => void;

  /** Derived viewport bucket — recomputed on resize. */
  viewport: ShellViewport;
  /** Phone-only: whether the slide-in drawer is open. Auto-closed on resize up. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const readBool = (key: string, fallback: boolean): boolean => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch (e) {
    logger.warn(`useShellState: failed to read ${key}`, e);
    return fallback;
  }
};

const writeBool = (key: string, value: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    logger.warn(`useShellState: failed to write ${key}`, e);
  }
};

const readNumber = (key: string): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    logger.warn(`useShellState: failed to read ${key}`, e);
    return null;
  }
};

const writeNumber = (key: string, value: number) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    logger.warn(`useShellState: failed to write ${key}`, e);
  }
};

// Resolve initial state from storage. The model used to write SIDEBAR_COLLAPSED_WIDTH (72)
// into shell.sidebarWidth when collapsed; the new model keeps shell.sidebarWidth as the
// "free width" (>= SIDEBAR_MIN_WIDTH) and tracks collapse separately via STORAGE_KEY_SIDEBAR.
// So if we read a value <= SIDEBAR_COLLAPSED_WIDTH (or below the min), we treat the user
// as collapsed, lift the width to lastFreeWidth (or default), and mark them collapsed.
interface InitialState {
  width: number;
  othersCollapsed: boolean;
}
const resolveInitialState = (): InitialState => {
  const direct = readNumber(STORAGE_KEY_SIDEBAR_WIDTH);
  if (direct !== null) {
    if (direct <= SIDEBAR_COLLAPSED_WIDTH) {
      // Old format: width was being set to 72 to represent collapsed. Restore
      // the user's prior free width from STORAGE_KEY_LAST_FREE_WIDTH.
      const lastFree = readNumber(STORAGE_KEY_LAST_FREE_WIDTH);
      const restored = lastFree && lastFree >= SIDEBAR_MIN_WIDTH ? lastFree : DEFAULT_SIDEBAR_WIDTH;
      return { width: restored, othersCollapsed: true };
    }
    if (direct < SIDEBAR_MIN_WIDTH) {
      // Stale value between the snap threshold and the min — bring it to the floor.
      return { width: SIDEBAR_MIN_WIDTH, othersCollapsed: false };
    }
    return { width: direct, othersCollapsed: false };
  }
  // No persisted width — migrate from legacy boolean.
  const legacyCollapsed = readBool(STORAGE_KEY_SIDEBAR, DEFAULT_SIDEBAR_COLLAPSED);
  return { width: DEFAULT_SIDEBAR_WIDTH, othersCollapsed: legacyCollapsed };
};

const computeViewport = (width: number): ShellViewport => {
  if (width <= PHONE_MAX) return 'phone';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
};

const useViewport = (): ShellViewport => {
  const [viewport, setViewport] = useState<ShellViewport>(() =>
    typeof window === 'undefined' ? 'desktop' : computeViewport(window.innerWidth)
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewport(computeViewport(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return viewport;
};

const useShellStateInternal = (): ShellState => {
  // Initialize synchronously from localStorage so we don't paint the default
  // width and then jump to the saved one on first render.
  const initial = React.useMemo(() => resolveInitialState(), []);
  const [railCollapsedPref, setRailCollapsedState] = useState<boolean>(() =>
    readBool(STORAGE_KEY_RAIL, DEFAULT_RAIL_COLLAPSED)
  );
  const [sidebarWidthPref, setSidebarWidthState] = useState<number>(initial.width);
  const [othersCollapsedPref, setOthersCollapsedState] = useState<boolean>(initial.othersCollapsed);
  const [channelsFlooredPref, setChannelsFlooredState] = useState<boolean>(
    () => readBool(STORAGE_KEY_CHANNELS_FLOORED, false)
  );
  // Live drag width (not persisted). null = not dragging. AppShell sets this.
  const [dragWidth, setDragWidthState] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  // Element focused before the drawer opened — restored on close so keyboard
  // and AT users return to the hamburger that triggered the drawer.
  const drawerTriggerRef = React.useRef<HTMLElement | null>(null);
  const viewport = useViewport();

  // Persist the resolved initial state so subsequent loads find a clean shape.
  useEffect(() => {
    writeNumber(STORAGE_KEY_SIDEBAR_WIDTH, initial.width);
    writeBool(STORAGE_KEY_SIDEBAR, initial.othersCollapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-close the drawer when the viewport grows above phone.
  useEffect(() => {
    if (viewport !== 'phone' && drawerOpen) setDrawerOpen(false);
  }, [viewport, drawerOpen]);

  const setRailCollapsed = useCallback((v: boolean) => {
    setRailCollapsedState(v);
    writeBool(STORAGE_KEY_RAIL, v);
  }, []);

  const toggleRailCollapsed = useCallback(() => {
    setRailCollapsedState((prev) => {
      const next = !prev;
      writeBool(STORAGE_KEY_RAIL, next);
      return next;
    });
  }, []);

  // setSidebarWidth: update the shared "free width." This is what every mode
  // uses when not minimized. Caller is responsible for clamping to a sensible
  // range; this just persists.
  const setSidebarWidth = useCallback((px: number) => {
    setSidebarWidthState(px);
    writeNumber(STORAGE_KEY_SIDEBAR_WIDTH, px);
    writeNumber(STORAGE_KEY_LAST_FREE_WIDTH, px);
  }, []);

  const setOthersCollapsed = useCallback((v: boolean) => {
    setOthersCollapsedState(v);
    writeBool(STORAGE_KEY_SIDEBAR, v);
  }, []);

  // setChannelsFloored: toggle the channels-mode minimize flag. Setting it true
  // also collapses DM/Spaces (cross-mode "minimize" intent). Setting it false
  // does NOT auto-expand DM/Spaces — each "expand" action is local to its mode.
  // See docs/features/responsive-layout.md for the full rationale.
  const setDragWidth = useCallback((px: number | null) => {
    setDragWidthState(px);
  }, []);

  const setChannelsFloored = useCallback((v: boolean) => {
    setChannelsFlooredState(v);
    writeBool(STORAGE_KEY_CHANNELS_FLOORED, v);
    if (v) {
      setOthersCollapsedState(true);
      writeBool(STORAGE_KEY_SIDEBAR, true);
    }
  }, []);

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setOthersCollapsed(v);
  }, [setOthersCollapsed]);

  const toggleSidebarCollapsed = useCallback(() => {
    setOthersCollapsedState((prev) => {
      const next = !prev;
      writeBool(STORAGE_KEY_SIDEBAR, next);
      return next;
    });
  }, []);

  const openDrawer = useCallback(() => {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      drawerTriggerRef.current = active instanceof HTMLElement ? active : null;
    }
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    const trigger = drawerTriggerRef.current;
    drawerTriggerRef.current = null;
    if (trigger && typeof document !== 'undefined' && document.contains(trigger)) {
      // Defer to next frame so the drawer DOM is gone before we move focus,
      // otherwise the browser may scroll the closing drawer into view.
      requestAnimationFrame(() => trigger.focus());
    }
  }, []);

  // Effective state: tablet forces collapsed visual state regardless of
  // persisted desktop preference. Desktop honours the user prefs. Phone
  // collapses both into the drawer (handled by AppShell using `viewport`).
  const railCollapsed = viewport === 'desktop' ? railCollapsedPref : true;
  const sidebarCollapsed = viewport === 'desktop' ? othersCollapsedPref : true;
  const sidebarWidth = sidebarWidthPref;
  const channelsFloored = viewport === 'desktop' ? channelsFlooredPref : false;
  // Live collapsed flag for sidebar content. While dragging, content switches
  // to the expanded layout as soon as the sidebar is wider than the collapsed
  // strip — the user expects to see the expanded list the moment they start
  // pulling. At rest, this equals sidebarCollapsed. (On release, if the user
  // landed in the snap zone, sidebarCollapsed flips back to true and the
  // content returns to the collapsed strip.)
  const sidebarLiveCollapsed =
    dragWidth !== null ? dragWidth <= SIDEBAR_COLLAPSED_WIDTH : sidebarCollapsed;

  // Memoize so context consumers (NavRail, Sidebar, etc.) don't re-render on
  // every parent render. Setters/togglers are stable via useCallback([]); only
  // the value-typed fields need to be deps.
  return React.useMemo(
    () => ({
      railCollapsed,
      sidebarCollapsed,
      sidebarWidth,
      channelsFloored,
      dragWidth,
      sidebarLiveCollapsed,
      setRailCollapsed,
      toggleRailCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      setSidebarWidth,
      setChannelsFloored,
      setDragWidth,
      viewport,
      drawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [
      railCollapsed,
      sidebarCollapsed,
      sidebarWidth,
      channelsFloored,
      dragWidth,
      sidebarLiveCollapsed,
      viewport,
      drawerOpen,
      setRailCollapsed,
      toggleRailCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      setSidebarWidth,
      setChannelsFloored,
      setDragWidth,
      openDrawer,
      closeDrawer,
    ]
  );
};

const ShellStateContext = React.createContext<ShellState | null>(null);

/**
 * Provider that owns the single shell-state instance. Must wrap the AppShell
 * tree so NavRail, Sidebar, and any nested sidebar variant share the same
 * collapse state.
 */
export const ShellStateProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const value = useShellStateInternal();
  return React.createElement(ShellStateContext.Provider, { value }, children);
};

/** Read the shared shell state. Throws if used outside ShellStateProvider. */
export const useShellState = (): ShellState => {
  const ctx = React.useContext(ShellStateContext);
  if (!ctx) {
    throw new Error('useShellState must be used within ShellStateProvider');
  }
  return ctx;
};

/**
 * Non-throwing variant for components that may render outside the AppShell
 * tree (e.g. test harnesses, isolated previews). Returns null when no provider
 * is present so callers can degrade gracefully instead of crashing.
 */
export const useOptionalShellState = (): ShellState | null => {
  return React.useContext(ShellStateContext);
};
