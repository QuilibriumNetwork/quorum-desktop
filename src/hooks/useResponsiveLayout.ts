import { useState, useEffect, useCallback } from 'react';

export interface ResponsiveLayoutState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  leftSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  closeLeftSidebar: () => void;
  openLeftSidebar: () => void;
  navMenuOpen: boolean;
  toggleNavMenu: () => void;
  closeNavMenu: () => void;
  openNavMenu: () => void;
}

const MOBILE_BREAKPOINT = 768; // Mobile devices only

export const useResponsiveLayout = (): ResponsiveLayoutState => {
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(true);

  const isMobile = screenWidth < MOBILE_BREAKPOINT;
  const isTablet = screenWidth >= MOBILE_BREAKPOINT && screenWidth < 1024;
  const isDesktop = screenWidth >= 1024;

  const updateScreenSize = useCallback(() => {
    const newWidth = window.innerWidth;
    setScreenWidth(newWidth);

    // Auto-close left sidebar when switching to desktop
    if (newWidth >= 1024 && leftSidebarOpen) {
      setLeftSidebarOpen(false);
    }

    // Auto-open NavMenu when switching to desktop
    if (newWidth >= 1024 && !navMenuOpen) {
      setNavMenuOpen(true);
    }
  }, [leftSidebarOpen, navMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, [updateScreenSize]);

  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarOpen((prev) => !prev);
  }, []);

  const closeLeftSidebar = useCallback(() => {
    setLeftSidebarOpen(false);
  }, []);

  const openLeftSidebar = useCallback(() => {
    setLeftSidebarOpen(true);
  }, []);

  const toggleNavMenu = useCallback(() => {
    setNavMenuOpen((prev) => !prev);
  }, []);

  const closeNavMenu = useCallback(() => {
    setNavMenuOpen(false);
  }, []);

  const openNavMenu = useCallback(() => {
    setNavMenuOpen(true);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop,
    leftSidebarOpen,
    toggleLeftSidebar,
    closeLeftSidebar,
    openLeftSidebar,
    navMenuOpen,
    toggleNavMenu,
    closeNavMenu,
    openNavMenu,
  };
};
