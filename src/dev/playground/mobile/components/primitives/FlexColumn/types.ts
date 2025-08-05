import React from 'react';

// Try to import ViewStyle, fallback to any if not available (web environment)
let ViewStyle: any;
try {
  ViewStyle = require('react-native').ViewStyle;
} catch {
  ViewStyle = any;
}

export interface FlexColumnProps {
  children: React.ReactNode;
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  wrap?: boolean;
  className?: string;
  style?: React.CSSProperties | ViewStyle | any;
  testId?: string;
  /**
   * HTML attributes
   */
  [key: string]: any;
}
