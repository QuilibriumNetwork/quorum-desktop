import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { logger } from '@quilibrium/quorum-shared';

const STORAGE_KEY_RAIL = 'shell.railCollapsed';
const STORAGE_KEY_SIDEBAR = 'shell.sidebarCollapsed';

const DEFAULT_RAIL_COLLAPSED = true;
const DEFAULT_SIDEBAR_COLLAPSED = false;

// Viewport breakpoints — mirror $screen-md / $screen-lg in _variables.scss.
const PHONE_MAX = 767;
const TABLET_MAX = 1023;

export type ShellViewport = 'phone' | 'tablet' | 'desktop';

export interface ShellState {
  railCollapsed: boolean;
  sidebarCollapsed: boolean;
  setRailCollapsed: (v: boolean) => void;
  toggleRailCollapsed: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebarCollapsed: () => void;

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
  const [railCollapsedPref, setRailCollapsedState] = useState<boolean>(DEFAULT_RAIL_COLLAPSED);
  const [sidebarCollapsedPref, setSidebarCollapsedState] = useState<boolean>(DEFAULT_SIDEBAR_COLLAPSED);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const viewport = useViewport();

  useEffect(() => {
    setRailCollapsedState(readBool(STORAGE_KEY_RAIL, DEFAULT_RAIL_COLLAPSED));
    setSidebarCollapsedState(readBool(STORAGE_KEY_SIDEBAR, DEFAULT_SIDEBAR_COLLAPSED));
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

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsedState(v);
    writeBool(STORAGE_KEY_SIDEBAR, v);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      writeBool(STORAGE_KEY_SIDEBAR, next);
      return next;
    });
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Effective collapse state: tablet forces both rail and sidebar to collapsed
  // visual state regardless of the user's persisted desktop preference. Desktop
  // honours the user pref. Phone collapses both into the drawer (handled by
  // AppShell using the `viewport === 'phone'` flag, not these booleans).
  const railCollapsed = viewport === 'desktop' ? railCollapsedPref : true;
  const sidebarCollapsed = viewport === 'desktop' ? sidebarCollapsedPref : true;

  return {
    railCollapsed,
    sidebarCollapsed,
    setRailCollapsed,
    toggleRailCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    viewport,
    drawerOpen,
    openDrawer,
    closeDrawer,
  };
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
