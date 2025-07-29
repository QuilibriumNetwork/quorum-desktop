import { ReactNode } from 'react';

export interface OverlayBackdropProps {
  /**
   * Whether the backdrop is visible
   */
  visible?: boolean;
  /**
   * Click handler for backdrop clicks
   */
  onBackdropClick?: () => void;
  /**
   * Custom z-index (defaults to z-[9999])
   */
  zIndex?: string;
  /**
   * Whether to apply blur effect
   */
  blur?: boolean;
  /**
   * Custom opacity (defaults to theme value)
   */
  opacity?: number;
  /**
   * Children to render on top of backdrop
   */
  children?: ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Whether clicking the backdrop should close (defaults to true)
   */
  closeOnBackdropClick?: boolean;
}
