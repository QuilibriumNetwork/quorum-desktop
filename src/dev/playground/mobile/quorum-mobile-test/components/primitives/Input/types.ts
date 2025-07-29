import React from 'react';

export interface InputProps {
  /** Input value */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Change handler - can be either string value or React event */
  onChange?:
    | ((value: string) => void)
    | ((e: React.ChangeEvent<HTMLInputElement>) => void);
  /** Input variant */
  variant?: 'filled' | 'bordered' | 'onboarding';
  /** Blur handler */
  onBlur?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Disable focus styling (border and shadow) */
  noFocusStyle?: boolean;
  /** Auto focus */
  autoFocus?: boolean;
  /** Additional CSS classes (web only) */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Test ID for automation */
  testID?: string;
  /** Accessibility label */
  accessibilityLabel?: string;
}

// React Native specific props
export interface InputNativeProps extends Omit<InputProps, 'className'> {
  /** Keyboard type for React Native */
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'numeric'
    | 'phone-pad'
    | 'number-pad'
    | 'decimal-pad'
    | 'url';
  /** Return key type */
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  /** Auto complete type */
  autoComplete?: 'off' | 'email' | 'name' | 'tel' | 'username' | 'password';
  /** Secure text entry for passwords */
  secureTextEntry?: boolean;
}
