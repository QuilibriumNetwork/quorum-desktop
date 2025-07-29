import { ReactNode } from 'react';

export interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
}

// Breakpoints matching the app's responsive design
export const BREAKPOINTS = {
  PHONE_MAX: 480, // Phone: <= 480px
  TABLET_MIN: 481, // Tablet starts at 481px
  DESKTOP_MIN: 1024, // Desktop starts at 1024px
} as const;

// NavMenu widths - corrected to match actual NavMenu.scss
export const NAV_WIDTHS = {
  DESKTOP_TABLET: 74, // Desktop & Tablet: 74px (matching NavMenu)
  PHONE: 50, // Phone: 50px
} as const;
