import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { logger } from '@quilibrium/quorum-shared';

const STORAGE_KEY_RAIL = 'shell.railCollapsed';
const STORAGE_KEY_SIDEBAR = 'shell.sidebarCollapsed';
const STORAGE_KEY_SIDEBAR_WIDTH = 'shell.sidebarWidth';
const STORAGE_KEY_LAST_FREE_WIDTH = 'shell.lastFreeWidth';

const DEFAULT_RAIL_COLLAPSED = true;
const DEFAULT_SIDEBAR_COLLAPSED = false;

// Sidebar width bounds. SIDEBAR_COLLAPSED_WIDTH must match $sidebar-width-collapsed
// in _variables.scss; DEFAULT_SIDEBAR_WIDTH should match $sidebar-width.
export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_SNAP_THRESHOLD = 200;
const DEFAULT_SIDEBAR_WIDTH = 300;

// Viewport breakpoints — mirror $screen-md / $screen-lg in _variables.scss.
const PHONE_MAX = 767;
const TABLET_MAX = 1023;

export type ShellViewport = 'phone' | 'tablet' | 'desktop';

export interface ShellState {
  railCollapsed: boolean;
  /** Derived: true when sidebarWidth <= SIDEBAR_COLLAPSED_WIDTH. */
  sidebarCollapsed: boolean;
  /** Effective sidebar width in px. SIDEBAR_COLLAPSED_WIDTH (72) means collapsed strip. */
  sidebarWidth: number;
  setRailCollapsed: (v: boolean) => void;
  toggleRailCollapsed: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebarCollapsed: () => void;
  /** Set sidebar width directly (used by the drag handle). Caller clamps; this persists. */
  setSidebarWidth: (px: number) => void;

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

// Resolve initial sidebar width: prefer the new shell.sidebarWidth key; fall
// back to migrating the legacy shell.sidebarCollapsed boolean; default to
// DEFAULT_SIDEBAR_WIDTH. Legacy key is left in place for one release so a
// rollback still finds a valid value.
const resolveInitialSidebarWidth = (): number => {
  const direct = readNumber(STORAGE_KEY_SIDEBAR_WIDTH);
  if (direct !== null) return direct;
  const legacyCollapsed = readBool(STORAGE_KEY_SIDEBAR, DEFAULT_SIDEBAR_COLLAPSED);
  return legacyCollapsed ? SIDEBAR_COLLAPSED_WIDTH : DEFAULT_SIDEBAR_WIDTH;
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
  const [railCollapsedPref, setRailCollapsedState] = useState<boolean>(() =>
    readBool(STORAGE_KEY_RAIL, DEFAULT_RAIL_COLLAPSED)
  );
  const [sidebarWidthPref, setSidebarWidthState] = useState<number>(() => resolveInitialSidebarWidth());
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  // Element focused before the drawer opened — restored on close so keyboard
  // and AT users return to the hamburger that triggered the drawer.
  const drawerTriggerRef = React.useRef<HTMLElement | null>(null);
  const viewport = useViewport();

  // Persist the migrated value so the legacy boolean can be retired safely.
  useEffect(() => {
    if (readNumber(STORAGE_KEY_SIDEBAR_WIDTH) === null) {
      writeNumber(STORAGE_KEY_SIDEBAR_WIDTH, sidebarWidthPref);
    }
    // Run once on mount.
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

  const setSidebarWidth = useCallback((px: number) => {
    setSidebarWidthState(px);
    writeNumber(STORAGE_KEY_SIDEBAR_WIDTH, px);
    // Mirror to the legacy boolean so a rollback still picks the right state.
    writeBool(STORAGE_KEY_SIDEBAR, px <= SIDEBAR_COLLAPSED_WIDTH);
  }, []);

  const setSidebarCollapsed = useCallback((v: boolean) => {
    if (v) {
      // Going collapsed: stash the current width as lastFreeWidth so the next
      // expand restores it, then snap to the collapsed strip.
      const current = readNumber(STORAGE_KEY_SIDEBAR_WIDTH) ?? DEFAULT_SIDEBAR_WIDTH;
      if (current > SIDEBAR_COLLAPSED_WIDTH) {
        writeNumber(STORAGE_KEY_LAST_FREE_WIDTH, current);
      }
      setSidebarWidth(SIDEBAR_COLLAPSED_WIDTH);
    } else {
      const restored = readNumber(STORAGE_KEY_LAST_FREE_WIDTH) ?? DEFAULT_SIDEBAR_WIDTH;
      setSidebarWidth(restored);
    }
  }, [setSidebarWidth]);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarWidthState((prev) => {
      const isCollapsed = prev <= SIDEBAR_COLLAPSED_WIDTH;
      let next: number;
      if (isCollapsed) {
        next = readNumber(STORAGE_KEY_LAST_FREE_WIDTH) ?? DEFAULT_SIDEBAR_WIDTH;
      } else {
        writeNumber(STORAGE_KEY_LAST_FREE_WIDTH, prev);
        next = SIDEBAR_COLLAPSED_WIDTH;
      }
      writeNumber(STORAGE_KEY_SIDEBAR_WIDTH, next);
      writeBool(STORAGE_KEY_SIDEBAR, next <= SIDEBAR_COLLAPSED_WIDTH);
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

  // Effective collapse state: tablet forces sidebar to collapsed visual state
  // regardless of the user's persisted desktop preference. Desktop honours the
  // user pref. Phone collapses both into the drawer (handled by AppShell using
  // the `viewport === 'phone'` flag, not these booleans).
  const railCollapsed = viewport === 'desktop' ? railCollapsedPref : true;
  const sidebarWidth = viewport === 'desktop' ? sidebarWidthPref : SIDEBAR_COLLAPSED_WIDTH;
  const sidebarCollapsed = sidebarWidth <= SIDEBAR_COLLAPSED_WIDTH;

  // Memoize so context consumers (NavRail, Sidebar, etc.) don't re-render on
  // every parent render. Setters/togglers are stable via useCallback([]); only
  // the value-typed fields need to be deps.
  return React.useMemo(
    () => ({
      railCollapsed,
      sidebarCollapsed,
      sidebarWidth,
      setRailCollapsed,
      toggleRailCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      setSidebarWidth,
      viewport,
      drawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [
      railCollapsed,
      sidebarCollapsed,
      sidebarWidth,
      viewport,
      drawerOpen,
      setRailCollapsed,
      toggleRailCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      setSidebarWidth,
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
