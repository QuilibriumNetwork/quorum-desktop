import React, { useState, useId } from 'react';
import clsx from 'clsx';
import { InputProps } from './types';

export const Input: React.FC<InputProps> = ({
  value,
  placeholder,
  onChange,
  onKeyDown,
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
  label,
  labelType = 'static',
  required = false,
  helperText,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = useId();
  const hasValue = value && value.length > 0;
  const showFloatingLabel = labelType === 'floating' && label;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Always pass the string value (most common case)
    // React 19 changed state setter function.length, making detection unreliable
    if (onChange) {
      (onChange as (value: string) => void)(e.target.value);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const inputClasses = clsx(
    variant === 'onboarding' ? 'onboarding-input' : 'quorum-input',
    variant === 'bordered' && 'quorum-input--bordered',
    variant === 'minimal' && 'quorum-input--minimal',
    error && 'error',
    noFocusStyle && 'no-focus-style',
    showFloatingLabel && 'quorum-input--with-floating-label',
    className
  );

  const containerClasses = clsx(
    'input-container',
    showFloatingLabel && 'input-container--floating',
    (isFocused || hasValue) && showFloatingLabel && 'input-container--active'
  );

  return (
    <div className={containerClasses}>
      {/* Static Label */}
      {label && labelType === 'static' && (
        <label htmlFor={inputId} className="input-label input-label--static">
          {label}
          {required && <span className="input-label__required">*</span>}
        </label>
      )}

      {/* Input wrapper for floating label */}
      <div className={showFloatingLabel ? 'input-wrapper' : undefined}>
        <input
          id={inputId}
          className={inputClasses}
          value={value}
          placeholder={
            showFloatingLabel
              ? isFocused || hasValue
                ? '' // No placeholder when floating label is active
                : label // Use label as placeholder when inactive
              : placeholder // Normal placeholder for non-floating inputs
          }
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          type={type}
          disabled={disabled}
          autoFocus={autoFocus}
          style={style}
          data-testid={testID}
          aria-label={accessibilityLabel || label}
          aria-required={required}
        />

        {/* Floating Label - only show when active (focused or has value) */}
        {showFloatingLabel && (isFocused || hasValue) && (
          <label
            htmlFor={inputId}
            className="input-label input-label--floating input-label--floating-active"
          >
            {label}
            {required && <span className="input-label__required">*</span>}
          </label>
        )}
      </div>

      {/* Helper text */}
      {helperText && !error && (
        <div className="input-helper-text">{helperText}</div>
      )}

      {/* Error message */}
      {error && errorMessage && (
        <div className="input-error-message" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
