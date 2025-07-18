import { useState, useEffect, useCallback } from 'react';

export interface ResponsiveLayoutState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  leftSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  closeLeftSidebar: () => void;
  openLeftSidebar: () => void;
}

const MOBILE_BREAKPOINT = 768; // Mobile devices only

export const useResponsiveLayout = (): ResponsiveLayoutState => {
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);

  const isMobile = screenWidth < MOBILE_BREAKPOINT;
  const isTablet = screenWidth >= MOBILE_BREAKPOINT && screenWidth < 1024;
  const isDesktop = screenWidth >= 1024;

  const updateScreenSize = useCallback(() => {
    const newWidth = window.innerWidth;
    setScreenWidth(newWidth);

    // Auto-close left sidebar when switching to desktop
    if (newWidth >= MOBILE_BREAKPOINT && leftSidebarOpen) {
      setLeftSidebarOpen(false);
    }
  }, [leftSidebarOpen]);

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

  return {
    isMobile,
    isTablet,
    isDesktop,
    leftSidebarOpen,
    toggleLeftSidebar,
    closeLeftSidebar,
    openLeftSidebar,
  };
};
