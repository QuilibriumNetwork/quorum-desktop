import React from 'react';

export type ScrollContainerHeight = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto';
export type ScrollContainerBorderRadius = 'none' | 'sm' | 'md' | 'lg';

export interface BaseScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  height?: ScrollContainerHeight | string | number;
  maxHeight?: ScrollContainerHeight | string | number;
  showBorder?: boolean;
  borderRadius?: ScrollContainerBorderRadius;
  testId?: string;
}

// Web-specific props
export interface WebScrollContainerProps extends BaseScrollContainerProps {
  // ARIA attributes for accessibility
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  // Scroll event handlers
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  // Additional HTML attributes
  [key: string]: any;
}

// Native-specific props
export interface NativeScrollContainerProps extends BaseScrollContainerProps {
  // ScrollView specific props
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  bounces?: boolean;
  scrollEnabled?: boolean;
  // Accessibility
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityHint?: string;
  // Scroll event handlers
  onScroll?: (event: any) => void;
  onContentSizeChange?: (contentWidth: number, contentHeight: number) => void;
  // Additional React Native props
  [key: string]: any;
}

export type ScrollContainerProps = WebScrollContainerProps | NativeScrollContainerProps;