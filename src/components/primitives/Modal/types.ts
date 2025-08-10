export interface BaseModalProps {
  title: string;
  visible: boolean;
  onClose: () => void;
  hideClose?: boolean;
  children: React.ReactNode;

  // Additional props for enhanced functionality
  size?: 'small' | 'medium' | 'large';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  noPadding?: boolean;
}

export interface WebModalProps extends BaseModalProps {
  // Web-specific props if needed
}

export interface NativeModalProps extends BaseModalProps {
  // Native-specific props
  swipeToClose?: boolean;
  swipeUpToOpen?: boolean;
  keyboardAvoidingView?: boolean;
}
