import { ReactNode, CSSProperties } from 'react';

// Try to import ViewStyle, fallback to any if not available (web environment)
let ViewStyle: any;
try {
  ViewStyle = require('react-native').ViewStyle;
} catch {
  ViewStyle = any;
}

export interface FlexBetweenProps {
  /**
   * Child elements
   */
  children: ReactNode;
  /**
   * Vertical alignment of items
   */
  align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
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
