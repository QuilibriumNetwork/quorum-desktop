export interface ResponsiveLayoutState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

// React Native always renders mobile-shaped layouts.
export const useResponsiveLayout = (): ResponsiveLayoutState => ({
  isMobile: true,
  isTablet: false,
  isDesktop: false,
});
