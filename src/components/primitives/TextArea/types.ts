import React from 'react';

export interface TextAreaProps {
  /** TextArea value */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Change handler - can be either string value or React event */
  onChange?:
    | ((value: string) => void)
    | ((e: React.ChangeEvent<HTMLTextAreaElement>) => void);
  /** TextArea variant */
  variant?: 'default' | 'onboarding';
  /** Blur handler */
  onBlur?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** Number of visible text lines */
  rows?: number;
  /** Minimum number of rows */
  minRows?: number;
  /** Maximum number of rows */
  maxRows?: number;
  /** Enable auto-resize functionality */
  autoResize?: boolean;
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
  /** Allow manual resize */
  resize?: boolean;
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
export interface TextAreaNativeProps
  extends Omit<TextAreaProps, 'className' | 'resize'> {
  /** Return key type */
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send' | 'default';
  /** Auto complete type */
  autoComplete?: 'off' | 'name' | 'username';
  /** Multiline (always true for TextArea) */
  multiline?: boolean;
}
