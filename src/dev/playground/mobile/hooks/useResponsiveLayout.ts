import { useCallback } from 'react';

export interface ResponsiveLayoutState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  leftSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  closeLeftSidebar: () => void;
  openLeftSidebar: () => void;
}

// React Native version - always returns mobile-like values
export const useResponsiveLayout = (): ResponsiveLayoutState => {
  // On native, we're always in a "mobile" layout
  const isMobile = true;
  const isTablet = false;
  const isDesktop = false;
  
  // Sidebar state is not applicable on native
  const leftSidebarOpen = false;
  
  const toggleLeftSidebar = useCallback(() => {
    // No-op on native
  }, []);
  
  const closeLeftSidebar = useCallback(() => {
    // No-op on native
  }, []);
  
  const openLeftSidebar = useCallback(() => {
    // No-op on native
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