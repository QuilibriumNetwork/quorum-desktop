import { ReactNode, CSSProperties } from 'react';

// Try to import ViewStyle, fallback to any if not available (web environment)
let ViewStyle: any;
try {
  ViewStyle = require('react-native').ViewStyle;
} catch {
  ViewStyle = any;
}

export interface FlexCenterProps {
  /**
   * Child elements
   */
  children: ReactNode;
  /**
   * Whether to center on both axes or single axis
   */
  direction?: 'both' | 'horizontal' | 'vertical';
  /**
   * Minimum height for full-screen centering
   */
  minHeight?: string | number;
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
