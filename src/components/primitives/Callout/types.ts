import { ReactNode } from 'react';

export type CalloutVariant = 'info' | 'success' | 'warning' | 'danger';
export type CalloutSize = 'xs' | 'sm' | 'md';
export type CalloutLayout = 'base' | 'minimal';

export interface CalloutProps {
  variant: CalloutVariant;
  children: ReactNode;
  size?: CalloutSize;
  layout?: CalloutLayout;
  dismissible?: boolean;
  autoClose?: number; // seconds
  onClose?: () => void;
  className?: string; // web only
  testID?: string;
}

export interface CalloutWebProps extends CalloutProps {
  className?: string;
}

export interface CalloutNativeProps extends CalloutProps {
  testID?: string;
}