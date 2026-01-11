import { ReactNode } from 'react';

// Shared placement type for all tooltip components
export type TooltipPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end';

export interface TooltipProps {
  id: string;
  content: ReactNode;
  children: ReactNode;
  place?: TooltipPlacement;
  noArrow?: boolean;
  className?: string;
  highlighted?: boolean;
  showCloseButton?: boolean;
  maxWidth?: number;
  disabled?: boolean;
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
  showOnTouch?: boolean;
  autoHideAfter?: number;
  clickable?: boolean;
  variant?: 'simple' | 'rich';
}

export interface TooltipWebProps extends TooltipProps {
  // Web-specific props can be added here
}

export interface TooltipNativeProps extends TooltipProps {
  // Native-specific props can be added here
}

