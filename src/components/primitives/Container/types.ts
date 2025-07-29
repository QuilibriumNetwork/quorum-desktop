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
}

// Native-specific props  
export interface NativeContainerProps extends BaseContainerProps {
  onPress?: () => void;
  accessible?: boolean;
  accessibilityLabel?: string;
}

export type ContainerProps = WebContainerProps | NativeContainerProps;