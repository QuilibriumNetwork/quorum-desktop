import { ReactNode, CSSProperties } from 'react';

// Try to import ViewStyle, fallback to any if not available (web environment)
let ViewStyle: any;
try {
  ViewStyle = require('react-native').ViewStyle;
} catch {
  ViewStyle = any;
}

export interface FlexProps {
  /**
   * Child elements
   */
  children: ReactNode;
  /**
   * Flex direction - 'row' (default) or 'column'
   */
  direction?: 'row' | 'column';
  /**
   * Main axis alignment (justify-content)
   */
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  /**
   * Cross axis alignment (align-items)
   * Default depends on direction: 'center' for row, 'stretch' for column
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
   * Additional CSS classes (web only)
   */
  className?: string;
  /**
   * Inline styles - supports both web CSSProperties and React Native ViewStyle
   */
  style?: CSSProperties | ViewStyle | any;
  /**
   * Test ID for testing
   */
  testId?: string;
  /**
   * HTML attributes passthrough
   */
  [key: string]: any;
}
