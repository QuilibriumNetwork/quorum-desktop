import React from 'react';
import clsx from 'clsx';
import { InputProps } from './types';

export const Input: React.FC<InputProps> = ({
  value,
  placeholder,
  onChange,
  variant = 'filled',
  onBlur,
  onFocus,
  type = 'text',
  error = false,
  errorMessage,
  disabled = false,
  noFocusStyle = false,
  autoFocus = false,
  className,
  style,
  testID,
  accessibilityLabel,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Always pass the string value (most common case)
    // React 19 changed state setter function.length, making detection unreliable
    if (onChange) {
      (onChange as (value: string) => void)(e.target.value);
    }
  };

  const classes = clsx(
    variant === 'onboarding' ? 'onboarding-input' : 'quorum-input',
    variant === 'bordered' && 'quorum-input--bordered',
    error && 'error',
    noFocusStyle && 'no-focus-style',
    className
  );

  return (
    <div className="input-container">
      <input
        className={classes}
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        type={type}
        disabled={disabled}
        autoFocus={autoFocus}
        style={style}
        data-testid={testID}
        aria-label={accessibilityLabel}
      />
      {error && errorMessage && (
        <div className="input-error-message" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
