import { ReactNode, CSSProperties } from 'react';

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
   * Inline styles
   */
  style?: CSSProperties;
  /**
   * HTML attributes
   */
  [key: string]: any;
}