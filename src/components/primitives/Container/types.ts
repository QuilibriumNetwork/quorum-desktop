import React from 'react';

export interface BaseContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  width?: 'auto' | 'full' | 'fit' | string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | string;
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string | number;
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto' | string | number;
  backgroundColor?: string;
  testId?: string;
}

// Web-specific props
export interface WebContainerProps extends BaseContainerProps {
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void;
  // ARIA attributes for accessibility
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  // Additional HTML attributes
  [key: string]: any;
}

// Native-specific props
export interface NativeContainerProps extends BaseContainerProps {
  onPress?: () => void;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityHint?: string;
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    expanded?: boolean;
  };
  // Additional React Native props
  [key: string]: any;
}

export type ContainerProps = WebContainerProps | NativeContainerProps;
