import React from 'react';
import clsx from 'clsx';
import { InputProps } from './types';

export const Input: React.FC<InputProps> = ({
  value,
  placeholder,
  onChange,
  variant = 'default',
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
    // Support both onChange signatures for backward compatibility
    if (onChange) {
      if (onChange.length === 1) {
        // If function expects 1 parameter, assume it wants the string value
        (onChange as (value: string) => void)(e.target.value);
      } else {
        // If function expects more parameters, assume it wants the full event
        (onChange as (e: React.ChangeEvent<HTMLInputElement>) => void)(e);
      }
    }
  };

  const classes = clsx(
    variant === 'onboarding' ? 'onboarding-input' : 'quorum-input',
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