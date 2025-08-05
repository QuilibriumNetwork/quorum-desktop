import { ReactNode, CSSProperties } from 'react';

// Try to import ViewStyle, fallback to any if not available (web environment)
let ViewStyle: any;
try {
  ViewStyle = require('react-native').ViewStyle;
} catch {
  ViewStyle = any;
}

export interface FlexRowProps {
  /**
   * Child elements
   */
  children: ReactNode;
  /**
   * Horizontal alignment of items
   */
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  /**
   * Vertical alignment of items
   */
  align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  /**
   * Gap between items (responsive values supported)
   */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  /**
   * Whether items should wrap
   */
  wrap?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Inline styles - supports both web CSSProperties and React Native ViewStyle
   */
  style?: CSSProperties | ViewStyle | any;
  /**
   * HTML attributes
   */
  [key: string]: any;
}
