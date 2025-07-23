import { ReactNode } from 'react';

export interface ModalContainerProps {
  /**
   * Whether the modal is visible
   */
  visible: boolean;
  /**
   * Handler called when the modal should close
   */
  onClose?: () => void;
  /**
   * Modal content
   */
  children: ReactNode;
  /**
   * Whether clicking outside should close the modal
   */
  closeOnBackdropClick?: boolean;
  /**
   * Whether to show the backdrop
   */
  showBackdrop?: boolean;
  /**
   * Whether to apply blur to backdrop
   */
  backdropBlur?: boolean;
  /**
   * Custom z-index
   */
  zIndex?: string;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  /**
   * Animation duration in ms
   */
  animationDuration?: number;
  /**
   * Whether to handle escape key
   */
  closeOnEscape?: boolean;
}