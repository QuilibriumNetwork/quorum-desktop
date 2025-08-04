import { ReactNode } from 'react';

export interface TooltipProps {
  id: string;
  content: string;
  children: ReactNode;
  place?:
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
  noArrow?: boolean;
  className?: string;
  highlighted?: boolean;
  showCloseButton?: boolean;
  maxWidth?: number;
  disabled?: boolean;
}

export interface TooltipWebProps extends TooltipProps {
  // Web-specific props can be added here
}

export interface TooltipNativeProps extends TooltipProps {
  // Native-specific props can be added here
}
