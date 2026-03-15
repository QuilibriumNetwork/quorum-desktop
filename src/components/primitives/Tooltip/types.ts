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

// Shared props between web and native
export interface BaseTooltipProps {
  content: ReactNode;
  children: ReactNode;
  place?: TooltipPlacement;
  showCloseButton?: boolean;
  maxWidth?: number;
  disabled?: boolean;
}

// Web-specific props
export interface TooltipWebProps extends BaseTooltipProps {
  id: string;
  noArrow?: boolean;
  className?: string;
  noBorder?: boolean;
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
  showOnTouch?: boolean;
  autoHideAfter?: number;
  clickable?: boolean;
  variant?: 'simple' | 'rich';
}

// Native-specific props
export interface TooltipNativeProps extends BaseTooltipProps {
  // Native-specific props can be added here
}

