import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import clsx from 'clsx';
import { TextAreaProps } from './types';

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
  value,
  placeholder,
  onChange,
  variant = 'filled',
  onBlur,
  onFocus,
  onKeyDown,
  rows = 3,
  minRows = 1,
  maxRows = 10,
  autoResize = false,
  error = false,
  errorMessage,
  disabled = false,
  noFocusStyle = false,
  autoFocus = false,
  resize = false,
  className,
  style,
  testID,
  accessibilityLabel,
}, ref) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Forward the ref
  useImperativeHandle(ref, () => textAreaRef.current!);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Support both onChange signatures for backward compatibility
    if (onChange) {
      if (onChange.length === 1) {
        // If function expects 1 parameter, assume it wants the string value
        (onChange as (value: string) => void)(e.target.value);
      } else {
        // If function expects more parameters, assume it wants the full event
        (onChange as (e: React.ChangeEvent<HTMLTextAreaElement>) => void)(e);
      }
    }
  };

  // Auto-resize functionality
  useEffect(() => {
    if (autoResize && textAreaRef.current) {
      const textArea = textAreaRef.current;

      // Reset height to calculate new height
      textArea.style.height = 'auto';

      // Calculate the number of lines
      const lineHeight = 24; // Base line height in pixels
      const paddingHeight = 20; // Top + bottom padding
      const borderHeight = 2; // Top + bottom border

      const scrollHeight = textArea.scrollHeight;
      const calculatedRows = Math.max(
        minRows || 1,
        Math.min(
          maxRows || 10,
          Math.round((scrollHeight - paddingHeight - borderHeight) / lineHeight)
        )
      );

      const newHeight =
        calculatedRows * lineHeight + paddingHeight + borderHeight;
      textArea.style.height = `${newHeight}px`;
    }
  }, [value, autoResize, minRows, maxRows]);

  const classes = clsx(
    'textarea-container',
    variant === 'onboarding' ? 'onboarding-textarea' : 'quorum-textarea',
    variant === 'bordered' && 'quorum-textarea--bordered',
    error && 'error',
    noFocusStyle && 'no-focus-style',
    !resize && 'no-resize',
    className
  );

  return (
    <div className="textarea-wrapper">
      <textarea
        ref={textAreaRef}
        className={classes}
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        rows={autoResize ? undefined : rows}
        disabled={disabled}
        autoFocus={autoFocus}
        style={style}
        data-testid={testID}
        aria-label={accessibilityLabel}
      />
      {error && errorMessage && (
        <div className="textarea-error-message" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
});
